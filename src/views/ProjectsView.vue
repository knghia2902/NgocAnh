<script setup lang="ts">
import { contentStore } from '../stores/content';

// Simple function to generate different wavy border radius for visual variety
const getWavyStyle = (index: number) => {
    const borders = [
        '60% 40% 30% 70% / 60% 30% 70% 40%',
        '40% 60% 70% 30% / 40% 70% 30% 60%',
        '70% 30% 60% 40% / 30% 60% 40% 70%',
        '40% 80% 30% 60% / 50% 30% 70% 40%'
    ];
    return { borderRadius: borders[index % borders.length] };
};
</script>

<template>
    <div class="min-h-screen font-display text-[#4a2c32] selection:bg-strawberry-cream selection:text-white pt-16">
        <main class="max-w-[1200px] mx-auto px-4 md:px-10 pb-20">
            <div class="flex flex-col items-center gap-6 mb-16 text-center">
                <div class="flex items-center gap-2">
                    <span class="material-symbols-outlined text-primary text-2xl">star</span>
                    <span class="text-primary font-bold tracking-widest uppercase text-sm">Portfolio</span>
                    <span class="material-symbols-outlined text-primary text-2xl">star</span>
                </div>
                <h1 class="text-5xl md:text-6xl font-bold tracking-tight text-[#4a2c32]">
                    My <span class="text-primary">Creative Journey</span>
                </h1>
                <p class="text-lg text-[#4a2c32]/70 max-w-2xl font-medium mx-auto">
                    A collection of magical digital experiences, whimsical illustrations, and user-centered designs crafted with love and pink sparkles.
                </p>
            </div>

            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
                <div v-for="(project, index) in contentStore.projects" :key="index" class="group flex flex-col gap-5 bg-white/40 p-4 rounded-[2rem] border border-white/60 hover:bg-white/60 transition-all shadow-sm hover:shadow-xl">
                    <div class="aspect-[4/3] overflow-hidden bg-white relative" :style="getWavyStyle(index)">
                        <div class="size-full bg-cover bg-center group-hover:scale-110 transition-transform duration-700" :style="{ backgroundImage: `url(${project.image})` }"></div>
                    </div>
                    <div class="px-2 flex flex-col gap-3">
                        <div class="flex flex-wrap gap-2">
                            <span class="px-4 py-1.5 rounded-full text-xs font-bold shadow-sm bg-pastel-pink text-primary">{{ project.tag }}</span>
                        </div>
                        <h3 class="text-2xl font-bold text-[#4a2c32] group-hover:text-primary transition-colors">{{ project.title }}</h3>
                        <p class="text-sm text-[#4a2c32]/70 line-clamp-2">{{ project.description }}</p>
                    </div>
                </div>
            </div>
        </main>
    </div>
</template>
