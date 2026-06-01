<script setup lang="ts">
import FormatConverter from '../components/tools/FormatConverter.vue';
import PdfOcrTools from '../components/tools/PdfOcrTools.vue';
import ExcelMerger from '../components/tools/ExcelMerger.vue';
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

      <!-- Tool 2: Smart Merge (Active) -->
      <ExcelMerger />

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
