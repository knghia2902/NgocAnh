<script setup lang="ts">
import { RouterView, RouterLink } from 'vue-router'
import { contentStore } from './stores/content';
</script>

<template>
  <div class="layout-container flex h-full grow flex-col min-h-screen">
    <header class="mx-auto mt-6 w-[95%] max-w-[1200px] flex items-center justify-between whitespace-nowrap bg-white px-8 py-4 rounded-full shadow-sm sticky top-6 z-50 border border-soft-pink">
      <div class="flex items-center gap-3">
        <router-link to="/" class="size-10 bg-soft-rose rounded-full flex items-center justify-center text-white glow-primary">
          <span class="material-symbols-outlined text-2xl">magic_button</span>
        </router-link>
        <router-link to="/" class="text-xl font-display font-bold tracking-tight text-soft-rose hover:text-primary transition-colors">Góc nhỏ tiện ích của Ánh</router-link>
      </div>
      <nav class="hidden md:flex items-center gap-8">
        <router-link to="/" class="flex items-center gap-2 text-sm font-bold text-[#4a2c32]/80 hover:text-primary transition-colors" active-class="text-primary">
            <span class="material-symbols-outlined text-lg">home</span>
            Home
        </router-link>
        <router-link to="/projects" class="text-sm font-bold text-[#4a2c32]/80 hover:text-primary transition-colors border-b-2 border-transparent hover:border-primary" active-class="text-primary border-primary">Projects</router-link>
        <router-link to="/tools" class="text-sm font-bold text-[#4a2c32]/80 hover:text-primary transition-colors border-b-2 border-transparent hover:border-primary" active-class="text-primary border-primary">Tools</router-link>
        <router-link to="/contact" class="text-sm font-bold text-[#4a2c32]/80 hover:text-primary transition-colors border-b-2 border-transparent hover:border-primary" active-class="text-primary border-primary">About</router-link>
      </nav>
      <div class="flex items-center gap-4">
        <router-link to="/admin" class="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-11 border-2 border-pastel-pink cursor-pointer hover:border-primary transition-colors" :style="{ backgroundImage: `url(${contentStore.hero.image})` }"></router-link>
      </div>
    </header>

    <RouterView />

    <footer class="mt-20 flex flex-col items-center gap-10 pb-10">
        <div class="h-px w-full bg-primary/20"></div>
        <div class="flex flex-col items-center gap-2">
            <p class="text-sm font-bold opacity-40">© 2024 Ngoc Anh Portfolio</p>
            <p class="text-xs font-bold text-primary flex items-center gap-1">
                Made with <span class="material-symbols-outlined text-[10px]">favorite</span> and magic
            </p>
        </div>
    </footer>
  </div>
</template>
