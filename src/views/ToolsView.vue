<script setup lang="ts">
import ExcelManager from '../components/ExcelManager.vue';
</script>

<template>
  <main class="flex-1 max-w-[1000px] mx-auto px-6 py-12 w-full">
    <section class="text-center mb-16 relative">
      <div class="absolute -top-10 left-1/2 -translate-x-1/2 text-primary/10 select-none">
        <span class="material-symbols-outlined text-[120px]">cloud</span>
      </div>
      <h2 class="text-4xl md:text-5xl font-display font-bold mb-4 relative z-10">Làm việc thật vui! ✨</h2>
      <p class="text-lg font-medium opacity-80 max-w-lg mx-auto">Chọn một công cụ nhỏ để giúp cậu xử lý công việc nhanh hơn nhé!</p>
    </section>

    <!-- Use our functional Excel Manager here -->
    <ExcelManager />

    <div class="grid grid-cols-1 md:grid-cols-2 gap-10 mt-10">
        <div class="bg-white rounded-cloud p-8 shadow-xl shadow-primary/5 border-2 border-soft-pink flex flex-col gap-6 relative overflow-hidden">
            <div class="absolute -right-4 -top-4 opacity-10">
                <span class="material-symbols-outlined text-9xl">magic_button</span>
            </div>
            <div class="flex items-center gap-4">
                <div class="size-16 bg-cute-lavender rounded-puffy flex items-center justify-center text-primary">
                    <span class="material-symbols-outlined text-4xl">flare</span>
                </div>
                <div>
                    <h3 class="text-xl font-display font-bold">Làm Sạch Dữ Liệu</h3>
                    <p class="text-sm opacity-60">Xoá khoảng trắng và lỗi định dạng</p>
                </div>
            </div>
            <div class="flex-1 space-y-4">
                <div class="bg-pastel-pink/50 rounded-2xl p-4 text-sm font-medium border border-soft-pink/30 italic">
                    "Hãy dán dữ liệu thô vào đây để Ánh dọn dẹp giúp cậu nha..."
                </div>
                <textarea class="w-full bg-cute-peach/20 border-2 border-dashed border-primary/20 rounded-2xl p-4 text-sm focus:ring-primary focus:border-primary min-h-[120px] outline-none" placeholder="Nhập văn bản tại đây..."></textarea>
            </div>
            <button class="puffy-button py-4 w-full">Biến hoá ngay ✨</button>
        </div>

         <div class="bg-white rounded-cloud p-8 shadow-xl shadow-primary/5 border-2 border-soft-pink flex flex-col gap-6 relative overflow-hidden">
             <div class="absolute -right-4 -top-4 opacity-10">
                <span class="material-symbols-outlined text-9xl">extension</span>
            </div>
             <div class="flex items-center gap-4">
                <div class="size-16 bg-cute-peach rounded-puffy flex items-center justify-center text-primary">
                    <span class="material-symbols-outlined text-4xl">diversity_1</span>
                </div>
                <div>
                    <h3 class="text-xl font-display font-bold">Ghép Dữ Liệu</h3>
                    <p class="text-sm opacity-60">Kết hợp nhiều file thành một</p>
                </div>
            </div>
             <div class="dashed-cloud rounded-[3rem] p-10 flex flex-col items-center justify-center gap-4 text-center cursor-pointer hover:bg-white/50 transition-all">
                <div class="text-primary">
                    <span class="material-symbols-outlined text-5xl">cloud_upload</span>
                </div>
                <div>
                    <p class="font-bold text-primary">Thả file vào mây nhé!</p>
                    <p class="text-xs opacity-50 mt-1">Hỗ trợ Excel, CSV, JSON</p>
                </div>
            </div>
         </div>
    </div>
  </main>
</template>
