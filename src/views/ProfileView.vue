<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { authStore, updateStoreProfile, logout } from '../stores/auth';
import { authService } from '../services/storage/AuthService';
import { StorageService } from '../services/storage/StorageService';
import { contentStore } from '../stores/content';

const router = useRouter();

// Form state
const displayName = ref(authStore.displayName || '');
const newPassword = ref('');
const confirmPassword = ref('');

const errorMsg = ref('');
const successMsg = ref('');
const isLoading = ref(false);
const isUploadingAvatar = ref(false);
const fileInput = ref<HTMLInputElement | null>(null);

const triggerFileInput = () => {
    fileInput.value?.click();
};

const handleAvatarUpload = async (event: Event) => {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (!file) return;

    // Check size limit (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        errorMsg.value = 'Ảnh đại diện không được vượt quá 5MB!';
        return;
    }

    isUploadingAvatar.value = true;
    errorMsg.value = '';
    successMsg.value = '';

    try {
        const publicUrl = await StorageService.uploadImage(file, 'avatars');
        if (publicUrl) {
            const success = await authService.updateProfile(
                authStore.user || '',
                displayName.value.trim(),
                undefined, // do not change password
                publicUrl
            );
            if (success) {
                updateStoreProfile(displayName.value.trim(), publicUrl);
                successMsg.value = 'Thay đổi ảnh đại diện thành công! ✨';
            } else {
                errorMsg.value = 'Không thể cập nhật ảnh đại diện mới vào cơ sở dữ liệu.';
            }
        } else {
            errorMsg.value = 'Không thể tải ảnh lên hệ thống lưu trữ Supabase.';
        }
    } catch (e) {
        console.error(e);
        errorMsg.value = 'Đã xảy ra lỗi kết nối trong khi tải ảnh lên.';
    } finally {
        isUploadingAvatar.value = false;
        if (fileInput.value) fileInput.value.value = '';
    }
};

const handleUpdateProfile = async () => {
    errorMsg.value = '';
    successMsg.value = '';
    
    const cleanName = displayName.value.trim();
    if (!cleanName) {
        errorMsg.value = 'Tên hiển thị không được để trống!';
        return;
    }

    if (newPassword.value) {
        if (newPassword.value.length < 6) {
            errorMsg.value = 'Mật khẩu phải chứa ít nhất 6 ký tự!';
            return;
        }
        if (newPassword.value !== confirmPassword.value) {
            errorMsg.value = 'Mật khẩu xác nhận không khớp!';
            return;
        }
    }

    isLoading.value = true;
    try {
        const success = await authService.updateProfile(
            authStore.user || '',
            cleanName,
            newPassword.value || undefined,
            authStore.avatar || undefined
        );

        if (success) {
            updateStoreProfile(cleanName, authStore.avatar || undefined);
            successMsg.value = 'Cập nhật hồ sơ tài khoản thành công! ✨';
            newPassword.value = '';
            confirmPassword.value = '';
        } else {
            errorMsg.value = 'Có lỗi xảy ra trong quá trình cập nhật. Vui lòng thử lại!';
        }
    } catch (e) {
        errorMsg.value = 'Đã xảy ra lỗi kết nối. Vui lòng thử lại!';
    } finally {
        isLoading.value = false;
    }
};

const handleLogout = () => {
    logout();
    router.push('/');
};
</script>

