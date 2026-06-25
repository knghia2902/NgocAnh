<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { authStore, updateStoreProfile, logout } from '../stores/auth';
import { authService } from '../services/storage/AuthService';
import { dbContext } from '../services/storage/DBContext';
import { ContentService } from '../services/ContentService';
import { supabase } from '../supabase';

const router = useRouter();

// Tab state
const activeTab = ref<'account' | 'permissions' | 'storage'>('account');

// Form state
const displayName = ref(authStore.displayName || '');
const newPassword = ref('');
const confirmPassword = ref('');

const errorMsg = ref('');
const successMsg = ref('');
const isLoading = ref(false);

// Local DB stats
const vesselCount = ref(0);
const ticketCount = ref(0);
const historyCount = ref(0);

// Connection state
const isSupabaseConnected = ref(true);
const isTestingConnection = ref(false);

// Staff tools allowed
const allowedStaffTools = ref<string[]>([]);

const allTools = [
  {
    id: 'converter',
    name: 'Chuyển Đổi Định Dạng File',
    desc: 'Chuyển đổi qua lại giữa Excel (.xlsx), CSV và JSON.',
    icon: 'swap_horiz',
    tags: ['Local Only', 'Trình duyệt']
  },
  {
    id: 'merger',
    name: 'Gộp Excel Thông Minh',
    desc: 'Hợp nhất nhiều tệp bảng tính theo cột khóa chung.',
    icon: 'layers',
    tags: ['Automate', 'Trình duyệt']
  },
  {
    id: 'weighbridge',
    name: 'In Phiếu Cân Xe 🚢',
    desc: 'Quản lý sà lan, xe cân và in phiếu cân tự động A5.',
    icon: 'print',
    tags: ['Supabase Cloud', 'In ấn A5']
  },
  {
    id: 'allocator',
    name: 'Phân Bổ Tải Trọng 🚛',
    desc: 'Phân rã tải tổng hợp thành các chuyến xe ngẫu nhiên.',
    icon: 'shuffle',
    tags: ['Local Only', 'Thuật toán']
  },
  {
    id: 'ocr',
    name: 'Trích Xuất PDF & OCR',
    desc: 'Nhận diện chữ từ ảnh và tệp PDF bằng Tesseract.js.',
    icon: 'document_scanner',
    tags: ['Browser OCR', 'Local Only']
  }
];

const loadStats = async () => {
    try {
        const vessels = await dbContext.get<any[]>('wb_vessels') || [];
        vesselCount.value = vessels.length;
    } catch (e) {
        console.error('Error fetching vessels count:', e);
    }
    try {
        const tickets = await dbContext.get<any[]>('allocator_tickets') || [];
        ticketCount.value = tickets.length;
    } catch (e) {
        console.error('Error fetching tickets count:', e);
    }
    try {
        const history = await dbContext.get<any[]>('allocator_history_trips') || [];
        historyCount.value = history.length;
    } catch (e) {
        console.error('Error fetching history count:', e);
    }
};

const checkConnection = async () => {
    isTestingConnection.value = true;
    errorMsg.value = '';
    successMsg.value = '';
    try {
        const { error } = await supabase.from('content').select('id').limit(1);
        isSupabaseConnected.value = !error;
        if (!error) {
            successMsg.value = 'Kết nối dữ liệu Supabase đám mây ổn định! ⚡';
        } else {
            errorMsg.value = 'Lỗi phản hồi từ Supabase Cloud. Vui lòng kiểm tra lại cấu hình.';
        }
    } catch (e) {
        isSupabaseConnected.value = false;
        errorMsg.value = 'Không thể kết nối đến Supabase Cloud. Kiểm tra lại đường truyền mạng!';
    } finally {
        isTestingConnection.value = false;
    }
};

onMounted(async () => {
    // Load allowed tools config
    allowedStaffTools.value = await ContentService.loadStaffTools();
    
    // Load stats
    await loadStats();

    // Check connection silently
    try {
        const { error } = await supabase.from('content').select('id').limit(1);
        isSupabaseConnected.value = !error;
    } catch (e) {
        isSupabaseConnected.value = false;
    }
});

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

