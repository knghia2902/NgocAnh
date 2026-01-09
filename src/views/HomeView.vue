<script setup lang="ts">
import { contentStore } from '../stores/content';
</script>

<template>
  <div class="fixed inset-0 overflow-hidden pointer-events-none -z-10">
    <!-- Sparkles visibility check could be added here if needed -->
    <div v-if="contentStore.visibility.sparkles" class="absolute top-[15%] left-[10%] text-strawberry-cream floating-1 opacity-40">
      <span class="material-symbols-outlined text-4xl">colors_spark</span>
    </div>
    <div class="absolute bottom-[20%] right-[15%] text-strawberry-cream floating-2 opacity-40">
      <span class="material-symbols-outlined text-5xl">favorite</span>
    </div>
    <div class="absolute top-[60%] left-[5%] text-strawberry-cream floating-1 opacity-20" style="animation-delay: 2s">
      <span class="material-symbols-outlined text-6xl">flare</span>
    </div>
    <div class="absolute top-[40%] right-[10%] text-strawberry-cream floating-2 opacity-30" style="animation-delay: 1s">
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
            <div v-for="item in contentStore.toolkit" :key="item.label" class="group flex flex-col items-center gap-3 p-6 bg-white/60 border border-strawberry-cream/10 rounded-xl hover:scale-105 transition-transform cursor-default backdrop-blur-md shadow-sm hover:shadow-md">
                <div class="size-16 rounded-full bg-white flex items-center justify-center shadow-sm text-primary">
                    <span class="material-symbols-outlined text-3xl">{{ item.icon }}</span>
                </div>
                <p class="font-bold text-lg">{{ item.label }}</p>
            </div>
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
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-8 px-4">
            <div v-for="(project, index) in contentStore.projects" :key="index" class="group cursor-pointer">
                <div class="aspect-[4/3] bg-pastel-peach/20 rounded-[2rem] overflow-hidden mb-6 relative group-hover:shadow-lg transition-all duration-300">
                    <div class="absolute top-4 right-4 bg-white/90 backdrop-blur px-4 py-1.5 rounded-full z-10 shadow-sm">
                        <span class="text-xs font-bold text-primary">{{ project.tag }}</span>
                    </div>
                    <div class="size-full bg-cover bg-center group-hover:scale-105 transition-transform duration-700" :style="{ backgroundImage: `url(${project.image})` }"></div>
                </div>
                <div>
                    <h3 class="text-xl font-bold mb-2 group-hover:text-primary transition-colors">{{ project.title }}</h3>
                    <p class="text-[#1b0d11]/60 font-medium leading-relaxed">{{ project.description }}</p>
                </div>
            </div>
        </div>
    </section>
  </main>
</template>
