<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import FormatConverter from '../components/tools/FormatConverter.vue';
import PdfOcrTools from '../components/tools/PdfOcrTools.vue';
import ExcelMerger from '../components/tools/ExcelMerger.vue';
import WeighbridgePrinter from '../components/tools/WeighbridgePrinter.vue';
import CargoAllocator from '../components/tools/CargoAllocator.vue';
import VehicleManager from '../components/tools/VehicleManager.vue';
import { authStore } from '../stores/auth';
import { ContentService } from '../services/ContentService';
import { WeighbridgeService, type Vessel } from '../services/excel/WeighbridgeService';

// Active tool and sub-views
const activeToolId = ref<string | null>(null);
const activeTab = ref<'allocator' | 'printer' | 'vehicles'>('allocator');
const allowedStaffTools = ref<string[]>(['converter', 'merger', 'weighbridge', 'allocator', 'ocr']);

// Vessel & Barge shared state
const vessels = ref<Vessel[]>([]);
const activeVesselId = ref<number | null>(null);
const activeBargeId = ref<number | null>(null);
const expandedVesselIds = ref<Record<number, boolean>>({});
const loadingVessels = ref(false);

// Toast and Confirm dialogs state
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

interface ConfirmDialogState {
    show: boolean;
    title: string;
    message: string;
    type: 'warning' | 'danger' | 'info' | 'success';
    okText?: string;
    cancelText?: string;
    onOk?: () => void;
    onCancel?: () => void;
}

const confirmDialog = ref<ConfirmDialogState>({
    show: false,
    title: '',
    message: '',
    type: 'info'
});

function showConfirm(options: Omit<ConfirmDialogState, 'show'>) {
    return new Promise<boolean>((resolve) => {
        confirmDialog.value = {
            show: true,
            title: options.title,
            message: options.message,
            type: options.type,
            okText: options.okText || 'Xác nhận',
            cancelText: options.cancelText || 'Hủy',
            onOk: () => {
                confirmDialog.value.show = false;
                resolve(true);
            },
            onCancel: () => {
                confirmDialog.value.show = false;
                resolve(false);
            }
        };
    });
}

function handleConfirmOk() {
    if (confirmDialog.value.onOk) {
        confirmDialog.value.onOk();
    }
}

function handleConfirmCancel() {
    if (confirmDialog.value.onCancel) {
        confirmDialog.value.onCancel();
    }
}

// Load vessels list
const loadVessels = async () => {
    loadingVessels.value = true;
    try {
        const data = await WeighbridgeService.getVessels();
        vessels.value = data;
        
        // Expand all vessels by default
        data.forEach(v => {
            if (expandedVesselIds.value[v.id] === undefined) {
                expandedVesselIds.value[v.id] = true;
            }
        });
    } catch (e) {
        showToast('Không thể tải danh sách tàu từ Supabase!', 'error');
    } finally {
        loadingVessels.value = false;
    }
};

const selectBarge = (vesselId: number, bargeId: number) => {
    activeVesselId.value = vesselId;
    activeBargeId.value = bargeId;
};

// CRUD Vessel
const addVessel = async () => {
    const name = prompt('Nhập tên tàu mới:');
    if (!name || !name.trim()) return;

    loadingVessels.value = true;
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
        loadingVessels.value = false;
    }
};

const renameVessel = async (id: number, currentName: string) => {
    const name = prompt('Nhập tên tàu mới:', currentName);
    if (!name || !name.trim() || name.trim() === currentName) return;

    loadingVessels.value = true;
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
        loadingVessels.value = false;
    }
};

