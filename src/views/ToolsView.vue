<script setup lang="ts">
import FormatConverter from '../components/tools/FormatConverter.vue';
import PdfOcrTools from '../components/tools/PdfOcrTools.vue';
</script>

<template>
  <main class="flex-1 max-w-[1200px] mx-auto px-6 py-12 w-full">
    <!-- Header Section -->
    <section class="text-center mb-16 relative">
      <div class="absolute -top-10 left-1/2 -translate-x-1/2 text-primary/10 select-none pointer-events-none">
        <span class="material-symbols-outlined text-[120px]">cloud</span>
      </div>
      <h2 class="text-4xl md:text-5xl font-display font-bold mb-4 relative z-10">Làm việc thật vui! ✨</h2>
      <p class="text-lg font-medium opacity-80 max-w-lg mx-auto">Chọn một công cụ nhỏ để giúp cậu xử lý công việc nhanh hơn nhé!</p>
    </section>

    <!-- Tools Grid -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
      
      <!-- Tool 1: Format Converter (Active) -->
      <FormatConverter />

      <!-- Tool 2: Data Cleaner (Coming Soon) -->
      <div class="bg-white rounded-cloud p-8 shadow-xl shadow-primary/5 border-2 border-soft-pink flex flex-col gap-6 relative overflow-hidden h-full group grayscale hover:grayscale-0 transition-all">
        <div class="absolute -right-4 -top-4 opacity-5">
          <span class="material-symbols-outlined text-9xl">magic_button</span>
        </div>
        
        <div class="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-20 flex items-center justify-center rotate-[-5deg]">
          <div class="bg-primary text-white font-bold py-2 px-6 rounded-full shadow-lg shadow-primary/20">
            Sắp ra mắt! 🚀
          </div>
        </div>

        <div class="flex items-center gap-4 relative z-10 opacity-40 group-hover:opacity-100 transition-opacity">
          <div class="size-16 bg-cute-lavender rounded-puffy flex items-center justify-center text-primary">
            <span class="material-symbols-outlined text-4xl">flare</span>
          </div>
          <div>
            <h3 class="text-xl font-display font-bold">Làm Sạch Dữ Liệu</h3>
            <p class="text-sm opacity-60">Xoá khoảng trắng và lỗi định dạng</p>
          </div>
        </div>
        
        <div class="flex-1 space-y-4 opacity-30 group-hover:opacity-100 transition-opacity">
          <div class="bg-pastel-pink/50 rounded-2xl p-4 text-sm font-medium border border-soft-pink/30 italic">
            "Hãy dán dữ liệu thô vào đây để Ánh dọn dẹp giúp cậu nha..."
          </div>
          <textarea readonly class="w-full bg-cute-peach/20 border-2 border-dashed border-primary/20 rounded-2xl p-4 text-sm min-h-[120px] outline-none pointer-events-none" placeholder="Nhập văn bản tại đây..."></textarea>
        </div>
        <button disabled class="puffy-button py-4 w-full opacity-50">Biến hoá ngay ✨</button>
      </div>

    </div>

    <div class="mt-8">
      <PdfOcrTools />
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