<template>
    <div class="min-h-screen flex items-center justify-center bg-[#FDF2F5] px-4 py-6 font-display">
        <div class="w-full max-w-lg bg-white rounded-[2.5rem] p-6 md:p-8 shadow-2xl border border-white/50 relative overflow-hidden">
            <!-- Decorative circle -->
            <div class="absolute -top-12 -right-12 text-primary/10 select-none pointer-events-none">
                 <span class="material-symbols-outlined text-[150px]">account_circle</span>
            </div>

            <!-- Profile Header & Avatar Uploader -->
            <div class="relative z-10 text-center mb-6">
                <!-- Avatar block with hover uploader -->
                <div class="relative size-20 mx-auto mb-2 group cursor-pointer" @click="triggerFileInput">
                    <!-- Image render -->
                    <div class="size-full bg-[#fcf8f9] rounded-full flex items-center justify-center text-white glow-primary border-4 border-white shadow-md overflow-hidden bg-cover bg-center bg-no-repeat transition-all group-hover:brightness-95"
                         :style="{ backgroundImage: `url(${authStore.avatar || contentStore.hero.avatar || 'https://ngocanhcute.vercel.app/avatar.jpg'})` }"
                    >
                        <!-- Loading indicator during upload -->
                        <div v-if="isUploadingAvatar" class="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <span class="material-symbols-outlined animate-spin text-white text-2xl">progress_activity</span>
                        </div>
                    </div>
                    
                    <!-- Hover overlay -->
                    <div class="absolute inset-0 bg-black/35 text-white rounded-full opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity border-4 border-transparent">
                        <span class="material-symbols-outlined text-lg">photo_camera</span>
                        <span class="text-[8px] font-black uppercase tracking-wider mt-0.5">Thay đổi</span>
                    </div>
                </div>

                <!-- Hidden file input -->
                <input 
                    type="file" 
                    ref="fileInput" 
                    accept="image/*" 
                    class="hidden" 
                    @change="handleAvatarUpload" 
                />

                <h1 class="text-2xl font-display font-black text-primary">Hồ Sơ Cá Nhân</h1>
                <p class="text-gray-400 text-xs mt-0.5">Thay đổi thông tin tài khoản của bạn</p>
                
                <!-- Role Badge -->
                <div class="mt-2 inline-block">
                    <span class="px-3 py-1 text-[10px] font-black uppercase rounded-full tracking-widest shadow-sm"
                        :class="authStore.role === 'admin' ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'"
                    >
                        {{ authStore.role === 'admin' ? 'Quản trị viên (Admin)' : 'Nhân viên (Staff)' }}
                    </span>
                </div>
            </div>

            <!-- Profile Info & Edit Form -->
            <form @submit.prevent="handleUpdateProfile" class="space-y-3.5 relative z-10">
                <!-- Username (ReadOnly) -->
                <div class="space-y-1 text-left">
                    <label class="font-bold text-[10px] text-primary/60 uppercase tracking-widest ml-2">Tên đăng nhập</label>
                    <div class="relative">
                        <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg">lock</span>
                        <input :value="authStore.user" type="text" readonly class="w-full bg-[#fcf8f9] border-none rounded-xl py-3 pl-11 pr-4 font-bold text-gray-400 cursor-not-allowed outline-none text-xs" />
                    </div>
                </div>

                <!-- Display Name -->
                <div class="space-y-1 text-left">
                    <label class="font-bold text-[10px] text-primary/80 uppercase tracking-widest ml-2">Tên hiển thị</label>
                    <div class="relative">
                        <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary/40 text-lg">face</span>
                        <input v-model="displayName" type="text" class="w-full bg-[#fcf8f9] border-none rounded-xl py-3 pl-11 pr-4 font-bold text-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-xs" required />
                    </div>
                </div>

                <div class="h-px bg-primary/10 my-4"></div>

                <!-- Change Password Header -->
                <div class="text-left mb-1">
                    <h3 class="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1">
                        Thay đổi mật khẩu
                    </h3>
                    <p class="text-[9px] text-gray-400">Nhập mật khẩu mới nếu muốn thay đổi, nếu không hãy để trống</p>
                </div>

                <!-- New Password -->
                <div class="space-y-1 text-left">
                    <label class="font-bold text-[10px] text-primary/80 uppercase tracking-widest ml-2">Mật khẩu mới</label>
                    <div class="relative">
                        <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary/40 text-lg">lock_open</span>
                        <input v-model="newPassword" type="password" placeholder="••••••••" class="w-full bg-[#fcf8f9] border-none rounded-xl py-3 pl-11 pr-4 font-bold text-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:font-normal placeholder:text-gray-300 text-xs" />
                    </div>
                </div>

                <!-- Confirm Password -->
                <div class="space-y-1 text-left">
                    <label class="font-bold text-[10px] text-primary/80 uppercase tracking-widest ml-2">Xác nhận mật khẩu</label>
                    <div class="relative">
                        <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary/40 text-lg">verified_user</span>
                        <input v-model="confirmPassword" type="password" placeholder="••••••••" class="w-full bg-[#fcf8f9] border-none rounded-xl py-3 pl-11 pr-4 font-bold text-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:font-normal placeholder:text-gray-300 text-xs" />
                    </div>
                </div>

                <!-- Alerts -->
                <div v-if="errorMsg" class="bg-red-50 text-red-500 p-3 rounded-xl text-[10px] font-bold flex items-center gap-2 border border-red-100">
                    <span class="material-symbols-outlined text-base">error</span>
                    {{ errorMsg }}
                </div>
                <div v-if="successMsg" class="bg-green-50 text-green-600 p-3 rounded-xl text-[10px] font-bold flex items-center gap-2 border border-green-100">
                    <span class="material-symbols-outlined text-base">task_alt</span>
                    {{ successMsg }}
                </div>

                <!-- Save Button -->
                <button :disabled="isLoading" type="submit" class="w-full bg-primary text-white font-bold py-3.5 rounded-full shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all text-xs flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                    <span v-if="isLoading" class="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                    <span v-else>Lưu Thay Đổi ✨</span>
                </button>
            </form>

            <!-- Navigation Hub & Logout -->
            <div class="mt-6 pt-6 border-t border-primary/10 flex flex-col sm:flex-row gap-3 justify-between items-center relative z-10">
                <router-link to="/" class="w-full sm:w-auto px-5 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 font-bold text-[10px] rounded-full transition-all flex items-center justify-center gap-1.5 shadow-sm uppercase tracking-wider">
                    <span class="material-symbols-outlined text-sm">home</span>
                    Quay lại Trang Chủ
                </router-link>
                
                <router-link v-if="authStore.role === 'admin'" to="/admin" class="w-full sm:w-auto px-5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold text-[10px] rounded-full transition-all flex items-center justify-center gap-1.5 shadow-sm uppercase tracking-wider">
                    <span class="material-symbols-outlined text-sm">settings_applications</span>
                    Trang Quản Trị
                </router-link>

                <button @click="handleLogout" class="w-full sm:w-auto px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-[10px] rounded-full transition-all flex items-center justify-center gap-1.5 shadow-sm uppercase tracking-wider">
                    <span class="material-symbols-outlined text-sm">logout</span>
                    Đăng xuất tài khoản
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.glow-primary {
    background-color: var(--color-primary, #FF85A2);
    box-shadow: 0 0 20px rgba(255, 133, 162, 0.4);
}
</style>
