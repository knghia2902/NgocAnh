<script setup lang="ts">
import { RouterView, RouterLink, useRouter } from 'vue-router'
import { contentStore } from './stores/content';
import { ContentService } from './services/ContentService';
import { onMounted } from 'vue';
import { VisitorTracker } from './services/VisitorTracker';
import { authStore, logout } from './stores/auth';
import ToastNotification from './components/ui/ToastNotification.vue';

const router = useRouter();

const handleHeaderLogout = () => {
    logout();
    router.push('/');
};

onMounted(async () => {
    // Load all content from Supabase
    await ContentService.loadAll();
    
    // Track visitor (only counts unique visitors within 30 days)
    await VisitorTracker.trackVisit(() => ContentService.incrementVisitors());
});
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
      <div class="flex items-center gap-3">
        <span v-if="authStore.isAuthenticated" class="text-xs font-bold text-[#4a2c32]/60 hidden sm:inline">
            Chào, {{ authStore.displayName }}
        </span>
        <router-link :to="!authStore.isAuthenticated ? '/login' : (authStore.role === 'admin' ? '/admin' : '/tools')" 
          class="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-11 border-2 border-pastel-pink cursor-pointer hover:border-primary transition-colors flex items-center justify-center overflow-hidden" 
          :style="{ backgroundImage: `url(${contentStore.hero.avatar || 'https://ngocanhcute.vercel.app/avatar.jpg'})` }"
          :title="authStore.isAuthenticated ? `Tài khoản: ${authStore.displayName} (${authStore.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'})` : 'Đăng nhập'"
        >
          <img v-if="contentStore.hero.avatar" :src="contentStore.hero.avatar" class="hidden" @error="(e: any) => e.target.parentElement.style.backgroundImage = 'url(https://ngocanhcute.vercel.app/avatar.jpg)'" />
        </router-link>
        <button v-if="authStore.isAuthenticated" @click="handleHeaderLogout" class="size-9 rounded-full bg-red-50 hover:bg-red-100 text-red-500 flex items-center justify-center transition-colors shadow-sm" title="Đăng xuất">
            <span class="material-symbols-outlined text-sm">logout</span>
        </button>
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
    <ToastNotification />
  </div>
</template>


