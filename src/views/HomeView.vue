<script setup lang="ts">
import { contentStore } from '../stores/content';
</script>

<template>
  <div class="fixed inset-0 overflow-hidden pointer-events-none -z-10">
    <!-- Sparkles visibility check could be added here if needed -->
    <div v-if="contentStore.visibility.sparkles" class="absolute top-[15%] left-[10%] text-strawberry-cream floating-1 twinkle opacity-40">
      <span class="material-symbols-outlined text-4xl">colors_spark</span>
    </div>
    <div v-if="contentStore.visibility.sparkles" class="absolute bottom-[20%] right-[15%] text-strawberry-cream floating-2 twinkle opacity-40">
      <span class="material-symbols-outlined text-5xl">favorite</span>
    </div>
    <div v-if="contentStore.visibility.sparkles" class="absolute top-[60%] left-[5%] text-strawberry-cream floating-1 twinkle opacity-20" style="animation-delay: 2s">
      <span class="material-symbols-outlined text-6xl">flare</span>
    </div>
    <div v-if="contentStore.visibility.sparkles" class="absolute top-[40%] right-[10%] text-strawberry-cream floating-2 twinkle opacity-30" style="animation-delay: 1s">
      <span class="material-symbols-outlined text-3xl">magic_button</span>
    </div>
  </div>

  <main class="flex-1 flex flex-col max-w-[1200px] mx-auto px-4 md:px-10 pb-20 w-full pt-10">
    <section v-if="contentStore.visibility.hero" class="flex flex-col-reverse lg:flex-row items-center justify-between py-16 lg:py-24 gap-12">
      <div class="flex flex-col gap-8 flex-1 text-center lg:text-left">
        <div class="flex flex-col gap-4">
          <div class="flex items-center gap-2 justify-center lg:justify-start">
            <span class="text-primary font-bold tracking-widest uppercase text-xs">Available for hire</span>
            <span class="material-symbols-outlined text-primary text-sm">auto_awesome</span>
          </div>
          <h1 class="text-5xl md:text-7xl font-bold leading-[1.1] tracking-tight text-[#4a2c32] dark:text-white">
            {{ contentStore.hero.title }}
          </h1>
          <p class="text-lg md:text-xl text-[#4a2c32]/70 dark:text-[#fcf8f9]/70 max-w-xl mx-auto lg:mx-0 font-medium whitespace-pre-line">
            {{ contentStore.hero.subtitle }}
          </p>
        </div>
        <div class="flex flex-wrap items-center gap-4 justify-center lg:justify-start">
            <router-link to="/tools" class="min-w-[180px] h-14 flex items-center justify-center rounded-full bg-primary text-white font-bold text-lg glow-primary hover:translate-y-[-2px] transition-all">
                {{ contentStore.hero.primaryButton }}
            </router-link>
            <router-link to="/contact" class="min-w-[180px] h-14 flex items-center justify-center rounded-full border-2 border-strawberry-cream font-bold text-lg hover:bg-white/50 transition-all text-primary">
                {{ contentStore.hero.secondaryButton }}
            </router-link>
        </div>
      </div>
      <div class="relative flex-1 flex justify-center items-center">
        <div class="absolute -top-10 right-10 text-primary floating-1">
          <span class="material-symbols-outlined text-4xl">favorite</span>
        </div>
        <div class="absolute -bottom-10 left-0 text-strawberry-cream floating-2">
          <span class="material-symbols-outlined text-5xl">auto_awesome</span>
        </div>
        <div class="absolute top-20 -left-10 text-primary/60 floating-1" style="animation-delay: 1s;">
          <span class="material-symbols-outlined text-3xl">star_rate</span>
        </div>
        <div class="relative size-[320px] md:size-[450px] blob-shape bg-strawberry-cream/30 dark:bg-primary/20 flex items-center justify-center p-4 overflow-hidden shadow-2xl glow-primary">
          <div class="size-full blob-shape bg-no-repeat bg-cover border-[8px] border-white dark:border-background-dark transition-all duration-500" :style="{ backgroundImage: `url(${contentStore.hero.image})`, backgroundPosition: `${contentStore.hero.position.x}% ${contentStore.hero.position.y}%` }">
          </div>
        </div>
      </div>
    </section>

    <section v-if="contentStore.visibility.skills" class="py-10 bg-white/20 rounded-xl backdrop-blur-sm border border-white/40 mb-20">
        <div class="flex flex-col items-center gap-4 mb-10">
            <h2 class="text-3xl md:text-4xl font-bold text-center">My Magic Toolkit</h2>
            <div class="h-1.5 w-24 bg-primary rounded-full glow-primary"></div>
        </div>
        <div class="flex flex-wrap justify-center gap-4 md:gap-6 px-4">
            <template v-for="item in contentStore.toolkit" :key="item.label">
                <!-- Link ngoài (External Link) -->
                <a 
                    v-if="item.tool && (item.tool.startsWith('http://') || item.tool.startsWith('https://'))"
                    :href="item.tool"
                    target="_blank"
                    class="group flex flex-col items-center gap-3 p-6 bg-white/60 border border-strawberry-cream/10 rounded-xl transition-all cursor-pointer backdrop-blur-md shadow-sm hover:shadow-md hover:scale-105 hover:border-primary/30 hover:bg-white/80"
                >
                    <div class="size-16 rounded-full bg-white flex items-center justify-center shadow-sm text-primary transition-colors group-hover:bg-primary/5">
                        <span class="material-symbols-outlined text-3xl">{{ item.icon }}</span>
                    </div>
                    <div class="text-center">
                        <p class="font-bold text-lg leading-none">{{ item.label }}</p>
                        <p class="text-[10px] text-primary font-bold mt-1 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-tighter">Click to open ↗</p>
                    </div>
                </a>

                <!-- Link trong (Internal Route) -->
                <router-link 
                    v-else-if="item.tool"
                    :to="item.tool"
                    class="group flex flex-col items-center gap-3 p-6 bg-white/60 border border-strawberry-cream/10 rounded-xl transition-all cursor-pointer backdrop-blur-md shadow-sm hover:shadow-md hover:scale-105 hover:border-primary/30 hover:bg-white/80"
                >
                    <div class="size-16 rounded-full bg-white flex items-center justify-center shadow-sm text-primary transition-colors group-hover:bg-primary/5">
                        <span class="material-symbols-outlined text-3xl">{{ item.icon }}</span>
                    </div>
                    <div class="text-center">
                        <p class="font-bold text-lg leading-none">{{ item.label }}</p>
                        <p class="text-[10px] text-primary font-bold mt-1 opacity-0 group-hover:opacity-100 transition-opacity uppercase tracking-tighter">Click to use ✨</p>
                    </div>
                </router-link>

                <!-- Thẻ tĩnh (Static Card) -->
                <div 
                    v-else
                    class="group flex flex-col items-center gap-3 p-6 bg-white/60 border border-strawberry-cream/10 rounded-xl transition-all cursor-default backdrop-blur-md shadow-sm hover:shadow-md hover:scale-105"
                >
                    <div class="size-16 rounded-full bg-white flex items-center justify-center shadow-sm text-primary transition-colors group-hover:bg-primary/5">
                        <span class="material-symbols-outlined text-3xl">{{ item.icon }}</span>
                    </div>
                    <div class="text-center">
                        <p class="font-bold text-lg leading-none">{{ item.label }}</p>
                    </div>
                </div>
            </template>
        </div>
    </section>

    <!-- Project Highlights Section -->
    <section v-if="contentStore.visibility.projects" id="projects" class="py-10">
        <div class="flex items-center justify-between mb-10 px-4">
             <h2 class="text-3xl md:text-4xl font-bold">Project Highlights</h2>
             <router-link to="/projects" class="text-primary font-bold hover:underline flex items-center gap-1">
                View All <span class="material-symbols-outlined text-sm">arrow_forward</span>
             </router-link>
        </div>
        
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4">
            <div v-for="(project, index) in contentStore.projects" :key="index" class="bg-white rounded-[2rem] p-4 pb-6 text-center border border-primary/5 hover:-translate-y-2 transition-transform duration-300 shadow-sm hover:shadow-xl flex flex-col items-center">
                 <!-- Blob Masked Image - reduced size -->
                <div class="relative w-full aspect-square rounded-[1.5rem] overflow-hidden mb-4 flex items-center justify-center">
                     <div class="absolute inset-0 bg-pastel-peach/10"></div>
                     <div class="size-[220px] blob-shape overflow-hidden bg-cover bg-center border-4 border-white shadow-lg" :style="{ backgroundImage: `url(${project.image})` }"></div>
                </div>
                
                <!-- Tag -->
                <div class="inline-block px-4 py-1.5 bg-soft-pink/20 rounded-full mb-4">
                    <span class="text-xs font-bold text-primary uppercase tracking-wider">{{ project.tag }}</span>
                </div>

                <h3 class="text-2xl font-bold mb-3 text-primary">{{ project.title }}</h3>
                <p class="text-[#1b0d11]/60 font-medium leading-relaxed max-w-sm mx-auto">{{ project.description }}</p>
                <div class="mt-4"><button class="text-sm font-bold text-primary hover:underline">View Details</button></div>
            </div>
        </div>
    </section>
  </main>
</template>
