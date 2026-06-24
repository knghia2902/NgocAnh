<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useToast } from '@/composables/useToast';
import { dbContext } from '@/services/storage/DBContext';
import { supabase } from '@/supabase';

const { addToast } = useToast();

// Types
interface CSVRecord {
    id?: string;
    ticketNo: string;
    plateNumber: string;
    customer: string;
    weight1: number;
    weight2: number;
    weightNet: number; // in kg
    dateInStr: string;
    timeInStr: string;
    dateOutStr: string;
    timeOutStr: string;
    direction: string; // Xuat/Nhap
    cargoType: string;
    bargeName: string;
    driverName: string;
    notes: string;
}

interface CapacityConfig {
    code: number;
    tttp: number;      // Trọng tải cho phép (tấn)
    limit: number;     // Trọng lượng hàng cho phép (tấn)
}


interface SplitTrip {
    stt: number;
    timeStr: string;
    plateNumber: string;
    tttp: number;
    limit: number;
    ticketNo: string;
    cargoType: string;
    weightTons: number;
    notes: string;
    isNew?: boolean;
    // New fields to match "Ánh phân bổ bằng tay.csv"
    customer: string;
    weight1: number;
    weight2: number;
    weightNet: number;
    direction: string;
    bargeName: string;
    date1Obj: Date;
    date2Obj: Date;
}

// Local State
const csvFile = ref<File | null>(null);
const ticketFileInput = ref<HTMLInputElement | null>(null);

function triggerTicketFileInput() {
    ticketFileInput.value?.click();
}
const csvRecords = ref<CSVRecord[]>([]);
const existingTrips = ref<SplitTrip[]>([]);

const loadingCSV = ref(false);
const compiling = ref(false);

// Capacity configuration standards
const standardTTTPLimit = ref(10.0);

function getRandomLimit(tttp: number): number {
    const curbWeight = 1.5 + Math.random() * 1.0; // random curb weight between 1.5 and 2.5
    return Math.round((tttp - curbWeight) * 100) / 100;
}

const vehicleLimitCache = new Map<string, { tttp: number; limit: number }>();

// vehicleLimitCache is maintained locally

// vehicleLimitCache is maintained locally

// Algorithmic parameters
const distStrategy = ref<'even' | 'max' | 'random'>('random');
const spacingStrategy = ref<'even' | 'forward' | 'backward'>('even');

// Bounded random split algorithm
function splitWeightRandomly(weightTons: number, numTrips: number, tripLimit: number): number[] {
    const weights: number[] = [];
    let remaining = weightTons;
    
    // We want each trip to be between minWeight and maxWeight (tripLimit)
    const maxWeight = tripLimit;
    const average = weightTons / numTrips;
    
    // Determine a dynamic reasonable minimum weight.
    let minWeight = Math.max(2.0, Math.min(average * 0.75, maxWeight * 0.5));
    if (minWeight > maxWeight) {
        minWeight = maxWeight * 0.5;
    }
    
    for (let i = 0; i < numTrips - 1; i++) {
        const remTrips = numTrips - 1 - i;
        
        // Mathematical limits to guarantee later trips can also be within limits:
        const lowerBound = Math.max(minWeight, remaining - remTrips * maxWeight);
        const upperBound = Math.min(maxWeight, remaining - remTrips * minWeight);
        
        let weight = average;
        if (upperBound >= lowerBound) {
            // Triangular distribution (sum of 2 randoms) to favor center/average values
            const r = (Math.random() + Math.random()) / 2;
            weight = lowerBound + r * (upperBound - lowerBound);
        }
        
        const roundedWeight = Math.round(weight * 100) / 100;
        weights.push(roundedWeight);
        remaining = Math.round((remaining - roundedWeight) * 100) / 100;
    }
    
    // Last trip gets the exact remaining weight
    weights.push(Math.round(remaining * 100) / 100);
    return weights;
}
const timeIntervalMinutes = ref(90);

watch(standardTTTPLimit, async (newVal) => {
    vehicleLimitCache.clear();
    try {
        await dbContext.set('allocator_standard_limit', newVal);
    } catch (e) {
        console.error('Lỗi khi lưu hạn mức tiêu chuẩn vào IndexedDB:', e);
    }
}, { immediate: true });

watch(csvRecords, () => {
    vehicleLimitCache.clear();
});

watch(distStrategy, async (newVal) => {
    try {
        await dbContext.set('allocator_dist_strategy', newVal);
    } catch (e) {}
});

watch(spacingStrategy, async (newVal) => {
    try {
        await dbContext.set('allocator_spacing_strategy', newVal);
    } catch (e) {}
});

watch(timeIntervalMinutes, async (newVal) => {
    try {
        await dbContext.set('allocator_time_interval', newVal);
    } catch (e) {}
});

// Auto-save settings on change

// Pagination
const currentPage = ref(1);
const itemsPerPage = 10;

// Search filter for preview
const searchQuery = ref('');

// Parse CSV text safely
function parseCSVText(text: string): CSVRecord[] {
    const lines = text.split(/\r?\n/).filter(line => line.trim() !== '');
    if (lines.length === 0) return [];
    
    const parseLine = (line: string): string[] => {
        const result = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(cur.trim());
                cur = '';
            } else {
                cur += char;
            }
        }
        result.push(cur.trim());
        return result;
    };
    
    // Parse headers and strip BOM if any
    const headers = parseLine(lines[0] || '').map(h => h.replace(/^\uFEFF/, '').trim());
    
    // Map headers to indexes
    const idxTicket = headers.findIndex(h => h.toLowerCase().includes('phieu'));
    const idxPlate = headers.findIndex(h => h.toLowerCase().includes('xe'));
    const idxCustomer = headers.findIndex(h => h.toLowerCase().includes('khach'));
    const idxWeight1 = headers.findIndex(h => h.toLowerCase().includes('lan 1'));
    const idxWeight2 = headers.findIndex(h => h.toLowerCase().includes('lan 2'));
    const idxWeightNet = headers.findIndex(h => h.toLowerCase().includes('kl') && h.toLowerCase().includes('hang'));
    const idxDate1 = headers.findIndex(h => h.toLowerCase().includes('ngay can lan 1'));
    const idxTime1 = headers.findIndex(h => h.toLowerCase().includes('gio can lan 1'));
    const idxDate2 = headers.findIndex(h => h.toLowerCase().includes('ngay can lan 2'));
    const idxTime2 = headers.findIndex(h => h.toLowerCase().includes('gio can lan 2'));
    const idxDirection = headers.findIndex(h => h.toLowerCase().includes('xuat/nhap'));
    const idxCargoType = headers.findIndex(h => h.toLowerCase().includes('loai hang'));
    const idxBarge = headers.findIndex(h => h.toLowerCase().includes('salan') || h.toLowerCase().includes('sa lan'));
    const idxDriver = headers.findIndex(h => h.toLowerCase().includes('tai xe') || h.toLowerCase().includes('tài xế'));
    const idxNotes = headers.findIndex(h => h.toLowerCase().includes('ghi chu') || h.toLowerCase().includes('ghi chú'));

    const records: CSVRecord[] = [];
    for (let i = 1; i < lines.length; i++) {
        const parts = parseLine(lines[i] || '');
        if (parts.length < Math.max(idxTicket, idxPlate, idxWeightNet)) continue;
        
        const plate = parts[idxPlate] || '';
        if (!plate) continue;

        records.push({
            id: 'ticket_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9),
            ticketNo: parts[idxTicket] || '',
            plateNumber: plate,
            customer: (idxCustomer !== -1 ? parts[idxCustomer] : '') || '',
            weight1: idxWeight1 !== -1 ? parseFloat(parts[idxWeight1] || '0') || 0 : 0,
            weight2: idxWeight2 !== -1 ? parseFloat(parts[idxWeight2] || '0') || 0 : 0,
            weightNet: idxWeightNet !== -1 ? parseFloat(parts[idxWeightNet] || '0') || 0 : 0,
            dateInStr: (idxDate1 !== -1 ? parts[idxDate1] : '') || '',
            timeInStr: (idxTime1 !== -1 ? parts[idxTime1] : '') || '',
            dateOutStr: (idxDate2 !== -1 ? parts[idxDate2] : '') || '',
            timeOutStr: (idxTime2 !== -1 ? parts[idxTime2] : '') || '',
            direction: (idxDirection !== -1 ? parts[idxDirection] : '') || '',
            cargoType: (idxCargoType !== -1 ? parts[idxCargoType] : '') || '',
            bargeName: (idxBarge !== -1 ? parts[idxBarge] : '') || '',
            driverName: (idxDriver !== -1 ? parts[idxDriver] : '') || '',
            notes: (idxNotes !== -1 ? parts[idxNotes] : '') || ''
        });
    }
    return records;
}