const handleClearCache = async () => {
    if (confirm('⚠️ BẠN CÓ CHẮC CHẮN?\nHành động này sẽ xóa toàn bộ danh sách tàu/sà lan và các phiếu cân xe đang được lưu trữ tạm thời trên trình duyệt của thiết bị này. Các thay đổi đã đồng bộ trên Supabase Cloud sẽ không bị ảnh hưởng.')) {
        isLoading.value = true;
        try {
            await dbContext.clear();
            await loadStats();
            successMsg.value = 'Đã xóa sạch bộ nhớ đệm IndexedDB thành công! 🧹';
        } catch (e) {
            errorMsg.value = 'Có lỗi xảy ra khi dọn dẹp bộ nhớ đệm.';
        } finally {
            isLoading.value = false;
        }
    }
};

const handleLogout = () => {
    logout();
    router.push('/');
};
</script>

<template>
    <div class="min-h-screen flex items-center justify-center bg-[#FDF2F5] px-4 py-12 font-display">
        <div class="w-full max-w-2xl bg-white rounded-[3rem] p-6 md:p-10 shadow-2xl border border-white/50 relative overflow-hidden">
            <!-- Decorative circle -->
            <div class="absolute -top-12 -right-12 text-primary/10 select-none pointer-events-none">
                 <span class="material-symbols-outlined text-[180px]">account_circle</span>
            </div>

            <!-- Profile Header -->
            <div class="relative z-10 text-center mb-6">
                <div class="size-20 bg-soft-rose rounded-full flex items-center justify-center text-white glow-primary mx-auto mb-3 border-4 border-white shadow-lg overflow-hidden">
                    <span class="material-symbols-outlined text-4xl">person</span>
                </div>
                <h1 class="text-2xl md:text-3xl font-display font-black text-primary">Thông Tin Hồ Sơ</h1>
                <p class="text-gray-400 text-xs mt-1">Xin chào, {{ authStore.displayName }}</p>
                
                <!-- Role Badge -->
                <div class="mt-2 inline-block">
                    <span class="px-4 py-1 text-[10px] font-black uppercase rounded-full tracking-widest shadow-sm"
                        :class="authStore.role === 'admin' ? 'bg-red-50 text-red-500 border border-red-100' : 'bg-green-50 text-green-600 border border-green-100'"
                    >
                        {{ authStore.role === 'admin' ? 'Quản trị viên (Admin)' : 'Nhân viên (Staff)' }}
                    </span>
                </div>
            </div>

            <!-- Navigation Tabs -->
            <div class="flex border-b border-primary/10 mb-6 relative z-10">
                <button 
                    @click="activeTab = 'account'" 
                    :class="['flex-1 pb-3 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 border-b-2 transition-all outline-none', activeTab === 'account' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-primary/60']"
                >
                    <span class="material-symbols-outlined text-sm">manage_accounts</span>
                    Tài khoản
                </button>
                <button 
                    @click="activeTab = 'permissions'" 
                    :class="['flex-1 pb-3 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 border-b-2 transition-all outline-none', activeTab === 'permissions' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-primary/60']"
                >
                    <span class="material-symbols-outlined text-sm">shield_person</span>
                    Phân Quyền
                </button>
                <button 
                    @click="activeTab = 'storage'" 
                    :class="['flex-1 pb-3 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 border-b-2 transition-all outline-none', activeTab === 'storage' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-primary/60']"
                >
                    <span class="material-symbols-outlined text-sm">database</span>
                    Lưu trữ & Mạng
                </button>
            </div>

            <!-- Panels -->
            <div class="relative z-10 min-h-[300px]">
                
                <!-- Tab 1: Account Settings -->
                <div v-if="activeTab === 'account'" class="space-y-6 animate-fade-in">
                    <form @submit.prevent="handleUpdateProfile" class="space-y-5">
                        <!-- Username (ReadOnly) -->
                        <div class="space-y-1 text-left">
                            <label class="font-bold text-[10px] text-primary/60 uppercase tracking-widest ml-2">Tên đăng nhập (Username)</label>
                            <div class="relative">
                                <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">lock</span>
                                <input :value="authStore.user" type="text" readonly class="w-full bg-[#fcf8f9] border-none rounded-2xl py-3 pl-11 pr-4 font-bold text-gray-400 cursor-not-allowed outline-none text-sm" />
                            </div>
                        </div>

                        <!-- Display Name -->
                        <div class="space-y-1 text-left">
                            <label class="font-bold text-[10px] text-primary/80 uppercase tracking-widest ml-2">Tên hiển thị</label>
                            <div class="relative">
                                <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary/40">face</span>
                                <input v-model="displayName" type="text" class="w-full bg-[#fcf8f9] border-none rounded-2xl py-3 pl-11 pr-4 font-bold text-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all text-sm" required />
                            </div>
                        </div>

                        <div class="h-px bg-primary/10 my-4"></div>

                        <!-- Change Password Header -->
                        <div class="text-left mb-1">
                            <h3 class="text-xs font-black text-primary uppercase tracking-widest flex items-center gap-1">
                                <span class="material-symbols-outlined text-sm">key</span> Thay đổi mật khẩu
                            </h3>
                            <p class="text-[10px] text-gray-400">Để trống nếu không muốn đổi mật khẩu</p>
                        </div>

                        <!-- New Password & Confirm -->
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div class="space-y-1 text-left">
                                <label class="font-bold text-[10px] text-primary/80 uppercase tracking-widest ml-2">Mật khẩu mới</label>
                                <div class="relative">
                                    <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary/40">lock_open</span>
                                    <input v-model="newPassword" type="password" placeholder="••••••••" class="w-full bg-[#fcf8f9] border-none rounded-2xl py-3 pl-11 pr-4 font-bold text-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:font-normal placeholder:text-gray-300 text-sm" />
                                </div>
                            </div>

                            <div class="space-y-1 text-left">
                                <label class="font-bold text-[10px] text-primary/80 uppercase tracking-widest ml-2">Xác nhận mật khẩu</label>
                                <div class="relative">
                                    <span class="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-primary/40">verified_user</span>
                                    <input v-model="confirmPassword" type="password" placeholder="••••••••" class="w-full bg-[#fcf8f9] border-none rounded-2xl py-3 pl-11 pr-4 font-bold text-primary focus:ring-2 focus:ring-primary/20 outline-none transition-all placeholder:font-normal placeholder:text-gray-300 text-sm" />
                                </div>
                            </div>
                        </div>

                        <!-- Save Button -->
                        <button :disabled="isLoading" type="submit" class="w-full bg-primary text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-primary/20 hover:scale-[1.01] active:scale-95 transition-all text-xs flex items-center justify-center gap-1.5 disabled:opacity-70 disabled:cursor-not-allowed">
                            <span v-if="isLoading" class="material-symbols-outlined animate-spin text-sm">progress_activity</span>
                            <span v-else>Lưu thông tin hồ sơ ✨</span>
                        </button>
                    </form>
                </div>

                <!-- Tab 2: Permissions -->
                <div v-if="activeTab === 'permissions'" class="space-y-4 animate-fade-in text-left">
                    <div class="bg-gray-50 border border-gray-100 p-4 rounded-2xl mb-4">
                        <p class="text-xs font-bold text-gray-600 flex items-center gap-1.5">
                            <span class="material-symbols-outlined text-base text-primary">info</span>
                            Quyền hạn của tài khoản
                        </p>
                        <p class="text-[10px] text-gray-400 mt-1">
                            {{ authStore.role === 'admin' 
                                ? 'Tài khoản của bạn là Admin. Bạn có toàn quyền quản lý nhân viên, cấu hình hiển thị công cụ và thao tác dữ liệu không giới hạn.' 
                                : 'Bạn đang đăng nhập dưới vai trò Staff. Quyền sử dụng các công cụ vận hành được Admin quản lý và cấp phép dưới đây.' }}
                        </p>
                    </div>

                    <h3 class="text-xs font-black uppercase text-primary tracking-widest mb-3">Hiển thị & Quyền truy cập công cụ</h3>
                    
                    <div class="space-y-3">
                        <div 
                            v-for="tool in allTools" 
                            :key="tool.id"
                            class="bg-[#fcf8f9] border border-primary/5 rounded-2xl p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-3"
                        >
                            <div class="flex items-center gap-3">
                                <div class="size-9 bg-white rounded-xl flex items-center justify-center shadow-sm border border-primary/10 text-primary">
                                    <span class="material-symbols-outlined text-base">{{ tool.icon }}</span>
                                </div>
                                <div>
                                    <h4 class="text-xs font-black text-gray-700">{{ tool.name }}</h4>
                                    <p class="text-[9px] text-gray-400 leading-normal">{{ tool.desc }}</p>
                                </div>
                            </div>

                            <!-- Badge status -->
                            <div class="shrink-0 flex items-center gap-2">
                                <span v-if="authStore.role === 'admin' || allowedStaffTools.includes(tool.id)" 
                                    class="px-2.5 py-1 text-[8px] font-black uppercase rounded-full bg-teal-50 border border-teal-100 text-teal-600 tracking-wider flex items-center gap-1"
                                >
                                    <span class="size-1.5 rounded-full bg-teal-500 animate-pulse"></span>
                                    Được phép dùng
                                </span>
                                <span v-else 
                                    class="px-2.5 py-1 text-[8px] font-black uppercase rounded-full bg-gray-100 border border-gray-200 text-gray-400 tracking-wider flex items-center gap-1"
                                >
                                    <span class="material-symbols-outlined text-[10px]">lock</span>
                                    Bị hạn chế
                                </span>
                            </div>
                        </div>
                    </div>

                    <!-- Detailed operations limitations -->
                    <div class="h-px bg-primary/10 my-4"></div>
                    <h3 class="text-xs font-black uppercase text-primary tracking-widest mb-3">Quyền thao tác nghiệp vụ chi tiết</h3>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-[10px]">
                        <!-- Print weighbridge details -->
                        <div class="bg-[#fcf8f9] p-3.5 rounded-2xl border border-primary/5 space-y-2">
                            <span class="font-black text-primary flex items-center gap-1">
                                <span class="material-symbols-outlined text-sm">print</span> In Phiếu Cân Xe
                            </span>
                            <ul class="space-y-1.5">
                                <li class="flex items-center gap-1 text-gray-600 font-bold">
                                    <span class="material-symbols-outlined text-xs text-teal-600 font-black">check_circle</span>
                                    Xem & in danh sách xe cân
                                </li>
                                <li class="flex items-center gap-1 font-bold" :class="authStore.role === 'admin' ? 'text-gray-600' : 'text-gray-400/80'">
                                    <span class="material-symbols-outlined text-xs font-black" :class="authStore.role === 'admin' ? 'text-teal-600' : 'text-gray-300'">
                                        {{ authStore.role === 'admin' ? 'check_circle' : 'cancel' }}
                                    </span>
                                    Quản lý tàu & sà lan (Admin)
                                </li>
                                <li class="flex items-center gap-1 font-bold" :class="authStore.role === 'admin' ? 'text-gray-600' : 'text-gray-400/80'">
                                    <span class="material-symbols-outlined text-xs font-black" :class="authStore.role === 'admin' ? 'text-teal-600' : 'text-gray-300'">
                                        {{ authStore.role === 'admin' ? 'check_circle' : 'cancel' }}
                                    </span>
                                    Cấu hình mẫu in A5 (Admin)
                                </li>
                            </ul>
                        </div>

                        <!-- Trip allocator details -->
                        <div class="bg-[#fcf8f9] p-3.5 rounded-2xl border border-primary/5 space-y-2">
                            <span class="font-black text-primary flex items-center gap-1">
                                <span class="material-symbols-outlined text-sm">shuffle</span> Phân Bổ Tải Trọng
                            </span>
                            <ul class="space-y-1.5">
                                <li class="flex items-center gap-1 text-gray-600 font-bold">
                                    <span class="material-symbols-outlined text-xs text-teal-600 font-black">check_circle</span>
                                    Phân chia xe & sinh giờ tự động
                                </li>
                                <li class="flex items-center gap-1 font-bold" :class="authStore.role === 'admin' ? 'text-gray-600' : 'text-gray-400/80'">
                                    <span class="material-symbols-outlined text-xs font-black" :class="authStore.role === 'admin' ? 'text-teal-600' : 'text-gray-300'">
                                        {{ authStore.role === 'admin' ? 'check_circle' : 'cancel' }}
                                    </span>
                                    Xóa lịch sử xe đã phân (Admin)
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                <!-- Tab 3: Storage & Connections -->
                <div v-if="activeTab === 'storage'" class="space-y-5 animate-fade-in text-left">
                    <!-- Network sync state -->
                    <div class="bg-[#fcf8f9] border border-primary/5 p-4 rounded-2xl">
                        <h3 class="text-xs font-black uppercase text-primary tracking-widest mb-3 flex items-center justify-between">
                            Đồng bộ Supabase Cloud
                            <span class="flex items-center gap-1 text-[9px] font-black tracking-normal px-2.5 py-0.5 rounded-full uppercase"
                                :class="isSupabaseConnected ? 'bg-teal-50 text-teal-600 border border-teal-100' : 'bg-red-50 text-red-500 border border-red-100'"
                            >
                                <span class="size-1.5 rounded-full animate-ping" :class="isSupabaseConnected ? 'bg-teal-500' : 'bg-red-500'"></span>
                                {{ isSupabaseConnected ? 'Đã kết nối' : 'Ngoại tuyến' }}
                            </span>
                        </h3>
                        <p class="text-[10px] text-gray-400 leading-normal">
                            Kiểm tra trạng thái đường truyền mạng tới máy chủ đám mây Supabase để đảm bảo việc đọc ghi cài đặt và danh sách tài khoản được đồng bộ trực tuyến.
                        </p>
                        <button 
                            @click="checkConnection" 
                            :disabled="isTestingConnection"
                            class="mt-3 px-4 py-2 bg-white hover:bg-gray-50 border border-primary/10 hover:border-primary/30 text-primary font-bold rounded-xl text-[10px] flex items-center justify-center gap-1 shadow-sm transition-all"
                        >
                            <span class="material-symbols-outlined text-xs" :class="{'animate-spin': isTestingConnection}">sync</span>
                            Kiểm tra kết nối đám mây
                        </button>
                    </div>

                    <!-- Local DB Stats -->
                    <div class="bg-[#fcf8f9] border border-primary/5 p-4 rounded-2xl space-y-3">
                        <h3 class="text-xs font-black uppercase text-primary tracking-widest">
                            Dữ liệu Offline tại thiết bị (IndexedDB)
                        </h3>
                        <p class="text-[10px] text-gray-400 leading-normal">
                            Hệ thống tự động lưu trữ các bản ghi công việc trên cơ sở dữ liệu IndexedDB của trình duyệt này để bảo mật dữ liệu tuyệt đối (không tải dữ liệu thô lên máy chủ).
                        </p>

                        <div class="grid grid-cols-3 gap-2.5 pt-1">
                            <div class="bg-white p-3 rounded-xl shadow-xs border border-primary/5 text-center">
                                <span class="text-gray-400 font-bold text-[9px] uppercase">Tàu & Sà Lan</span>
                                <p class="text-base font-black text-primary mt-0.5">{{ vesselCount }}</p>
                            </div>
                            <div class="bg-white p-3 rounded-xl shadow-xs border border-primary/5 text-center">
                                <span class="text-gray-400 font-bold text-[9px] uppercase">Phiếu xe thô</span>
                                <p class="text-base font-black text-primary mt-0.5">{{ ticketCount }}</p>
                            </div>
                            <div class="bg-white p-3 rounded-xl shadow-xs border border-primary/5 text-center">
                                <span class="text-gray-400 font-bold text-[9px] uppercase">Lịch sử chia</span>
                                <p class="text-base font-black text-primary mt-0.5">{{ historyCount }}</p>
                            </div>
                        </div>

                        <div class="pt-2">
                            <button 
                                @click="handleClearCache"
                                class="px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-100 hover:border-red-200 font-bold rounded-xl text-[10px] flex items-center justify-center gap-1 shadow-sm transition-all"
                            >
                                <span class="material-symbols-outlined text-xs">delete_sweep</span>
                                Làm sạch dữ liệu offline (Clear Cache)
                            </button>
                        </div>
                    </div>
                </div>

            </div>

            <!-- Global feedback messages -->
            <div v-if="errorMsg || successMsg" class="mt-6 relative z-10">
                <div v-if="errorMsg" class="bg-red-50 text-red-500 p-3.5 rounded-2xl text-[10px] font-bold flex items-center gap-2 border border-red-100">
                    <span class="material-symbols-outlined text-sm">error</span>
                    {{ errorMsg }}
                </div>
                <div v-if="successMsg" class="bg-green-50 text-green-600 p-3.5 rounded-2xl text-[10px] font-bold flex items-center gap-2 border border-green-100">
                    <span class="material-symbols-outlined text-sm">task_alt</span>
                    {{ successMsg }}
                </div>
            </div>

            <!-- Navigation Hub & Logout -->
            <div class="mt-6 pt-6 border-t border-primary/10 flex flex-col sm:flex-row gap-4 justify-between items-center relative z-10">
                <router-link v-if="authStore.role === 'admin'" to="/admin" class="w-full sm:w-auto px-5 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm">
                    <span class="material-symbols-outlined text-sm">settings_applications</span>
                    Đi đến Trang Quản Trị
                </router-link>
                <router-link v-else to="/tools" class="w-full sm:w-auto px-5 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm">
                    <span class="material-symbols-outlined text-sm">construction</span>
                    Sử dụng Công Cụ
                </router-link>

                <button @click="handleLogout" class="w-full sm:w-auto px-5 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-sm">
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

.animate-fade-in {
    animation: fadeIn 0.2s ease-out forwards;
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateY(4px);
    }
    to {
        opacity: 1;
        transform: translateY(0);
    }
}
</style>
