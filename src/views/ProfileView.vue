<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { authStore, updateStoreProfile, logout } from '../stores/auth';
import { authService } from '../services/storage/AuthService';

const router = useRouter();

const displayName = ref(authStore.displayName || '');
const newPassword = ref('');
const confirmPassword = ref('');

const errorMsg = ref('');
const successMsg = ref('');
const isLoading = ref(false);

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
            newPassword.value || undefined
        );

        if (success) {
            updateStoreProfile(cleanName);
            successMsg.value = 'Cập nhật hồ sơ thành công! ✨';
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
    <div class="min-h-screen flex items-center justify-center bg-[#FDF2F5] px-4 py-12 font-display">
        <div class="w-full max-w-xl bg-white rounded-[3rem] p-8 md:p-12 shadow-2xl border border-white/50 relative overflow-hidden">
            <!-- Decorative circle -->
            <div class="absolute -top-12 -right-12 text-primary/10 select-none pointer-events-none">
                 <span class="material-symbols-outlined text-[180px]">account_circle</span>
            </div>

            <!-- Profile Header -->
            <div class="relative z-10 text-center mb-8">
                <div class="size-24 bg-soft-rose rounded-full flex items-center justify-center text-white glow-primary mx-auto mb-4 border-4 border-white shadow-lg overflow-hidden">
                    <span class="material-symbols-outlined text-5xl">person</span>
                </div>
                <h1 class="text-3xl font-display font-black text-primary">Hồ Sơ Cá Nhân</h1>
                <p class="text-gray-400 text-sm mt-1">Quản lý tài khoản của bạn</p>
                
                <!-- Role Badge -->
                <div class="mt-3 inline-block">
                    <span class="px-4 py-1.5 text-xs font-black uppercase rounded-full tracking-widest shadow-sm"
                        :class="authStore.role === 'admin' ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'"
                    >
                        {{ authStore.role === 'admin' ? 'Quản trị viên (Admin)' : 'Nhân viên (Staff)' }}
                    </span>
                </div>
            </div>

            <!-- Profile Info & Edit Form -->
            <form @submit.prevent="handleUpdateProfile" class="space-y-6 relative z-10">
                <!-- Username (ReadOnly) -->
                <div class="space-y-1.5 text-left">
                    <label class="font-bold text-xs text-primary/60 uppercase tracking-widest ml-2">Tên đăng nhập</label>
                    <div class="relative">
                        <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">lock</span>
                        <input :value="authStore.user" type="text" readonly class="w-full bg-[#fcf8f9] border-none rounded-2xl py-4 pl-12 pr-4 font-bold text-gray-400 cursor-not-allowed outline-none" />
                    </div>
                </div>

                <!-- Display Name -->
                <div class="space-y-1.5 text-left">
                    <label class="font-bold text-xs text-primary/80 uppercase tracking-widest ml-2">Tên hiển thị</label>
                    <div class="relative">
                        <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary/40">face</span>
                        <input v-model="displayName" type="text" class="w-full bg-[#fcf8f9] border-none rounded-2xl py-4 pl-12 pr-4 font-bold text-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all" required />
                    </div>
                </div>

                <div class="h-px bg-primary/10 my-6"></div>

                <!-- Change Password Header -->
                <div class="text-left mb-2">
                    <h3 class="text-sm font-black text-primary uppercase tracking-widest flex items-center gap-1">
                        <span class="material-symbols-outlined text-base">key</span> Thay đổi mật khẩu (Để trống nếu không đổi)
                    </h3>
                </div>

                <!-- New Password -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div class="space-y-1.5 text-left">
                        <label class="font-bold text-xs text-primary/80 uppercase tracking-widest ml-2">Mật khẩu mới</label>
                        <div class="relative">
                            <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary/40">lock_open</span>
                            <input v-model="newPassword" type="password" placeholder="••••••••" class="w-full bg-[#fcf8f9] border-none rounded-2xl py-4 pl-12 pr-4 font-bold text-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:font-normal placeholder:text-gray-300" />
                        </div>
                    </div>

                    <!-- Confirm Password -->
                    <div class="space-y-1.5 text-left">
                        <label class="font-bold text-xs text-primary/80 uppercase tracking-widest ml-2">Xác nhận mật khẩu</label>
                        <div class="relative">
                            <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary/40">verified_user</span>
                            <input v-model="confirmPassword" type="password" placeholder="••••••••" class="w-full bg-[#fcf8f9] border-none rounded-2xl py-4 pl-12 pr-4 font-bold text-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:font-normal placeholder:text-gray-300" />
                        </div>
                    </div>
                </div>

                <!-- Alerts -->
                <div v-if="errorMsg" class="bg-red-50 text-red-500 p-4 rounded-2xl text-xs font-bold flex items-center gap-2 border border-red-100">
                    <span class="material-symbols-outlined text-base">error</span>
                    {{ errorMsg }}
                </div>
                <div v-if="successMsg" class="bg-green-50 text-green-600 p-4 rounded-2xl text-xs font-bold flex items-center gap-2 border border-green-100">
                    <span class="material-symbols-outlined text-base">task_alt</span>
                    {{ successMsg }}
                </div>

                <!-- Save Button -->
                <button :disabled="isLoading" type="submit" class="w-full bg-primary text-white font-bold py-4 rounded-full shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed">
                    <span v-if="isLoading" class="material-symbols-outlined animate-spin">progress_activity</span>
                    <span v-else>Lưu Thay Đổi ✨</span>
                </button>
            </form>

            <!-- Navigation Hub & Logout -->
            <div class="mt-8 pt-8 border-t border-primary/10 flex flex-col sm:flex-row gap-4 justify-between items-center relative z-10">
                <router-link v-if="authStore.role === 'admin'" to="/admin" class="w-full sm:w-auto px-6 py-3 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold text-xs rounded-full transition-all flex items-center justify-center gap-1.5 shadow-sm">
                    <span class="material-symbols-outlined text-sm">settings_applications</span>
                    Đi đến Trang Quản Trị
                </router-link>
                <router-link v-else to="/tools" class="w-full sm:w-auto px-6 py-3 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 font-bold text-xs rounded-full transition-all flex items-center justify-center gap-1.5 shadow-sm">
                    <span class="material-symbols-outlined text-sm">construction</span>
                    Sử dụng Công Cụ
                </router-link>

                <button @click="handleLogout" class="w-full sm:w-auto px-6 py-3 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-xs rounded-full transition-all flex items-center justify-center gap-1.5 shadow-sm">
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