// Normalize plate numbers to compare easily
function normalizePlate(plate: string): string {
    return String(plate).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// Format plate numbers to standard display: e.g. "61H-16907"
function formatPlate(plate: string): string {
    let clean = plate.trim().toUpperCase().replace(/\s+/g, '');
    if (clean.includes('-')) {
        return clean;
    }
    const match = clean.match(/^([0-9]{2}[A-Z]{1,2})([0-9]+)$/);
    if (match) {
        return match[1] + '-' + match[2];
    }
    return clean;
}

// Convert DD/MM/YYYY and HH:mm:ss strings to Date object
function parseDateTime(dateStr: string, timeStr: string): Date {
    try {
        if (!dateStr) return new Date();
        
        // If dateStr contains both date and time
        if (dateStr.includes(' ') && !timeStr) {
            const parts = dateStr.split(' ');
            dateStr = parts[0] || '';
            timeStr = parts[1] || '';
        }
        
        // Replace dashes with slashes
        const normalizedDate = dateStr.replace(/-/g, '/');
        const dParts = normalizedDate.split('/');
        
        let day = parseInt(dParts[0] || '0', 10);
        let month = parseInt(dParts[1] || '0', 10) - 1; // 0-indexed
        let year = parseInt(dParts[2] || '0', 10);
        
        if (year < 100) {
            year += 2000;
        }
        
        let hour = 0;
        let minute = 0;
        let second = 0;
        
        if (timeStr) {
            const tParts = timeStr.split(':');
            hour = parseInt(tParts[0] || '0', 10);
            minute = parseInt(tParts[1] || '0', 10);
            second = parseInt(tParts[2] || '0', 10);
        }
        
        return new Date(year, month, day, hour, minute, second);
    } catch (e) {
        return new Date();
    }
}

// Format Date object to "HH:mm:ss\nDD/MM/YYYY"
function formatExcelDateTime(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const hh = pad(date.getHours());
    const mm = pad(date.getMinutes());
    const ss = pad(date.getSeconds());
    const DD = pad(date.getDate());
    const MM = pad(date.getMonth() + 1);
    const YYYY = date.getFullYear();
    return `${hh}:${mm}:${ss}\n${DD}/${MM}/${YYYY}`;
}

function formatExcelDate(d: Date): string {
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}

function formatExcelTime(d: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getHours()}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function formatExcelDateTimeCombined(d: Date): string {
    const hour24 = d.getHours();
    const ampm = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 % 12 || 12;
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${hour12}:${min} ${ampm}`;
}

// Handle Ticket Import (accepts CSV and Excel)
async function handleTicketImport(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;
    
    csvFile.value = file;
    const ext = file.name.split('.').pop()?.toLowerCase();
    
    if (ext === 'csv') {
        loadingCSV.value = true;
        try {
            const text = await file.text();
            const newRecords = parseCSVText(text);
            mergeTickets(newRecords);
            addToast(`Đã tải lên và import thêm ${newRecords.length} phiếu cân từ tệp CSV`, 'success');
        } catch (error) {
            console.error(error);
            addToast('Lỗi khi đọc file CSV!', 'error');
        } finally {
            loadingCSV.value = false;
        }
    } else if (ext === 'xlsx') {
        await handleTicketExcelUpload(file);
    } else {
        addToast('Định dạng tệp không được hỗ trợ (chỉ hỗ trợ .csv, .xlsx)', 'error');
    }
}

// Handle Excel tickets file upload
async function handleTicketExcelUpload(file: File) {
    loadingCSV.value = true;
    try {
        const ExcelJS = await import('exceljs');
        const workbook = new ExcelJS.Workbook();
        const arrayBuffer = await file.arrayBuffer();
        await workbook.xlsx.load(arrayBuffer);
        
        const sheet = workbook.worksheets[0];
        if (!sheet) {
            addToast('Không tìm thấy sheet nào trong file Excel!', 'error');
            return;
        }
        
        let headerRowIdx = -1;
        let headers: string[] = [];
        
        for (let r = 1; r <= Math.min(10, sheet.rowCount); r++) {
            const row = sheet.getRow(r);
            const rowValues = [];
            let hasKeywords = false;
            for (let c = 1; c <= Math.min(25, row.cellCount); c++) {
                const val = String(row.getCell(c).value || '').trim();
                rowValues.push(val);
                if (
                    val.toLowerCase().includes('phieu') || 
                    val.toLowerCase().includes('xe') || 
                    (val.toLowerCase().includes('kl') && val.toLowerCase().includes('hang'))
                ) {
                    hasKeywords = true;
                }
            }
            if (hasKeywords) {
                headerRowIdx = r;
                headers = rowValues;
                break;
            }
        }
        
        if (headerRowIdx === -1) {
            addToast('Không tìm thấy dòng tiêu đề phù hợp trong file Excel!', 'info');
            return;
        }
        
        // Map headers to column indexes
        const idxTicket = headers.findIndex(h => h.toLowerCase().includes('phieu'));
        const idxPlate = headers.findIndex(h => h.toLowerCase().includes('xe'));
        const idxCustomer = headers.findIndex(h => h.toLowerCase().includes('khach'));
        const idxWeight1 = headers.findIndex(h => h.toLowerCase().includes('lan 1'));
        const idxWeight2 = headers.findIndex(h => h.toLowerCase().includes('lan 2'));
        const idxWeightNet = headers.findIndex(h => h.toLowerCase().includes('kl') && h.toLowerCase().includes('hang'));
        const idxDate1 = headers.findIndex(h => h.toLowerCase().includes('ngay can lan 1') || h.toLowerCase().includes('ngày cân lần 1') || h.toLowerCase() === 'ngay can 1' || h.toLowerCase() === 'ngày cân 1');
        const idxTime1 = headers.findIndex(h => h.toLowerCase().includes('gio can lan 1') || h.toLowerCase().includes('giờ cân lần 1') || h.toLowerCase() === 'gio can 1' || h.toLowerCase() === 'giờ cân 1');
        const idxDate2 = headers.findIndex(h => h.toLowerCase().includes('ngay can lan 2') || h.toLowerCase().includes('ngày cân lần 2') || h.toLowerCase() === 'ngay can 2' || h.toLowerCase() === 'ngày cân 2');
        const idxTime2 = headers.findIndex(h => h.toLowerCase().includes('gio can lan 2') || h.toLowerCase().includes('giờ cân lần 2') || h.toLowerCase() === 'gio can 2' || h.toLowerCase() === 'giờ cân 2');
        const idxDirection = headers.findIndex(h => h.toLowerCase().includes('xuat/nhap') || h.toLowerCase().includes('xuất/nhập'));
        const idxCargoType = headers.findIndex(h => h.toLowerCase().includes('loai hang') || h.toLowerCase().includes('loại hàng'));
        const idxBarge = headers.findIndex(h => h.toLowerCase().includes('salan') || h.toLowerCase().includes('sa lan'));
        const idxDriver = headers.findIndex(h => h.toLowerCase().includes('tai xe') || h.toLowerCase().includes('tài xế'));
        const idxNotes = headers.findIndex(h => h.toLowerCase().includes('ghi chu') || h.toLowerCase().includes('ghi chú'));
        
        const newRecords: CSVRecord[] = [];
        
        for (let r = headerRowIdx + 1; r <= sheet.rowCount; r++) {
            const row = sheet.getRow(r);
            const getVal = (idx: number) => {
                if (idx === -1) return '';
                const cell = row.getCell(idx + 1);
                if (cell.value && typeof cell.value === 'object') {
                    if ((cell.value as any).result !== undefined) {
                        return String((cell.value as any).result);
                    }
                    if (cell.value instanceof Date) {
                        return cell.value.toLocaleDateString('vi-VN');
                    }
                }
                return cell.value !== null && cell.value !== undefined ? String(cell.value) : '';
            };
            
            const plate = getVal(idxPlate);
            if (!plate) continue;
            
            newRecords.push({
                ticketNo: getVal(idxTicket),
                plateNumber: plate,
                customer: getVal(idxCustomer),
                weight1: parseFloat(getVal(idxWeight1)) || 0,
                weight2: parseFloat(getVal(idxWeight2)) || 0,
                weightNet: parseFloat(getVal(idxWeightNet)) || 0,
                dateInStr: getVal(idxDate1),
                timeInStr: getVal(idxTime1),
                dateOutStr: getVal(idxDate2),
                timeOutStr: getVal(idxTime2),
                direction: getVal(idxDirection),
                cargoType: getVal(idxCargoType),
                bargeName: getVal(idxBarge),
                driverName: getVal(idxDriver),
                notes: getVal(idxNotes)
            });
        }
        
        if (newRecords.length === 0) {
            addToast('Không tìm thấy dữ liệu phiếu cân hợp lệ nào trong file Excel!', 'info');
            return;
        }
        
        mergeTickets(newRecords);
        addToast(`Đã import thêm ${newRecords.length} phiếu cân từ tệp Excel`, 'success');
        
    } catch (e) {
        console.error(e);
        addToast('Lỗi khi phân tích tệp Excel phiếu cân!', 'error');
    } finally {
        loadingCSV.value = false;
    }
}

// Smart merge tickets to prevent duplicates
function mergeTickets(newRecords: CSVRecord[]) {
    const currentList = [...csvRecords.value];
    
    newRecords.forEach(rec => {
        const matchIdx = rec.ticketNo 
            ? currentList.findIndex(x => x.ticketNo === rec.ticketNo)
            : -1;
            
        const id = rec.id || 'ticket_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        const mergedRec = { ...rec, id };
        
        if (matchIdx !== -1) {
            currentList[matchIdx] = mergedRec;
        } else {
            currentList.push(mergedRec);
        }
    });
    
    csvRecords.value = currentList;
    saveTicketsToSupabase();
}

// CRUD State & Functions
const showTicketDialog = ref(false);
const editingTicket = ref<CSVRecord | null>(null);

const dialogTicket = ref<CSVRecord>({
    id: '',
    ticketNo: '',
    plateNumber: '',
    customer: '',
    weight1: 0,
    weight2: 0,
    weightNet: 0,
    dateInStr: '',
    timeInStr: '',
    dateOutStr: '',
    timeOutStr: '',
    direction: 'XUẤT KHẨU',
    cargoType: '',
    bargeName: '',
    driverName: '',
    notes: ''
});

function openAddTicketDialog() {
    editingTicket.value = null;
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const dateStr = `${pad(now.getDate())}/${pad(now.getMonth() + 1)}/${now.getFullYear()}`;
    const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
    
    dialogTicket.value = {
        id: '',
        ticketNo: 'PC' + Date.now().toString().slice(-6),
        plateNumber: '',
        customer: '',
        weight1: 0,
        weight2: 0,
        weightNet: 0,
        dateInStr: dateStr,
        timeInStr: timeStr,
        dateOutStr: dateStr,
        timeOutStr: timeStr,
        direction: 'XUẤT KHẨU',
        cargoType: 'Viên Nén Gỗ',
        bargeName: '',
        driverName: '',
        notes: ''
    };
    showTicketDialog.value = true;
}

function openEditTicketDialog(ticket: CSVRecord) {
    editingTicket.value = ticket;
    dialogTicket.value = { ...ticket };
    showTicketDialog.value = true;
}

function saveTicket() {
    if (!dialogTicket.value.plateNumber.trim()) {
        addToast('Vui lòng nhập biển số xe!', 'info');
        return;
    }
    
    if (dialogTicket.value.weightNet === 0 && dialogTicket.value.weight1 > 0 && dialogTicket.value.weight2 > 0) {
        dialogTicket.value.weightNet = Math.abs(dialogTicket.value.weight1 - dialogTicket.value.weight2);
    }
    
    if (dialogTicket.value.weightNet <= 0) {
        addToast('Vui lòng nhập khối lượng hàng hợp lệ!', 'info');
        return;
    }

    const currentList = [...csvRecords.value];
    
    if (editingTicket.value && editingTicket.value.id) {
        const idx = currentList.findIndex(t => t.id === editingTicket.value!.id);
        if (idx !== -1) {
            currentList[idx] = { ...dialogTicket.value };
            addToast('Đã cập nhật phiếu cân thành công!', 'success');
        }
    } else {
        const id = 'ticket_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        currentList.push({
            ...dialogTicket.value,
            id
        });
        addToast('Đã thêm phiếu cân mới thành công!', 'success');
    }
    
    csvRecords.value = currentList;
    showTicketDialog.value = false;
    saveTicketsToSupabase();
}

function deleteTicket(ticket: CSVRecord) {
    if (confirm(`Bạn có chắc chắn muốn xóa phiếu cân ${ticket.ticketNo || ticket.plateNumber} không?`)) {
        csvRecords.value = csvRecords.value.filter(t => t.id !== ticket.id);
        addToast('Đã xóa phiếu cân!', 'info');
        saveTicketsToSupabase();
    }
}

// Clear all tickets
function clearAllTickets() {
    if (confirm('Bạn có chắc chắn muốn xóa toàn bộ danh sách phiếu cân hiện tại không?')) {
        csvRecords.value = [];
        csvFile.value = null;
        addToast('Đã xóa sạch danh sách phiếu cân!', 'info');
        saveTicketsToSupabase();
    }
}

// Tabs and filters for Source tickets
const activeDataTab = ref<'source' | 'generated' | 'template'>('source');
const sourceCurrentPage = ref(1);
const sourceSearchQuery = ref('');

const filteredSourceTickets = computed(() => {
    if (!sourceSearchQuery.value.trim()) return csvRecords.value;
    const q = sourceSearchQuery.value.toLowerCase();
    return csvRecords.value.filter(t => 
        t.plateNumber.toLowerCase().includes(q) || 
        t.ticketNo.toLowerCase().includes(q) || 
        t.cargoType.toLowerCase().includes(q)
    );
});

const pagedSourceTickets = computed(() => {
    const start = (sourceCurrentPage.value - 1) * itemsPerPage;
    return filteredSourceTickets.value.slice(start, start + itemsPerPage);
});

const sourceTotalPages = computed(() => {
    return Math.ceil(filteredSourceTickets.value.length / itemsPerPage);
});

watch(sourceSearchQuery, () => {
    sourceCurrentPage.value = 1;
});

const syncStatus = ref<'synced' | 'saving' | 'error'>('synced');

async function loadTicketsFromSupabase() {
    try {
        const { data, error } = await supabase
            .from('content')
            .select('settings')
            .eq('id', 'main')
            .single();
        if (error) throw error;
        
        if (data?.settings) {
            const remoteTickets = data.settings.allocator_tickets;
            if (Array.isArray(remoteTickets)) {
                // Merge local and remote tickets to prevent data loss
                const merged = [...csvRecords.value];
                let changed = false;
                
                remoteTickets.forEach((r: any) => {
                    const exists = merged.some(l => l.id === r.id || (l.ticketNo && l.ticketNo === r.ticketNo));
                    if (!exists) {
                        merged.push(r);
                        changed = true;
                    }
                });
                
                if (changed || csvRecords.value.length < remoteTickets.length) {
                    csvRecords.value = merged;
                    await dbContext.set('allocator_tickets', merged);
                    await saveTicketsToSupabase();
                } else if (csvRecords.value.length > remoteTickets.length) {
                    // Local has more tickets, upload them to Supabase
                    await saveTicketsToSupabase();
                } else {
                    syncStatus.value = 'synced';
                }
            } else {
                // If remote has no tickets but local has, push local to remote
                if (csvRecords.value.length > 0) {
                    await saveTicketsToSupabase();
                } else {
                    syncStatus.value = 'synced';
                }
            }
        }
    } catch (e) {
        console.warn('Lỗi khi tải danh sách phiếu cân từ Supabase:', e);
        syncStatus.value = 'error';
    }
}

async function saveTicketsToSupabase() {
    syncStatus.value = 'saving';
    try {
        const { data: current, error: fetchError } = await supabase
            .from('content')
            .select('settings')
            .eq('id', 'main')
            .single();
        
        if (fetchError) throw fetchError;
        
        const currentSettings = current?.settings || {};
        const updatedSettings = {
            ...currentSettings,
            allocator_tickets: csvRecords.value
        };

        const { error: updateError } = await supabase
            .from('content')
            .update({ settings: updatedSettings })
            .eq('id', 'main');

        if (updateError) throw updateError;
        
        syncStatus.value = 'synced';
    } catch (e) {
        console.error('Lỗi khi lưu danh sách phiếu cân lên Supabase:', e);
        syncStatus.value = 'error';
        addToast('Lỗi đồng bộ dữ liệu đám mây!', 'error');
    }
}

// Mounted hook to load settings and tickets from IndexedDB
onMounted(async () => {
    try {
        const savedLimit = await dbContext.get<number>('allocator_standard_limit');
        if (savedLimit !== undefined && savedLimit !== null) {
            standardTTTPLimit.value = savedLimit;
        }

        const savedDist = await dbContext.get<any>('allocator_dist_strategy');
        if (savedDist) distStrategy.value = savedDist;

        const savedSpacing = await dbContext.get<any>('allocator_spacing_strategy');
        if (savedSpacing) spacingStrategy.value = savedSpacing;

        const savedInterval = await dbContext.get<number>('allocator_time_interval');
        if (savedInterval) timeIntervalMinutes.value = savedInterval;

        const saved = await dbContext.get<CSVRecord[]>('allocator_tickets');
        if (saved && Array.isArray(saved)) {
            csvRecords.value = saved;
        }

        // Đồng bộ dữ liệu từ đám mây
        await loadTicketsFromSupabase();
    } catch (e) {
        console.error('Lỗi khi nạp dữ liệu từ IndexedDB:', e);
    }
});

// Auto-save tickets on change
watch(csvRecords, async (newVal) => {
    try {
        await dbContext.set('allocator_tickets', newVal);
    } catch (e) {
        console.error('Lỗi khi lưu danh sách phiếu cân vào IndexedDB:', e);
    }
}, { deep: true });

// Get the capacity info for a vehicle (uses standard limit)
function getVehicleCapacity(plate: string): CapacityConfig {
    const norm = normalizePlate(plate);
    const fallbackTTTP = standardTTTPLimit.value;
    
    // Check cache first
    if (vehicleLimitCache.has(norm)) {
        const cached = vehicleLimitCache.get(norm)!;
        return { code: 0, tttp: cached.tttp, limit: cached.limit };
    }
    
    // Fallback default
    const limit = getRandomLimit(fallbackTTTP);
    vehicleLimitCache.set(norm, { tttp: fallbackTTTP, limit });
    return { code: 0, tttp: fallbackTTTP, limit };
}

// Computed: Total CSV Weight in tons
const totalCsvWeightTons = computed(() => {
    const kg = csvRecords.value.reduce((acc, r) => acc + r.weightNet, 0);
    return kg / 1000;
});

// Computed: Next STT start number
const nextSTT = computed(() => {
    if (existingTrips.value.length > 0) {
        const lastTrip = existingTrips.value[existingTrips.value.length - 1];
        return (lastTrip?.stt || 0) + 1;
    }
    return 1;
});

// Computed: Generated split trips based on current settings
const generatedTrips = computed<SplitTrip[]>(() => {
    if (csvRecords.value.length === 0) return [];
    
    interface TempTrip {
        plateNumber: string;
        tttp: number;
        limit: number;
        ticketNo: string;
        cargoType: string;
        weightTons: number;
        notes: string;
        isNew?: boolean;
        dateObj: Date;
        // New columns to match "Ánh phân bổ bằng tay.csv"
        customer: string;
        weight1: number;
        weight2: number;
        weightNet: number;
        durationMs: number;
        direction: string;
        bargeName: string;
    }
    
    const tempTrips: TempTrip[] = [];
    
    csvRecords.value.forEach(record => {
        const capacity = getVehicleCapacity(record.plateNumber);
        const weightTons = record.weightNet / 1000;
        
        // Calculate trips count
        const tripLimit = capacity.limit;
        const numTrips = Math.ceil(weightTons / tripLimit);
        
        // Weight split strategy
        let weights: number[] = [];
        if (distStrategy.value === 'random') {
            weights = splitWeightRandomly(weightTons, numTrips, tripLimit);
        } else if (distStrategy.value === 'even') {
            const baseWeight = Math.round((weightTons / numTrips) * 100) / 100;
            let sum = 0;
            for (let j = 0; j < numTrips - 1; j++) {
                weights.push(baseWeight);
                sum += baseWeight;
            }
            // Adjust last trip weight to match exactly
            const lastWeight = Math.round((weightTons - sum) * 100) / 100;
            weights.push(lastWeight);
        } else {
            // Max Capacity strategy
            let remaining = weightTons;
            for (let j = 0; j < numTrips - 1; j++) {
                weights.push(tripLimit);
                remaining -= tripLimit;
            }
            weights.push(Math.round(remaining * 100) / 100);
        }
        
        // Spacing Dates/Times
        const dateIn = parseDateTime(record.dateInStr, record.timeInStr);
        const dateOut = parseDateTime(record.dateOutStr, record.timeOutStr);
        const durationMs = dateOut.getTime() - dateIn.getTime();
        
        for (let j = 0; j < numTrips; j++) {
            let tripTime = new Date();
            
            if (spacingStrategy.value === 'even') {
                if (numTrips === 1) {
                    tripTime = dateOut;
                } else {
                    const fraction = (j + 1) / numTrips;
                    tripTime = new Date(dateIn.getTime() + fraction * durationMs);
                }
            } else if (spacingStrategy.value === 'forward') {
                // Step forward from In time
                tripTime = new Date(dateIn.getTime() + (j + 1) * timeIntervalMinutes.value * 60 * 1000);
            } else {
                // Step backward from Out time
                tripTime = new Date(dateOut.getTime() - (numTrips - 1 - j) * timeIntervalMinutes.value * 60 * 1000);
            }
            
            // Add a small random jitter (+/- 10 minutes) to tripTime to make it look more natural
            const jitterMs = (Math.random() * 20 - 10) * 60 * 1000;
            tripTime = new Date(tripTime.getTime() + jitterMs);
            
            const tripWeightTons = weights[j] || 0;
            const tripWeightNet = Math.round(tripWeightTons * 1000);
            
            // Xác xe (tare weight) được tính bằng Trọng tải cho phép (TTTP) - Hạn mức hàng (tính theo kg)
            // Đảm bảo xác xe luôn dao động trong khoảng tiêu chuẩn từ 1.5t - 2.5t (1,500 - 2,500 kg)
            // Thêm jitter ngẫu nhiên ±150kg để số cân không bao giờ tròn chẵn
            const baseTare = (capacity.tttp - capacity.limit) * 1000;
            const tareJitter = Math.round((Math.random() * 300 - 150) + (Math.random() * 10 - 5));
            const tareWeight = Math.round(baseTare + tareJitter);
            
            // Phân bổ cân lần 1 và lần 2 dựa trên hướng Xuất/Nhập
            const isXuat = record.direction.toUpperCase().includes('XUẤT') || record.direction.toUpperCase().includes('XUAT');
            let tripWeight1 = 0;
            let tripWeight2 = 0;
            
            if (isXuat) {
                // Xuất: Lần 1 có hàng (Gross), Lần 2 xác xe (Tare)
                tripWeight1 = tareWeight + tripWeightNet;
                tripWeight2 = tareWeight;
            } else {
                // Nhập: Lần 1 xác xe (Tare), Lần 2 có hàng (Gross)
                tripWeight1 = tareWeight;
                tripWeight2 = tareWeight + tripWeightNet;
            }
            
            tempTrips.push({
                plateNumber: formatPlate(record.plateNumber),
                tttp: capacity.tttp,
                limit: capacity.limit,
                ticketNo: j === 0 ? record.ticketNo : '', // Only keep ticketNo for the first trip
                cargoType: record.cargoType, // Keep full original cargo type
                weightTons: tripWeightTons,
                notes: '',
                isNew: true,
                dateObj: tripTime,
                customer: record.customer,
                weight1: tripWeight1,
                weight2: tripWeight2,
                weightNet: tripWeightNet,
                durationMs: durationMs,
                direction: record.direction,
                bargeName: record.bargeName
            });
        }
    });
    
    // Sort all trips chronologically by dateObj
    tempTrips.sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
    
    // Extract chronological time strings before interleaving to re-apply them in order later
    const sortedTimeStrings = tempTrips.map(t => formatExcelDateTime(t.dateObj));
    
    // Resolve consecutive duplicates of plate numbers using our multi-pass resolver
    const n = tempTrips.length;
    let swapped = true;
    let iterations = 0;
    while (swapped && iterations < 10) {
        swapped = false;
        for (let i = 0; i < n - 1; i++) {
            const currentTrip = tempTrips[i];
            const nextTrip = tempTrips[i + 1];
            if (!currentTrip || !nextTrip) continue;
            
            if (currentTrip.plateNumber === nextTrip.plateNumber) {
                let swapIdx = -1;
                // Search forward first
                for (let k = i + 2; k < n; k++) {
                    const candidate = tempTrips[k];
                    if (!candidate) continue;
                    
                    const nextCandidate = tempTrips[k + 1];
                    const isDifferent = candidate.plateNumber !== currentTrip.plateNumber;
                    const isNextDifferent = !nextCandidate || nextCandidate.plateNumber !== nextTrip.plateNumber;
                    
                    if (isDifferent && (k === n - 1 || isNextDifferent)) {
                        swapIdx = k;
                        break;
                    }
                }
                // If forward fails, search backward
                if (swapIdx === -1) {
                    for (let k = i - 1; k >= 0; k--) {
                        const candidate = tempTrips[k];
                        if (!candidate) continue;
                        
                        const prevCandidate = k > 0 ? tempTrips[k - 1] : null;
                        const isDifferent = candidate.plateNumber !== currentTrip.plateNumber && candidate.plateNumber !== nextTrip.plateNumber;
                        const isPrevDifferent = !prevCandidate || prevCandidate.plateNumber !== nextTrip.plateNumber;
                        
                        if (isDifferent && (k === 0 || isPrevDifferent)) {
                            swapIdx = k;
                            break;
                        }
                    }
                }
                
                if (swapIdx !== -1) {
                    const candidateTrip = tempTrips[swapIdx];
                    if (candidateTrip) {
                        tempTrips[i + 1] = candidateTrip;
                        tempTrips[swapIdx] = nextTrip;
                        swapped = true;
                    }
                }
            }
        }
        iterations++;
    }
    
    // Re-apply sorted times and STTs sequentially so everything looks chronological in output
    const startSTT = nextSTT.value;
    const finalTrips: SplitTrip[] = tempTrips.map((t, idx) => {
        const { dateObj, durationMs, ...rest } = t;
        const tripDate2 = dateObj;
        const tripDate1 = new Date(dateObj.getTime() - durationMs);
        return {
            ...rest,
            stt: startSTT + idx,
            timeStr: sortedTimeStrings[idx] || '',
            date1Obj: tripDate1,
            date2Obj: tripDate2
        };
    });
    
    return finalTrips;
});

// Computed: Filtered trips for preview search
const filteredTrips = computed(() => {
    if (!searchQuery.value.trim()) return generatedTrips.value;
    const q = searchQuery.value.toLowerCase();
    return generatedTrips.value.filter(t => 
        t.plateNumber.toLowerCase().includes(q) || 
        t.ticketNo.toLowerCase().includes(q) || 
        t.cargoType.toLowerCase().includes(q)
    );
});

// Computed: Total split weight tons
const totalSplitWeightTons = computed(() => {
    return generatedTrips.value.reduce((acc, t) => acc + t.weightTons, 0);
});

// Paged trips
const pagedTrips = computed(() => {
    const start = (currentPage.value - 1) * itemsPerPage;
    return filteredTrips.value.slice(start, start + itemsPerPage);
});

// Total pages
const totalPages = computed(() => {
    return Math.ceil(filteredTrips.value.length / itemsPerPage);
});

// Reset pagination when search changes
watch(searchQuery, () => {
    currentPage.value = 1;
});

// Export source tickets (Tab 1) as Excel
async function exportSourceTickets() {
    if (csvRecords.value.length === 0) {
        addToast('Không có phiếu cân nào để xuất!', 'info');
        return;
    }
    compiling.value = true;
    try {
        const ExcelJS = await import('exceljs');
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Phiếu cân');
        
        const headers = ['STT', 'Số phiếu', 'Biển số xe', 'Khách hàng', 'Cân lần 1', 'Cân lần 2', 'KL hàng (kg)', 'Loại hàng', 'Ngày vào', 'Giờ vào', 'Ngày ra', 'Giờ ra', 'Xuất/Nhập', 'Sà lan', 'Tài xế', 'Ghi chú'];
        const headerRow = sheet.getRow(1);
        headers.forEach((h, i) => { headerRow.getCell(i + 1).value = h; });
        headerRow.font = { name: 'Arial', size: 10, bold: true };
        headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
        
        csvRecords.value.forEach((r, idx) => {
            const row = sheet.getRow(idx + 2);
            row.getCell(1).value = idx + 1;
            row.getCell(2).value = r.ticketNo;
            row.getCell(3).value = r.plateNumber;
            row.getCell(4).value = r.customer;
            row.getCell(5).value = r.weight1;
            row.getCell(6).value = r.weight2;
            row.getCell(7).value = r.weightNet;
            row.getCell(8).value = r.cargoType;
            row.getCell(9).value = r.dateInStr;
            row.getCell(10).value = r.timeInStr;
            row.getCell(11).value = r.dateOutStr;
            row.getCell(12).value = r.timeOutStr;
            row.getCell(13).value = r.direction;
            row.getCell(14).value = r.bargeName;
            row.getCell(15).value = r.driverName;
            row.getCell(16).value = r.notes;
            row.font = { name: 'Arial', size: 10 };
        });
        
        // Auto-width columns
        sheet.columns.forEach((col: any) => { col.width = 18; });
        
        const buffer = await workbook.xlsx.writeBuffer();
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'PHIẾU_CÂN_THỰC_TẾ.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        addToast('Đã xuất phiếu cân thực tế thành công!', 'success');
    } catch (error) {
        console.error(error);
        addToast('Lỗi khi xuất tệp Excel!', 'error');
    } finally {
        compiling.value = false;
    }
}

// Execute Excel update and download
async function compileAndDownload() {
    if (generatedTrips.value.length === 0) {
        addToast('Không có dữ liệu chuyến xe để xuất!', 'info');
        return;
    }
    
    compiling.value = true;
    
    try {
        let workbook: any = null;
        let dsSheet;
        const ExcelJS = await import('exceljs');
        workbook = new ExcelJS.Workbook();
        dsSheet = workbook.addWorksheet('DS');

        if (activeDataTab.value === 'template') {
            // Set 15 columns matching "Ánh phân bổ bằng tay.csv"
            dsSheet.columns = [
                { header: 'So phieu', key: 'ticketNo', width: 18 },
                { header: 'So xe', key: 'plateNumber', width: 15 },
                { header: 'Khach hang', key: 'customer', width: 30 },
                { header: 'KL can lan 1', key: 'weight1', width: 15 },
                { header: 'KL can lan 2', key: 'weight2', width: 15 },
                { header: 'KL hang', key: 'weightNet', width: 15 },
                { header: 'Ngay can lan 1', key: 'date1', width: 15 },
                { header: 'Gio can lan 1', key: 'time1', width: 15 },
                { header: '', key: 'dateTime1', width: 22 },
                { header: 'Ngay can lan 2', key: 'date2', width: 15 },
                { header: 'Gio can lan 2', key: 'time2', width: 15 },
                { header: '', key: 'dateTime2', width: 22 },
                { header: 'Xuat/Nhap', key: 'direction', width: 15 },
                { header: 'Loai Hang', key: 'cargoType', width: 30 },
                { header: 'Loai Salan', key: 'bargeName', width: 35 }
            ];
            
            const headerRow = dsSheet.getRow(1);
            headerRow.getCell(1).value = 'So phieu';
            headerRow.getCell(2).value = 'So xe';
            headerRow.getCell(3).value = 'Khach hang';
            headerRow.getCell(4).value = 'KL can lan 1';
            headerRow.getCell(5).value = 'KL can lan 2';
            headerRow.getCell(6).value = 'KL hang';
            headerRow.getCell(7).value = 'Ngay can lan 1';
            headerRow.getCell(8).value = 'Gio can lan 1';
            headerRow.getCell(9).value = '';
            headerRow.getCell(10).value = 'Ngay can lan 2';
            headerRow.getCell(11).value = 'Gio can lan 2';
            headerRow.getCell(12).value = '';
            headerRow.getCell(13).value = 'Xuat/Nhap';
            headerRow.getCell(14).value = 'Loai Hang';
            headerRow.getCell(15).value = 'Loai Salan';
            
            headerRow.font = { name: 'Arial', size: 10, bold: true };
            headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
            
            for (let colIdx = 1; colIdx <= 15; colIdx++) {
                const cell = headerRow.getCell(colIdx);
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
                    left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
                    bottom: { style: 'thin', color: { argb: 'FFBFBFBF' } },
                    right: { style: 'thin', color: { argb: 'FFBFBFBF' } }
                };
            }
            headerRow.height = 25;
            
            let currentRowIdx = 2;
            generatedTrips.value.forEach(trip => {
                const row = dsSheet.getRow(currentRowIdx);
                row.getCell(1).value = trip.ticketNo;
                row.getCell(2).value = trip.plateNumber;
                row.getCell(3).value = trip.customer;
                row.getCell(4).value = trip.weight1;
                row.getCell(5).value = trip.weight2;
                row.getCell(6).value = trip.weightNet;
                row.getCell(7).value = formatExcelDate(trip.date1Obj);
                row.getCell(8).value = formatExcelTime(trip.date1Obj);
                row.getCell(9).value = formatExcelDateTimeCombined(trip.date1Obj);
                row.getCell(10).value = formatExcelDate(trip.date2Obj);
                row.getCell(11).value = formatExcelTime(trip.date2Obj);
                row.getCell(12).value = formatExcelDateTimeCombined(trip.date2Obj);
                row.getCell(13).value = trip.direction;
                row.getCell(14).value = trip.cargoType;
                row.getCell(15).value = trip.bargeName;
                
                for (let colIdx = 1; colIdx <= 15; colIdx++) {
                    const cell = row.getCell(colIdx);
                    cell.font = { name: 'Arial', size: 10 };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                        right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
                    };
                    if ([1, 2, 7, 8, 9, 10, 11, 12, 13].includes(colIdx)) {
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    } else if ([4, 5, 6].includes(colIdx)) {
                        cell.alignment = { horizontal: 'right', vertical: 'middle' };
                        cell.numFmt = '#,##0.00';
                    } else {
                        cell.alignment = { horizontal: 'left', vertical: 'middle' };
                    }
                }
                currentRowIdx++;
            });
        } else {
            // Set 10 columns for summary layout
            dsSheet.columns = [
                { header: '', key: 'A', width: 3 },
                { header: 'STT', key: 'stt', width: 8 },
                { header: 'Ngày giờ', key: 'timeStr', width: 22 },
                { header: 'Số xe', key: 'plateNumber', width: 15 },
                { header: 'TTTP (tấn)', key: 'tttp', width: 15 },
                { header: 'Hạn mức hàng (tấn)', key: 'limit', width: 22 },
                { header: 'Số phiếu cân', key: 'ticketNo', width: 18 },
                { header: 'Loại hàng hóa', key: 'cargoType', width: 18 },
                { header: 'Trọng lượng hàng (tấn)', key: 'weightTons', width: 22 },
                { header: 'Ghi chú', key: 'notes', width: 15 }
            ];
            
            // Write headers at Row 9
            const headerRow = dsSheet.getRow(9);
            headerRow.getCell(2).value = 'STT';
            headerRow.getCell(3).value = 'Ngày giờ';
            headerRow.getCell(4).value = 'Số xe';
            headerRow.getCell(5).value = 'TTTP (tấn)';
            headerRow.getCell(6).value = 'Hạn mức hàng (tấn)';
            headerRow.getCell(7).value = 'Số phiếu cân';
            headerRow.getCell(8).value = 'Loại hàng hóa';
            headerRow.getCell(9).value = 'Trọng lượng hàng (tấn)';
            headerRow.getCell(10).value = 'Ghi chú';
            
            headerRow.font = { name: 'Arial', size: 10, bold: true };
            headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
            
            for (let colIdx = 2; colIdx <= 10; colIdx++) {
                const cell = headerRow.getCell(colIdx);
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE2EBF5' } // soft light blue fill
                };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFBFBFBF' } },
                    left: { style: 'thin', color: { argb: 'FFBFBFBF' } },
                    bottom: { style: 'medium', color: { argb: 'FF808080' } },
                    right: { style: 'thin', color: { argb: 'FFBFBFBF' } }
                };
            }
            headerRow.height = 25;
            
            let currentSTT = 0;
            let currentRowIdx = 10;
            
            generatedTrips.value.forEach(trip => {
                currentSTT++;
                
                const row = dsSheet.getRow(currentRowIdx);
                row.getCell(2).value = currentSTT;             // Col B: STT
                row.getCell(3).value = trip.timeStr;           // Col C: Date/Time
                row.getCell(4).value = trip.plateNumber;       // Col D: Plate
                row.getCell(5).value = trip.tttp;              // Col E: TTTP
                row.getCell(6).value = trip.limit;             // Col F: Allowed Cargo
                row.getCell(7).value = trip.ticketNo;          // Col G: Ticket No
                row.getCell(8).value = trip.cargoType;         // Col H: Cargo type
                row.getCell(9).value = trip.weightTons;        // Col I: Weight in tons
                row.getCell(10).value = null;                  // Col J: Ghi chú
                
                for (let colIdx = 2; colIdx <= 10; colIdx++) {
                    const cell = row.getCell(colIdx);
                    cell.font = { name: 'Arial', size: 10 };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                        left: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                        bottom: { style: 'thin', color: { argb: 'FFD9D9D9' } },
                        right: { style: 'thin', color: { argb: 'FFD9D9D9' } }
                    };
                    if (colIdx === 2 || colIdx === 3 || colIdx === 4 || colIdx === 7) {
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    } else if (colIdx === 5 || colIdx === 6 || colIdx === 9) {
                        cell.alignment = { horizontal: 'right', vertical: 'middle' };
                        cell.numFmt = '#,##0.00';
                    } else {
                        cell.alignment = { horizontal: 'left', vertical: 'middle' };
                    }
                }
                
                currentRowIdx++;
            });
        }
        
        // Write to buffer
        const buffer = await workbook.xlsx.writeBuffer();
        
        // Download
        const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = activeDataTab.value === 'template' 
            ? 'SỔ PHÂN BỔ CHI TIẾT_PhanBo.xlsx' 
            : 'SỔ THEO DÕI XẾP HÀNG HÓA_PhanBo.xlsx';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        
        addToast('Đã phân bổ và xuất tệp Excel thành công!', 'success');
    } catch (error) {
        console.error(error);
        addToast('Lỗi khi xuất tệp Excel!', 'error');
    } finally {
        compiling.value = false;
    }
}
</script>

<template>
    <div class="flex flex-col gap-6 w-full max-w-[1200px] mx-auto pb-8 fade-in">
        <!-- Header Banner -->
        <div class="flex flex-wrap items-center justify-between bg-white rounded-[24px] p-5 soft-shadow border border-primary/5 gap-4">
            <div>
                <div class="text-[9px] uppercase font-black tracking-widest text-primary mb-0.5">Công cụ thông minh</div>
                <h1 class="text-base font-black text-[#4a2c32] flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-primary text-lg">balance</span>
                    Phân bổ tải trọng xếp hàng lên phương tiện
                </h1>
                <p class="text-xs text-gray-500 mt-1">
                    Tự động chia tách trọng lượng xe quá tải vượt hạn mức thành nhiều chuyến hợp lệ và kết xuất tệp theo mẫu chuẩn.
                </p>
            </div>
        </div>

        <!-- Settings Section -->

        <!-- 3-Column Settings & Capacities configs -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <!-- Parameters configuration -->
            <div class="lg:col-span-2 bg-white rounded-[24px] p-5 soft-shadow border border-primary/5 flex flex-col gap-4">
                <h4 class="text-xs font-black text-primary flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-base">tune</span>
                    Cấu hình giải thuật & quy tắc phân bổ
                </h4>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <!-- Distribution Strategy -->
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Chiến lược chia trọng lượng</label>
                        <select v-model="distStrategy" class="w-full px-3 py-2 bg-white border border-gray-200 rounded-[12px] text-xs font-semibold focus:outline-none focus:border-primary transition-all cursor-pointer">
                            <option value="random">Phân bổ ngẫu nhiên</option>
                            <option value="even">Chia đều</option>
                            <option value="max">Tối đa hóa công suất</option>
                        </select>
                        <span class="text-[9px] text-gray-400 leading-tight">
                            {{ distStrategy === 'random' ? 'Tự động tạo ra các số tải trọng ngẫu nhiên tự nhiên dưới hạn mức cho phép.' : distStrategy === 'even' ? 'Chia đều toàn bộ khối lượng thực tế cho số chuyến tối thiểu. Trọng lượng mỗi chuyến bằng nhau.' : 'Xếp tối đa tải trọng cho phép cho các chuyến đầu, chuyến cuối cùng chở phần khối lượng còn thừa.' }}
                        </span>
                    </div>

                    <!-- Spacing Strategy -->
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Phương pháp định thời gian</label>
                        <select v-model="spacingStrategy" class="w-full px-3 py-2 bg-white border border-gray-200 rounded-[12px] text-xs font-semibold focus:outline-none focus:border-primary transition-all cursor-pointer">
                            <option value="even">Phân bổ đều theo chu kỳ cân</option>
                            <option value="forward">Tịnh tiến từ thời gian vào (+ Interval)</option>
                            <option value="backward">Lùi dần từ thời gian ra (- Interval)</option>
                        </select>
                        <span class="text-[9px] text-gray-400 leading-tight">
                            {{ spacingStrategy === 'even' ? 'Thời gian các chuyến được chia đều trong khoảng từ lúc xe vào trạm đến lúc xe ra.' : 'Mỗi chuyến xe sau được xếp cách chuyến xe trước một khoảng thời gian cố định.' }}
                        </span>
                    </div>

                    <!-- Time Interval (Used if forward/backward) -->
                    <div v-if="spacingStrategy !== 'even'" class="flex flex-col gap-1.5">
                        <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Khoảng cách giữa các chuyến (phút)</label>
                        <input 
                            type="number" 
                            v-model.number="timeIntervalMinutes" 
                            min="10" 
                            max="720"
                            class="w-full px-3 py-2 bg-white border border-gray-200 rounded-[12px] text-xs font-semibold focus:outline-none focus:border-primary transition-all"
                        >
                    </div>
                </div>
            </div>

            <!-- General Capacity standards config -->
            <div class="bg-white rounded-[24px] p-5 soft-shadow border border-primary/5 flex flex-col gap-4">
                <h4 class="text-xs font-black text-primary flex items-center gap-1.5">
                    <span class="material-symbols-outlined text-base">shield</span>
                    Hạn mức tải trọng tiêu chuẩn
                </h4>
                <p class="text-[10px] text-gray-500 -mt-2">Cấu hình tải trọng tiêu chuẩn áp dụng khi chia tải:</p>

                <div class="flex flex-col gap-3">
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Trọng tải cho phép tiêu chuẩn (tấn)</label>
                        <input 
                            type="number" 
                            v-model.number="standardTTTPLimit" 
                            step="0.1"
                            class="w-full px-3 py-2 bg-white border border-gray-200 rounded-[12px] text-xs font-semibold focus:outline-none focus:border-primary transition-all font-mono"
                        >
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Hạn mức hàng tiêu chuẩn (tấn)</label>
                        <div class="px-3 py-2 bg-gray-50 border border-gray-200 rounded-[12px] text-xs font-bold text-gray-600 select-none font-mono">
                            Ngẫu nhiên: [{{ (standardTTTPLimit - 2.5).toFixed(1) }} - {{ (standardTTTPLimit - 1.5).toFixed(1) }}] t
                        </div>
                        <span class="text-[9px] text-gray-400 leading-tight">
                            Bằng Trọng tải cho phép tiêu chuẩn trừ xác xe ngẫu nhiên (1.5 - 2.5t).
                        </span>
                    </div>
                </div>
            </div>
        </div>

        <!-- Tabbed Data Panel -->
        <div class="bg-white rounded-[24px] p-5 soft-shadow border border-primary/5 flex flex-col gap-4 animate-fade-in">
            <!-- Tabs Header -->
            <div class="flex flex-wrap items-center justify-between gap-4 border-b border-gray-100 pb-3">
                <div class="flex items-center gap-2 flex-wrap">
                    <button 
                        @click="activeDataTab = 'source'"
                        :class="[
                            'px-4 py-2 text-xs font-black rounded-lg transition-all',
                            activeDataTab === 'source' 
                                ? 'bg-primary/10 text-primary border border-primary/20' 
                                : 'text-gray-500 hover:bg-gray-50'
                        ]"
                    >
                        1. Phiếu cân ({{ csvRecords.length }})
                    </button>
                    <button 
                        @click="activeDataTab = 'template'"
                        :class="[
                            'px-4 py-2 text-xs font-black rounded-lg transition-all',
                            activeDataTab === 'template' 
                                ? 'bg-primary/10 text-primary border border-primary/20' 
                                : 'text-gray-500 hover:bg-gray-50'
                        ]"
                    >
                        2. Phân bổ ({{ generatedTrips.length }})
                    </button>
                    <button 
                        @click="activeDataTab = 'generated'"
                        :class="[
                            'px-4 py-2 text-xs font-black rounded-lg transition-all',
                            activeDataTab === 'generated' 
                                ? 'bg-primary/10 text-primary border border-primary/20' 
                                : 'text-gray-500 hover:bg-gray-50'
                        ]"
                    >
                        3. Theo dõi ({{ generatedTrips.length }})
                    </button>

                    <!-- Cloud Sync Indicator -->
                    <div class="flex items-center gap-1.5 ml-2 border-l border-gray-200 pl-3">
                        <span v-if="syncStatus === 'saving'" class="text-[10px] font-medium text-gray-400 flex items-center gap-0.5 select-none">
                            <span class="material-symbols-outlined text-xs animate-spin">sync</span> Đang đồng bộ...
                        </span>
                        <span v-else-if="syncStatus === 'synced'" class="text-[10px] font-medium text-teal-500 flex items-center gap-0.5 select-none" title="Đã lưu đồng bộ lên đám mây">
                            <span class="material-symbols-outlined text-xs">cloud_done</span> Đã đồng bộ đám mây
                        </span>
                        <span v-else-if="syncStatus === 'error'" class="text-[10px] font-medium text-red-500 flex items-center gap-0.5 cursor-pointer hover:underline select-none" @click="saveTicketsToSupabase" title="Lỗi đồng bộ. Bấm để thử lại.">
                            <span class="material-symbols-outlined text-xs">cloud_off</span> Lỗi đồng bộ (Thử lại)
                        </span>
                    </div>
                </div>

                <!-- Action buttons for Tab 1 (Source) -->
                <div v-if="activeDataTab === 'source'" class="flex items-center gap-2">
                    <!-- Hidden File Input for tickets -->
                    <input 
                        type="file" 
                        ref="ticketFileInput" 
                        accept=".csv,.xlsx" 
                        @change="handleTicketImport" 
                        class="hidden"
                    >
                    <button 
                        @click="triggerTicketFileInput"
                        class="px-3 py-1.5 bg-primary/10 text-primary border border-primary/20 text-[11px] font-bold rounded-[10px] hover:bg-primary/20 active:scale-[0.98] transition-all flex items-center gap-1.5"
                        :disabled="loadingCSV"
                    >
                        <span class="material-symbols-outlined text-[14px]">upload_file</span>
                        {{ loadingCSV ? 'Đang đọc...' : 'Import' }}
                    </button>
                    <button 
                        @click="openAddTicketDialog"
                        class="px-3 py-1.5 bg-primary text-white text-[11px] font-bold rounded-[10px] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5"
                    >
                        <span class="material-symbols-outlined text-[14px]">add</span>
                        Thêm
                    </button>
                    <button 
                        @click="clearAllTickets"
                        class="px-3 py-1.5 bg-red-50 text-red-600 border border-red-200 text-[11px] font-bold rounded-[10px] hover:bg-red-100 active:scale-[0.98] transition-all flex items-center gap-1.5"
                    >
                        <span class="material-symbols-outlined text-[14px]">delete</span>
                        Xóa hết
                    </button>
                    <button 
                        @click="exportSourceTickets"
                        :disabled="csvRecords.length === 0 || compiling"
                        class="px-3 py-1.5 bg-teal-50 text-teal-700 border border-teal-200 text-[11px] font-bold rounded-[10px] hover:bg-teal-100 active:scale-[0.98] transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <span class="material-symbols-outlined text-[14px]">download</span>
                        Xuất Excel
                    </button>
                </div>

                <!-- Stats summary badges for Tab 2 (Template / Phân bổ) -->
                <div v-if="activeDataTab === 'template'" class="flex items-center gap-2 flex-wrap text-[10px] font-black text-gray-500">
                    <div v-if="existingTrips.length > 0" class="px-2.5 py-1.5 bg-gray-50 rounded-[12px] border border-primary/5">
                        Dòng bắt đầu: từ dòng số {{ nextSTT }}
                    </div>
                    <div class="px-2.5 py-1.5 bg-primary/10 rounded-[12px] text-primary">
                        Số chuyến: {{ generatedTrips.length }}
                    </div>
                    <div class="px-2.5 py-1.5 bg-teal-50 rounded-[12px] border border-teal-200 text-teal-700">
                        KL phân bổ: {{ totalSplitWeightTons.toFixed(2) }}t
                    </div>
                    <button 
                        @click="compileAndDownload"
                        :disabled="generatedTrips.length === 0 || compiling"
                        class="px-3 py-1.5 bg-primary text-white text-[11px] font-bold rounded-[10px] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <span v-if="compiling" class="material-symbols-outlined text-[14px] animate-spin">sync</span>
                        <span v-else class="material-symbols-outlined text-[14px]">download</span>
                        {{ compiling ? 'Đang xử lý...' : 'Xuất Excel' }}
                    </button>
                </div>

                <!-- Stats summary badges for Tab 3 (Generated / Theo dõi) -->
                <div v-if="activeDataTab === 'generated'" class="flex items-center gap-2 flex-wrap text-[10px] font-black text-gray-500">
                    <div class="px-2.5 py-1.5 bg-primary/10 rounded-[12px] text-primary">
                        Số chuyến: {{ generatedTrips.length }}
                    </div>
                    <div class="px-2.5 py-1.5 bg-teal-50 rounded-[12px] border border-teal-200 text-teal-700">
                        KL phân bổ: {{ totalSplitWeightTons.toFixed(2) }}t
                    </div>
                    <button 
                        @click="compileAndDownload"
                        :disabled="generatedTrips.length === 0 || compiling"
                        class="px-3 py-1.5 bg-primary text-white text-[11px] font-bold rounded-[10px] hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <span v-if="compiling" class="material-symbols-outlined text-[14px] animate-spin">sync</span>
                        <span v-else class="material-symbols-outlined text-[14px]">download</span>
                        {{ compiling ? 'Đang xử lý...' : 'Xuất Excel' }}
                    </button>
                </div>
            </div>

            <!-- Tab Content: Source Tickets -->
            <div v-if="activeDataTab === 'source'" class="flex flex-col gap-4">
                <!-- Search & Info -->
                <div class="flex items-center justify-between gap-4">
                    <div class="relative w-full max-w-[320px] flex items-center">
                        <span class="material-symbols-outlined absolute left-3 text-gray-400 text-sm">search</span>
                        <input 
                            type="text" 
                            v-model="sourceSearchQuery" 
                            placeholder="Tìm theo biển số, số phiếu, loại hàng..." 
                            class="w-full pl-9 pr-8 py-1.5 bg-white border border-gray-200 rounded-[12px] text-xs font-semibold focus:outline-none focus:border-primary transition-all placeholder:text-gray-400"
                        >
                        <button 
                            v-if="sourceSearchQuery" 
                            @click="sourceSearchQuery = ''" 
                            class="absolute right-3 text-gray-400 hover:text-primary flex items-center"
                        >
                            <span class="material-symbols-outlined text-xs">close</span>
                        </button>
                    </div>
                    
                    <span class="text-[10px] font-bold text-gray-400">
                        Đang hiển thị {{ filteredSourceTickets.length }} / {{ csvRecords.length }} phiếu cân (Tổng: {{ totalCsvWeightTons.toFixed(2) }} tấn)
                    </span>
                </div>

                <!-- Source Tickets Table -->
                <div class="overflow-x-auto border border-gray-100 rounded-[16px] bg-white">
                    <table class="w-full text-left border-collapse text-xs font-semibold">
                        <thead>
                            <tr class="bg-gray-50 text-gray-500 border-b border-gray-100 font-bold">
                                <th class="p-3 w-12 text-center bg-gray-55 font-bold">STT</th>
                                <th class="p-3 bg-gray-50 font-bold">Số phiếu</th>
                                <th class="p-3 bg-gray-55 font-bold">Số xe</th>
                                <th class="p-3 bg-gray-50 font-bold">Loại hàng</th>
                                <th class="p-3 text-right bg-gray-55 font-bold">Khối lượng (kg)</th>
                                <th class="p-3 bg-gray-50 font-bold">Thời gian vào</th>
                                <th class="p-3 bg-gray-55 font-bold">Thời gian ra</th>
                                <th class="p-3 bg-gray-50 font-bold">Tài xế</th>
                                <th class="p-3 text-center w-24 bg-gray-55 font-bold">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100 text-[#4a2c32]/90">
                            <tr 
                                v-for="(ticket, idx) in pagedSourceTickets" 
                                :key="ticket.id || idx"
                                class="hover:bg-gray-50 transition-colors"
                            >
                                <td class="p-3 text-center font-bold text-gray-400">
                                    {{ (sourceCurrentPage - 1) * itemsPerPage + idx + 1 }}
                                </td>
                                <td class="p-3 font-semibold text-gray-500">{{ ticket.ticketNo }}</td>
                                <td class="p-3 font-bold text-gray-900">{{ formatPlate(ticket.plateNumber) }}</td>
                                <td class="p-3 truncate max-w-[120px]" :title="ticket.cargoType">{{ ticket.cargoType }}</td>
                                <td class="p-3 text-right font-black text-primary">{{ ticket.weightNet.toLocaleString() }}</td>
                                <td class="p-3 text-[10px] text-gray-500 font-mono">{{ ticket.timeInStr }} {{ ticket.dateInStr }}</td>
                                <td class="p-3 text-[10px] text-gray-500 font-mono">{{ ticket.timeOutStr }} {{ ticket.dateOutStr }}</td>
                                <td class="p-3 text-gray-500 truncate max-w-[100px]" :title="ticket.driverName">{{ ticket.driverName || '-' }}</td>
                                <td class="p-3 text-center">
                                    <div class="flex items-center justify-center gap-1.5">
                                        <button 
                                            @click="openEditTicketDialog(ticket)" 
                                            class="size-7 rounded-full bg-primary/5 hover:bg-primary/10 text-primary flex items-center justify-center transition-all"
                                            title="Sửa"
                                        >
                                            <span class="material-symbols-outlined text-[15px]">edit</span>
                                        </button>
                                        <button 
                                            @click="deleteTicket(ticket)" 
                                            class="size-7 rounded-full bg-red-50 hover:bg-red-100 text-red-655 flex items-center justify-center transition-all"
                                            title="Xóa"
                                        >
                                            <span class="material-symbols-outlined text-[15px]">delete</span>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                            <tr v-if="filteredSourceTickets.length === 0">
                                <td colspan="9" class="p-8 text-center text-gray-400 italic">
                                    {{ csvRecords.length === 0 ? 'Chưa có phiếu cân nào. Vui lòng bấm "Import phiếu cân" hoặc "Thêm phiếu cân" để bắt đầu.' : 'Không tìm thấy phiếu cân nào khớp bộ lọc!' }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Source Pagination -->
                <div v-if="sourceTotalPages > 1" class="flex items-center justify-center gap-2 pt-2">
                    <button 
                        @click="sourceCurrentPage = Math.max(1, sourceCurrentPage - 1)" 
                        :disabled="sourceCurrentPage === 1"
                        class="size-8 rounded-[10px] hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center text-gray-600 border border-gray-100 transition-colors"
                    >
                        <span class="material-symbols-outlined text-lg">chevron_left</span>
                    </button>
                    <span class="text-xs font-bold text-gray-500">
                        Trang {{ sourceCurrentPage }} / {{ sourceTotalPages }}
                    </span>
                    <button 
                        @click="sourceCurrentPage = Math.min(sourceTotalPages, sourceCurrentPage + 1)" 
                        :disabled="sourceCurrentPage === sourceTotalPages"
                        class="size-8 rounded-[10px] hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center text-gray-600 border border-gray-100 transition-colors"
                    >
                        <span class="material-symbols-outlined text-lg">chevron_right</span>
                    </button>
                </div>
            </div>

            <!-- Tab Content: Generated Split Trips -->
            <div v-if="activeDataTab === 'generated'" class="flex flex-col gap-4">
                <!-- Search Filter Row -->
                <div class="flex items-center justify-between gap-4">
                    <div class="relative w-full max-w-[320px] flex items-center">
                        <span class="material-symbols-outlined absolute left-3 text-gray-400 text-sm">search</span>
                        <input 
                            type="text" 
                            v-model="searchQuery" 
                            placeholder="Tìm theo biển số, số phiếu, loại hàng..." 
                            class="w-full pl-9 pr-8 py-1.5 bg-white border border-gray-200 rounded-[12px] text-xs font-semibold focus:outline-none focus:border-primary transition-all placeholder:text-gray-400"
                        >
                        <button 
                            v-if="searchQuery" 
                            @click="searchQuery = ''" 
                            class="absolute right-3 text-gray-400 hover:text-primary flex items-center"
                        >
                            <span class="material-symbols-outlined text-xs">close</span>
                        </button>
                    </div>
                    
                    <span class="text-[10px] font-bold text-gray-400">
                        Đang hiển thị {{ filteredTrips.length }} / {{ generatedTrips.length }} dòng kết quả
                    </span>
                </div>

                <!-- Preview Data Table -->
                <div class="overflow-x-auto border border-gray-100 rounded-[16px] bg-white">
                    <table class="w-full text-left border-collapse text-xs font-semibold">
                        <thead>
                            <tr class="bg-gray-50 text-gray-500 border-b border-gray-100 font-bold">
                                <th class="p-3 w-12 text-center bg-gray-50 font-bold">STT</th>
                                <th class="p-3 bg-gray-50 font-bold">Thời gian rời bến (Giờ/Ngày)</th>
                                <th class="p-3 bg-gray-55 font-bold">Số xe</th>
                                <th class="p-3 text-center bg-gray-50 font-bold">TTTP (tấn)</th>
                                <th class="p-3 text-center bg-gray-55 font-bold">Trọng lượng hàng CP (tấn)</th>
                                <th class="p-3 bg-gray-50 font-bold">Số phiếu</th>
                                <th class="p-3 text-center w-28 bg-gray-55 font-bold">Loại hàng</th>
                                <th class="p-3 text-right bg-gray-50 font-bold">Khối lượng (tấn)</th>
                                <th class="p-3 text-center w-16 bg-gray-55 font-bold">Trạng thái</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100 text-[#4a2c32]/90">
                            <tr 
                                v-for="trip in pagedTrips" 
                                :key="trip.stt"
                                class="hover:bg-gray-50 transition-colors"
                            >
                                <td class="p-3 text-center font-bold text-gray-400">
                                    <span class="flex items-center justify-center gap-1.5">
                                        <span class="w-1.5 h-1.5 rounded-full bg-primary" title="Chuyến sẽ thêm mới"></span>
                                        {{ trip.stt }}
                                    </span>
                                </td>
                                <td class="p-3 whitespace-pre-line font-mono text-[10px] leading-tight text-gray-500">{{ trip.timeStr }}</td>
                                <td class="p-3 font-bold text-gray-900 flex items-center gap-2">
                                    <span>{{ trip.plateNumber }}</span>
                                    <span 
                                        class="text-[8px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-black border border-primary/20 uppercase tracking-wide select-none"
                                    >
                                        Mới
                                    </span>
                                </td>
                                <td class="p-3 text-center">{{ trip.tttp.toFixed(1) }}</td>
                                <td class="p-3 text-center">{{ trip.limit.toFixed(1) }}</td>
                                <td class="p-3 font-semibold text-gray-500">{{ trip.ticketNo }}</td>
                                <td class="p-3 truncate max-w-[120px]" :title="trip.cargoType">{{ trip.cargoType }}</td>
                                <td class="p-3 text-right font-black text-primary">{{ trip.weightTons.toFixed(2) }}</td>
                                <td class="p-3 text-center">
                                    <span 
                                        v-if="trip.weightTons <= trip.limit" 
                                        class="size-5 rounded-full bg-teal-50 text-teal-655 border border-teal-200 flex items-center justify-center mx-auto"
                                        title="Hợp lệ - Dưới hạn mức"
                                    >
                                        <span class="material-symbols-outlined text-[13px] font-black">check</span>
                                    </span>
                                    <span 
                                        v-else 
                                        class="size-5 rounded-full bg-red-50 text-red-600 border border-red-200 flex items-center justify-center mx-auto"
                                        title="Quá tải!"
                                    >
                                        <span class="material-symbols-outlined text-[13px] font-black">close</span>
                                    </span>
                                </td>
                            </tr>
                            <tr v-if="filteredTrips.length === 0">
                                <td colspan="9" class="p-8 text-center text-gray-400 italic">
                                    Không tìm thấy bản ghi nào khớp bộ lọc!
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Table Pagination -->
                <div v-if="totalPages > 1" class="flex items-center justify-center gap-2 pt-2">
                    <button 
                        @click="currentPage = Math.max(1, currentPage - 1)" 
                        :disabled="currentPage === 1"
                        class="size-8 rounded-[10px] hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center text-gray-600 border border-gray-100 transition-colors"
                    >
                        <span class="material-symbols-outlined text-lg">chevron_left</span>
                    </button>
                    <span class="text-xs font-bold text-gray-500">
                        Trang {{ currentPage }} / {{ totalPages }}
                    </span>
                    <button 
                        @click="currentPage = Math.min(totalPages, currentPage + 1)" 
                        :disabled="currentPage === totalPages"
                        class="size-8 rounded-[10px] hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center text-gray-600 border border-gray-100 transition-colors"
                    >
                        <span class="material-symbols-outlined text-lg">chevron_right</span>
                    </button>
                </div>
            </div>

            <!-- Tab Content: Detail Template (Theo dõi) -->
            <div v-if="activeDataTab === 'template'" class="flex flex-col gap-4">
                <!-- Search Filter Row -->
                <div class="flex items-center justify-between gap-4">
                    <div class="relative w-full max-w-[320px] flex items-center">
                        <span class="material-symbols-outlined absolute left-3 text-gray-400 text-sm">search</span>
                        <input 
                            type="text" 
                            v-model="searchQuery" 
                            placeholder="Tìm theo biển số, số phiếu, loại hàng..." 
                            class="w-full pl-9 pr-8 py-1.5 bg-white border border-gray-200 rounded-[12px] text-xs font-semibold focus:outline-none focus:border-primary transition-all placeholder:text-gray-400"
                        >
                        <button 
                            v-if="searchQuery" 
                            @click="searchQuery = ''" 
                            class="absolute right-3 text-gray-400 hover:text-primary flex items-center"
                        >
                            <span class="material-symbols-outlined text-xs">close</span>
                        </button>
                    </div>
                    
                    <span class="text-[10px] font-bold text-gray-400">
                        Đang hiển thị {{ filteredTrips.length }} / {{ generatedTrips.length }} dòng kết quả
                    </span>
                </div>

                <!-- Preview Data Table -->
                <div class="overflow-x-auto border border-gray-100 rounded-[16px] bg-white">
                    <table class="w-full text-left border-collapse text-[11px] font-semibold min-w-[1200px]">
                        <thead>
                            <tr class="bg-gray-50 text-gray-500 border-b border-gray-100 font-bold">
                                <th class="p-2 bg-gray-55 font-bold">Số phiếu</th>
                                <th class="p-2 bg-gray-50 font-bold">Số xe</th>
                                <th class="p-2 bg-gray-55 font-bold">Khách hàng</th>
                                <th class="p-2 text-right bg-gray-50 font-bold">KL cân lần 1</th>
                                <th class="p-2 text-right bg-gray-55 font-bold">KL cân lần 2</th>
                                <th class="p-2 text-right bg-gray-50 font-bold">KL hàng</th>
                                <th class="p-2 text-center bg-gray-55 font-bold">Ngày cân 1</th>
                                <th class="p-2 text-center bg-gray-50 font-bold">Giờ cân 1</th>
                                <th class="p-2 bg-gray-55 font-bold">Ngày giờ 1</th>
                                <th class="p-2 text-center bg-gray-50 font-bold">Ngày cân 2</th>
                                <th class="p-2 text-center bg-gray-55 font-bold">Giờ cân 2</th>
                                <th class="p-2 bg-gray-50 font-bold">Ngày giờ 2</th>
                                <th class="p-2 text-center bg-gray-55 font-bold">X/N</th>
                                <th class="p-2 bg-gray-50 font-bold">Loại hàng</th>
                                <th class="p-2 bg-gray-55 font-bold">Loại Sà lan</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-100 text-[#4a2c32]/90">
                            <tr 
                                v-for="trip in pagedTrips" 
                                :key="trip.stt"
                                class="hover:bg-gray-50 transition-colors"
                            >
                                <td class="p-2 font-bold text-gray-800">{{ trip.ticketNo }}</td>
                                <td class="p-2 font-bold text-gray-900">{{ trip.plateNumber }}</td>
                                <td class="p-2 max-w-[150px] truncate text-gray-500" :title="trip.customer">{{ trip.customer }}</td>
                                <td class="p-2 text-right font-mono text-gray-600">{{ trip.weight1.toLocaleString() }}</td>
                                <td class="p-2 text-right font-mono text-gray-600">{{ trip.weight2.toLocaleString() }}</td>
                                <td class="p-2 text-right font-black text-primary font-mono">{{ trip.weightNet.toLocaleString() }}</td>
                                <td class="p-2 text-center text-gray-500 font-mono">{{ formatExcelDate(trip.date1Obj) }}</td>
                                <td class="p-2 text-center text-gray-500 font-mono">{{ formatExcelTime(trip.date1Obj) }}</td>
                                <td class="p-2 text-gray-400 text-[10px] font-mono whitespace-nowrap">{{ formatExcelDateTimeCombined(trip.date1Obj) }}</td>
                                <td class="p-2 text-center text-gray-500 font-mono">{{ formatExcelDate(trip.date2Obj) }}</td>
                                <td class="p-2 text-center text-gray-500 font-mono">{{ formatExcelTime(trip.date2Obj) }}</td>
                                <td class="p-2 text-gray-400 text-[10px] font-mono whitespace-nowrap">{{ formatExcelDateTimeCombined(trip.date2Obj) }}</td>
                                <td class="p-2 text-center">
                                    <span :class="['px-1.5 py-0.5 rounded text-[10px] font-black', trip.direction.toUpperCase().includes('XUẤT') || trip.direction.toUpperCase().includes('XUAT') ? 'bg-primary/10 text-primary' : 'bg-teal-50 text-teal-600']">
                                        {{ trip.direction.toUpperCase().includes('XUẤT') || trip.direction.toUpperCase().includes('XUAT') ? 'XUẤT' : 'NHẬP' }}
                                    </span>
                                </td>
                                <td class="p-2 truncate max-w-[150px]" :title="trip.cargoType">{{ trip.cargoType }}</td>
                                <td class="p-2 truncate max-w-[150px]" :title="trip.bargeName">{{ trip.bargeName }}</td>
                            </tr>
                            <tr v-if="filteredTrips.length === 0">
                                <td colspan="15" class="p-8 text-center text-gray-400 italic">
                                    Không tìm thấy bản ghi nào khớp bộ lọc!
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>

                <!-- Table Pagination -->
                <div v-if="totalPages > 1" class="flex items-center justify-center gap-2 pt-2">
                    <button 
                        @click="currentPage = Math.max(1, currentPage - 1)" 
                        :disabled="currentPage === 1"
                        class="size-8 rounded-[10px] hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center text-gray-600 border border-gray-100 transition-colors"
                    >
                        <span class="material-symbols-outlined text-lg">chevron_left</span>
                    </button>
                    <span class="text-xs font-bold text-gray-500">
                        Trang {{ currentPage }} / {{ totalPages }}
                    </span>
                    <button 
                        @click="currentPage = Math.min(totalPages, currentPage + 1)" 
                        :disabled="currentPage === totalPages"
                        class="size-8 rounded-[10px] hover:bg-gray-100 disabled:opacity-30 flex items-center justify-center text-gray-600 border border-gray-100 transition-colors"
                    >
                        <span class="material-symbols-outlined text-lg">chevron_right</span>
                    </button>
                </div>
            </div>
        </div>



        <!-- DIALOG: ADD/EDIT TICKET -->
        <div v-if="showTicketDialog" class="fixed inset-0 bg-black/50 z-[120] flex items-center justify-center p-4 animate-fade-in font-display no-print">
            <div class="bg-white rounded-[24px] soft-shadow border border-primary/5 w-full max-w-lg overflow-hidden flex flex-col animate-scale-up">
                <!-- Dialog Header -->
                <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                    <div>
                        <h3 class="text-sm font-black text-[#4a2c32] flex items-center gap-1.5">
                            <span class="material-symbols-outlined text-primary text-base">receipt_long</span>
                            {{ editingTicket ? 'Chỉnh sửa phiếu cân' : 'Thêm phiếu cân thủ công' }}
                        </h3>
                        <p class="text-[10px] text-gray-400">Nhập thông tin chi tiết của xe cân thực tế</p>
                    </div>
                    <button 
                        @click="showTicketDialog = false"
                        class="size-8 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-700 flex items-center justify-center transition-all"
                    >
                        <span class="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>
                
                <!-- Dialog Body -->
                <div class="p-5 flex flex-col gap-4 overflow-y-auto max-h-[75vh]">
                    <div class="grid grid-cols-2 gap-4">
                        <!-- Plate Number -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Số đăng ký xe (Biển số) *</label>
                            <input 
                                v-model="dialogTicket.plateNumber" 
                                type="text" 
                                placeholder="Ví dụ: 61H-16907" 
                                class="px-3.5 py-2.5 rounded-[12px] border border-gray-200 text-xs font-semibold focus:outline-none focus:border-primary uppercase"
                            >
                        </div>
                        
                        <!-- Ticket Number -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Số phiếu cân</label>
                            <input 
                                v-model="dialogTicket.ticketNo" 
                                type="text" 
                                placeholder="Tự động nếu để trống" 
                                class="px-3.5 py-2.5 rounded-[12px] border border-gray-200 text-xs font-semibold focus:outline-none focus:border-primary"
                            >
                        </div>

                        <!-- Weight 1 -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Khối lượng cân lần 1 (kg)</label>
                            <input 
                                v-model.number="dialogTicket.weight1" 
                                type="number" 
                                class="px-3.5 py-2.5 rounded-[12px] border border-gray-200 text-xs font-semibold focus:outline-none focus:border-primary"
                            >
                        </div>

                        <!-- Weight 2 -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Khối lượng cân lần 2 (kg)</label>
                            <input 
                                v-model.number="dialogTicket.weight2" 
                                type="number" 
                                class="px-3.5 py-2.5 rounded-[12px] border border-gray-200 text-xs font-semibold focus:outline-none focus:border-primary"
                            >
                        </div>

                        <!-- Weight Net -->
                        <div class="flex flex-col gap-1.5 col-span-2">
                            <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Khối lượng hàng thực tế (Net - kg) *</label>
                            <input 
                                v-model.number="dialogTicket.weightNet" 
                                type="number" 
                                placeholder="Khối lượng net thực tế chở" 
                                class="px-3.5 py-2.5 rounded-[12px] border border-gray-200 text-xs font-bold text-primary focus:outline-none focus:border-primary"
                            >
                            <span class="text-[9px] text-gray-400">
                                Nếu nhập Lần 1 & Lần 2, khối lượng Net sẽ tự động được tính bằng hiệu của hai lần cân khi bấm Lưu.
                            </span>
                        </div>

                        <!-- Cargo Type -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Loại hàng hóa</label>
                            <input 
                                v-model="dialogTicket.cargoType" 
                                type="text" 
                                placeholder="Ví dụ: Viên Nén Gỗ" 
                                class="px-3.5 py-2.5 rounded-[12px] border border-gray-200 text-xs font-semibold focus:outline-none focus:border-primary"
                            >
                        </div>

                        <!-- Driver Name -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Tên tài xế</label>
                            <input 
                                v-model="dialogTicket.driverName" 
                                type="text" 
                                placeholder="Tên tài xế..." 
                                class="px-3.5 py-2.5 rounded-[12px] border border-gray-200 text-xs font-semibold focus:outline-none focus:border-primary"
                            >
                        </div>

                        <!-- Date In -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Ngày cân vào (DD/MM/YYYY)</label>
                            <input 
                                v-model="dialogTicket.dateInStr" 
                                type="text" 
                                placeholder="DD/MM/YYYY" 
                                class="px-3.5 py-2.5 rounded-[12px] border border-gray-200 text-xs font-semibold focus:outline-none focus:border-primary"
                            >
                        </div>

                        <!-- Time In -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Giờ cân vào (HH:mm:ss)</label>
                            <input 
                                v-model="dialogTicket.timeInStr" 
                                type="text" 
                                placeholder="HH:mm:ss" 
                                class="px-3.5 py-2.5 rounded-[12px] border border-gray-200 text-xs font-semibold focus:outline-none focus:border-primary"
                            >
                        </div>

                        <!-- Date Out -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Ngày cân ra (DD/MM/YYYY)</label>
                            <input 
                                v-model="dialogTicket.dateOutStr" 
                                type="text" 
                                placeholder="DD/MM/YYYY" 
                                class="px-3.5 py-2.5 rounded-[12px] border border-gray-200 text-xs font-semibold focus:outline-none focus:border-primary"
                            >
                        </div>

                        <!-- Time Out -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Giờ cân ra (HH:mm:ss)</label>
                            <input 
                                v-model="dialogTicket.timeOutStr" 
                                type="text" 
                                placeholder="HH:mm:ss" 
                                class="px-3.5 py-2.5 rounded-[12px] border border-gray-200 text-xs font-semibold focus:outline-none focus:border-primary"
                            >
                        </div>

                        <!-- Direction -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Hình thức</label>
                            <select 
                                v-model="dialogTicket.direction" 
                                class="px-3.5 py-2.5 rounded-[12px] border border-gray-200 text-xs font-semibold focus:outline-none focus:border-primary bg-white cursor-pointer"
                            >
                                <option value="XUẤT KHẨU">XUẤT KHẨU</option>
                                <option value="NHẬP KHẨU">NHẬP KHẨU</option>
                                <option value="NỘI BỘ">NỘI BỘ</option>
                            </select>
                        </div>

                        <!-- Customer -->
                        <div class="flex flex-col gap-1.5">
                            <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Khách hàng</label>
                            <input 
                                v-model="dialogTicket.customer" 
                                type="text" 
                                placeholder="Tên khách hàng..." 
                                class="px-3.5 py-2.5 rounded-[12px] border border-gray-200 text-xs font-semibold focus:outline-none focus:border-primary"
                            >
                        </div>

                        <!-- Notes -->
                        <div class="flex flex-col gap-1.5 col-span-2">
                            <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Ghi chú</label>
                            <textarea 
                                v-model="dialogTicket.notes" 
                                rows="2"
                                placeholder="Ghi chú thêm..." 
                                class="px-3.5 py-2.5 rounded-[12px] border border-gray-200 text-xs font-semibold focus:outline-none focus:border-primary resize-none"
                            ></textarea>
                        </div>
                    </div>
                </div>
                
                <!-- Dialog Footer -->
                <div class="px-5 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-end gap-2">
                    <button 
                        @click="showTicketDialog = false"
                        class="px-4 py-2 border border-gray-200 rounded-[12px] text-xs font-bold text-[#4a2c32] hover:bg-gray-100 active:scale-[0.98] transition-all"
                    >
                        Hủy
                    </button>
                    <button 
                        @click="saveTicket"
                        class="px-4 py-2 bg-primary text-white rounded-[12px] text-xs font-bold hover:scale-[1.02] active:scale-[0.98] transition-all"
                    >
                        Lưu phiếu cân
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<style scoped>
.fade-in {
    animation: fadeIn 0.2s ease-out forwards;
}

.animate-scale-up {
    animation: scaleUp 0.2s ease-out forwards;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(3px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}

@keyframes scaleUp {
    from {
        transform: scale(0.95);
        opacity: 0;
    }
    to {
        transform: scale(1);
        opacity: 1;
    }
}
</style>
