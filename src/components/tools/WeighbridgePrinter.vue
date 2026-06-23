<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue';
import { authStore } from '@/stores/auth';
import { excelService } from '@/services/excel/ExcelService';
import { WeighbridgeService, type Vessel, type Barge, type Truck, type BargeConfig, type CustomFieldConfig } from '@/services/excel/WeighbridgeService';
const props = withDefaults(defineProps<{
    hideCard?: boolean;
}>(), {
    hideCard: false
});

// Fullscreen state
const isOpen = ref(false);
const activeTab = ref<'data' | 'config'>('data');

// Form default layout helper
const getDefaultPrintFields = (): CustomFieldConfig[] => [
    { id: 'plateNumber', label: 'Số xe', visible: true, column: 'left', order: 1 },
    { id: 'goods', label: 'Hàng hóa', visible: true, column: 'left', order: 2 },
    { id: 'owner', label: 'Tên chủ hàng', visible: true, column: 'left', order: 3 },
    { id: 'weight1', label: 'Trọng lượng lần 1', visible: true, column: 'left', order: 4 },
    { id: 'weight2', label: 'Trọng lượng lần 2', visible: true, column: 'left', order: 5 },
    { id: 'weightNet', label: 'Trọng lượng hàng', visible: true, column: 'left', order: 6 },
    { id: 'words', label: 'Bằng chữ', visible: true, column: 'left', order: 7 },
    { id: 'barge', label: 'Sà lan', visible: true, column: 'left', order: 8 },
    { id: 'note', label: 'Ghi chú', visible: true, column: 'left', order: 9 },
    
    { id: 'driver', label: 'Tài xế', visible: true, column: 'right', order: 1 },
    { id: 'goodsCode', label: 'Mã hàng', visible: true, column: 'right', order: 2 },
    { id: 'xn', label: 'X/N', visible: true, column: 'right', order: 3 },
    { id: 'chinhpham', label: '*Chính phẩm', visible: true, column: 'right', order: 4 },
    { id: 'phupham', label: '*Phụ phẩm', visible: true, column: 'right', order: 5 },
    { id: 'ketluan', label: 'Kết luận', visible: true, column: 'right', order: 6 }
];

defineExpose({
    isOpen
});

// Core state
const vessels = ref<Vessel[]>([]);
const activeVesselId = ref<number | null>(null);
const activeBargeId = ref<number | null>(null);
const trucks = ref<Truck[]>([]);
const loading = ref(false);
const saving = ref(false);

// Filters and sorting state
const vesselFilterMonth = ref<string>('');
const bargeSearchQuery = ref<string>('');
const searchQuery = ref<string>('');
const globalBargeSearchQuery = ref<string>('');
const globalFilterMonth = ref<string>('');
const globalBargesSummary = ref<BargeSummary[]>([]);
const loadingGlobalSummary = ref(false);
const sortKey = ref<string>('');
const sortOrder = ref<'asc' | 'desc'>('asc');

// UI elements and modals
const expandedVesselIds = ref<Record<number, boolean>>({});
const showMappingModal = ref(false);
const showTruckDialog = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

// Toast state
const toastMessage = ref<string | null>(null);
const toastType = ref<'success' | 'error'>('success');
let toastTimer: any = null;

const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    toastMessage.value = msg;
    toastType.value = type;
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
        toastMessage.value = null;
    }, 3000);
};

// Excel Upload pending data
interface ExcelColumn {
    index: number;
    name: string;
}

type ExcelField = 'ticketNo' | 'plateNumber' | 'driver' | 'weight1' | 'weight2' | 'weightNet' | 'dateIn' | 'dateOut' | 'note';

interface PendingExcel {
    rawRows: any[][];
    headerIndex: number;
    columns: ExcelColumn[];
    mapping: Record<ExcelField, number>;
}

const pendingExcelData = ref<PendingExcel | null>(null);

interface FieldInfo {
    id: ExcelField;
    label: string;
    required: boolean;
}

const mappingFields: FieldInfo[] = [
    { id: 'ticketNo', label: 'Số phiếu (tự chọn)', required: false },
    { id: 'plateNumber', label: 'Biển số xe / Số xe *', required: true },
    { id: 'driver', label: 'Tên tài xế', required: false },
    { id: 'weight1', label: 'Trọng lượng lần 1 (kg) *', required: true },
    { id: 'weight2', label: 'Trọng lượng lần 2 (kg) *', required: true },
    { id: 'weightNet', label: 'Trọng lượng hàng (Net) (kg)', required: false },
    { id: 'dateIn', label: 'Ngày giờ vào', required: false },
    { id: 'dateOut', label: 'Ngày giờ ra', required: false },
    { id: 'note', label: 'Ghi chú', required: false }
];

// Forms and inputs
const cfgForm = reactive<BargeConfig>({
    goods: '',
    goodsCode: '',
    owner: '',
    operator: '',
    xn: 'XUẤT KHẨU',
    ticketPrefix: 'PC-',
    ticketSeed: 1,
    chinhpham: 100,
    phupham: 0,
    ketluan: 'Chính phẩm đạt tiêu chuẩn',
    locked: false,
    printFields: getDefaultPrintFields()
});

const dialogTruck = reactive({
    id: 0,
    ticketNo: '',
    plateNumber: '',
    driver: '',
    weight1: 0,
    weight2: 0,
    weightNet: 0,
    dateIn: '',
    dateOut: '',
    note: ''
});

// Helper functions for filtering and sorting
const removeAccents = (str: string): string => {
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D');
};

const toggleSort = (key: string) => {
    if (sortKey.value === key) {
        sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
    } else {
        sortKey.value = key;
        sortOrder.value = 'asc';
    }
};

// Computed properties
const activeVessel = computed(() => vessels.value.find(v => v.id === activeVesselId.value) || null);
const activeBarge = computed<Barge | null>(() => activeVessel.value?.barges?.find(b => b.id === activeBargeId.value) || null);

const allBarges = computed(() => {
    const list: Array<{ id: number; name: string; vesselId: number; vesselName: string; created_at?: string; locked: boolean }> = [];
    vessels.value.forEach(v => {
        if (v.barges) {
            v.barges.forEach(b => {
                list.push({
                    id: b.id,
                    name: b.name,
                    vesselId: v.id,
                    vesselName: v.name,
                    created_at: b.created_at,
                    locked: b.config?.locked || false
                });
            });
        }
    });
    return list.sort((a, b) => {
        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
        return dateB - dateA; // Show latest first
    });
});

const availableGlobalMonths = computed(() => {
    if (!globalBargesSummary.value) return [];
    
    const months = new Set<string>();
    globalBargesSummary.value.forEach(b => {
        const dates = [b.dateStart, b.dateEnd].filter(Boolean);
        dates.forEach(dStr => {
            const date = new Date(dStr!);
            if (!isNaN(date.getTime())) {
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const yyyy = date.getFullYear();
                months.add(`${mm}/${yyyy}`);
            }
        });
    });
    
    return Array.from(months).sort((a, b) => {
        const partsA = a.split('/');
        const partsB = b.split('/');
        const mA = Number(partsA[0]) || 0;
        const yA = Number(partsA[1]) || 0;
        const mB = Number(partsB[0]) || 0;
        const yB = Number(partsB[1]) || 0;
        if (yA !== yB) return yB - yA;
        return mB - mA;
    });
});

const filteredAllBarges = computed(() => {
    let list = allBarges.value.map(b => {
        const summary = globalBargesSummary.value.find(s => s.id === b.id);
        return {
            ...b,
            dateStart: summary ? summary.dateStart : '',
            dateEnd: summary ? summary.dateEnd : '',
            truckCount: summary ? summary.truckCount : 0,
            totalWeight: summary ? summary.totalWeight : 0
        };
    });

    if (globalFilterMonth.value) {
        list = list.filter(b => {
            const dates = [b.dateStart, b.dateEnd].filter(Boolean);
            return dates.some(dStr => {
                const d = new Date(dStr!);
                if (isNaN(d.getTime())) return false;
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const yyyy = d.getFullYear();
                return `${mm}/${yyyy}` === globalFilterMonth.value;
            });
        });
    }

    if (globalBargeSearchQuery.value.trim()) {
        const query = removeAccents(globalBargeSearchQuery.value.trim().toLowerCase());
        list = list.filter(b => 
            removeAccents(b.name.toLowerCase()).includes(query) || 
            removeAccents(b.vesselName.toLowerCase()).includes(query)
        );
    }
    return list;
});

const availableVesselMonths = computed(() => {
    const vessel = activeVessel.value;
    if (!vessel || !vesselBargesSummary.value) return [];
    
    const months = new Set<string>();
    vesselBargesSummary.value.forEach(b => {
        const dates = [b.dateStart, b.dateEnd].filter(Boolean);
        dates.forEach(dStr => {
            const date = new Date(dStr!);
            if (!isNaN(date.getTime())) {
                const mm = String(date.getMonth() + 1).padStart(2, '0');
                const yyyy = date.getFullYear();
                months.add(`${mm}/${yyyy}`);
            }
        });
    });
    
    return Array.from(months).sort((a, b) => {
        const partsA = a.split('/');
        const partsB = b.split('/');
        const mA = Number(partsA[0]) || 0;
        const yA = Number(partsA[1]) || 0;
        const mB = Number(partsB[0]) || 0;
        const yB = Number(partsB[1]) || 0;
        if (yA !== yB) return yB - yA;
        return mB - mA;
    });
});

const filteredVesselBarges = computed<BargeSummary[]>(() => {
    let list = vesselBargesSummary.value;
    
    if (vesselFilterMonth.value) {
        list = list.filter(b => {
            const dates = [b.dateStart, b.dateEnd].filter(Boolean);
            return dates.some(dStr => {
                const d = new Date(dStr!);
                if (isNaN(d.getTime())) return false;
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const yyyy = d.getFullYear();
                return `${mm}/${yyyy}` === vesselFilterMonth.value;
            });
        });
    }
    
    if (bargeSearchQuery.value.trim()) {
        const query = removeAccents(bargeSearchQuery.value.trim().toLowerCase());
        list = list.filter(b => removeAccents(b.name.toLowerCase()).includes(query));
    }
    
    return list;
});

const filteredTrucks = computed(() => {
    let list = [...trucks.value];

    // 1. Search Filter
    const query = removeAccents(searchQuery.value.trim().toLowerCase());
    if (query) {
        list = list.filter(t => {
            const plate = removeAccents((t.plateNumber || '').toLowerCase());
            const drv = removeAccents((t.driver || '').toLowerCase());
            const ticket = removeAccents((t.ticketNo || '').toLowerCase());
            const noteStr = removeAccents((t.note || '').toLowerCase());
            return plate.includes(query) || drv.includes(query) || ticket.includes(query) || noteStr.includes(query);
        });
    }

    // 2. Sort Filter
    if (sortKey.value) {
        list.sort((a, b) => {
            let valA: any = a[sortKey.value as keyof Truck];
            let valB: any = b[sortKey.value as keyof Truck];

            if (valA === undefined || valA === null) valA = '';
            if (valB === undefined || valB === null) valB = '';

            if (sortKey.value === 'dateIn' || sortKey.value === 'dateOut') {
                const timeA = valA ? new Date(valA).getTime() : 0;
                const timeB = valB ? new Date(valB).getTime() : 0;
                return sortOrder.value === 'asc' ? timeA - timeB : timeB - timeA;
            }

            if (typeof valA === 'number' && typeof valB === 'number') {
                return sortOrder.value === 'asc' ? valA - valB : valB - valA;
            }

            const strA = String(valA).trim();
            const strB = String(valB).trim();
            return sortOrder.value === 'asc' 
                ? strA.localeCompare(strB, 'vi', { numeric: true }) 
                : strB.localeCompare(strA, 'vi', { numeric: true });
        });
    }

    return list;
});

const totalNetWeight = computed(() => {
    return filteredTrucks.value.reduce((sum, t) => sum + (t.weightNet || 0), 0);
});

const avgNetWeight = computed(() => {
    if (filteredTrucks.value.length === 0) return 0;
    return Math.round(totalNetWeight.value / filteredTrucks.value.length);
});

// Load all Vessels and Barges on component load
interface BargeSummary {
    id: number;
    name: string;
    truckCount: number;
    totalWeight: number;
    dateStart: string;
    dateEnd: string;
    locked?: boolean;
}

const vesselBargesSummary = ref<BargeSummary[]>([]);
const loadingVesselSummary = ref(false);

// Helper function to load/update vessel summary data
const refreshVesselSummary = async () => {
    if (!activeVesselId.value) {
        vesselBargesSummary.value = [];
        return;
    }
    const vessel = vessels.value.find(v => v.id === activeVesselId.value);
    if (!vessel || !vessel.barges || vessel.barges.length === 0) {
        vesselBargesSummary.value = [];
        return;
    }
    
    loadingVesselSummary.value = true;
    try {
        const summaries = await Promise.all(vessel.barges.map(async (barge) => {
            const list = await WeighbridgeService.getTrucks(barge.id);
            let totalWeight = 0;
            let minDate = '';
            let maxDate = '';
            
            list.forEach(t => {
                totalWeight += (t.weightNet || 0);
                if (t.dateIn) {
                    if (!minDate || t.dateIn < minDate) minDate = t.dateIn;
                }
                if (t.dateOut) {
                    if (!maxDate || t.dateOut > maxDate) maxDate = t.dateOut;
                }
            });
            
            return {
                id: barge.id,
                name: barge.name,
                truckCount: list.length,
                totalWeight,
                dateStart: minDate,
                dateEnd: maxDate,
                locked: barge.config?.locked || false
            };
        }));
        
        vesselBargesSummary.value = summaries;
    } catch (e) {
        console.error('Error loading vessel summary:', e);
    } finally {
        loadingVesselSummary.value = false;
    }
};

const refreshGlobalBargesSummary = async () => {
    loadingGlobalSummary.value = true;
    try {
        const allBargePromises = vessels.value.flatMap(v => {
            return (v.barges || []).map(async (b) => {
                const trks = await WeighbridgeService.getTrucks(b.id);
                let totalWeight = 0;
                let minDate = '';
                let maxDate = '';
                
                trks.forEach(t => {
                    totalWeight += (t.weightNet || 0);
                    if (t.dateIn) {
                        if (!minDate || t.dateIn < minDate) minDate = t.dateIn;
                    }
                    if (t.dateOut) {
                        if (!maxDate || t.dateOut > maxDate) maxDate = t.dateOut;
                    }
                });
                
                return {
                    id: b.id,
                    name: b.name,
                    truckCount: trks.length,
                    totalWeight,
                    dateStart: minDate,
                    dateEnd: maxDate,
                    locked: b.config?.locked || false
                };
            });
        });
        
        const results = await Promise.all(allBargePromises);
        globalBargesSummary.value = results;
    } catch (e) {
        console.error('Error loading global summary:', e);
    } finally {
        loadingGlobalSummary.value = false;
    }
};

const loadVessels = async () => {
    loading.value = true;
    try {
        const data = await WeighbridgeService.getVessels();
        vessels.value = data;
        
        // Expand all vessels by default
        data.forEach(v => {
            if (expandedVesselIds.value[v.id] === undefined) {
                expandedVesselIds.value[v.id] = true;
            }
        });

        if (activeVesselId.value) {
            await refreshVesselSummary();
        } else {
            await refreshGlobalBargesSummary();
        }
    } catch (e) {
        showToast('Không thể tải danh sách tàu từ Supabase!', 'error');
    } finally {
        loading.value = false;
    }
};

