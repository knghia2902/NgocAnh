<script setup lang="ts">
import { RouterView, RouterLink, useRouter } from 'vue-router'
import { contentStore } from './stores/content';
import { ContentService } from './services/ContentService';
import { onMounted, onUnmounted, ref } from 'vue';
import { VisitorTracker } from './services/VisitorTracker';
import { authStore, logout } from './stores/auth';
import ToastNotification from './components/ui/ToastNotification.vue';

const router = useRouter();

const showDropdown = ref(false);

const toggleDropdown = (e: Event) => {
    e.stopPropagation();
    showDropdown.value = !showDropdown.value;
};

const closeDropdown = () => {
    showDropdown.value = false;
};

const handleHeaderLogout = () => {
    logout();
    router.push('/');
};

const uiScale = 0.9;
const isWeighbridge = ref(false);

const handleWeighbridgeStatus = (e: any) => {
    isWeighbridge.value = !!e.detail;
    if (isWeighbridge.value) {
        (document.documentElement.style as any).zoom = 1;
    } else {
        (document.documentElement.style as any).zoom = uiScale;
    }
};

onMounted(async () => {
    (document.documentElement.style as any).zoom = isWeighbridge.value ? 1 : uiScale;

    // Load all content from Supabase
    await ContentService.loadAll();
    
    // Track visitor (only counts unique visitors within 30 days)
    await VisitorTracker.trackVisit(() => ContentService.incrementVisitors());

    // Register click listener to close dropdown when clicking outside
    window.addEventListener('click', closeDropdown);
    window.addEventListener('weighbridge-status', handleWeighbridgeStatus);
});

onUnmounted(() => {
    window.removeEventListener('click', closeDropdown);
    window.removeEventListener('weighbridge-status', handleWeighbridgeStatus);
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
        
        <!-- Avatar Wrapper with Dropdown -->
        <div class="relative flex items-center">
          <div 
            @click="authStore.isAuthenticated ? toggleDropdown($event) : router.push('/login')" 
            class="bg-center bg-no-repeat aspect-square bg-cover rounded-full size-11 border-2 border-pastel-pink cursor-pointer hover:border-primary hover:scale-105 active:scale-95 transition-all flex items-center justify-center overflow-hidden" 
            :style="{ backgroundImage: `url(${authStore.avatar || contentStore.hero.avatar || 'https://ngocanhcute.vercel.app/avatar.jpg'})` }"
            :title="authStore.isAuthenticated ? `Tài khoản: ${authStore.displayName} (${authStore.role === 'admin' ? 'Quản trị viên' : 'Nhân viên'})` : 'Đăng nhập'"
          >
            <img v-if="authStore.avatar || contentStore.hero.avatar" :src="authStore.avatar || contentStore.hero.avatar" class="hidden" @error="(e: any) => e.target.parentElement.style.backgroundImage = 'url(https://ngocanhcute.vercel.app/avatar.jpg)'" />
          </div>

          <!-- Dropdown Menu -->
          <Transition name="slide-up">
            <div 
              v-if="showDropdown && authStore.isAuthenticated" 
              @click.stop 
              class="absolute right-0 top-14 w-60 bg-white rounded-3xl shadow-xl border border-primary/10 py-3 z-50 overflow-hidden font-display flex flex-col"
            >
              <!-- User Info Header inside Dropdown -->
              <div class="px-4 py-3 border-b border-primary/5 bg-[#fcf8f9]/50 flex items-center gap-3 mb-2">
                <div 
                  class="size-9 bg-center bg-no-repeat bg-cover rounded-full border border-primary/10 shrink-0"
                  :style="{ backgroundImage: `url(${authStore.avatar || contentStore.hero.avatar || 'https://ngocanhcute.vercel.app/avatar.jpg'})` }"
                ></div>
                <div class="truncate">
                  <p class="text-xs font-black text-primary truncate leading-tight">{{ authStore.displayName }}</p>
                  <p class="text-[9px] font-black uppercase text-gray-400 mt-0.5 tracking-wider">
                    {{ authStore.role === 'admin' ? 'Quản trị viên' : 'Nhân viên' }}
                  </p>
                </div>
              </div>

              <!-- Menu Options -->
              <router-link 
                to="/profile" 
                @click="closeDropdown"
                class="px-4 py-2.5 hover:bg-primary/5 text-[#4a2c32]/85 font-bold text-xs flex items-center gap-2 transition-colors"
              >
                <span class="material-symbols-outlined text-base text-primary/60">person</span>
                Hồ sơ cá nhân
              </router-link>

              <router-link 
                v-if="authStore.role === 'admin'"
                to="/admin" 
                @click="closeDropdown"
                class="px-4 py-2.5 hover:bg-primary/5 text-[#4a2c32]/85 font-bold text-xs flex items-center gap-2 transition-colors border-t border-primary/5"
              >
                <span class="material-symbols-outlined text-base text-amber-500">settings_applications</span>
                Trang quản trị (Admin)
              </router-link>

              <router-link 
                to="/tools" 
                @click="closeDropdown"
                class="px-4 py-2.5 hover:bg-primary/5 text-[#4a2c32]/85 font-bold text-xs flex items-center gap-2 transition-colors"
              >
                <span class="material-symbols-outlined text-base text-teal-600">construction</span>
                Sử dụng công cụ
              </router-link>

              <div class="h-px bg-primary/5 my-1"></div>

              <!-- Logout option -->
              <button 
                @click="() => { handleHeaderLogout(); closeDropdown(); }"
                class="px-4 py-2.5 hover:bg-red-50 text-red-600 font-bold text-xs flex items-center gap-2 transition-colors text-left"
              >
                <span class="material-symbols-outlined text-base">logout</span>
                Đăng xuất tài khoản
              </button>
            </div>
          </Transition>
        </div>
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

<style>
/* Dropdown animation */
.slide-up-enter-active,
.slide-up-leave-active {
  transition: all 0.2s ease-out;
}
.slide-up-enter-from {
  opacity: 0;
  transform: translateY(8px);
}
.slide-up-leave-to {
  opacity: 0;
  transform: translateY(8px);
}
</style>


