<script setup lang="ts">
import { ref, computed } from 'vue';
import { contentStore } from '../stores/content';

const activeTag = ref('All');

const allTags = computed(() => {
    const tags = new Set(['All']);
    contentStore.projects.forEach(p => {
        if (p.tag) tags.add(p.tag);
    });
    return Array.from(tags);
});

const filteredProjects = computed(() => {
    if (activeTag.value === 'All') return contentStore.projects;
    return contentStore.projects.filter(p => p.tag === activeTag.value);
});
</script>

<template>
  <main class="flex-1 max-w-[1200px] mx-auto px-6 py-12 w-full">
    <!-- Header -->
    <section class="text-center mb-16 relative">
        <div class="absolute -top-10 left-1/2 -translate-x-1/2 text-primary/5 select-none pointer-events-none">
            <span class="material-symbols-outlined text-[150px]">folder_special</span>
        </div>
        <h1 class="text-5xl font-display font-bold mb-4 relative z-10">Magic Portfolio ✨</h1>
        <p class="text-lg opacity-60 font-medium max-w-lg mx-auto">Nơi lưu giữ những phép thuật mà mình đã dày công tạo ra.</p>
    </section>

    <!-- Tag Filter -->
    <div class="flex flex-wrap justify-center gap-3 mb-12">
        <button 
            v-for="tag in allTags" 
            :key="tag"
            @click="activeTag = tag"
            :class="['px-6 py-2 rounded-full font-bold transition-all border-2', activeTag === tag ? 'bg-primary text-white border-primary shadow-lg shadow-primary/20 scale-105' : 'bg-white text-primary/60 border-primary/10 hover:border-primary/30']"
        >
            {{ tag }}
        </button>
    </div>

    <!-- Projects Grid -->
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        <transition-group name="list">
            <div v-for="project in filteredProjects" :key="project.id" 
                class="bg-white rounded-[2.5rem] p-5 pb-8 text-center border-2 border-primary/5 hover:border-primary/20 hover:-translate-y-2 transition-all duration-300 shadow-sm hover:shadow-xl flex flex-col items-center group relative overflow-hidden"
            >
                <!-- Background Blob -->
                <div class="absolute -right-10 -bottom-10 size-40 bg-cute-lavender/10 rounded-full blur-3xl group-hover:bg-primary/5 transition-colors"></div>

                <!-- Project Image -->
                <div class="relative w-full aspect-square rounded-[2rem] overflow-hidden mb-6 flex items-center justify-center">
                    <div class="absolute inset-0 bg-gradient-to-tr from-primary/5 to-transparent"></div>
                    <div class="size-[85%] blob-shape overflow-hidden bg-cover bg-center border-4 border-white shadow-md group-hover:scale-110 transition-transform duration-500" :style="{ backgroundImage: `url(${project.image})` }"></div>
                </div>

                <!-- Tag & Title -->
                <div class="inline-block px-4 py-1 bg-soft-pink/20 rounded-full mb-4">
                    <span class="text-[10px] font-bold text-primary uppercase tracking-widest">{{ project.tag }}</span>
                </div>
                <h3 class="text-2xl font-bold mb-3 text-[#1b0d11] group-hover:text-primary transition-colors">{{ project.title }}</h3>
                <p class="text-[#1b0d11]/60 font-medium leading-relaxed max-w-sm line-clamp-3 text-sm px-2 mb-6">{{ project.description }}</p>

                <!-- Actions -->
                <div class="mt-auto flex gap-4 w-full">
                    <button class="flex-1 py-3 rounded-2xl bg-background-light text-primary font-bold text-xs hover:bg-primary hover:text-white transition-all">Details</button>
                    <button class="size-11 rounded-2xl bg-primary/5 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-all">
                        <span class="material-symbols-outlined text-xl">open_in_new</span>
                    </button>
                </div>
            </div>
        </transition-group>
    </div>

    <!-- Empty State -->
    <div v-if="filteredProjects.length === 0" class="py-32 text-center opacity-30 flex flex-col items-center gap-4">
        <span class="material-symbols-outlined text-6xl">cloud_off</span>
        <p class="font-bold text-xl">Oops! Chưa có dự án nào trong mục này cả.</p>
    </div>
  </main>
</template>

<style scoped>
.list-enter-active, .list-leave-active {
  transition: all 0.5s ease;
}
.list-enter-from, .list-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>
