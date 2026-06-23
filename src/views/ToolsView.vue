<script setup lang="ts">
import { ref, computed } from 'vue';
import FormatConverter from '../components/tools/FormatConverter.vue';
import PdfOcrTools from '../components/tools/PdfOcrTools.vue';
import ExcelMerger from '../components/tools/ExcelMerger.vue';
import WeighbridgePrinter from '../components/tools/WeighbridgePrinter.vue';

const activeToolId = ref<string | null>(null);
const weighbridgeRef = ref<any>(null);

const toolsList = [
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
    name: 'In Phiếu Cân Xe 🚢',
    desc: 'Quản lý tàu, sà lan và danh sách xe cân từ Excel. Hỗ trợ tạo và in phiếu cân tự động định dạng A5 chuyên nghiệp.',
    icon: 'print',
    bgIcon: 'bg-primary/10 text-primary',
    tags: ['Supabase Cloud', 'In A5', 'Excel Match']
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

const activeToolMetadata = computed(() => {
  return toolsList.find(t => t.id === activeToolId.value) || null;
});

const openTool = (id: string) => {
  if (id === 'weighbridge') {
    if (weighbridgeRef.value) {
      weighbridgeRef.value.isOpen = true;
    }
  } else {
    activeToolId.value = id;
  }
};

const handleSidebarSwitch = (id: string) => {
  if (id === 'weighbridge') {
    activeToolId.value = null;
    setTimeout(() => {
      if (weighbridgeRef.value) {
        weighbridgeRef.value.isOpen = true;
      }
    }, 150);
  } else {
    activeToolId.value = id;
  }
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

    <!-- Hidden Weighbridge component (triggered by openTool('weighbridge')) -->
    <WeighbridgePrinter ref="weighbridgeRef" :hide-card="true" />

    <!-- Fullscreen Workspace Overlay for other tools -->
    <div v-if="activeToolId && activeToolMetadata" class="fixed inset-0 bg-cute-gradient z-[100] flex flex-col overflow-hidden no-print animate-fade-in font-display">
      <!-- Header bar of Workspace -->
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
        <!-- Sidebar: quick navigation to other tools -->
        <aside class="w-64 bg-white border-r border-primary/10 flex flex-col shrink-0">
          <div class="p-3 border-b border-primary/5 flex items-center justify-between">
            <span class="text-[10px] font-black text-gray-400 uppercase tracking-wider">Danh sách công cụ</span>
          </div>

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

          <!-- Back button -->
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
          <div class="w-full max-w-4xl">
            <FormatConverter v-if="activeToolId === 'converter'" />
            <ExcelMerger v-else-if="activeToolId === 'merger'" />
            <PdfOcrTools v-else-if="activeToolId === 'ocr'" />
          </div>
        </main>
      </div>
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