const selectBarge = async (vesselId: number, bargeId: number) => {
    activeVesselId.value = vesselId;
    activeBargeId.value = bargeId;
    
    // Reset filters and sorting when switching barges
    searchQuery.value = '';
    sortKey.value = '';
    sortOrder.value = 'asc';
    
    // Load config of active barge
    if (activeBarge.value) {
        const cfg = activeBarge.value.config || {};
        cfgForm.goods = cfg.goods || '';
        cfgForm.goodsCode = cfg.goodsCode || '';
        cfgForm.owner = cfg.owner || '';
        cfgForm.operator = cfg.operator || '';
        cfgForm.xn = cfg.xn || 'XUẤT KHẨU';
        cfgForm.ticketPrefix = cfg.ticketPrefix || 'PC-';
        cfgForm.ticketSeed = cfg.ticketSeed !== undefined ? cfg.ticketSeed : 1;
        cfgForm.chinhpham = cfg.chinhpham !== undefined ? cfg.chinhpham : 100;
        cfgForm.phupham = cfg.phupham !== undefined ? cfg.phupham : 0;
        cfgForm.ketluan = cfg.ketluan || 'Chính phẩm đạt tiêu chuẩn';
        cfgForm.locked = cfg.locked || false;
        cfgForm.printFields = cfg.printFields || getDefaultPrintFields();

        // Fetch trucks
        loading.value = true;
        try {
            const list = await WeighbridgeService.getTrucks(bargeId);
            trucks.value = list;
        } catch (e) {
            showToast('Lỗi tải danh sách xe cân!', 'error');
        } finally {
            loading.value = false;
        }
    }
};

const selectVessel = async (vesselId: number) => {
    const isSameVessel = activeVesselId.value === vesselId;
    const isBargeNull = activeBargeId.value === null;

    activeVesselId.value = vesselId;
    activeBargeId.value = null; // Deselect barge to show vessel report summary
    vesselFilterMonth.value = '';
    bargeSearchQuery.value = '';

    if (isSameVessel && isBargeNull) {
        await refreshVesselSummary();
    }
};

const exportVesselSummaryExcel = () => {
    const vessel = activeVessel.value;
    if (!vessel) return;
    
    try {
        import('exceljs').then(async (ExcelJS) => {
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Báo Cáo Tổng Hợp Tàu');
            
            sheet.pageSetup.margins = {
                left: 0.7, right: 0.7,
                top: 0.75, bottom: 0.75,
                header: 0.3, footer: 0.3
            };
            
            sheet.addRow([`BÁO CÁO TỔNG HỢP TÀU: ${vessel.name}`]);
            sheet.addRow([`Cảng Nguyên Ngọc - Đồng bộ lúc: ${formatDateTimeStr(new Date().toISOString())}`]);
            sheet.addRow([]);
            
            const headerRow = sheet.addRow(['STT', 'Tên sà lan', 'Số chuyến xe chạy', 'Tổng khối lượng hàng (Net - kg)', 'Thời gian bắt đầu', 'Thời gian kết thúc']);
            
            sheet.mergeCells('A1:F1');
            const titleCell = sheet.getCell('A1');
            titleCell.font = { name: 'Times New Roman', size: 16, bold: true };
            titleCell.alignment = { horizontal: 'center' };
            
            sheet.mergeCells('A2:F2');
            const subtitleCell = sheet.getCell('A2');
            subtitleCell.font = { name: 'Times New Roman', size: 10, italic: true };
            subtitleCell.alignment = { horizontal: 'center' };
            
            headerRow.font = { name: 'Times New Roman', size: 11, bold: true };
            headerRow.eachCell((cell) => {
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE8DCD0' }
                };
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                cell.alignment = { vertical: 'middle', horizontal: 'center' };
            });
            
            let totalTrips = 0;
            let grandTotalWeight = 0;
            
            filteredVesselBarges.value.forEach((b, idx) => {
                const row = sheet.addRow([
                    idx + 1,
                    b.name,
                    b.truckCount,
                    b.totalWeight,
                    formatDateTimeStr(b.dateStart) || '-',
                    formatDateTimeStr(b.dateEnd) || '-'
                ]);
                totalTrips += b.truckCount;
                grandTotalWeight += b.totalWeight;
                
                row.font = { name: 'Times New Roman', size: 11 };
                row.eachCell((cell, colNumber) => {
                    cell.border = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' }
                    };
                    if (colNumber === 1 || colNumber === 2 || colNumber === 5 || colNumber === 6) {
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    } else if (colNumber === 3) {
                        cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    } else if (colNumber === 4) {
                        cell.alignment = { horizontal: 'right', vertical: 'middle' };
                        cell.numFmt = '#,##0';
                    }
                });
            });
            
            const totalRow = sheet.addRow([
                'TỔNG CỘNG',
                '',
                totalTrips,
                grandTotalWeight,
                '',
                ''
            ]);
            sheet.mergeCells(`A${totalRow.number}:B${totalRow.number}`);
            
            totalRow.font = { name: 'Times New Roman', size: 11, bold: true };
            totalRow.eachCell((cell, colNumber) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF5EBE6' }
                };
                if (colNumber === 1) {
                    cell.alignment = { horizontal: 'center', vertical: 'middle' };
                } else if (colNumber === 3) {
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                } else if (colNumber === 4) {
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                    cell.numFmt = '#,##0';
                }
            });
            
            sheet.columns.forEach((col, idx) => {
                let maxLen = 10;
                sheet.eachRow((row) => {
                    const val = row.getCell(idx + 1).value;
                    if (val) maxLen = Math.max(maxLen, String(val).length);
                });
                col.width = maxLen + 4;
            });
            
            const buffer = await workbook.xlsx.writeBuffer();
            excelService.downloadFile(
                buffer, 
                `BAO_CAO_TONG_HOP_TAU_${vessel.name.replace(/\s+/g, '_')}.xlsx`, 
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            );
            showToast('Xuất báo cáo tổng hợp tàu thành công!');
        });
    } catch (e: any) {
        showToast('Lỗi khi xuất báo cáo: ' + e.message, 'error');
    }
};

// Auto save configurations when modified (debounced)
let saveDebounceTimer: any = null;
const saveBargeConfig = () => {
    const bargeId = activeBargeId.value;
    if (!bargeId) return;
    if (cfgForm.locked) return; // Prevent auto-saving when locked
    
    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(async () => {
        saving.value = true;
        try {
            const success = await WeighbridgeService.updateBargeConfig(bargeId, { ...cfgForm });
            if (success) {
                // Update local model
                if (activeBarge.value) {
                    activeBarge.value.config = { ...cfgForm };
                }
            }
        } catch (e) {
            console.error(e);
        } finally {
            saving.value = false;
        }
    }, 1000);
};

// Immediate save configuration (with toast notification)
const saveBargeConfigImmediately = async () => {
    const bargeId = activeBargeId.value;
    if (!bargeId) return;
    if (cfgForm.locked) {
        showToast('Sà lan đang bị khóa! Không thể lưu cấu hình.', 'error');
        return;
    }

    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
    
    saving.value = true;
    try {
        const success = await WeighbridgeService.updateBargeConfig(bargeId, { ...cfgForm });
        if (success) {
            if (activeBarge.value) {
                activeBarge.value.config = { ...cfgForm };
            }
            showToast('Đã lưu cấu hình mẫu phiếu thành công!');
        } else {
            showToast('Không thể lưu cấu hình mẫu phiếu!', 'error');
        }
    } catch (e) {
        console.error('Error saving barge config:', e);
        showToast('Lỗi kết nối khi lưu cấu hình!', 'error');
    } finally {
        saving.value = false;
    }
};

const toggleBargeLock = async () => {
    const bargeId = activeBargeId.value;
    if (!bargeId) return;

    const newLockState = !cfgForm.locked;
    saving.value = true;
    try {
        const success = await WeighbridgeService.updateBargeConfig(bargeId, { ...cfgForm, locked: newLockState });
        if (success) {
            cfgForm.locked = newLockState;
            if (activeBarge.value) {
                activeBarge.value.config = { ...cfgForm };
            }
            // Update in local vessels list
            vessels.value.forEach(v => {
                const b = v.barges?.find(barge => barge.id === bargeId);
                if (b) {
                    b.config = { ...cfgForm };
                }
            });
            showToast(cfgForm.locked ? 'Đã khóa sà lan thành công! 🔒' : 'Đã mở khóa sà lan thành công! 🔓');
        } else {
            showToast('Không thể thay đổi trạng thái khóa!', 'error');
        }
    } catch (e) {
        console.error('Error toggling barge lock:', e);
        showToast('Lỗi kết nối khi đổi trạng thái khóa!', 'error');
    } finally {
        saving.value = false;
    }
};

// Custom field layouts computed and methods
const printFieldsLeft = computed(() => {
    return (cfgForm.printFields || [])
        .filter(f => f.column === 'left')
        .sort((a, b) => a.order - b.order);
});

const printFieldsRight = computed(() => {
    return (cfgForm.printFields || [])
        .filter(f => f.column === 'right')
        .sort((a, b) => a.order - b.order);
});

const isFirstQualityField = (fieldId: string) => {
    const visibleRight = printFieldsRight.value.filter(f => f.visible);
    const firstQuality = visibleRight.find(f => f.id === 'chinhpham' || f.id === 'phupham');
    return firstQuality?.id === fieldId;
};

const getFieldValue = (fieldId: string, truck?: Truck) => {
    const sampleTruck = {
        id: 0,
        barge_id: 0,
        ticketNo: 'PC-001',
        plateNumber: '51C-123.45',
        driver: 'Nguyễn Văn Hùng',
        weight1: 35400,
        weight2: 12200,
        weightNet: 23200,
        dateIn: '2026-06-20T08:30:00Z',
        dateOut: '2026-06-20T09:00:00Z',
        note: 'Đạt chuẩn'
    };
    
    const t = truck || sampleTruck;
    
    switch (fieldId) {
        case 'plateNumber': return t.plateNumber;
        case 'goods': return cfgForm.goods || 'Đất sét nguyên liệu';
        case 'owner': return cfgForm.owner || 'Công ty Cảng Nguyên Ngọc';
        case 'weight1': return `${formatNumber(t.weight1)} kg`;
        case 'weight2': return `${formatNumber(t.weight2)} kg`;
        case 'weightNet': return `${formatNumber(t.weightNet)} kg`;
        case 'words': return DocSoThanhChu(t.weightNet);
        case 'barge': return activeBarge.value?.name || 'Sà lan SG-9921';
        case 'note': return t.note || '-';
        case 'driver': return t.driver || '-';
        case 'goodsCode': return cfgForm.goodsCode || '-';
        case 'xn': return cfgForm.xn;
        case 'chinhpham': return `${cfgForm.chinhpham} %`;
        case 'phupham': return `${cfgForm.phupham} %`;
        case 'ketluan': return cfgForm.ketluan || '-';
        default: return '';
    }
};

const moveField = (fieldId: string, direction: 'up' | 'down') => {
    if (cfgForm.locked) return;
    const fields = cfgForm.printFields || [];
    const index = fields.findIndex(f => f.id === fieldId);
    if (index === -1) return;
    
    const currentField = fields[index];
    if (!currentField) return;
    
    const columnFields = fields.filter(f => f.column === currentField.column).sort((a, b) => a.order - b.order);
    const colIndex = columnFields.findIndex(f => f.id === fieldId);
    
    if (direction === 'up' && colIndex > 0) {
        const prevField = columnFields[colIndex - 1];
        if (prevField) {
            const tempOrder = currentField.order;
            currentField.order = prevField.order;
            prevField.order = tempOrder;
        }
    } else if (direction === 'down' && colIndex < columnFields.length - 1) {
        const nextField = columnFields[colIndex + 1];
        if (nextField) {
            const tempOrder = currentField.order;
            currentField.order = nextField.order;
            nextField.order = tempOrder;
        }
    }
    resequenceFields();
};

const switchColumn = (fieldId: string) => {
    if (cfgForm.locked) return;
    const fields = cfgForm.printFields || [];
    const field = fields.find(f => f.id === fieldId);
    if (!field) return;
    
    field.column = field.column === 'left' ? 'right' : 'left';
    const maxOrder = fields.filter(f => f.column === field.column).reduce((max, f) => Math.max(max, f.order), 0);
    field.order = maxOrder + 1;
    
    resequenceFields();
};

const resequenceFields = () => {
    const fields = cfgForm.printFields || [];
    ['left', 'right'].forEach(col => {
        fields
            .filter(f => f.column === col)
            .sort((a, b) => a.order - b.order)
            .forEach((f, idx) => {
                f.order = idx + 1;
            });
    });
};

// Watch config form for auto-saving
watch(cfgForm, () => {
    saveBargeConfig();
}, { deep: true });

// Watch activeVesselId to automatically load vessel summary when switching vessels/barges
watch(activeVesselId, async (newVesselId) => {
    if (newVesselId) {
        await refreshVesselSummary();
    } else {
        vesselBargesSummary.value = [];
        await refreshGlobalBargesSummary();
    }
});

// Watch activeBargeId: if we return to the vessel summary view (activeBargeId becomes null)
watch(activeBargeId, async (newBargeId) => {
    if (newBargeId === null) {
        if (activeVesselId.value !== null) {
            await refreshVesselSummary();
        } else {
            await refreshGlobalBargesSummary();
        }
    }
});

// Handle ticket prefix or seed change from UI to regenerate ticket numbers
const handleTicketConfigChange = async () => {
    const bargeId = activeBargeId.value;
    if (!bargeId) return;
    if (cfgForm.locked) {
        showToast('Sà lan đang bị khóa! Không thể thay đổi số phiếu.', 'error');
        return;
    }

    // Save configuration immediately to Supabase
    saving.value = true;
    try {
        await WeighbridgeService.updateBargeConfig(bargeId, { ...cfgForm });
        if (activeBarge.value) {
            activeBarge.value.config = { ...cfgForm };
        }
    } catch (e) {
        console.error('Error saving barge config:', e);
    } finally {
        saving.value = false;
    }

    if (trucks.value.length === 0) return;
    
    // Regenerate ticket numbers
    const prefix = cfgForm.ticketPrefix || 'PC-';
    const seedStr = String(cfgForm.ticketSeed || '1');
    let seed = parseInt(seedStr) || 1;
    const padLength = seedStr.length;

    trucks.value.forEach(truck => {
        const padNum = String(seed).padStart(padLength, '0');
        truck.ticketNo = `${prefix}${padNum}`;
        seed++;
    });

    // Save updated list to Supabase
    saving.value = true;
    try {
        await WeighbridgeService.saveTrucks(bargeId, trucks.value);
        showToast('Đã cập nhật lại toàn bộ số phiếu xe!');
    } catch (e) {
        showToast('Lỗi khi cập nhật lại số phiếu xe!', 'error');
    } finally {
        saving.value = false;
    }
};

// Vessel CRUD
const addVessel = async () => {
    const name = prompt('Nhập tên tàu mới:');
    if (!name || !name.trim()) return;

    loading.value = true;
    try {
        const data = await WeighbridgeService.createVessel(name);
        if (data) {
            await loadVessels();
            expandedVesselIds.value[data.id] = true;
            showToast(`Đã thêm tàu: ${data.name}`);
        } else {
            showToast('Không thể thêm tàu mới!', 'error');
        }
    } catch (e) {
        showToast('Lỗi khi thêm tàu!', 'error');
    } finally {
        loading.value = false;
    }
};

const renameVessel = async (id: number, currentName: string) => {
    const name = prompt('Nhập tên tàu mới:', currentName);
    if (!name || !name.trim() || name.trim() === currentName) return;

    loading.value = true;
    try {
        const success = await WeighbridgeService.updateVessel(id, name);
        if (success) {
            await loadVessels();
            showToast(`Đã đổi tên tàu thành: ${name}`);
        } else {
            showToast('Không thể đổi tên tàu!', 'error');
        }
    } catch (e) {
        showToast('Lỗi khi đổi tên tàu!', 'error');
    } finally {
        loading.value = false;
    }
};