const deleteVessel = async (id: number, name: string) => {
    const confirm = await showConfirm({
        title: 'Xóa tàu',
        message: `Bạn có chắc chắn muốn xóa tàu "${name}" cùng toàn bộ sà lan và dữ liệu cân xe của nó không? Hành động này sẽ xóa vĩnh viễn dữ liệu.`,
        type: 'danger',
        okText: 'Xóa tàu',
        cancelText: 'Hủy'
    });
    if (!confirm) return;

    loadingVessels.value = true;
    try {
        const success = await WeighbridgeService.deleteVessel(id);
        if (success) {
            if (activeVesselId.value === id) {
                activeVesselId.value = null;
                activeBargeId.value = null;
            }
            await loadVessels();
            showToast(`Đã xóa tàu: ${name}`, 'error');
        } else {
            showToast('Không thể xóa tàu!', 'error');
        }
    } catch (e) {
        showToast('Lỗi khi xóa tàu!', 'error');
    } finally {
        loadingVessels.value = false;
    }
};

// CRUD Barge
const addBarge = async (vesselId: number) => {
    const name = prompt('Nhập tên sà lan mới:');
    if (!name || !name.trim()) return;

    loadingVessels.value = true;
    try {
        const data = await WeighbridgeService.createBarge(vesselId, name);
        if (data) {
            await loadVessels();
            selectBarge(vesselId, data.id);
            showToast(`Đã thêm sà lan: ${data.name}`);
        } else {
            showToast('Không thể thêm sà lan mới!', 'error');
        }
    } catch (e) {
        showToast('Lỗi khi thêm sà lan!', 'error');
    } finally {
        loadingVessels.value = false;
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

    loadingVessels.value = true;
    try {
        const success = await WeighbridgeService.updateBarge(id, name);
        if (success) {
            await loadVessels();
            showToast(`Đã đổi tên sà lan thành: ${name}`);
        } else {
            showToast('Không thể đổi tên sà lan!', 'error');
        }
    } catch (e) {
        showToast('Lỗi khi đổi tên sà lan!', 'error');
    } finally {
        loadingVessels.value = false;
    }
};

const deleteBarge = async (id: number, name: string) => {
    const barge = vessels.value.flatMap(v => v.barges || []).find(b => b.id === id);
    if (barge?.config?.locked) {
        showToast('Sà lan đang bị khóa! Vui lòng mở khóa để xóa.', 'error');
        return;
    }

    const confirm = await showConfirm({
        title: 'Xóa sà lan',
        message: `Bạn có chắc chắn muốn xóa sà lan "${name}" cùng toàn bộ danh sách xe không? Hành động này sẽ xóa vĩnh viễn dữ liệu.`,
        type: 'danger',
        okText: 'Xóa sà lan',
        cancelText: 'Hủy'
    });
    if (!confirm) return;

    loadingVessels.value = true;
    try {
        const success = await WeighbridgeService.deleteBarge(id);
        if (success) {
            if (activeBargeId.value === id) {
                activeBargeId.value = null;
            }
            await loadVessels();
            showToast(`Đã xóa sà lan: ${name}`, 'error');
        } else {
            showToast('Không thể xóa sà lan!', 'error');
        }
    } catch (e) {
        showToast('Lỗi khi xóa sà lan!', 'error');
    } finally {
        loadingVessels.value = false;
    }
};

onMounted(async () => {
    allowedStaffTools.value = await ContentService.loadStaffTools();
});

const allTools = [
  {
    id: 'converter',
    name: 'Chuyển Đổi Định Dạng File',
    desc: 'Hỗ trợ chuyển đổi nhanh chóng qua lại giữa các định dạng Excel (.xlsx), CSV và JSON mà không làm mất dữ liệu gốc.',
    icon: 'swap_horiz',
    bgIcon: 'bg-rose-500/10 text-rose-500',
    tags: ['Excel', 'CSV', 'JSON', 'Local Only']
  },
  {
    id: 'merger',
    name: 'Gộp Excel Thông Minh',
    desc: 'Trộn và hợp nhất nhiều tệp bảng tính dựa trên cột khóa chung, giữ nguyên định dạng của tệp chính.',
    icon: 'layers',
    bgIcon: 'bg-sky-500/10 text-sky-500',
    tags: ['Excel', 'Merge', 'Automate']
  },
  {
    id: 'weighbridge',
    name: 'Báo Cáo & In Phiếu Cân Xe 🚢',
    desc: 'Hệ thống gộp quản lý trạm cân: Phân bổ sà lan, in ấn phiếu cân A5 chuyên nghiệp và danh sách xe quản lý.',
    icon: 'print',
    bgIcon: 'bg-primary/10 text-primary',
    tags: ['Báo Cáo', 'In A5', 'Supabase Cloud', 'Phân bổ']
  },
  {
    id: 'ocr',
    name: 'Trích Xuất PDF & OCR',
    desc: 'Quét và nhận diện văn bản (OCR) từ các file ảnh và tệp PDF trực tiếp trong trình duyệt bằng Tesseract.js.',
    icon: 'document_scanner',
    bgIcon: 'bg-teal-500/10 text-teal-600',
    tags: ['PDF Quét', 'Image OCR', 'Browser Only']
  }
];

const toolsList = computed(() => {
  if (authStore.role === 'admin') {
    return allTools;
  }
  // If allowed either 'weighbridge' or 'allocator', allow access to the merged tool
  const hasWeighbridgeAccess = allowedStaffTools.value.includes('weighbridge') || allowedStaffTools.value.includes('allocator');
  return allTools.filter(t => {
      if (t.id === 'weighbridge') return hasWeighbridgeAccess;
      return allowedStaffTools.value.includes(t.id);
  });
});

const activeToolMetadata = computed(() => {
  return toolsList.value.find(t => t.id === activeToolId.value) || null;
});

const openTool = (id: string) => {
  if (id === 'weighbridge' || id === 'allocator') {
    activeToolId.value = 'weighbridge';
    activeTab.value = id === 'allocator' ? 'allocator' : 'printer';
    loadVessels();
  } else {
    activeToolId.value = id;
  }
};

const handleSidebarSwitch = (id: string) => {
  if (id === 'weighbridge' || id === 'allocator') {
    activeToolId.value = 'weighbridge';
    activeTab.value = id === 'allocator' ? 'allocator' : 'printer';
    loadVessels();
  } else {
    activeToolId.value = id;
  }
};

const toggleVessel = (vesselId: number) => {
    expandedVesselIds.value[vesselId] = !expandedVesselIds.value[vesselId];
};
</script>

<template>
  <main class="flex-1 max-w-[1200px] mx-auto px-6 py-12 w-full font-display">
    <!-- Header Section -->
    <section class="text-center mb-12 relative">
      <div class="absolute -top-10 left-1/2 -translate-x-1/2 text-primary/5 select-none pointer-events-none">
        <span class="material-symbols-outlined text-[130px]">widgets</span>
      </div>
      <h2 class="text-3xl md:text-4xl font-display font-black text-[#4a2c32] mb-3 relative z-10">Làm việc thật vui! ✨</h2>
      <p class="text-sm font-medium text-[#1b0d11]/60 max-w-xl mx-auto leading-relaxed">
        Chọn một công cụ nhỏ để giúp cậu xử lý công việc nhanh hơn nhé. Mọi dữ liệu đều được xử lý offline an toàn ngay trên trình duyệt của bạn!
      </p>
    </section>

    <!-- Tools Catalog Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
      <div 
        v-for="tool in toolsList" 
        :key="tool.id"
        class="bg-white rounded-2xl p-6 soft-shadow border border-primary/5 flex flex-col justify-between h-full group hover:border-primary/20 hover:scale-[1.01] transition-all relative overflow-hidden"
      >
        <!-- Background Icon decoration -->
        <div class="absolute -top-6 -right-6 p-6 opacity-[0.03] group-hover:opacity-[0.07] group-hover:scale-110 transition-all pointer-events-none">
          <span class="material-symbols-outlined text-[110px] text-primary">{{ tool.icon }}</span>
        </div>

        <div>
          <!-- Tool Header -->
          <div class="flex items-center gap-3 mb-4">
            <div :class="['size-10 rounded-xl flex items-center justify-center shadow-soft', tool.bgIcon]">
              <span class="material-symbols-outlined text-lg">{{ tool.icon }}</span>
            </div>
            <h3 class="text-base font-display font-black text-[#4a2c32] group-hover:text-primary transition-colors">
              {{ tool.name }}
            </h3>
          </div>

          <!-- Tool Desc -->
          <p class="text-xs font-medium text-[#1b0d11]/60 leading-relaxed mb-6 min-h-[48px]">
            {{ tool.desc }}
          </p>

          <!-- Tool Tags -->
          <div class="flex flex-wrap gap-1.5 mb-6">
            <span 
              v-for="tag in tool.tags" 
              :key="tag" 
              class="text-[9px] font-black px-2.5 py-1 bg-gray-50 text-gray-500 rounded-full border border-gray-100"
            >
              {{ tag }}
            </span>
          </div>
        </div>

        <!-- Open Button -->
        <button 
          @click="openTool(tool.id)" 
          class="w-full py-3 bg-white border border-primary/10 hover:border-primary text-primary font-bold rounded-2xl text-xs flex items-center justify-center gap-1.5 hover:bg-primary/5 transition-all shadow-sm"
        >
          <span class="material-symbols-outlined text-base">open_in_new</span>
          Sử dụng công cụ
        </button>
      </div>

      <!-- Placeholder card for future tools -->
      <div class="bg-white/30 rounded-2xl p-6 border border-dashed border-primary/20 flex flex-col justify-center items-center text-center h-full min-h-[220px]">
        <div class="size-11 bg-primary/5 text-primary/30 rounded-full flex items-center justify-center mb-3">
          <span class="material-symbols-outlined text-lg">add_circle</span>
        </div>
        <h3 class="text-xs font-black text-[#4a2c32]/50 mb-1">
          Nhiều công cụ khác sắp ra mắt...
        </h3>
        <p class="text-[10px] text-[#1b0d11]/40 max-w-[190px]">
          Chúng mình đang thiết kế thêm nhiều tiện ích văn phòng miễn phí để giúp bạn làm việc thảnh thơi hơn!
        </p>
      </div>
    </div>

    <!-- Fullscreen Workspace Overlay for all tools -->
    <div v-if="activeToolId && activeToolMetadata" class="fixed inset-0 bg-cute-gradient z-[100] flex flex-col overflow-hidden no-print animate-fade-in font-display">
      
      <!-- Workspace Header bar -->
      <header class="bg-white px-6 py-2.5 border-b border-primary/10 flex items-center justify-between shadow-sm shrink-0">
        <div class="flex items-center gap-2.5">
          <div :class="['size-9 rounded-full flex items-center justify-center text-white shadow-soft', activeToolMetadata.bgIcon.split(' ')[0] || 'bg-primary']">
            <span class="material-symbols-outlined text-lg">{{ activeToolMetadata.icon }}</span>
          </div>
          <div>
            <h2 class="text-sm font-black text-primary leading-tight">{{ activeToolMetadata.name }}</h2>
            <p class="text-[10px] font-medium text-[#1b0d11]/60 leading-none">Công cụ tiện ích - Xử lý offline an toàn</p>
          </div>
        </div>

        <!-- 3 Tab Main Navigation for Weighbridge App on Header -->
        <nav v-if="activeToolId === 'weighbridge'" class="flex gap-1 bg-slate-50 border border-primary/5 p-1 rounded-xl">
          <button 
            @click="activeTab = 'allocator'"
            :class="['px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5', activeTab === 'allocator' ? 'bg-primary text-white shadow-soft' : 'text-gray-600 hover:bg-gray-100']"
          >
            <span class="material-symbols-outlined text-sm">shuffle</span>
            Báo cáo cân hàng
          </button>
          <button 
            @click="activeTab = 'printer'"
            :class="['px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5', activeTab === 'printer' ? 'bg-primary text-white shadow-soft' : 'text-gray-600 hover:bg-gray-100']"
          >
            <span class="material-symbols-outlined text-sm">print</span>
            In Phiếu Cân Xe
          </button>
          <button 
            @click="activeTab = 'vehicles'"
            :class="['px-4 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5', activeTab === 'vehicles' ? 'bg-primary text-white shadow-soft' : 'text-gray-600 hover:bg-gray-100']"
          >
            <span class="material-symbols-outlined text-sm">local_shipping</span>
            Danh sách xe
          </button>
        </nav>
        
        <button 
          @click="activeToolId = null" 
          class="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-full text-xs flex items-center gap-1 transition-all"
        >
          <span class="material-symbols-outlined text-sm">close</span>
          Đóng công cụ
        </button>
      </header>

      <!-- Workspace Body -->
      <div class="flex-1 flex overflow-hidden">
        
        <!-- Left Sidebar: Vessel / Barge hierarchy selection for Weighbridge, standard list for other tools -->
        <aside class="w-64 bg-white border-r border-primary/10 flex flex-col shrink-0">
          <div class="p-3 border-b border-primary/5 flex items-center justify-between">
            <span class="text-[10px] font-black text-gray-400 uppercase tracking-wider">
              {{ activeToolId === 'weighbridge' ? 'Danh mục Tàu / Sà lan' : 'Danh sách công cụ' }}
            </span>
          </div>

          <!-- Vessel / Barge hierarchical tree -->
          <template v-if="activeToolId === 'weighbridge'">
            <div class="flex-1 overflow-y-auto p-2 space-y-2">
              <div v-if="loadingVessels" class="text-center py-6 text-gray-400 text-xs flex flex-col items-center justify-center gap-2">
                <span class="material-symbols-outlined text-xl animate-spin text-primary">sync</span>
                Đang tải danh sách...
              </div>
              <div v-else-if="vessels.length === 0" class="text-center py-6 text-gray-400 text-xs italic">
                Chưa có tàu nào được tạo.
              </div>
              <template v-else>
                <div 
                  v-for="vessel in vessels" 
                  :key="vessel.id" 
                  class="border border-primary/5 rounded-[16px] overflow-hidden bg-gray-50/50"
                >
                  <!-- Vessel row -->
                  <div 
                    @click="toggleVessel(vessel.id)"
                    class="p-2.5 flex items-center justify-between hover:bg-primary/5 cursor-pointer font-bold text-xs text-[#4a2c32]"
                  >
                    <div class="flex items-center gap-1.5 truncate">
                      <span class="material-symbols-outlined text-sm text-primary">directions_boat</span>
                      <span class="truncate">{{ vessel.name }}</span>
                    </div>
                    <div class="flex items-center gap-1">
                      <span class="material-symbols-outlined text-xs transition-transform" :class="{ 'rotate-180': expandedVesselIds[vessel.id] }">expand_more</span>
                      
                      <!-- Vessel admin action buttons -->
                      <div v-if="authStore.role === 'admin'" class="flex items-center gap-0.5" @click.stopPropagation>
                        <button @click="addBarge(vessel.id)" class="size-5 rounded-full hover:bg-white flex items-center justify-center text-primary/70 hover:text-primary transition-colors" title="Thêm sà lan">
                          <span class="material-symbols-outlined text-xs">add</span>
                        </button>
                        <button @click="renameVessel(vessel.id, vessel.name)" class="size-5 rounded-full hover:bg-white flex items-center justify-center text-gray-400 hover:text-primary transition-colors" title="Đổi tên">
                          <span class="material-symbols-outlined text-xs">edit</span>
                        </button>
                        <button @click="deleteVessel(vessel.id, vessel.name)" class="size-5 rounded-full hover:bg-white flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors" title="Xóa tàu">
                          <span class="material-symbols-outlined text-xs">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Barges list under Vessel -->
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
                        <span v-if="barge.config?.orderNo" :class="['ml-1.5 px-1 py-0.2 text-[8px] border rounded font-black uppercase tracking-wider', activeBargeId === barge.id ? 'bg-white/20 text-white border-white/30' : 'bg-teal-50 text-teal-600 border-teal-200']">
                          Lệnh: {{ barge.config.orderNo }}
                        </span>
                        <span v-if="barge.config?.locked" class="material-symbols-outlined text-[11px]" :class="activeBargeId === barge.id ? 'text-white/90' : 'text-red-500'" title="Sà lan đang bị khóa">lock</span>
                      </div>

                      <!-- Barge admin actions -->
                      <div v-if="authStore.role === 'admin'" class="flex items-center gap-0.5" @click.stopPropagation>
                        <button @click="renameBarge(barge.id, barge.name)" class="size-5 rounded-full hover:bg-black/10 flex items-center justify-center transition-colors" :class="activeBargeId === barge.id ? 'text-white' : 'text-gray-400 hover:text-primary'" title="Đổi tên">
                          <span class="material-symbols-outlined text-[10px]">edit</span>
                        </button>
                        <button @click="deleteBarge(barge.id, barge.name)" class="size-5 rounded-full hover:bg-black/10 flex items-center justify-center transition-colors" :class="activeBargeId === barge.id ? 'text-white' : 'text-gray-400 hover:text-red-500'" title="Xóa sà lan">
                          <span class="material-symbols-outlined text-[10px]">delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </div>
            
            <!-- Sidebar Footer for Admin to add Vessel -->
            <div v-if="authStore.role === 'admin'" class="p-3 border-t border-primary/10 bg-gray-50">
              <button 
                @click="addVessel" 
                class="w-full py-2 bg-white border border-primary/20 hover:border-primary text-primary font-bold rounded-[12px] text-xs flex items-center justify-center gap-1.5 hover:bg-primary/5 transition-all shadow-sm"
              >
                <span class="material-symbols-outlined text-xs">add</span>
                Thêm tàu mới
              </button>
            </div>
          </template>

          <!-- Navigation for other tools -->
          <template v-else>
            <div class="flex-1 overflow-y-auto p-2 space-y-1">
              <button 
                v-for="tool in toolsList" 
                :key="tool.id"
                @click="handleSidebarSwitch(tool.id)"
                :class="['w-full flex items-center gap-2 p-2 rounded-lg text-left text-xs font-bold transition-all', activeToolId === tool.id ? 'bg-primary text-white shadow-soft' : 'text-gray-600 hover:bg-gray-100']"
              >
                <span class="material-symbols-outlined text-sm">{{ tool.icon }}</span>
                <span class="truncate">{{ tool.name }}</span>
              </button>
            </div>
          </template>

          <!-- Back to Catalog button -->
          <div class="p-3 border-t border-primary/10 bg-gray-50">
            <button 
              @click="activeToolId = null" 
              class="w-full py-2 bg-white border border-primary/20 hover:border-primary text-primary font-bold rounded-lg text-xs flex items-center justify-center gap-1.5 hover:bg-primary/5 transition-all shadow-sm"
            >
              <span class="material-symbols-outlined text-xs">arrow_back</span>
              Về Trang Chủ
            </button>
          </div>
        </aside>

        <!-- Main Content Area -->
        <main class="flex-1 overflow-y-auto p-6 bg-cute-gradient flex flex-col items-center">
          <div class="w-full max-w-[1200px] h-full flex flex-col">
            <FormatConverter v-if="activeToolId === 'converter'" />
            <ExcelMerger v-else-if="activeToolId === 'merger'" />
            <PdfOcrTools v-else-if="activeToolId === 'ocr'" />
            
            <!-- Weighbridge Unified App components -->
            <template v-else-if="activeToolId === 'weighbridge'">
              <!-- Cargo Allocator Tab -->
              <CargoAllocator 
                v-show="activeTab === 'allocator'" 
                :active-sub-view="activeTab" 
                :active-vessel-id="activeVesselId" 
                :active-barge-id="activeBargeId" 
                :vessels-list="vessels"
                @update-vessels="loadVessels" 
              />
              
              <!-- Weighbridge Printer Tab -->
              <WeighbridgePrinter 
                v-if="activeTab === 'printer'" 
                :active-vessel-id="activeVesselId" 
                :active-barge-id="activeBargeId" 
                :vessels-list="vessels" 
                :hide-sidebar="true" 
                @update-vessels="loadVessels" 
              />
              
              <!-- Vehicles Manager Tab -->
              <VehicleManager v-if="activeTab === 'vehicles'" />
            </template>
          </div>
        </main>

      </div>
    </div>

    <!-- UI Confirm Dialog -->
    <div v-if="confirmDialog.show" class="fixed inset-0 bg-black/60 z-[300] flex items-center justify-center p-4">
      <div class="bg-white rounded-[24px] max-w-md w-full overflow-hidden shadow-2xl border border-primary/5 animate-scale-in">
        <div class="p-6">
          <h3 class="text-base font-black text-[#4a2c32] mb-2 flex items-center gap-2">
            <span class="material-symbols-outlined text-lg" :class="{
              'text-amber-500': confirmDialog.type === 'warning',
              'text-red-500': confirmDialog.type === 'danger',
              'text-primary': confirmDialog.type === 'info',
              'text-emerald-500': confirmDialog.type === 'success',
            }">
              {{ confirmDialog.type === 'danger' ? 'delete_forever' : 'info' }}
            </span>
            {{ confirmDialog.title }}
          </h3>
          <p class="text-xs text-[#1b0d11]/70 leading-relaxed">{{ confirmDialog.message }}</p>
        </div>
        <div class="px-6 py-4 bg-gray-50 flex justify-end gap-2 border-t border-gray-100">
          <button 
            @click="handleConfirmCancel"
            class="px-4 py-2 border border-gray-200 hover:bg-gray-100 text-[#4a2c32] font-bold rounded-[14px] text-xs transition-all"
          >
            {{ confirmDialog.cancelText }}
          </button>
          <button 
            @click="handleConfirmOk"
            :class="[
              'px-5 py-2 text-white font-bold rounded-[14px] text-xs transition-all shadow-sm',
              confirmDialog.type === 'danger' ? 'bg-red-500 hover:bg-red-600' : 'bg-primary hover:bg-primary/95'
            ]"
          >
            {{ confirmDialog.okText }}
          </button>
        </div>
      </div>
    </div>

    <!-- Toast Notification -->
    <div 
      v-if="toastMessage" 
      class="fixed bottom-6 right-6 z-[500] px-4 py-3 rounded-2xl shadow-xl border text-xs font-bold flex items-center gap-2 animate-slide-up"
      :class="toastType === 'success' ? 'bg-emerald-50 border-emerald-100 text-emerald-800' : 'bg-red-50 border-red-100 text-red-800'"
    >
      <span class="material-symbols-outlined text-sm">
        {{ toastType === 'success' ? 'check_circle' : 'error' }}
      </span>
      {{ toastMessage }}
    </div>

    <!-- Features Info Footer -->
    <div class="mt-20 grid grid-cols-1 md:grid-cols-3 gap-8">
      <div class="flex flex-col items-center text-center gap-3">
        <div class="size-12 bg-white rounded-full flex items-center justify-center text-primary shadow-soft border border-soft-pink">
          <span class="material-symbols-outlined">security</span>
        </div>
        <h4 class="font-bold text-primary">An toàn tuyệt đối</h4>
        <p class="text-xs opacity-60">Dữ liệu được xử lý tại thiết bị của cậu, không tải lên máy chủ.</p>
      </div>
      <div class="flex flex-col items-center text-center gap-3">
        <div class="size-12 bg-white rounded-full flex items-center justify-center text-primary shadow-soft border border-soft-pink">
          <span class="material-symbols-outlined">bolt</span>
        </div>
        <h4 class="font-bold text-primary">Nhanh & Mượt</h4>
        <p class="text-xs opacity-60">Sử dụng ExcelJS mạnh mẽ để xử lý hàng ngàn dòng dữ liệu trong nháy mắt.</p>
      </div>
      <div class="flex flex-col items-center text-center gap-3">
        <div class="size-12 bg-white rounded-full flex items-center justify-center text-primary shadow-soft border border-soft-pink">
          <span class="material-symbols-outlined">coffee</span>
        </div>
        <h4 class="font-bold text-primary">Hoàn toàn miễn phí</h4>
        <p class="text-xs opacity-60">Món quà từ Ánh giúp công việc của cậu trở nên thư thái hơn.</p>
      </div>
    </div>
  </main>
</template>