const deleteVessel = async (id: number, name: string) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa tàu "${name}" cùng toàn bộ sà lan và dữ liệu cân xe của nó không?`)) return;

    loading.value = true;
    try {
        const success = await WeighbridgeService.deleteVessel(id);
        if (success) {
            if (activeVesselId.value === id) {
                activeVesselId.value = null;
                activeBargeId.value = null;
                trucks.value = [];
            }
            await loadVessels();
            showToast(`Đã xóa tàu: ${name}`, 'error');
        } else {
            showToast('Không thể xóa tàu!', 'error');
        }
    } catch (e) {
        showToast('Lỗi khi xóa tàu!', 'error');
    } finally {
        loading.value = false;
    }
};

// Barge CRUD
const addBarge = async (vesselId: number) => {
    const name = prompt('Nhập tên sà lan mới:');
    if (!name || !name.trim()) return;

    loading.value = true;
    try {
        const data = await WeighbridgeService.createBarge(vesselId, name);
        if (data) {
            await loadVessels();
            await selectBarge(vesselId, data.id);
            showToast(`Đã thêm sà lan: ${data.name}`);
        } else {
            showToast('Không thể thêm sà lan mới!', 'error');
        }
    } catch (e) {
        showToast('Lỗi khi thêm sà lan!', 'error');
    } finally {
        loading.value = false;
    }
};

const renameBarge = async (id: number, currentName: string) => {
    const barge = vessels.value.flatMap(v => v.barges || []).find(b => b.id === id);
    if (barge?.config?.locked) {
        showToast('Sà lan đang bị khóa! Vui lòng mở khóa để đổi tên.', 'error');
        return;
    }

    const name = prompt('Nhập tên sà lan mới:', currentName);
    if (!name || !name.trim() || name.trim() === currentName) return;

    loading.value = true;
    try {
        const success = await WeighbridgeService.updateBarge(id, name);
        if (success) {
            await loadVessels();
            if (activeBargeId.value === id && activeVesselId.value) {
                await selectBarge(activeVesselId.value, id);
            }
            showToast(`Đã đổi tên sà lan thành: ${name}`);
        } else {
            showToast('Không thể đổi tên sà lan!', 'error');
        }
    } catch (e) {
        showToast('Lỗi khi đổi tên sà lan!', 'error');
    } finally {
        loading.value = false;
    }
};

const deleteBarge = async (_vesselId: number, id: number, name: string) => {
    const barge = vessels.value.flatMap(v => v.barges || []).find(b => b.id === id);
    if (barge?.config?.locked) {
        showToast('Sà lan đang bị khóa! Vui lòng mở khóa để xóa.', 'error');
        return;
    }

    if (!confirm(`Bạn có chắc chắn muốn xóa sà lan "${name}" cùng toàn bộ danh sách xe không?`)) return;

    loading.value = true;
    try {
        const success = await WeighbridgeService.deleteBarge(id);
        if (success) {
            if (activeBargeId.value === id) {
                activeBargeId.value = null;
                trucks.value = [];
            }
            await loadVessels();
            showToast(`Đã xóa sà lan: ${name}`, 'error');
        } else {
            showToast('Không thể xóa sà lan!', 'error');
        }
    } catch (e) {
        showToast('Lỗi khi xóa sà lan!', 'error');
    } finally {
        loading.value = false;
    }
};

// Excel Upload and Analysis
const handleExcelFile = async (file: File) => {
    if (!activeBargeId.value) {
        showToast('Vui lòng chọn một sà lan trước!', 'error');
        return;
    }
    if (cfgForm.locked) {
        showToast('Sà lan đang bị khóa! Không thể nhập Excel.', 'error');
        return;
    }
    
    loading.value = true;
    try {
        const workbook = await excelService.readExcel(file);
        const worksheet = excelService.getWorksheet(workbook, 0);
        
        if (!worksheet) {
            showToast('File Excel không có dữ liệu!', 'error');
            return;
        }

        const rawRows: any[][] = [];
        worksheet.eachRow({ includeEmpty: true }, (row) => {
            const rowValues: any[] = [];
            const values = (row.values as any[]) || [];
            // values[1] is column A. Let's copy values to a 0-based array.
            for (let col = 1; col < values.length; col++) {
                const val = values[col];
                if (val && typeof val === 'object') {
                    if ('result' in val) {
                        rowValues.push(val.result);
                    } else if ('text' in val) {
                        rowValues.push(val.text);
                    } else if (val instanceof Date) {
                        rowValues.push(val);
                    } else {
                        rowValues.push(val.toString());
                    }
                } else {
                    rowValues.push(val);
                }
            }
            rawRows.push(rowValues);
        });

        if (rawRows.length === 0) {
            showToast('File Excel rỗng!', 'error');
            return;
        }

        // Fuzzy match headers
        analyzeExcelHeaders(rawRows);
    } catch (err: any) {
        showToast('Lỗi phân tích file Excel: ' + err.message, 'error');
    } finally {
        loading.value = false;
    }
};

const handleFileSelect = (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
        const file = target.files[0];
        if (file) handleExcelFile(file);
    }
    target.value = '';
};

const handleExcelDrop = (e: DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer && e.dataTransfer.files.length > 0) {
        const file = e.dataTransfer.files[0];
        if (file) handleExcelFile(file);
    }
};

const analyzeExcelHeaders = (rawRows: any[][]) => {
    let headerRowIndex = -1;
    let maxMatches = 0;

    const keywords: Record<ExcelField, string[]> = {
        ticketNo: ["số phiếu", "phiếu số", "phieu", "ticket", "mã phiếu", "ma phieu", "so phieu"],
        plateNumber: ["số xe", "biển số", "biển xe", "xe", "sks", "số kiểm soát", "plate", "phương tiện"],
        weight1: ["lần 1", "trọng lượng 1", "tl 1", "cân 1", "lần một", "gross", "tổng"],
        weight2: ["lần 2", "trọng lượng 2", "tl 2", "cân 2", "lần hai", "tare", "xe", "xác"],
        weightNet: ["hàng", "khối lượng hàng", "trọng lượng hàng", "tịnh", "net", "khối lượng tịnh", "kl tịnh"],
        dateIn: ["giờ vào", "ngày vào", "vào", "thời gian vào", "ngày giờ vào", "time in"],
        dateOut: ["giờ ra", "ngày ra", "ra", "thời gian ra", "ngày giờ ra", "time out"],
        driver: ["tài xế", "tài", "lái xe", "tên tài xế", "driver"],
        note: ["ghi chú", "note", "diễn giải", "ghi chú thêm"]
    };

    for (let r = 0; r < Math.min(rawRows.length, 15); r++) {
        const row = rawRows[r];
        if (!row || !Array.isArray(row)) continue;

        let matches = 0;
        row.forEach(cell => {
            if (cell === null || cell === undefined) return;
            const val = String(cell).toLowerCase().trim();
            
            Object.values(keywords).forEach(kwList => {
                if (kwList.some(kw => val.includes(kw))) {
                    matches++;
                }
            });
        });

        if (matches > maxMatches) {
            maxMatches = matches;
            headerRowIndex = r;
        }
    }

    if (headerRowIndex === -1) {
        headerRowIndex = 0;
    }

    const headerRow = rawRows[headerRowIndex];
    if (!headerRow) {
        showToast('Không đọc được tiêu đề Excel!', 'error');
        return;
    }

    const columns: ExcelColumn[] = headerRow.map((cell, idx) => ({
        index: idx,
        name: cell !== undefined && cell !== null ? String(cell).trim() : `Cột ${idx + 1}`
    }));

    const mapping: Record<ExcelField, number> = {
        ticketNo: -1,
        plateNumber: -1,
        weight1: -1,
        weight2: -1,
        weightNet: -1,
        dateIn: -1,
        dateOut: -1,
        driver: -1,
        note: -1
    };

    columns.forEach(col => {
        const nameLower = col.name.toLowerCase();
        
        (Object.keys(keywords) as ExcelField[]).forEach(field => {
            if (mapping[field] !== -1) return;
            if (keywords[field].some(kw => nameLower.includes(kw))) {
                mapping[field] = col.index;
            }
        });
    });

    pendingExcelData.value = {
        rawRows,
        headerIndex: headerRowIndex,
        columns,
        mapping
    };

    showMappingModal.value = true;
};

const parseExcelDate = (val: any): string => {
    if (!val) return '';
    if (val instanceof Date) {
        return val.toISOString().slice(0, 16);
    }
    if (typeof val === 'number') {
        const date = new Date(Math.round((val - 25569) * 86400 * 1000));
        return date.toISOString().slice(0, 16);
    }
    const str = String(val).trim();
    const dMyHm = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})\s+(\d{1,2}):(\d{1,2})/);
    if (dMyHm) {
        const date = new Date(parseInt(dMyHm[3] || '0'), parseInt(dMyHm[2] || '1') - 1, parseInt(dMyHm[1] || '1'), parseInt(dMyHm[4] || '0'), parseInt(dMyHm[5] || '0'));
        if (!isNaN(date.getTime())) return date.toISOString().slice(0, 16);
    }
    const iso = str.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/);
    if (iso) return str.slice(0, 16);

    return '';
};

const confirmExcelMapping = async () => {
    const bargeId = activeBargeId.value;
    if (!pendingExcelData.value || !bargeId) return;
    if (cfgForm.locked) {
        showToast('Sà lan đang bị khóa! Không thể nhập dữ liệu.', 'error');
        return;
    }

    const mapping = pendingExcelData.value.mapping;
    const requiredFields: ExcelField[] = ['plateNumber', 'weight1', 'weight2'];
    const hasRequired = requiredFields.every(f => (mapping[f] ?? -1) !== -1);

    if (!hasRequired) {
        alert("Vui lòng ánh xạ các cột bắt buộc: Số xe, Trọng lượng lần 1, Trọng lượng lần 2.");
        return;
    }

    const ticketNoCol = mapping.ticketNo;
    const plateCol = mapping.plateNumber;
    const w1Col = mapping.weight1;
    const w2Col = mapping.weight2;
    const wNetCol = mapping.weightNet;
    const dateInCol = mapping.dateIn;
    const dateOutCol = mapping.dateOut;
    const driverCol = mapping.driver;
    const noteCol = mapping.note;

    if (plateCol === undefined || plateCol === -1 || w1Col === undefined || w1Col === -1 || w2Col === undefined || w2Col === -1) {
        alert("Ánh xạ cột không hợp lệ!");
        return;
    }

    loading.value = true;
    try {
        const startRow = pendingExcelData.value.headerIndex + 1;
        const importedTrucks: Truck[] = [];
        
        const prefix = cfgForm.ticketPrefix || 'PC-';
        const seedStr = String(cfgForm.ticketSeed || '1');
        let seed = parseInt(seedStr) || 1;
        const padLength = seedStr.length;

        for (let r = startRow; r < pendingExcelData.value.rawRows.length; r++) {
            const row = pendingExcelData.value.rawRows[r];
            if (!row || row.length === 0) continue;

            const plateRaw = row[plateCol];
            if (plateRaw === undefined || plateRaw === null || String(plateRaw).trim() === '') continue;
            const plate = String(plateRaw).trim().toUpperCase();

            const w1 = parseFloat(String(row[w1Col]).replace(/[^0-9.-]/g, '')) || 0;
            const w2 = parseFloat(String(row[w2Col]).replace(/[^0-9.-]/g, '')) || 0;
            
            let wNet = 0;
            if (wNetCol !== undefined && wNetCol !== -1 && row[wNetCol] !== undefined && row[wNetCol] !== null) {
                wNet = parseFloat(String(row[wNetCol]).replace(/[^0-9.-]/g, '')) || 0;
            }
            if (wNet === 0) {
                wNet = Math.abs(w1 - w2);
            }

            let dIn = '';
            if (dateInCol !== undefined && dateInCol !== -1 && row[dateInCol]) {
                dIn = parseExcelDate(row[dateInCol]);
            }
            let dOut = '';
            if (dateOutCol !== undefined && dateOutCol !== -1 && row[dateOutCol]) {
                dOut = parseExcelDate(row[dateOutCol]);
            }

            if (!dIn) {
                const now = new Date();
                dIn = now.toISOString().slice(0, 16);
            }
            if (!dOut) {
                const now = new Date();
                now.setMinutes(now.getMinutes() + 30);
                dOut = now.toISOString().slice(0, 16);
            }

            const driver = driverCol !== undefined && driverCol !== -1 && row[driverCol] ? String(row[driverCol]).trim() : '';
            const note = noteCol !== undefined && noteCol !== -1 && row[noteCol] ? String(row[noteCol]).trim() : '';

            let ticketNo = '';
            if (ticketNoCol !== undefined && ticketNoCol !== -1 && row[ticketNoCol] !== undefined && row[ticketNoCol] !== null) {
                ticketNo = String(row[ticketNoCol]).trim();
            }
            if (!ticketNo) {
                const padNum = String(seed).padStart(padLength, '0');
                ticketNo = `${prefix}${padNum}`;
                seed++;
            }

            importedTrucks.push({
                id: Date.now() + r,
                barge_id: bargeId,
                ticketNo: ticketNo,
                plateNumber: plate,
                driver: driver,
                weight1: w1,
                weight2: w2,
                weightNet: wNet,
                dateIn: dIn,
                dateOut: dOut,
                note: note
            });
        }

        // Upsert to DB
        const allTrucks = [...trucks.value, ...importedTrucks];
        const success = await WeighbridgeService.saveTrucks(bargeId, allTrucks);

        if (success) {
            // Update seed in configuration
            cfgForm.ticketSeed = String(seed).padStart(padLength, '0');
            await WeighbridgeService.updateBargeConfig(bargeId, { ...cfgForm });
            
            // Reload list
            trucks.value = await WeighbridgeService.getTrucks(bargeId);
            showToast(`Đã nhập thành công ${importedTrucks.length} xe từ file Excel!`);
        } else {
            showToast('Lỗi lưu trữ dữ liệu xe vào database!', 'error');
        }
    } catch (e: any) {
        showToast('Lỗi trong khi nhập dữ liệu: ' + e.message, 'error');
    } finally {
        showMappingModal.value = false;
        pendingExcelData.value = null;
        loading.value = false;
    }
};

const downloadSampleExcel = () => {
    try {
        const sampleHeaders = [
            ['STT', 'Số phiếu', 'Biển số xe', 'Tài xế', 'Trọng lượng lần 1 (Gross)', 'Trọng lượng lần 2 (Tare)', 'Trọng lượng hàng (Net)', 'Thời gian vào', 'Thời gian ra', 'Ghi chú'],
            [1, 'PC-001', '51C-123.45', 'Nguyễn Văn Hùng', 35400, 12200, 23200, '2026-06-20 08:30', '2026-06-20 09:00', 'Đạt chuẩn'],
            [2, 'PC-002', '60C-554.89', 'Lê Hữu Tình', 28900, 11800, 17100, '2026-06-20 09:15', '2026-06-20 09:45', 'Hàng ẩm nhẹ'],
            [3, 'PC-003', '72H-992.11', 'Phạm Quốc Bảo', 31500, 12000, 19500, '2026-06-20 10:00', '2026-06-20 10:30', '']
        ];
        
        // Dynamically import ExcelJS if not globally imported
        import('exceljs').then(async (ExcelJS) => {
            const workbook = new ExcelJS.Workbook();
            const sheet = workbook.addWorksheet('Mẫu Dữ Liệu Xe');
            
            sampleHeaders.forEach(row => {
                sheet.addRow(row);
            });
            
            const buffer = await workbook.xlsx.writeBuffer();
            excelService.downloadFile(buffer, 'MAU_DANH_SACH_XE_CAN.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            showToast('Đã tải file mẫu thành công!');
        });
    } catch (e: any) {
        showToast('Lỗi khi tạo file mẫu: ' + e.message, 'error');
    }
};

// Truck CRUD Dialog Functions
const openAddTruckDialog = () => {
    if (cfgForm.locked) {
        showToast('Sà lan đang bị khóa! Không thể thêm xe.', 'error');
        return;
    }
    dialogTruck.id = 0;
    dialogTruck.ticketNo = '';
    dialogTruck.plateNumber = '';
    dialogTruck.driver = '';
    dialogTruck.weight1 = 0;
    dialogTruck.weight2 = 0;
    dialogTruck.weightNet = 0;
    
    const now = new Date();
    dialogTruck.dateIn = now.toISOString().slice(0, 16);
    now.setMinutes(now.getMinutes() + 30);
    dialogTruck.dateOut = now.toISOString().slice(0, 16);
    
    dialogTruck.note = '';
    
    showTruckDialog.value = true;
};

const openEditTruckDialog = (truck: Truck) => {
    if (cfgForm.locked) {
        showToast('Sà lan đang bị khóa! Không thể sửa thông tin.', 'error');
        return;
    }
    dialogTruck.id = truck.id;
    dialogTruck.ticketNo = truck.ticketNo;
    dialogTruck.plateNumber = truck.plateNumber;
    dialogTruck.driver = truck.driver || '';
    dialogTruck.weight1 = truck.weight1;
    dialogTruck.weight2 = truck.weight2;
    dialogTruck.weightNet = truck.weightNet;
    dialogTruck.dateIn = truck.dateIn || '';
    dialogTruck.dateOut = truck.dateOut || '';
    dialogTruck.note = truck.note || '';
    
    showTruckDialog.value = true;
};

const onWeightInput = () => {
    dialogTruck.weightNet = Math.abs(dialogTruck.weight1 - dialogTruck.weight2);
};

const saveTruck = async () => {
    if (cfgForm.locked) {
        showToast('Sà lan đang bị khóa! Không thể lưu dữ liệu.', 'error');
        return;
    }
    if (!dialogTruck.plateNumber.trim()) {
        alert("Vui lòng nhập biển số xe.");
        return;
    }
    const bargeId = activeBargeId.value;
    if (!bargeId) return;

    loading.value = true;
    try {
        let ticketNo = dialogTruck.ticketNo;
        
        // Generate new ticket no if adding new
        if (dialogTruck.id === 0) {
            const prefix = cfgForm.ticketPrefix || 'PC-';
            const seedStr = String(cfgForm.ticketSeed || '1');
            let seed = parseInt(seedStr) || 1;
            const padLength = seedStr.length;

            const padNum = String(seed).padStart(padLength, '0');
            ticketNo = `${prefix}${padNum}`;
            seed++;

            // Update configuration seed
            cfgForm.ticketSeed = String(seed).padStart(padLength, '0');
            await WeighbridgeService.updateBargeConfig(bargeId, { ...cfgForm });
        }

        const truckData = {
            id: dialogTruck.id || Date.now(),
            ticketNo,
            plateNumber: dialogTruck.plateNumber.trim().toUpperCase(),
            driver: dialogTruck.driver.trim(),
            weight1: dialogTruck.weight1,
            weight2: dialogTruck.weight2,
            weightNet: dialogTruck.weightNet,
            dateIn: dialogTruck.dateIn,
            dateOut: dialogTruck.dateOut,
            note: dialogTruck.note.trim()
        };

        const success = await WeighbridgeService.saveSingleTruck(bargeId, truckData);
        if (success) {
            showToast(dialogTruck.id ? 'Đã cập nhật thông tin xe!' : 'Đã thêm xe thành công!');
            // Reload list
            trucks.value = await WeighbridgeService.getTrucks(bargeId);
            showTruckDialog.value = false;
        } else {
            showToast('Không thể lưu thông tin xe!', 'error');
        }
    } catch (e: any) {
        showToast('Lỗi: ' + e.message, 'error');
    } finally {
        loading.value = false;
    }
};

const deleteTruck = async (id: number, plate: string) => {
    if (cfgForm.locked) {
        showToast('Sà lan đang bị khóa! Không thể xóa xe.', 'error');
        return;
    }
    if (!confirm(`Bạn có muốn xóa xe "${plate}" ra khỏi danh sách không?`)) return;

    const bargeId = activeBargeId.value;
    if (!bargeId) return;

    loading.value = true;
    try {
        const success = await WeighbridgeService.deleteTruck(id);
        if (success) {
            trucks.value = trucks.value.filter(t => t.id !== id);
            showToast(`Đã xóa xe: ${plate}`, 'error');
        } else {
            showToast('Không thể xóa xe!', 'error');
        }
    } catch (e) {
        showToast('Lỗi khi xóa xe!', 'error');
    } finally {
        loading.value = false;
    }
};

const clearTrucks = async () => {
    const bargeId = activeBargeId.value;
    if (!bargeId) return;
    if (cfgForm.locked) {
        showToast('Sà lan đang bị khóa! Không thể xóa danh sách.', 'error');
        return;
    }
    if (!confirm("Bạn có chắc chắn muốn xóa toàn bộ danh sách xe của sà lan này?")) return;

    loading.value = true;
    try {
        const success = await WeighbridgeService.clearBargeTrucks(bargeId);
        if (success) {
            trucks.value = [];
            
            // Reset seed in config
            const padLength = String(cfgForm.ticketSeed || '1').length;
            cfgForm.ticketSeed = "1".padStart(padLength, '0');
            await WeighbridgeService.updateBargeConfig(bargeId, { ...cfgForm });

            showToast("Đã xóa sạch danh sách xe của sà lan!", "error");
        } else {
            showToast('Không thể xóa danh sách xe!', 'error');
        }
    } catch (e) {
        showToast('Lỗi khi xóa danh sách!', 'error');
    } finally {
        loading.value = false;
    }
};

// Vietnamese Number-to-Words Converter
function DocSoThanhChu(so: number): string {
    if (so === 0) return "Không ki-lô-gam";
    const ChuSo = ["không", "một", "hai", "ba", "bốn", "năm", "sáu", "bảy", "tám", "chín"];
    
    function docXetChuc(chuc: number, donvi: number, KetQua: string) {
        if (chuc > 1) {
            KetQua += " " + ChuSo[chuc] + " mươi";
            if (donvi === 1) KetQua += " mốt";
            else if (donvi === 5) KetQua += " lăm";
            else if (donvi > 0) KetQua += " " + ChuSo[donvi];
        } else if (chuc === 1) {
            KetQua += " mười";
            if (donvi === 1) KetQua += " một";
            else if (donvi === 5) KetQua += " lăm";
            else if (donvi > 0) KetQua += " " + ChuSo[donvi];
        } else {
            if (donvi > 0) {
                if (KetQua !== "") KetQua += " lẻ";
                KetQua += " " + ChuSo[donvi];
            }
        }
        return KetQua;
    }

    function Doc3ChuSo(baso: number, daydu: boolean) {
        let tram = Math.floor(baso / 100);
        let chuc = Math.floor((baso % 100) / 10);
        let donvi = baso % 10;
        let KetQua = "";
        
        if (tram === 0 && chuc === 0 && donvi === 0) return "";
        
        if (daydu || tram > 0) {
            KetQua += " " + ChuSo[tram] + " trăm";
            KetQua = docXetChuc(chuc, donvi, KetQua);
        } else {
            KetQua = docXetChuc(chuc, donvi, KetQua);
        }
        return KetQua;
    }

    let strSo = String(Math.abs(so));
    let sochech = strSo.length % 3;
    if (sochech === 1) strSo = "00" + strSo;
    else if (sochech === 2) strSo = "0" + strSo;

    let nhom3 = [];
    for (let i = 0; i < strSo.length; i += 3) {
        nhom3.push(parseInt(strSo.slice(i, i + 3)));
    }

    const DonViLon = ["", " nghìn", " triệu", " tỷ", " nghìn tỷ", " triệu tỷ"];
    let KetQuaFinal = "";
    let countNhom = nhom3.length;
    
    for (let i = 0; i < countNhom; i++) {
        const val = nhom3[i];
        if (val === undefined) continue;
        const isDayDu = i > 0;
        const chuNhom = Doc3ChuSo(val, isDayDu);
        if (chuNhom !== "") {
            KetQuaFinal += chuNhom + DonViLon[countNhom - 1 - i];
        }
    }

    let text = KetQuaFinal.trim().replace(/\s+/g, ' ');
    text = text.charAt(0).toUpperCase() + text.slice(1);
    return text + " ki-lô-gam";
}

// Helpers for printing and formatting
const formatDateTimeStr = (isoString: string): string => {
    if (!isoString) return '';
    try {
        const date = new Date(isoString);
        if (isNaN(date.getTime())) return isoString;
        const d = String(date.getDate()).padStart(2, '0');
        const m = String(date.getMonth() + 1).padStart(2, '0');
        const y = date.getFullYear();
        const h = String(date.getHours()).padStart(2, '0');
        const min = String(date.getMinutes()).padStart(2, '0');
        return `${h}:${min} ${d}/${m}/${y}`;
    } catch(e) {
        return isoString;
    }
};

const formatNumber = (num: number): string => {
    return Number(num).toLocaleString('vi-VN');
};

// Print Logic
const printTrucksList = ref<Truck[]>([]);

const triggerPrint = (singleTruck?: Truck) => {
    if (singleTruck) {
        printTrucksList.value = [singleTruck];
    } else {
        if (filteredTrucks.value.length === 0) {
            alert("Danh sách xe trống! Vui lòng tải file Excel hoặc thêm xe thủ công trước khi in.");
            return;
        }
        printTrucksList.value = [...filteredTrucks.value];
    }

    // Wait for DOM to render the print section
    setTimeout(() => {
        window.print();
    }, 200);
};

// Initialize
onMounted(() => {
    loadVessels();
});
</script>

<template>
    <div class="weighbridge-printer-wrapper">
        <div v-if="!hideCard" class="bg-white rounded-[24px] p-8 md:p-10 soft-shadow border border-primary/5 relative overflow-hidden flex flex-col justify-between h-full group">
            <div class="absolute -top-6 -right-6 p-8 opacity-5 group-hover:opacity-10 group-hover:scale-110 transition-all pointer-events-none">
                <span class="material-symbols-outlined text-[120px] text-primary">print</span>
            </div>
            <div>
                <h3 class="text-2xl font-display font-black text-primary mb-3">In Phiếu Cân Xe 🚢</h3>
                <p class="text-sm font-medium text-[#1b0d11]/60 leading-relaxed mb-6">
                    Quản lý danh sách tàu, sà lan và nhập xe từ Excel. Hỗ trợ tạo và in phiếu cân tự động định dạng A5 chuyên nghiệp.
                </p>
                <div class="flex flex-wrap gap-2 mb-6">
                    <span class="text-xs font-bold px-3 py-1 bg-primary/10 text-primary rounded-full">Supabase Cloud</span>
                    <span class="text-xs font-bold px-3 py-1 bg-teal-500/10 text-teal-600 rounded-full">In A5</span>
                    <span class="text-xs font-bold px-3 py-1 bg-amber-500/10 text-amber-600 rounded-full">Excel Smart Match</span>
                </div>
            </div>
            
            <button 
                @click="isOpen = true" 
                class="w-full py-4 puffy-button flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
                <span class="material-symbols-outlined">open_in_new</span>
                Mở công cụ In Phiếu Cân
            </button>
        </div>

        <!-- Fullscreen Workspace Overlay -->
        <div v-if="isOpen" class="fixed inset-0 bg-cute-gradient z-[100] flex flex-col overflow-hidden no-print animate-fade-in font-display">
            <!-- Header bar of Workspace -->
            <header class="bg-white px-6 py-2.5 border-b border-primary/10 flex items-center justify-between shadow-sm">
                <div class="flex items-center gap-2.5">
                    <div class="size-9 bg-primary rounded-full flex items-center justify-center text-white shadow-soft">
                        <span class="material-symbols-outlined text-lg">print</span>
                    </div>
                    <div>
                        <h2 class="text-sm font-black text-primary leading-tight">PHẦN MỀM IN PHIẾU CÂN XE</h2>
                        <p class="text-[10px] font-medium text-[#1b0d11]/60 leading-none">Cảng Nguyên Ngọc - Đồng bộ đám mây</p>
                    </div>
                </div>
                
                <!-- Status bar -->
                <div class="flex items-center gap-3">
                    <div v-if="!authStore.isAuthenticated" class="hidden lg:flex items-center gap-1.5 text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                        <span class="material-symbols-outlined text-xs">warning</span>
                        Chưa đăng nhập! Dữ liệu đang được lưu tạm thời.
                    </div>
                    
                    <button 
                        @click="isOpen = false" 
                        class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-full text-xs flex items-center gap-1 transition-all"
                    >
                        <span class="material-symbols-outlined text-sm">close</span>
                        Đóng
                    </button>
                </div>
            </header>

            <!-- Main area -->
            <div class="flex-1 flex overflow-hidden">
                <!-- Sidebar (left): Vessels -> Barges tree -->
                <aside class="w-72 bg-white border-r border-primary/10 flex flex-col shrink-0">
                    <div class="p-3 border-b border-primary/5 flex items-center justify-between">
                        <span 
                            @click="activeVesselId = null; activeBargeId = null" 
                            class="text-xs font-black text-gray-500 hover:text-primary cursor-pointer uppercase tracking-wider transition-colors flex items-center gap-1"
                            title="Quay lại Trang tổng quan"
                        >
                            <span class="material-symbols-outlined text-sm">home</span>
                            Tổng quan
                        </span>
                        <button @click="loadVessels" class="size-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-primary transition-colors" title="Tải lại danh sách">
                            <span class="material-symbols-outlined text-lg" :class="{'animate-spin': loading}">refresh</span>
                        </button>
                    </div>

                    <!-- Tree list -->
                    <div class="flex-1 overflow-y-auto p-2 space-y-1.5">
                        <div v-if="vessels.length === 0" class="text-center py-6 text-gray-400 text-xs">
                            Chưa có dữ liệu tàu. Nhấn nút bên dưới để thêm tàu mới.
                        </div>

                        <div v-for="vessel in vessels" :key="vessel.id" class="border border-primary/5 rounded-[16px] overflow-hidden bg-gray-50">
                            <!-- Vessel Header -->
                            <div 
                                @click="selectVessel(vessel.id); expandedVesselIds[vessel.id] = !expandedVesselIds[vessel.id]"
                                :class="['flex items-center justify-between p-2.5 hover:bg-primary/5 cursor-pointer transition-colors', activeVesselId === vessel.id && activeBargeId === null ? 'bg-primary/10 border-l-4 border-primary' : '']"
                            >
                                <div class="flex items-center gap-1.5 font-bold text-xs text-[#4a2c32]">
                                    <span class="material-symbols-outlined text-primary text-base">directions_boat</span>
                                    <span class="truncate max-w-[120px]">{{ vessel.name }}</span>
                                </div>
                                
                                <!-- Vessel Actions -->
                                <div class="flex items-center gap-0.5" @click.stopPropagation>
                                    <button @click="addBarge(vessel.id)" class="size-6 rounded-full hover:bg-white flex items-center justify-center text-primary/70 hover:text-primary transition-colors" title="Thêm sà lan">
                                        <span class="material-symbols-outlined text-xs">add</span>
                                    </button>
                                    <button @click="renameVessel(vessel.id, vessel.name)" class="size-6 rounded-full hover:bg-white flex items-center justify-center text-gray-400 hover:text-primary transition-colors" title="Đổi tên tàu">
                                        <span class="material-symbols-outlined text-xs">edit</span>
                                    </button>
                                    <button @click="deleteVessel(vessel.id, vessel.name)" class="size-6 rounded-full hover:bg-white flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors" title="Xóa tàu">
                                        <span class="material-symbols-outlined text-xs">delete</span>
                                    </button>
                                </div>
                            </div>

                            <!-- Barges List (under Vessel) -->
                            <div v-if="expandedVesselIds[vessel.id]" class="bg-white px-1.5 py-1 border-t border-primary/5 flex flex-col gap-0.5">
                                <div v-if="!vessel.barges || vessel.barges.length === 0" class="text-[10px] text-gray-400 py-1.5 px-2.5 italic">
                                    Không có sà lan nào
                                </div>
                                <div 
                                    v-for="barge in vessel.barges" 
                                    :key="barge.id"
                                    @click="selectBarge(vessel.id, barge.id)"
                                    :class="['flex items-center justify-between p-2 rounded-[12px] cursor-pointer transition-all text-[11px] font-bold', activeBargeId === barge.id ? 'bg-primary text-white shadow-soft' : 'text-gray-600 hover:bg-gray-100']"
                                >
                                    <div class="flex items-center gap-1.5 truncate">
                                        <span class="material-symbols-outlined text-sm">layers</span>
                                        <span class="truncate">{{ barge.name }}</span>
                                        <span v-if="barge.config?.locked" class="material-symbols-outlined text-[11px]" :class="activeBargeId === barge.id ? 'text-white/90' : 'text-red-500'" title="Sà lan đang bị khóa">lock</span>
                                    </div>
                                    <div class="flex items-center gap-0.5" @click.stopPropagation>
                                        <button @click="renameBarge(barge.id, barge.name)" class="size-5 rounded-full hover:bg-black/10 flex items-center justify-center transition-colors" :class="activeBargeId === barge.id ? 'text-white' : 'text-gray-400 hover:text-primary'" title="Đổi tên">
                                            <span class="material-symbols-outlined text-[10px]">edit</span>
                                        </button>
                                        <button @click="deleteBarge(vessel.id, barge.id, barge.name)" class="size-5 rounded-full hover:bg-black/10 flex items-center justify-center transition-colors" :class="activeBargeId === barge.id ? 'text-white' : 'text-gray-400 hover:text-red-500'" title="Xóa sà lan">
                                            <span class="material-symbols-outlined text-[10px]">delete</span>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Sidebar Footer -->
                    <div class="p-3 border-t border-primary/10 bg-gray-50">
                        <button 
                            @click="addVessel" 
                            class="w-full py-2 bg-white border border-primary/20 hover:border-primary text-primary font-bold rounded-[12px] text-xs flex items-center justify-center gap-1.5 hover:bg-primary/5 transition-all shadow-sm"
                        >
                            <span class="material-symbols-outlined text-xs">add</span>
                            Thêm tàu mới
                        </button>
                    </div>
                </aside>

                <!-- Workspace (right) -->
                <main class="flex-1 overflow-y-auto p-4 bg-cute-gradient flex flex-col gap-4">
                    <!-- Global Dashboard (Empty State replaced by All Barges Overview) -->
                    <div v-if="!activeVesselId" class="flex flex-col gap-4 w-full max-w-[1200px] mx-auto pb-4 animate-fade-in">
                        <!-- Welcome Header banner -->
                        <div class="flex flex-wrap items-center justify-between bg-white rounded-[24px] p-4 soft-shadow border border-primary/5 gap-3">
                            <div>
                                <div class="text-[9px] uppercase font-black tracking-widest text-primary mb-0.5">Hệ thống in phiếu cân xe</div>
                                <h1 class="text-base font-black text-[#4a2c32] flex items-center gap-1.5">
                                    Báo cáo tổng quan hệ thống
                                </h1>
                            </div>
                        </div>

                        <!-- Stats Row -->
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div class="bg-white rounded-[24px] p-4 soft-shadow border border-primary/5 flex items-center gap-4">
                                <div class="size-11 bg-primary/10 text-primary rounded-[12px] flex items-center justify-center flex-shrink-0">
                                    <span class="material-symbols-outlined text-xl">directions_boat</span>
                                </div>
                                <div>
                                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tổng số tàu</p>
                                    <h4 class="text-lg font-black text-[#4a2c32]">{{ vessels.length }} <span class="text-xs text-gray-400 font-bold">tàu</span></h4>
                                </div>
                            </div>
                            <div class="bg-white rounded-[24px] p-4 soft-shadow border border-primary/5 flex items-center gap-4">
                                <div class="size-11 bg-teal-500/10 text-teal-600 rounded-[12px] flex items-center justify-center flex-shrink-0">
                                    <span class="material-symbols-outlined text-xl">layers</span>
                                </div>
                                <div>
                                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tổng số sà lan</p>
                                    <h4 class="text-lg font-black text-teal-600">{{ allBarges.length }} <span class="text-xs text-gray-400 font-bold">sà lan</span></h4>
                                </div>
                            </div>
                            <div class="bg-white rounded-[24px] p-4 soft-shadow border border-primary/5 flex items-center gap-4">
                                <div class="size-11 bg-amber-500/10 text-amber-600 rounded-[12px] flex items-center justify-center flex-shrink-0">
                                    <span class="material-symbols-outlined text-xl">cloud_done</span>
                                </div>
                                <div>
                                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Trạng thái dữ liệu</p>
                                    <h4 class="text-lg font-black text-amber-600">Sẵn sàng <span class="text-xs text-gray-400 font-bold">offline</span></h4>
                                </div>
                            </div>
                        </div>

                        <!-- All Barges Table Card -->
                        <div class="bg-white rounded-[24px] p-5 soft-shadow border border-primary/5">
                            <div class="flex flex-wrap items-center justify-between mb-4 gap-3">
                                <h3 class="text-sm font-black text-primary flex items-center gap-1.5">
                                    <span class="material-symbols-outlined text-base">analytics</span>
                                    Danh sách quản lý tất cả sà lan
                                </h3>
                            </div>
                            
                            <!-- Filters Row for all barges -->
                            <div v-if="allBarges.length > 0" class="flex flex-col md:flex-row gap-3 mb-4 p-3 bg-gray-50 rounded-[16px] border border-primary/5">
                                <!-- Search input -->
                                <div class="relative flex-1 flex items-center">
                                    <span class="material-symbols-outlined absolute left-3 text-gray-400 text-sm">search</span>
                                    <input 
                                        v-model="globalBargeSearchQuery"
                                        type="text"
                                        placeholder="Tìm kiếm nhanh tên sà lan hoặc tên tàu..."
                                        class="w-full pl-9 pr-8 py-1.5 bg-white border border-gray-200 rounded-[12px] text-xs font-semibold focus:outline-none focus:border-primary transition-all placeholder:text-gray-400"
                                    />
                                    <button 
                                        v-if="globalBargeSearchQuery" 
                                        @click="globalBargeSearchQuery = ''" 
                                        class="absolute right-3 text-gray-400 hover:text-primary flex items-center"
                                    >
                                        <span class="material-symbols-outlined text-xs">close</span>
                                    </button>
                                </div>
                                
                                <!-- Month Filter dropdown -->
                                <div v-if="availableGlobalMonths.length > 0" class="relative min-w-[200px] flex items-center">
                                    <span class="material-symbols-outlined absolute left-3 text-gray-400 text-sm">calendar_month</span>
                                    <select 
                                        v-model="globalFilterMonth" 
                                        class="w-full pl-9 pr-8 py-1.5 bg-white border border-gray-200 rounded-[12px] text-xs font-bold focus:outline-none focus:border-primary cursor-pointer appearance-none"
                                    >
                                        <option value="">Tất cả các tháng (Thời gian)</option>
                                        <option v-for="month in availableGlobalMonths" :key="month" :value="month">
                                            Tháng {{ month }}
                                        </option>
                                    </select>
                                    <span class="material-symbols-outlined absolute right-3 text-gray-400 text-sm pointer-events-none">expand_more</span>
                                </div>
                            </div>

                            <div v-if="loadingGlobalSummary" class="text-center py-10 flex flex-col items-center justify-center text-gray-400 text-xs gap-2">
                                <span class="material-symbols-outlined text-2xl animate-spin text-primary">sync</span>
                                Đang tính toán và tải dữ liệu sà lan...
                            </div>
                            <div v-else-if="allBarges.length === 0" class="text-center py-10 text-gray-400 text-xs italic">
                                Chưa có tàu hoặc sà lan nào được tạo. Vui lòng thêm ở cột bên trái.
                            </div>
                            <div v-else-if="filteredAllBarges.length === 0" class="text-center py-10 text-gray-400 text-xs italic">
                                Không tìm thấy sà lan phù hợp với từ khóa tìm kiếm hoặc bộ lọc.
                            </div>
                            <div v-else class="overflow-x-auto rounded-[16px] border border-gray-100">
                                <table class="w-full text-left border-collapse text-xs font-semibold">
                                    <thead>
                                        <tr class="bg-gray-50 text-gray-500 border-b border-gray-100 font-bold">
                                            <th class="p-3 w-12 text-center bg-gray-50">STT</th>
                                            <th class="p-3 bg-gray-50">Tên sà lan</th>
                                            <th class="p-3 bg-gray-50">Thuộc Tàu</th>
                                            <th class="p-3 bg-gray-50">Trạng thái</th>
                                            <th class="p-3 bg-gray-50">Thời gian bắt đầu</th>
                                            <th class="p-3 bg-gray-50">Thời gian kết thúc</th>
                                            <th class="p-3 text-center w-24 bg-gray-50">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-gray-100 text-[#4a2c32]/90">
                                        <tr v-for="(b, idx) in filteredAllBarges" :key="b.id" class="hover:bg-gray-50 transition-colors">
                                            <td class="p-3 text-center text-gray-400 font-bold">{{ idx + 1 }}</td>
                                            <td class="p-3 font-bold text-gray-900">{{ b.name }}</td>
                                            <td class="p-3">
                                                <span class="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[10px] font-black">
                                                    {{ b.vesselName }}
                                                </span>
                                            </td>
                                            <td class="p-3">
                                                <span v-if="b.locked" class="px-2.5 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit">
                                                    <span class="material-symbols-outlined text-[11px]">lock</span> Khóa
                                                </span>
                                                <span v-else class="px-2.5 py-0.5 bg-teal-50 text-teal-600 border border-teal-200 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit">
                                                    <span class="material-symbols-outlined text-[11px]">lock_open</span> Mở
                                                </span>
                                            </td>
                                            <td class="p-3 text-gray-500 whitespace-nowrap">{{ b.dateStart ? formatDateTimeStr(b.dateStart) : '-' }}</td>
                                            <td class="p-3 text-gray-500 whitespace-nowrap">{{ b.dateEnd ? formatDateTimeStr(b.dateEnd) : '-' }}</td>
                                            <td class="p-3 text-center">
                                                <button 
                                                    @click="selectBarge(b.vesselId, b.id)" 
                                                    class="px-2.5 py-1 bg-primary text-white font-bold rounded-[12px] text-[10px] hover:scale-[1.05] transition-all"
                                                >
                                                    Xem chi tiết
                                                </button>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- Vessel Summary Dashboard -->
                    <div v-else-if="activeVesselId && !activeBargeId" class="flex flex-col gap-4 w-full max-w-[1200px] mx-auto pb-4 animate-fade-in">
                        <!-- Vessel header breadcrumbs -->
                        <div class="flex flex-wrap items-center justify-between bg-white rounded-[24px] p-4 soft-shadow border border-primary/5 gap-3">
                            <div class="flex items-center gap-3">
                                <div>
                                    <div class="text-[9px] uppercase font-black tracking-widest text-primary mb-0.5">Báo cáo tổng hợp tàu</div>
                                    <h1 class="text-base font-black text-[#4a2c32] flex items-center gap-1.5">
                                        <span @click="activeVesselId = null; activeBargeId = null" class="text-gray-400 hover:text-primary cursor-pointer transition-colors flex items-center gap-0.5" title="Quay lại Tổng quan"><span class="material-symbols-outlined text-base">home</span>Tổng quan</span>
                                        <span class="text-gray-300">&rsaquo;</span>
                                        Tàu: <span class="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-xs font-black">{{ activeVessel?.name }}</span>
                                    </h1>
                                </div>
                            </div>
                            
                            <div class="flex items-center gap-2">
                                <button 
                                    v-if="filteredVesselBarges.length > 0"
                                    @click="exportVesselSummaryExcel"
                                    class="px-4 py-2 bg-teal-600 text-white font-bold text-xs rounded-[12px] shadow-soft hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5"
                                >
                                    <span class="material-symbols-outlined text-sm">download</span>
                                    Xuất báo cáo (Excel)
                                </button>
                            </div>
                        </div>

                        <!-- Stats Row -->
                        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div class="bg-white rounded-[24px] p-4 soft-shadow border border-primary/5 flex items-center gap-4">
                                <div class="size-11 bg-primary/10 text-primary rounded-[12px] flex items-center justify-center flex-shrink-0">
                                    <span class="material-symbols-outlined text-xl">layers</span>
                                </div>
                                <div>
                                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tổng số sà lan</p>
                                    <h4 class="text-lg font-black text-[#4a2c32]">{{ filteredVesselBarges.length }} <span class="text-xs text-gray-400 font-bold">sà lan</span></h4>
                                </div>
                            </div>
                            <div class="bg-white rounded-[24px] p-4 soft-shadow border border-primary/5 flex items-center gap-4">
                                <div class="size-11 bg-teal-500/10 text-teal-600 rounded-[12px] flex items-center justify-center flex-shrink-0">
                                    <span class="material-symbols-outlined text-xl">local_shipping</span>
                                </div>
                                <div>
                                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tổng số chuyến xe</p>
                                    <h4 class="text-lg font-black text-teal-600">{{ formatNumber(filteredVesselBarges.reduce((sum, b) => sum + b.truckCount, 0)) }} <span class="text-xs font-bold text-gray-400">lượt</span></h4>
                                </div>
                            </div>
                            <div class="bg-white rounded-[24px] p-4 soft-shadow border border-primary/5 flex items-center gap-4">
                                <div class="size-11 bg-amber-500/10 text-amber-600 rounded-[12px] flex items-center justify-center flex-shrink-0">
                                    <span class="material-symbols-outlined text-xl">scale</span>
                                </div>
                                <div>
                                    <p class="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Tổng khối lượng nhận</p>
                                    <h4 class="text-lg font-black text-amber-600">{{ formatNumber(filteredVesselBarges.reduce((sum, b) => sum + b.totalWeight, 0)) }} <span class="text-xs font-bold text-gray-400">kg</span></h4>
                                </div>
                            </div>
                        </div>

                        <!-- Barges Summary Table Card -->
                        <div class="bg-white rounded-[24px] p-5 soft-shadow border border-primary/5">
                            <div class="flex flex-wrap items-center justify-between mb-4 gap-3">
                                <h3 class="text-sm font-black text-primary flex items-center gap-1.5">
                                    <span class="material-symbols-outlined text-base">analytics</span>
                                    Chi tiết danh sách sà lan đã làm
                                </h3>
                            </div>
                            
                            <!-- Filters Row (The red-boxed area in the screenshot) -->
                            <div v-if="vesselBargesSummary.length > 0" class="flex flex-col md:flex-row gap-3 mb-4 p-3 bg-gray-50 rounded-[16px] border border-primary/5">
                                <!-- Search Barge Input -->
                                <div class="relative flex-1 flex items-center">
                                    <span class="material-symbols-outlined absolute left-3 text-gray-400 text-sm">search</span>
                                    <input 
                                        v-model="bargeSearchQuery"
                                        type="text"
                                        placeholder="Tìm kiếm tên sà lan..."
                                        class="w-full pl-9 pr-8 py-1.5 bg-white border border-gray-200 rounded-[12px] text-xs font-semibold focus:outline-none focus:border-primary transition-all placeholder:text-gray-400"
                                    />
                                    <button 
                                        v-if="bargeSearchQuery" 
                                        @click="bargeSearchQuery = ''" 
                                        class="absolute right-3 text-gray-400 hover:text-primary flex items-center"
                                    >
                                        <span class="material-symbols-outlined text-xs">close</span>
                                    </button>
                                </div>
                                
                                <!-- Month Filter for Barges -->
                                <div v-if="availableVesselMonths.length > 0" class="relative min-w-[200px] flex items-center">
                                    <span class="material-symbols-outlined absolute left-3 text-gray-400 text-sm">calendar_month</span>
                                    <select 
                                        v-model="vesselFilterMonth" 
                                        class="w-full pl-9 pr-8 py-1.5 bg-white border border-gray-200 rounded-[12px] text-xs font-bold focus:outline-none focus:border-primary cursor-pointer appearance-none"
                                    >
                                        <option value="">Tất cả các tháng (Thời gian)</option>
                                        <option v-for="month in availableVesselMonths" :key="month" :value="month">
                                            Tháng {{ month }}
                                        </option>
                                    </select>
                                    <span class="material-symbols-outlined absolute right-3 text-gray-400 text-sm pointer-events-none">expand_more</span>
                                </div>
                            </div>

                            <div v-if="loadingVesselSummary" class="text-center py-10 flex flex-col items-center justify-center text-gray-400 text-xs gap-2">
                                <span class="material-symbols-outlined text-2xl animate-spin text-primary">sync</span>
                                Đang tính toán và tải dữ liệu sà lan...
                            </div>
                            <div v-else-if="vesselBargesSummary.length === 0" class="text-center py-10 text-gray-400 text-xs italic">
                                Tàu này chưa có sà lan nào.
                            </div>
                            <div v-else-if="filteredVesselBarges.length === 0" class="text-center py-10 text-gray-400 text-xs italic">
                                Không có sà lan nào hoạt động trong thời gian được lọc.
                            </div>
                            <div v-else class="overflow-x-auto rounded-[16px] border border-gray-100">
                                <table class="w-full text-left border-collapse text-xs font-semibold">
                                    <thead>
                                        <tr class="bg-gray-50 text-gray-500 border-b border-gray-100 font-bold">
                                            <th class="p-3 w-12 text-center bg-gray-50">STT</th>
                                            <th class="p-3 bg-gray-50">Tên sà lan</th>
                                            <th class="p-3 bg-gray-50 text-center">Trạng thái</th>
                                            <th class="p-3 text-right bg-gray-50">Số chuyến xe chạy</th>
                                            <th class="p-3 text-right text-primary bg-gray-50">Tổng khối lượng (Net - kg)</th>
                                            <th class="p-3 bg-gray-50">Thời gian bắt đầu</th>
                                            <th class="p-3 bg-gray-50">Thời gian kết thúc</th>
                                            <th class="p-3 text-center w-24 bg-gray-50">Thao tác</th>
                                        </tr>
                                    </thead>
                                    <tbody class="divide-y divide-gray-100 text-[#4a2c32]/90">
                                        <tr v-for="(b, idx) in filteredVesselBarges" :key="b.id" class="hover:bg-gray-50 transition-colors">
                                            <td class="p-3 text-center text-gray-400 font-bold">{{ idx + 1 }}</td>
                                            <td class="p-3 font-bold text-gray-900">{{ b.name }}</td>
                                            <td class="p-3 flex justify-center">
                                                <span v-if="b.locked" class="px-2.5 py-0.5 bg-red-50 text-red-600 border border-red-200 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit">
                                                    <span class="material-symbols-outlined text-[11px]">lock</span> Khóa
                                                </span>
                                                <span v-else class="px-2.5 py-0.5 bg-teal-50 text-teal-600 border border-teal-200 rounded-full text-[10px] font-bold flex items-center gap-1 w-fit">
                                                    <span class="material-symbols-outlined text-[11px]">lock_open</span> Mở
                                                </span>
                                            </td>
                                            <td class="p-3 text-right font-medium">{{ formatNumber(b.truckCount) }}</td>
                                            <td class="p-3 text-right font-bold text-teal-600">{{ formatNumber(b.totalWeight) }}</td>
                                            <td class="p-3 text-gray-500 whitespace-nowrap">{{ formatDateTimeStr(b.dateStart) || '-' }}</td>
                                            <td class="p-3 text-gray-500 whitespace-nowrap">{{ formatDateTimeStr(b.dateEnd) || '-' }}</td>
                                            <td class="p-3 text-center">
                                                <button 
                                                    @click="selectBarge(activeVesselId!, b.id)" 
                                                    class="px-2.5 py-1 bg-primary text-white font-bold rounded-[12px] text-[10px] hover:scale-[1.05] transition-all"
                                                >
                                                    Xem chi tiết
                                                </button>
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <!-- Active Barge Workspace -->
                    <div v-else class="flex flex-col gap-4 w-full max-w-[1200px] mx-auto pb-4">
                        <!-- Header with breadcrumbs -->
                        <div class="flex flex-wrap items-center justify-between bg-white rounded-[24px] p-3 px-4 soft-shadow border border-primary/5 gap-3">
                            <div>
                                <div class="text-[9px] uppercase font-black tracking-widest text-primary mb-0.5">Đang chọn hoạt động</div>
                                <h1 class="text-sm font-black text-[#4a2c32] flex items-center gap-1.5">
                                    <span @click="activeVesselId = null; activeBargeId = null" class="text-gray-400 hover:text-primary cursor-pointer transition-colors flex items-center gap-0.5" title="Quay lại Tổng quan"><span class="material-symbols-outlined text-base">home</span>Tổng quan</span>
                                    <span class="text-gray-300">&rsaquo;</span>
                                    Tàu: <span @click="activeBargeId = null" class="px-2 py-0.5 bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer rounded-full text-[10px] font-black" title="Xem báo cáo tổng hợp tàu">{{ activeVessel?.name }}</span>
                                    <span class="text-gray-300">&rsaquo;</span>
                                    Sà lan: <span class="px-2 py-0.5 bg-teal-500/10 text-teal-600 rounded-full text-[10px] font-black">{{ activeBarge?.name }}</span>
                                    <button 
                                        @click="toggleBargeLock" 
                                        :class="['ml-2 p-1 rounded-full flex items-center justify-center transition-all', cfgForm.locked ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200']"
                                        :title="cfgForm.locked ? 'Mở khóa sà lan' : 'Khóa sà lan'"
                                    >
                                        <span class="material-symbols-outlined text-[12px] font-bold">{{ cfgForm.locked ? 'lock' : 'lock_open' }}</span>
                                    </button>
                                </h1>
                            </div>

                            <!-- Sync indicator -->
                            <div class="flex items-center gap-1.5">
                                <span v-if="cfgForm.locked" class="text-[10px] font-black text-red-600 flex items-center gap-0.5 bg-red-50 px-2.5 py-0.5 rounded-full border border-red-200">
                                    <span class="material-symbols-outlined text-[12px]">lock</span> ĐÃ KHÓA
                                </span>
                                <span v-else-if="saving" class="text-[10px] font-medium text-gray-400 flex items-center gap-0.5">
                                    <span class="material-symbols-outlined text-xs animate-spin">sync</span> Đang đồng bộ...
                                </span>
                                <span v-else class="text-[10px] font-medium text-teal-500 flex items-center gap-0.5">
                                    <span class="material-symbols-outlined text-xs">cloud_done</span> Đã đồng bộ đám mây
                                </span>
                            </div>
                        </div>

                        <!-- Tab Navigation -->
                        <div class="flex gap-1.5 border-b border-primary/15 pb-1.5">
                            <button 
                                @click="activeTab = 'data'"
                                :class="['px-4 py-1.5 rounded-[12px] font-bold text-xs transition-all flex items-center gap-1', activeTab === 'data' ? 'bg-primary text-white shadow-soft' : 'text-[#4a2c32]/60 hover:bg-white/50']"
                            >
                                <span class="material-symbols-outlined text-sm">local_shipping</span>
                                Danh sách xe & In ấn
                            </button>
                            <button 
                                @click="activeTab = 'config'"
                                :class="['px-4 py-1.5 rounded-[12px] font-bold text-xs transition-all flex items-center gap-1', activeTab === 'config' ? 'bg-primary text-white shadow-soft' : 'text-[#4a2c32]/60 hover:bg-white/50']"
                            >
                                <span class="material-symbols-outlined text-sm">settings</span>
                                Cấu hình mẫu phiếu
                            </button>
                        </div>

                        <!-- TAB 1: DATA & PRINT -->
                        <div v-if="activeTab === 'data'" class="flex flex-col gap-4 animate-fade-in">
                            <!-- Stats & Excel Upload Side-by-Side -->
                            <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                                <!-- Stats Grid (8 cols) -->
                                <div class="lg:col-span-8 grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div class="bg-white rounded-2xl p-3 soft-shadow border border-primary/5 flex items-center gap-3">
                                        <div class="size-9 bg-primary/10 text-primary rounded-[12px] flex items-center justify-center flex-shrink-0">
                                            <span class="material-symbols-outlined text-lg">local_shipping</span>
                                        </div>
                                        <div>
                                            <p class="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Tổng số xe</p>
                                            <h4 class="text-base font-black text-[#4a2c32]">{{ filteredTrucks.length }} <span class="text-[10px] text-gray-400 font-bold">xe</span></h4>
                                        </div>
                                    </div>
                                    <div class="bg-white rounded-2xl p-3 soft-shadow border border-primary/5 flex items-center gap-3">
                                        <div class="size-9 bg-teal-500/10 text-teal-600 rounded-[12px] flex items-center justify-center flex-shrink-0">
                                            <span class="material-symbols-outlined text-lg">scale</span>
                                        </div>
                                        <div>
                                            <p class="text-[9px] font-bold text-gray-400 uppercase tracking-wider">Tổng TL tịnh (Net)</p>
                                            <h4 class="text-base font-black text-teal-600 truncate max-w-[120px]">{{ formatNumber(totalNetWeight) }} <span class="text-[10px] font-bold">kg</span></h4>
                                        </div>
                                    </div>
                                    <div class="bg-white rounded-2xl p-3 soft-shadow border border-primary/5 flex items-center gap-3">
                                        <div class="size-9 bg-amber-500/10 text-amber-600 rounded-[12px] flex items-center justify-center flex-shrink-0">
                                            <span class="material-symbols-outlined text-lg">monitoring</span>
                                        </div>
                                        <div>
                                            <p class="text-[9px] font-bold text-gray-400 uppercase tracking-wider">TL Trung bình</p>
                                            <h4 class="text-base font-black text-amber-600 truncate max-w-[120px]">{{ formatNumber(avgNetWeight) }} <span class="text-[10px] font-bold">kg</span></h4>
                                        </div>
                                    </div>
                                </div>

                                <!-- Compact Excel Upload (4 cols) -->
                                <div 
                                    @dragover.prevent
                                    @drop="cfgForm.locked ? null : handleExcelDrop($event)"
                                    :class="['lg:col-span-4 bg-white rounded-2xl p-3 soft-shadow border border-primary/5 hover:border-primary/20 transition-all flex items-center justify-between gap-3 bg-gray-50/50', cfgForm.locked ? 'opacity-50 pointer-events-none' : '']"
                                >
                                    <input 
                                        type="file" 
                                        ref="fileInput" 
                                        class="hidden" 
                                        @change="handleFileSelect" 
                                        accept=".xlsx, .xls" 
                                        :disabled="cfgForm.locked"
                                    />
                                    <div class="flex items-center gap-2.5 min-w-0" @click="cfgForm.locked ? null : fileInput?.click()">
                                        <div class="size-9 bg-primary/10 text-primary rounded-[12px] flex items-center justify-center flex-shrink-0">
                                            <span class="material-symbols-outlined text-lg">upload_file</span>
                                        </div>
                                        <div class="text-left min-w-0">
                                            <p class="text-xs font-black text-[#4a2c32] truncate">Nhập file Excel</p>
                                            <p class="text-[9px] text-gray-400 font-bold truncate">Kéo thả hoặc Click chọn</p>
                                        </div>
                                    </div>
                                    
                                    <div class="flex items-center gap-1 flex-shrink-0">
                                        <button 
                                            @click="downloadSampleExcel"
                                            class="size-7 bg-gray-100 hover:bg-gray-200 text-[#4a2c32] rounded-[8px] flex items-center justify-center border border-gray-200 transition-colors"
                                            title="Tải Excel mẫu"
                                        >
                                            <span class="material-symbols-outlined text-sm">download</span>
                                        </button>
                                        <button 
                                            @click="fileInput?.click()"
                                            class="px-2.5 py-1.5 bg-primary text-white text-[9px] font-black rounded-[8px] hover:scale-[1.02] active:scale-[0.98] transition-all"
                                            :disabled="cfgForm.locked"
                                        >
                                            Chọn File
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <!-- Truck List Table Card -->
                             <div class="bg-white rounded-[24px] p-4 soft-shadow border border-primary/5">
                                <div class="flex flex-wrap items-center justify-between mb-3 gap-3">
                                    <h3 class="text-sm font-black text-primary flex items-center gap-1.5">
                                        <span class="material-symbols-outlined text-base">list_alt</span>
                                        Chi tiết danh sách xe cân sà lan
                                    </h3>
                                    
                                    <div class="flex items-center gap-1.5 flex-wrap">
                                        <button 
                                            @click="openAddTruckDialog"
                                            :disabled="cfgForm.locked"
                                            class="px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none font-bold rounded-[8px] text-[10px] flex items-center gap-1 transition-all"
                                        >
                                            <span class="material-symbols-outlined text-xs">add</span>
                                            Thêm xe
                                        </button>
                                        <button 
                                            @click="clearTrucks"
                                            :disabled="cfgForm.locked"
                                            class="px-3 py-1.5 bg-red-50 hover:bg-red-100 text-red-500 font-bold rounded-[8px] text-[10px] flex items-center gap-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
                                        >
                                            <span class="material-symbols-outlined text-xs">delete_sweep</span>
                                            Xóa tất cả
                                        </button>
                                        <button 
                                            @click="triggerPrint()"
                                            class="px-3.5 py-1.5 puffy-button flex items-center gap-1 text-[10px] hover:scale-[1.02] transition-all"
                                        >
                                            <span class="material-symbols-outlined text-xs">print</span>
                                            In hàng loạt (A5)
                                        </button>
                                    </div>
                                </div>

                                <!-- Table -->
                                <div class="overflow-x-auto max-h-[350px] overflow-y-auto rounded-[16px] border border-gray-100">
                                    <table class="w-full text-left border-collapse text-[11px] font-semibold">
                                        <thead class="sticky top-0 bg-gray-50 z-10 shadow-sm">
                                            <tr class="text-gray-500 border-b border-gray-100 font-bold select-none">
                                                <th class="p-2.5 w-10 text-center bg-gray-50">STT</th>
                                                <th class="p-2.5 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors" @click="toggleSort('plateNumber')">
                                                    <div class="flex items-center gap-1">
                                                        Số xe (Biển số)
                                                        <span v-if="sortKey === 'plateNumber'" class="material-symbols-outlined text-[12px] font-bold">{{ sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</span>
                                                    </div>
                                                </th>
                                                <th class="p-2.5 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors" @click="toggleSort('driver')">
                                                    <div class="flex items-center gap-1">
                                                        Tài xế
                                                        <span v-if="sortKey === 'driver'" class="material-symbols-outlined text-[12px] font-bold">{{ sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</span>
                                                    </div>
                                                </th>
                                                <th class="p-2.5 text-right bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors" @click="toggleSort('weight1')">
                                                    <div class="flex items-center justify-end gap-1">
                                                        TL Lần 1 (kg)
                                                        <span v-if="sortKey === 'weight1'" class="material-symbols-outlined text-[12px] font-bold">{{ sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</span>
                                                    </div>
                                                </th>
                                                <th class="p-2.5 text-right bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors" @click="toggleSort('weight2')">
                                                    <div class="flex items-center justify-end gap-1">
                                                        TL Lần 2 (kg)
                                                        <span v-if="sortKey === 'weight2'" class="material-symbols-outlined text-[12px] font-bold">{{ sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</span>
                                                    </div>
                                                </th>
                                                <th class="p-2.5 text-right text-primary bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors" @click="toggleSort('weightNet')">
                                                    <div class="flex items-center justify-end gap-1">
                                                        TL Hàng (Net)
                                                        <span v-if="sortKey === 'weightNet'" class="material-symbols-outlined text-[12px] font-bold">{{ sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</span>
                                                    </div>
                                                </th>
                                                <th class="p-2.5 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors" @click="toggleSort('dateIn')">
                                                    <div class="flex items-center gap-1">
                                                        Giờ vào
                                                        <span v-if="sortKey === 'dateIn'" class="material-symbols-outlined text-[12px] font-bold">{{ sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</span>
                                                    </div>
                                                </th>
                                                <th class="p-2.5 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors" @click="toggleSort('dateOut')">
                                                    <div class="flex items-center gap-1">
                                                        Giờ ra
                                                        <span v-if="sortKey === 'dateOut'" class="material-symbols-outlined text-[12px] font-bold">{{ sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</span>
                                                    </div>
                                                </th>
                                                <th class="p-2.5 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors" @click="toggleSort('note')">
                                                    <div class="flex items-center gap-1">
                                                        Ghi chú
                                                        <span v-if="sortKey === 'note'" class="material-symbols-outlined text-[12px] font-bold">{{ sortOrder === 'asc' ? 'arrow_upward' : 'arrow_downward' }}</span>
                                                    </div>
                                                </th>
                                                <th class="p-2.5 text-center w-28 bg-gray-50">Thao tác</th>
                                            </tr>
                                        </thead>
                                        <tbody class="divide-y divide-gray-100 text-[#4a2c32]/90">
                                            <tr v-if="filteredTrucks.length === 0">
                                                <td colspan="10" class="p-6 text-center text-gray-400 italic">
                                                    Chưa có dữ liệu xe. Hãy tải file Excel hoặc thêm xe thủ công để hiển thị.
                                                </td>
                                            </tr>
                                            <tr v-for="(truck, index) in filteredTrucks" :key="truck.id" class="hover:bg-gray-50 transition-colors">
                                                <td class="p-2 text-center text-gray-400 font-bold">{{ index + 1 }}</td>
                                                <td class="p-2 font-bold text-gray-900">{{ truck.plateNumber }}</td>
                                                <td class="p-2 text-gray-600">{{ truck.driver || '-' }}</td>
                                                <td class="p-2 text-right font-medium">{{ formatNumber(truck.weight1) }}</td>
                                                <td class="p-2 text-right font-medium">{{ formatNumber(truck.weight2) }}</td>
                                                <td class="p-2 text-right font-bold text-teal-600">{{ formatNumber(truck.weightNet) }}</td>
                                                <td class="p-2 text-gray-500 whitespace-nowrap">{{ formatDateTimeStr(truck.dateIn) }}</td>
                                                <td class="p-2 text-gray-500 whitespace-nowrap">{{ formatDateTimeStr(truck.dateOut) }}</td>
                                                <td class="p-2 text-gray-400 italic max-w-[150px] truncate" :title="truck.note">{{ truck.note || '-' }}</td>
                                                <td class="p-2">
                                                    <div class="flex items-center gap-1 justify-center">
                                                        <button @click="triggerPrint(truck)" class="size-7 rounded-full bg-teal-50 hover:bg-teal-100 text-teal-600 flex items-center justify-center transition-all" title="In phiếu này">
                                                            <span class="material-symbols-outlined text-sm">print</span>
                                                        </button>
                                                        <button @click="openEditTruckDialog(truck)" :disabled="cfgForm.locked" class="size-7 rounded-full bg-primary/5 hover:bg-primary/10 text-primary flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none" title="Sửa">
                                                            <span class="material-symbols-outlined text-sm">edit</span>
                                                        </button>
                                                        <button @click="deleteTruck(truck.id, truck.plateNumber)" :disabled="cfgForm.locked" class="size-7 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-all disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none" title="Xóa">
                                                            <span class="material-symbols-outlined text-sm">delete</span>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        <!-- TAB 2: CONFIGURATION -->
                        <div v-if="activeTab === 'config'" class="flex flex-col gap-4 animate-fade-in">
                            <!-- Banner lock warning -->
                            <div v-if="cfgForm.locked" class="bg-red-50 text-red-700 text-xs font-bold p-3 rounded-lg border border-red-200 mb-2 flex items-center gap-1.5">
                                <span class="material-symbols-outlined text-sm">warning</span>
                                Sà lan này đang bị khóa. Vui lòng mở khóa để sửa đổi cấu hình.
                            </div>

                            <div class="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                                <!-- Print Configuration (7 cols) -->
                                <div class="bg-white rounded-[16px] p-5 soft-shadow border border-primary/5 lg:col-span-7 flex flex-col justify-between">
                                    <div>
                                        <h3 class="text-sm font-black text-primary mb-4 flex items-center gap-1.5">
                                            <span class="material-symbols-outlined text-base">settings_applications</span>
                                            Cấu hình thông tin in chung
                                        </h3>
                                        
                                        <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                                            <div class="flex flex-col gap-1">
                                                <label class="text-[10px] font-bold text-gray-500">Tên hàng hóa (mặc định)</label>
                                                <input v-model="cfgForm.goods" :disabled="cfgForm.locked" type="text" placeholder="Đất sét nguyên liệu..." class="px-3 py-2 rounded-[8px] border border-gray-200 focus:border-primary focus:outline-none text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                                            </div>
                                            <div class="flex flex-col gap-1">
                                                <label class="text-[10px] font-bold text-gray-500">Mã hàng hóa</label>
                                                <input v-model="cfgForm.goodsCode" :disabled="cfgForm.locked" type="text" placeholder="Mã hàng..." class="px-3 py-2 rounded-[8px] border border-gray-200 focus:border-primary focus:outline-none text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                                            </div>
                                            <div class="flex flex-col gap-1 md:col-span-2">
                                                <label class="text-[10px] font-bold text-gray-500">Tên chủ hàng (mặc định)</label>
                                                <input v-model="cfgForm.owner" :disabled="cfgForm.locked" type="text" placeholder="Công ty xuất nhập khẩu..." class="px-3 py-2 rounded-[8px] border border-gray-200 focus:border-primary focus:outline-none text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                                            </div>
                                            <div class="flex flex-col gap-1">
                                                <label class="text-[10px] font-bold text-gray-500">Người cân (NV trạm cân)</label>
                                                <input v-model="cfgForm.operator" :disabled="cfgForm.locked" type="text" placeholder="Tên nhân viên..." class="px-3 py-2 rounded-[8px] border border-gray-200 focus:border-primary focus:outline-none text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                                            </div>
                                            <div class="flex flex-col gap-1">
                                                <label class="text-[10px] font-bold text-gray-500">Hình thức xuất/nhập</label>
                                                <select v-model="cfgForm.xn" :disabled="cfgForm.locked" class="px-3 py-2 rounded-[8px] border border-gray-200 focus:border-primary focus:outline-none text-xs font-bold bg-white disabled:opacity-50 disabled:cursor-not-allowed">
                                                    <option value="XUẤT KHẨU">XUẤT KHẨU</option>
                                                    <option value="NHẬP KHẨU">NHẬP KHẨU</option>
                                                    <option value="NỘI BỘ">NỘI BỘ</option>
                                                </select>
                                            </div>
                                            <div class="flex flex-col gap-1">
                                                <label class="text-[10px] font-bold text-gray-500">Tiền tố số phiếu (Mẫu số)</label>
                                                <input v-model="cfgForm.ticketPrefix" :disabled="cfgForm.locked" @change="handleTicketConfigChange" type="text" placeholder="Ví dụ: PC-" class="px-3 py-2 rounded-[8px] border border-gray-200 focus:border-primary focus:outline-none text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                                            </div>
                                            <div class="flex flex-col gap-1">
                                                <label class="text-[10px] font-bold text-gray-500">Số phiếu bắt đầu</label>
                                                <input v-model="cfgForm.ticketSeed" :disabled="cfgForm.locked" @change="handleTicketConfigChange" type="text" placeholder="Ví dụ: 1 hoặc 001" class="px-3 py-2 rounded-[8px] border border-gray-200 focus:border-primary focus:outline-none text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <!-- Quality Evaluation Configuration (5 cols) -->
                                <div class="bg-white rounded-[16px] p-5 soft-shadow border border-primary/5 lg:col-span-5 flex flex-col justify-between">
                                    <div>
                                        <h3 class="text-sm font-black text-primary mb-4 flex items-center gap-1.5">
                                            <span class="material-symbols-outlined text-base">analytics</span>
                                            Cấu hình Đánh giá chất lượng
                                        </h3>
                                        
                                        <div class="space-y-3">
                                            <div class="flex flex-col gap-1">
                                                <label class="text-[10px] font-bold text-gray-500">Tỷ lệ Chính phẩm (%)</label>
                                                <input v-model.number="cfgForm.chinhpham" :disabled="cfgForm.locked" type="number" min="0" max="100" class="px-3 py-2 rounded-[8px] border border-gray-200 focus:border-primary focus:outline-none text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                                            </div>
                                            <div class="flex flex-col gap-1">
                                                <label class="text-[10px] font-bold text-gray-500">Tỷ lệ Phụ phẩm (%)</label>
                                                <input v-model.number="cfgForm.phupham" :disabled="cfgForm.locked" type="number" min="0" max="100" class="px-3 py-2 rounded-[8px] border border-gray-200 focus:border-primary focus:outline-none text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed">
                                            </div>
                                            <div class="flex flex-col gap-1">
                                                <label class="text-[10px] font-bold text-gray-500">Kết luận</label>
                                                <textarea v-model="cfgForm.ketluan" :disabled="cfgForm.locked" rows="3" placeholder="Nhập kết luận đánh giá..." class="px-3 py-2 rounded-[8px] border border-gray-200 focus:border-primary focus:outline-none text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed resize-none"></textarea>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <!-- Visual Template Designer Section (Full width) -->
                            <div class="bg-white rounded-[16px] p-5 soft-shadow border border-primary/5">
                                <h3 class="text-sm font-black text-primary mb-4 flex items-center gap-1.5 border-b border-gray-100 pb-2">
                                    <span class="material-symbols-outlined text-base">design_services</span>
                                    Thiết kế bố cục và Tùy biến nhãn biểu in
                                </h3>
                                
                                <div class="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                                    <!-- Field Control Panel (xl:col-span-6) -->
                                    <div class="xl:col-span-6 space-y-3">
                                        <div class="flex items-center justify-between text-[10px] font-bold text-gray-400 pb-1.5 border-b border-gray-100 select-none">
                                            <span>Trường thông tin</span>
                                            <span>Hiện | Cột hiển thị | Thứ tự</span>
                                        </div>
                                        
                                        <div class="space-y-1.5 max-h-[350px] overflow-y-auto pr-1">
                                            <div 
                                                v-for="f in (cfgForm.printFields || [])" 
                                                :key="f.id" 
                                                class="flex items-center justify-between p-2 rounded-[10px] border border-gray-100 hover:border-primary/20 transition-all gap-3 bg-gray-50/50"
                                            >
                                                <!-- Left: Label renaming input -->
                                                <div class="flex items-center gap-1.5 min-w-0 flex-1">
                                                    <span class="material-symbols-outlined text-gray-300 text-xs shrink-0 select-none">drag_indicator</span>
                                                    <input 
                                                        v-model="f.label" 
                                                        :disabled="cfgForm.locked" 
                                                        type="text" 
                                                        class="px-2 py-1 bg-white border border-gray-200 rounded-[6px] text-xs font-semibold focus:outline-none focus:border-primary w-full truncate disabled:bg-transparent disabled:border-none"
                                                    />
                                                </div>
                                                
                                                <!-- Right: Actions -->
                                                <div class="flex items-center gap-2 shrink-0">
                                                    <!-- Visibility Checkbox -->
                                                    <label class="flex items-center cursor-pointer select-none" title="Bật/Tắt hiển thị">
                                                        <input 
                                                            v-model="f.visible" 
                                                            :disabled="cfgForm.locked" 
                                                            type="checkbox" 
                                                            class="rounded border-gray-300 text-primary focus:ring-primary size-3.5 cursor-pointer disabled:opacity-50"
                                                        />
                                                    </label>
                                                    
                                                    <!-- Column Switcher -->
                                                    <button 
                                                        @click="switchColumn(f.id)" 
                                                        :disabled="cfgForm.locked"
                                                        class="px-2 py-1 text-[9px] font-black rounded-lg border transition-all select-none w-14 text-center"
                                                        :class="f.column === 'left' ? 'bg-teal-50 text-teal-600 border-teal-100 hover:bg-teal-100' : 'bg-primary/5 text-primary border-primary/10 hover:bg-primary/10'"
                                                    >
                                                        Cột {{ f.column === 'left' ? 'Trái' : 'Phải' }}
                                                    </button>
                                                    
                                                    <!-- Order Buttons -->
                                                    <div class="flex items-center gap-0.5 select-none">
                                                        <button 
                                                            @click="moveField(f.id, 'up')" 
                                                            :disabled="cfgForm.locked"
                                                            class="size-5 rounded-md hover:bg-gray-150 text-gray-500 flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none"
                                                            title="Di chuyển lên"
                                                        >
                                                            <span class="material-symbols-outlined text-[10px] font-bold">arrow_upward</span>
                                                        </button>
                                                        <button 
                                                            @click="moveField(f.id, 'down')" 
                                                            :disabled="cfgForm.locked"
                                                            class="size-5 rounded-md hover:bg-gray-150 text-gray-500 flex items-center justify-center disabled:opacity-30 disabled:pointer-events-none"
                                                            title="Di chuyển xuống"
                                                        >
                                                            <span class="material-symbols-outlined text-[10px] font-bold">arrow_downward</span>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <!-- Live Preview Mockup (xl:col-span-6) -->
                                    <div class="xl:col-span-6 flex flex-col items-center border border-gray-100 rounded-2xl p-4 bg-gray-50/50">
                                        <div class="text-[9px] uppercase font-black text-gray-400 mb-3 select-none">Xem trước biểu mẫu in</div>
                                        
                                        <!-- Real Mockup Container -->
                                        <div class="bg-white border border-gray-200 rounded-xl p-4 select-none w-full max-w-[480px] shadow-sm font-serif text-[10px] text-black">
                                            <!-- Mockup Header -->
                                            <div class="flex justify-between items-start text-[8px] mb-2 font-bold line-clamp-1 border-b border-gray-100 pb-1.5">
                                                <div>CÔNG TY CỔ PHẦN DỊCH VỤ CẢNG NGUYÊN NGỌC</div>
                                                <div class="text-right">Phiếu số: PC-001</div>
                                            </div>
                                            
                                            <!-- Title -->
                                            <div class="text-center mb-3">
                                                <div class="text-xs font-black">PHIẾU CÂN XE</div>
                                                <div class="text-[7px] italic text-gray-400">Ngày giờ vào/ra: 2026-06-20...</div>
                                            </div>
                                            
                                            <!-- Columns mockup -->
                                            <div class="grid grid-cols-2 gap-4 border-t border-b border-gray-100 py-3">
                                                <!-- Left -->
                                                <div class="space-y-1.5">
                                                    <div v-for="f in printFieldsLeft.filter(f => f.visible)" :key="f.id" class="flex items-baseline">
                                                        <span class="w-20 shrink-0 text-gray-500 font-semibold">{{ f.label }}</span>
                                                        <span class="w-2 shrink-0 text-center font-semibold">:</span>
                                                        <span class="grow font-bold text-gray-800 truncate" :class="(f.id === 'plateNumber' || f.id === 'weightNet') ? 'text-[11px]' : ''">
                                                            {{ getFieldValue(f.id) }}
                                                        </span>
                                                    </div>
                                                </div>
                                                
                                                <!-- Right -->
                                                <div class="space-y-1.5">
                                                    <template v-for="f in printFieldsRight.filter(f => f.visible)" :key="f.id">
                                                        <div v-if="f.id === 'chinhpham' && isFirstQualityField(f.id)" class="font-bold text-[8px] text-primary uppercase pt-1 border-t border-gray-50 mb-1">
                                                            ĐÁNH GIÁ CHẤT LƯỢNG HÀNG HÓA
                                                        </div>
                                                        <div class="flex items-baseline">
                                                            <span class="w-20 shrink-0 text-gray-500 font-semibold" :class="f.id === 'chinhpham' || f.id === 'phupham' ? 'font-normal' : ''">
                                                                {{ f.label }}
                                                            </span>
                                                            <span class="w-2 shrink-0 text-center font-semibold">{{ f.id === 'chinhpham' || f.id === 'phupham' ? ':' : ' ' }}</span>
                                                            <div v-if="f.id === 'chinhpham' || f.id === 'phupham'" class="grow flex items-baseline">
                                                                <span class="border-b border-black w-14 text-center font-bold pb-0.5">
                                                                    {{ f.id === 'chinhpham' ? cfgForm.chinhpham : cfgForm.phupham }}
                                                                </span>
                                                                <span class="ml-1 text-[8px] font-normal">%</span>
                                                            </div>
                                                            <span v-else class="grow font-bold text-gray-850 truncate">{{ getFieldValue(f.id) }}</span>
                                                        </div>
                                                    </template>
                                                </div>
                                            </div>
                                            
                                            <!-- Signatures -->
                                            <div class="flex justify-between text-[7px] font-black text-gray-800 mt-4 text-center">
                                                <div>NV TRẠM CÂN</div>
                                                <div>BẢO VỆ</div>
                                                <div>CHỦ HÀNG</div>
                                                <div>THỦ KHO</div>
                                                <div>TÀI XẾ</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="flex justify-end pt-2">
                                <button 
                                    @click="saveBargeConfigImmediately" 
                                    :disabled="cfgForm.locked"
                                    class="px-5 py-2.5 bg-primary text-white font-bold text-xs rounded-[8px] shadow-soft hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none"
                                >
                                    <span class="material-symbols-outlined text-sm">save</span>
                                    Lưu cấu hình mẫu phiếu
                                </button>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>

        <!-- COLUMN MAPPING MODAL -->
        <div v-if="showMappingModal && pendingExcelData" class="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4 animate-fade-in no-print font-display">
            <div class="bg-white rounded-2xl max-w-xl w-full p-6 md:p-8 soft-shadow border border-primary/10 flex flex-col gap-6">
                <div>
                    <h3 class="text-xl font-black text-primary mb-1">Cấu hình ánh xạ cột Excel</h3>
                    <p class="text-xs text-[#1b0d11]/60">Hệ thống đã nhận diện các cột. Vui lòng kiểm tra và sửa lại nếu chưa khớp.</p>
                </div>

                <!-- Fields grid -->
                <div class="space-y-4 max-h-[350px] overflow-y-auto pr-2">
                    <div v-for="field in mappingFields" :key="field.id" class="grid grid-cols-5 items-center gap-4">
                        <label class="col-span-2 text-xs font-bold text-gray-500">
                            {{ field.label }}
                        </label>
                        <select 
                            v-model="pendingExcelData.mapping[field.id]" 
                            class="col-span-3 px-3 py-2 border border-gray-200 rounded-[8px] text-xs font-bold bg-white focus:outline-none focus:border-primary"
                        >
                            <option :value="-1">-- Không ánh xạ --</option>
                            <option v-for="col in pendingExcelData.columns" :key="col.index" :value="col.index">
                                {{ col.name }} (Cột {{ col.index + 1 }})
                            </option>
                        </select>
                    </div>
                </div>

                <!-- Footer buttons -->
                <div class="flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
                    <button 
                        @click="showMappingModal = false; pendingExcelData = null" 
                        class="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-full text-xs transition-all"
                    >
                        Hủy bỏ
                    </button>
                    <button 
                        @click="confirmExcelMapping" 
                        class="px-5 py-2.5 bg-primary text-white font-bold rounded-full text-xs shadow-soft hover:scale-[1.02] transition-all"
                    >
                        Hoàn tất nhập dữ liệu
                    </button>
                </div>
            </div>
        </div>

        <!-- DIALOG: ADD/EDIT TRUCK -->
        <div v-if="showTruckDialog" class="fixed inset-0 bg-black/50 z-[110] flex items-center justify-center p-4 animate-fade-in no-print font-display">
            <div class="bg-white rounded-[16px] max-w-md w-full p-6 md:p-8 soft-shadow border border-primary/10 flex flex-col gap-6">
                <div>
                    <h3 class="text-xl font-black text-primary mb-1">{{ dialogTruck.id ? 'Sửa thông tin xe cân' : 'Thêm thông tin xe cân thủ công' }}</h3>
                    <p class="text-xs text-[#1b0d11]/60">Nhập đầy đủ thông tin chi tiết xe cân bên dưới.</p>
                </div>

                <!-- Form Inputs -->
                <form class="grid grid-cols-2 gap-4 text-xs font-bold text-gray-500">
                    <div class="col-span-2 flex flex-col gap-1.5">
                        <label>Biển số xe / Số xe *</label>
                        <input v-model="dialogTruck.plateNumber" type="text" placeholder="Ví dụ: 51C-12345" class="px-4 py-2.5 rounded-[8px] border border-gray-200 text-sm font-semibold focus:outline-none focus:border-primary">
                    </div>
                    <div class="col-span-2 flex flex-col gap-1.5">
                        <label>Họ tên tài xế</label>
                        <input v-model="dialogTruck.driver" type="text" placeholder="Tên tài xế..." class="px-4 py-2.5 rounded-[8px] border border-gray-200 text-sm font-semibold focus:outline-none focus:border-primary">
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label>TL lần 1 (kg) *</label>
                        <input v-model.number="dialogTruck.weight1" type="number" @input="onWeightInput" class="px-4 py-2.5 rounded-[8px] border border-gray-200 text-sm font-semibold focus:outline-none focus:border-primary">
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label>TL lần 2 (kg) *</label>
                        <input v-model.number="dialogTruck.weight2" type="number" @input="onWeightInput" class="px-4 py-2.5 rounded-[8px] border border-gray-200 text-sm font-semibold focus:outline-none focus:border-primary">
                    </div>
                    <div class="col-span-2 flex flex-col gap-1.5">
                        <label>Trọng lượng hàng (Net) (kg)</label>
                        <input :value="dialogTruck.weightNet" type="number" readonly class="px-4 py-2.5 rounded-[8px] border border-gray-200 text-sm font-black focus:outline-none bg-gray-50 text-teal-600">
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label>Ngày giờ vào</label>
                        <input v-model="dialogTruck.dateIn" type="datetime-local" class="px-4 py-2.5 rounded-[8px] border border-gray-200 text-sm font-semibold focus:outline-none focus:border-primary">
                    </div>
                    <div class="flex flex-col gap-1.5">
                        <label>Ngày giờ ra</label>
                        <input v-model="dialogTruck.dateOut" type="datetime-local" class="px-4 py-2.5 rounded-[8px] border border-gray-200 text-sm font-semibold focus:outline-none focus:border-primary">
                    </div>
                    <div class="col-span-2 flex flex-col gap-1.5">
                        <label>Ghi chú</label>
                        <input v-model="dialogTruck.note" type="text" placeholder="Ghi chú thêm..." class="px-4 py-2.5 rounded-[8px] border border-gray-200 text-sm font-semibold focus:outline-none focus:border-primary">
                    </div>
                </form>

                <!-- Footer buttons -->
                <div class="flex items-center justify-end gap-2 border-t border-gray-100 pt-4">
                    <button 
                        @click="showTruckDialog = false" 
                        class="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-full text-xs transition-all"
                    >
                        Hủy bỏ
                    </button>
                    <button 
                        @click="saveTruck" 
                        class="px-5 py-2.5 bg-primary text-white font-bold rounded-full text-xs shadow-soft hover:scale-[1.02] transition-all"
                    >
                        Lưu thông tin
                    </button>
                </div>
            </div>
        </div>

        <!-- GLOBAL TOAST BANNER -->
        <div v-if="toastMessage" :class="['fixed bottom-8 right-8 z-[200] px-6 py-4 rounded-[16px] shadow-lg border text-sm font-bold flex items-center gap-2 animate-fade-in no-print', toastType === 'success' ? 'bg-teal-50 border-teal-200 text-teal-700' : 'bg-red-50 border-red-200 text-red-700']">
            <span class="material-symbols-outlined text-lg">{{ toastType === 'success' ? 'check_circle' : 'error' }}</span>
            <span>{{ toastMessage }}</span>
        </div>

        <!-- PRINT ONLY SECTION -->
        <teleport to="body">
            <div id="print-section" class="hidden">
            <div v-for="truck in printTrucksList" :key="truck.id" class="print-page">
                <!-- Header -->
                <div class="ticket-header">
                    <div class="ticket-logo-info">
                        <div class="ticket-company">CÔNG TY CỔ PHẦN DỊCH VỤ CẢNG NGUYÊN NGỌC</div>
                        <div class="ticket-address">Địa chỉ: Số 167, tổ 78, Đường Đê Bao, Khu phố 9, Phường Phú An, TP. Hồ Chí Minh, Việt Nam</div>
                        <div class="ticket-phone">ĐT: 0964 258 671 / Fax:</div>
                    </div>
                    <div class="ticket-number-box">
                        <span class="ticket-number-label">Phiếu số: </span>
                        <span class="ticket-number-val">{{ truck.ticketNo }}</span>
                    </div>
                </div>

                <!-- Title -->
                <div class="ticket-title-container">
                    <div class="ticket-title">PHIẾU CÂN XE</div>
                    <div class="ticket-dates">
                        <div>Ngày, giờ vào: {{ formatDateTimeStr(truck.dateIn) }}</div>
                        <div>Ngày, giờ ra: {{ formatDateTimeStr(truck.dateOut) }}</div>
                    </div>
                </div>

                <!-- Body (Two Columns) -->
                <div class="ticket-body">
                    <!-- Left Column -->
                    <div class="ticket-col-left">
                        <div 
                            v-for="field in printFieldsLeft.filter(f => f.visible)" 
                            :key="field.id" 
                            class="ticket-row"
                        >
                            <span class="ticket-row-label">{{ field.label }}</span>
                            <span class="ticket-row-separator">:</span>
                            <span 
                                :class="[
                                    'ticket-row-val', 
                                    (field.id === 'plateNumber' || field.id === 'weightNet') ? 'highlight' : '', 
                                    (field.id === 'weight1' || field.id === 'weight2') ? 'highlight normal-weight' : '',
                                    (field.id === 'words') ? 'text-italic' : '',
                                    (field.id !== 'plateNumber' && field.id !== 'weightNet' && field.id !== 'weight1' && field.id !== 'weight2') ? 'normal-weight' : ''
                                ]"
                            >
                                {{ getFieldValue(field.id, truck) }}
                            </span>
                        </div>
                    </div>

                    <!-- Right Column -->
                    <div class="ticket-col-right">
                        <template v-for="field in printFieldsRight.filter(f => f.visible)" :key="field.id">
                            <!-- Section header for Quality Evaluation -->
                            <div v-if="field.id === 'chinhpham' && isFirstQualityField(field.id)" class="ticket-quality-header">
                                ĐÁNH GIÁ CHẤT LƯỢNG HÀNG HÓA
                            </div>
                            
                            <div class="ticket-row">
                                <span class="ticket-row-label" :class="field.id === 'chinhpham' || field.id === 'phupham' ? 'font-normal' : ''">
                                    {{ field.label }}
                                </span>
                                <span class="ticket-row-separator">{{ field.id === 'chinhpham' || field.id === 'phupham' ? ':' : '&nbsp;' }}</span>
                                
                                <div v-if="field.id === 'chinhpham' || field.id === 'phupham'" class="ticket-row-val-underline-container">
                                    <span class="ticket-row-val-underline">
                                        {{ field.id === 'chinhpham' ? cfgForm.chinhpham : cfgForm.phupham }}
                                    </span>
                                    <span class="ticket-row-unit">%</span>
                                </div>
                                
                                <span 
                                    v-else
                                    class="ticket-row-val normal-weight"
                                >
                                    {{ getFieldValue(field.id, truck) }}
                                </span>
                            </div>
                        </template>
                    </div>
                </div>

                <!-- Signatures -->
                <div class="ticket-footer-signatures">
                    <div class="sig-col">NV TRẠM CÂN</div>
                    <div class="sig-col">BẢO VỆ</div>
                    <div class="sig-col">CHỦ HÀNG</div>
                    <div class="sig-col">THỦ KHO</div>
                    <div class="sig-col">TÀI XẾ</div>
                </div>
            </div>
        </div>
    </teleport>
</div>
</template>

<style scoped>
/* Animations */
.animate-fade-in {
    animation: fadeIn 0.25s ease-out forwards;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: scale(0.98);
    }
    to {
        opacity: 1;
        transform: scale(1);
    }
}

/* Print CSS Styles */
@media print {
    @page {
        size: A5 landscape;
        margin: 5mm;
    }

    :global(body) {
        background-color: white !important;
        background-image: none !important;
        color: black !important;
        height: auto !important;
        overflow: visible !important;
    }
    /* Hide the entire app container during printing */
    :global(#app) {
        display: none !important;
    }
    
    /* Show print section only (teleported to body) */
    #print-section {
        display: block !important;
        background-color: white !important;
        color: black !important;
        width: 100% !important;
    }

    .print-page {
        page-break-after: always;
        height: 135mm; /* Adjusted to fit perfectly in A5 landscape printable area */
        box-sizing: border-box;
        position: relative;
        overflow: hidden;
        border: none;
        padding: 2mm 5mm;
        font-family: 'Times New Roman', Times, serif !important;
        font-size: 11pt !important;
        color: black !important;
        background-color: white !important;
    }

    .print-page:last-child {
        page-break-after: avoid;
    }

    /* Print Ticket styles mapping the original exactly */
    .ticket-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        width: 100%;
        margin-bottom: 2mm;
    }

    .ticket-logo-info {
        width: 70%;
        line-height: 1.2;
    }

    .ticket-company {
        font-weight: bold;
        font-size: 12pt;
        text-transform: uppercase;
    }

    .ticket-address, .ticket-phone {
        font-size: 9.5pt;
    }

    .ticket-number-box {
        width: 25%;
        text-align: right;
        font-size: 11pt;
    }
    
    .ticket-number-label {
        font-weight: normal;
    }
    
    .ticket-number-val {
        font-weight: bold;
        font-size: 11pt;
    }

    .ticket-title-container {
        text-align: center;
        margin-bottom: 3mm;
        width: 100%;
    }

    .ticket-title {
        font-size: 16pt;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 1px;
    }

    .ticket-dates {
        display: flex;
        flex-direction: column;
        align-items: center;
        font-size: 10pt;
        font-style: italic;
        margin-top: 1mm;
        line-height: 1.3;
    }

    .ticket-body {
        display: flex;
        justify-content: space-between;
        width: 100%;
        margin-bottom: 4mm;
    }

    .ticket-col-left {
        width: 48%;
        display: flex;
        flex-direction: column;
        gap: 1.5mm;
    }

    .ticket-col-right {
        width: 48%;
        display: flex;
        flex-direction: column;
        gap: 1.5mm;
    }

    .ticket-row {
        display: flex;
        align-items: baseline;
        line-height: 1.2;
        font-size: 10.5pt;
        color: black !important;
    }

    .ticket-row-label {
        width: 130px;
        flex-shrink: 0;
    }

    .ticket-row-separator {
        width: 15px;
        flex-shrink: 0;
        text-align: center;
    }

    .ticket-row-val {
        flex-grow: 1;
        font-weight: bold;
        min-height: 18px;
    }
    
    .ticket-row-val.normal-weight {
        font-weight: normal;
    }

    .ticket-row-val.highlight {
        font-size: 11pt;
        font-weight: bold;
    }
    
    .text-italic {
        font-style: italic;
    }

    .ticket-quality-header {
        font-weight: bold;
        text-transform: uppercase;
        font-size: 10.5pt;
        margin-top: 2.5mm;
        margin-bottom: 1.5mm;
    }

    .ticket-row-val-underline-container {
        flex-grow: 1;
        display: flex;
        align-items: baseline;
    }

    .ticket-row-val-underline {
        border-bottom: 1px solid black;
        width: 120px;
        text-align: center;
        font-weight: bold;
        display: inline-block;
        min-height: 18px;
    }

    .ticket-row-unit {
        margin-left: 5px;
        font-weight: normal;
    }

    .ticket-footer-signatures {
        display: flex;
        justify-content: space-between;
        width: 100%;
        margin-top: 12mm; /* Give plenty of space for signatures */
        font-size: 9.5pt;
    }

    .sig-col {
        width: 18%;
        text-align: center;
        font-weight: bold;
        text-transform: uppercase;
        font-size: 9.5pt;
    }
}
</style>
