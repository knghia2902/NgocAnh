<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { contentStore } from '../stores/content';
import { logout } from '../stores/auth';
import { authService } from '../services/storage/AuthService';

const router = useRouter();
const currentTab = ref('dashboard');
const fileInput = ref<HTMLInputElement | null>(null);
const projectFileInput = ref<HTMLInputElement | null>(null);

// Settings Modal
const showSettings = ref(false);
const newPassword = ref('');
const confirmPassword = ref('');
const settingsMessage = ref('');
const showLogoutModal = ref(false);

// Project Modal
const showProjectModal = ref(false);
const newProject = ref({ title: '', description: '', tag: '', image: '' });

// Toolkit Editor State
const showToolkitConfig = ref(false);
const newTool = ref({ icon: '', label: '' });

// Notification
const showToast = ref(false);
const toastMessage = ref('');
const triggerToast = (msg: string) => {
    toastMessage.value = msg;
    showToast.value = true;
    setTimeout(() => showToast.value = false, 3000);
}

// Notification Dropdown
const showNotifications = ref(false);
const notifications = ref([
    { id: 1, text: "System updated successfully", time: "2 min ago" },
    { id: 2, text: "New project 'PinkyPal' added", time: "1 hour ago" },
    { id: 3, text: "Portfolio views reached 1,000", time: "1 day ago" }
]);

// --- Image Drag Logic ---
const isDragging = ref(false);
const dragStart = ref({ x: 0, y: 0 });
const startPos = ref({ x: 50, y: 50 });

const handleMouseDown = (e: MouseEvent) => {
    isDragging.value = true;
    dragStart.value = { x: e.clientX, y: e.clientY };
    startPos.value = { ...contentStore.hero.position };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
};

const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.value) return;
    // Sensitivity factor controls how fast the image moves relative to mouse
    const sensitivity = 0.5; 
    const dx = (e.clientX - dragStart.value.x) * sensitivity;
    const dy = (e.clientY - dragStart.value.y) * sensitivity;

    // Update position (clamped 0-100)
    contentStore.hero.position.x = Math.min(100, Math.max(0, startPos.value.x - dx));
    contentStore.hero.position.y = Math.min(100, Math.max(0, startPos.value.y - dy));
};

const handleMouseUp = () => {
    isDragging.value = false;
    window.removeEventListener('mousemove', handleMouseMove);
    window.removeEventListener('mouseup', handleMouseUp);
};

// --- Actions ---
const handleLogout = () => {
   showLogoutModal.value = true; 
};

const confirmLogout = () => {
    logout();
    router.push('/login');
};

const handlePasswordChange = async () => {
    if (newPassword.value !== confirmPassword.value) {
        settingsMessage.value = 'Passwords do not match!';
        return;
    }
    if (newPassword.value.length < 6) return;
    const success = await authService.changePassword(newPassword.value);
    if (success) {
        triggerToast('Password updated!');
        showSettings.value = false;
        newPassword.value = ''; confirmPassword.value = ''; settingsMessage.value = '';
    } else settingsMessage.value = 'Failed.';
};

const triggerHeroImageUpload = () => fileInput.value?.click();
const handleHeroImageUpload = (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.files?.[0]) {
        const reader = new FileReader();
        reader.onload = (ev) => { if (ev.target?.result) contentStore.hero.image = ev.target.result as string; };
        reader.readAsDataURL(target.files[0]);
    }
};

// Toolkit Actions
const addTool = () => {
    if (newTool.value.label && newTool.value.icon) {
        contentStore.toolkit.push({ ...newTool.value });
        newTool.value = { icon: '', label: '' };
        triggerToast('Tool added!');
    }
};
const removeTool = (index: number) => {
    contentStore.toolkit.splice(index, 1);
};

// Project Actions
const triggerProjectImageUpload = () => projectFileInput.value?.click();
const handleProjectImageUpload = (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.files?.[0]) {
        const reader = new FileReader();
        reader.onload = (ev) => { if (ev.target?.result) newProject.value.image = ev.target.result as string; };
        reader.readAsDataURL(target.files[0]);
    }
};
const addProject = () => {
    if (!newProject.value.title) return;
    if (!newProject.value.image) newProject.value.image = "https://lh3.googleusercontent.com/aida-public/AB6AXuDpyOZU63z80-gG8qighS06AKdJBzZeu9FQbZ-qPF8ziCtVwdAZRyovsPm-gxv7bwuY-nWEk-SmGiFwao3G1vwzOXIJ-lRi0xyFtPLzwHNJsOEyyqthZtYxRg6y41Dt3oiv8bYXV-KuxnemhACsYKwmxZx7I4z5aN20BrglTZdSgcPpt_sbi6jlBKNX4P2nMm530Gr0qfzVTmUN_N2v3t0m0PDsoENGj9zHbbfN0oBTDO8_zwZaMFcNoPqUL7v5PDO1EDcv6lgCqvLU";
    contentStore.projects.push({ ...newProject.value });
    newProject.value = { title: '', description: '', tag: '', image: '' };
    showProjectModal.value = false;
    triggerToast('Project added!');
};
const deleteProject = (idx: number) => { if (confirm('Delete?')) contentStore.projects.splice(idx, 1); };
const deleteMessage = (idx: number) => { if (confirm('Delete?')) contentStore.messages.splice(idx, 1); };
const saveChanges = () => triggerToast('✨ Changes saved!');
</script>

<template>
<div class="flex h-[calc(100vh-2rem)] overflow-hidden bg-background-light font-display text-[#1b0d11] rounded-3xl m-4 border border-primary/10 shadow-xl relative">
    
    <transition name="fade">
        <div v-if="showToast" class="absolute top-8 left-1/2 -translate-x-1/2 z-50 bg-primary text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-primary/30 flex items-center gap-2">
            <span class="material-symbols-outlined">check_circle</span>
            {{ toastMessage }}
        </div>
    </transition>

    <!-- Sidebar -->
    <aside class="w-72 bg-white m-4 ml-4 rounded-[2.5rem] flex flex-col border border-primary/5 hidden md:flex shrink-0 shadow-sm relative z-20">
         <div class="p-8 pb-6 flex items-center gap-3">
             <!-- Sidebar Header with Image 1 Style -->
            <div class="size-12 rounded-full bg-cover bg-center border-2 border-primary/20" :style="{ backgroundImage: `url(${contentStore.hero.image})` }"></div>
            <div>
                 <p class="text-xs font-bold opacity-40 uppercase tracking-widest">Admin Mode</p>
                 <h2 class="text-lg font-bold tracking-tight text-primary">Ngoc Anh</h2>
            </div>
        </div>
        
        <nav class="flex-1 px-4 space-y-2 mt-2">
            <button @click="currentTab = 'dashboard'" :class="['w-full flex items-center gap-4 px-6 py-4 rounded-full font-bold transition-all', currentTab === 'dashboard' ? 'bg-primary/5 text-primary shadow-inner' : 'text-[#1b0d11]/60 hover:bg-gray-50']">
                <span class="material-symbols-outlined" :class="{ 'filled': currentTab === 'dashboard' }">dashboard</span>
                <span>Dashboard</span>
            </button>
            <button @click="currentTab = 'projects'" :class="['w-full flex items-center gap-4 px-6 py-4 rounded-full font-bold transition-all', currentTab === 'projects' ? 'bg-primary/5 text-primary shadow-inner' : 'text-[#1b0d11]/60 hover:bg-gray-50']">
                <span class="material-symbols-outlined" :class="{ 'filled': currentTab === 'projects' }">folder</span>
                <span>Projects</span>
            </button>
            <button @click="currentTab = 'about'" :class="['w-full flex items-center gap-4 px-6 py-4 rounded-full font-bold transition-all', currentTab === 'about' ? 'bg-primary/5 text-primary shadow-inner' : 'text-[#1b0d11]/60 hover:bg-gray-50']">
                <span class="material-symbols-outlined" :class="{ 'filled': currentTab === 'about' }">person</span>
                <span>About Me</span>
            </button>
             <button @click="currentTab = 'messages'" :class="['w-full flex items-center gap-4 px-6 py-4 rounded-full font-bold transition-all', currentTab === 'messages' ? 'bg-primary/5 text-primary shadow-inner' : 'text-[#1b0d11]/60 hover:bg-gray-50']">
                <span class="material-symbols-outlined" :class="{ 'filled': currentTab === 'messages' }">mail</span>
                <span>Messages</span>
            </button>
        </nav>

        <!-- Simplified Footer (Logout Only) -->
        <div class="p-6 mt-auto">
            <button @click="handleLogout" class="w-full text-red-400 hover:text-red-500 hover:bg-red-50 font-bold py-3 rounded-2xl transition-all flex items-center justify-center gap-2 group">
                <span class="material-symbols-outlined group-hover:-translate-x-1 transition-transform">logout</span>
                Logout
            </button>
        </div>
    </aside>

    <!-- Main Content -->
    <main class="flex-1 flex flex-col overflow-hidden bg-background-light relative">
        <header class="px-8 py-6 flex justify-between items-center sticky top-0 z-10">
            <div>
                 <h1 class="text-2xl font-bold text-[#1b0d11]" v-if="currentTab === 'dashboard'">Welcome back, Admin!</h1>
                 <h1 class="text-2xl font-bold text-[#1b0d11] capitalize" v-else>{{ currentTab }} Management</h1>
                 <p class="text-sm opacity-60 font-medium mt-1" v-if="currentTab === 'dashboard'">Ready to sprinkle some more magic today?</p>
            </div>
            <div class="flex items-center gap-4 relative">
                 <button @click="showNotifications = !showNotifications" class="size-10 rounded-full bg-white flex items-center justify-center shadow-sm hover:scale-105 transition-transform text-primary relative z-20">
                    <span class="material-symbols-outlined">notifications</span>
                    <span class="absolute top-2 right-2 size-2 bg-red-400 rounded-full border border-white"></span>
                </button>
                <div v-if="showNotifications" class="absolute top-12 right-10 w-80 bg-white rounded-[2rem] shadow-xl border border-primary/10 overflow-hidden z-30">
                    <div class="p-4 border-b border-gray-100 font-bold text-sm">Notifications</div>
                    <div class="max-h-60 overflow-y-auto">
                        <div v-for="notif in notifications" :key="notif.id" class="p-4 hover:bg-gray-50 border-b border-gray-50 last:border-0 cursor-pointer">
                            <p class="text-xs font-bold">{{ notif.text }}</p>
                            <p class="text-[10px] opacity-50 mt-1">{{ notif.time }}</p>
                        </div>
                    </div>
                </div>
                <button @click="showSettings = true" class="size-10 rounded-full bg-white flex items-center justify-center shadow-sm hover:scale-105 transition-transform text-primary">
                    <span class="material-symbols-outlined">settings</span>
                </button>
            </div>
        </header>

        <div class="flex-1 overflow-y-auto px-8 pb-8">
            <div v-if="currentTab === 'dashboard'" class="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <!-- Left Column -->
                <div class="lg:col-span-2 flex flex-col gap-8 h-full">
                     <!-- Hero Editor -->
                     <div class="bg-white rounded-[2rem] p-8 soft-shadow border border-primary/5">
                        <div class="flex justify-between items-center mb-6">
                            <h3 class="text-lg font-bold flex items-center gap-2 text-[#1b0d11]">
                                <span class="material-symbols-outlined text-primary">home</span> Edit 'Trang chủ' Content
                            </h3>
                            <button @click="saveChanges" class="bg-primary text-white px-5 py-2 rounded-full font-bold text-sm shadow-lg shadow-primary/20 hover:scale-105 transition-transform">Save</button>
                        </div>
                        <div class="space-y-6">
                            <div class="bg-background-light rounded-2xl p-4">
                                <label class="block text-xs font-bold mb-2 opacity-50 ml-1 uppercase">Hero Title</label>
                                <input v-model="contentStore.hero.title" class="w-full bg-transparent border-none p-0 font-bold text-lg focus:ring-0" placeholder="Title..."/>
                            </div>
                            <div class="bg-background-light rounded-2xl p-4">
                                <label class="block text-xs font-bold mb-2 opacity-50 ml-1 uppercase">Hero Subtitle</label>
                                <textarea v-model="contentStore.hero.subtitle" class="w-full bg-transparent border-none p-0 font-medium focus:ring-0 resize-none" rows="3" placeholder="Subtitle..."></textarea>
                            </div>
                            <div class="grid grid-cols-2 gap-6">
                                <div class="bg-background-light rounded-2xl p-4">
                                    <label class="block text-xs font-bold mb-2 opacity-50 ml-1 uppercase">Button 1</label>
                                    <input v-model="contentStore.hero.primaryButton" class="w-full bg-transparent border-none p-0 font-bold"/>
                                </div>
                                <div class="bg-background-light rounded-2xl p-4">
                                    <label class="block text-xs font-bold mb-2 opacity-50 ml-1 uppercase">Button 2</label>
                                    <input v-model="contentStore.hero.secondaryButton" class="w-full bg-transparent border-none p-0 font-bold"/>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Visibility & Toolkit -->
                     <div class="grid grid-cols-1 md:grid-cols-2 gap-8 flex-1">
                        <div class="bg-white rounded-[2rem] p-8 soft-shadow border border-primary/5 h-full">
                             <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
                                <span class="material-symbols-outlined text-primary">visibility</span> Visibility
                             </h3>
                             <div class="grid grid-cols-2 gap-4">
                                <div v-for="(_val, key) in contentStore.visibility" :key="key" class="flex items-center justify-between p-3 bg-background-light rounded-2xl capitalize">
                                    <span class="font-bold text-xs">{{ key }}</span>
                                    <div class="relative inline-block w-8 h-4">
                                        <input v-model="contentStore.visibility[key]" type="checkbox" :id="key" class="peer appearance-none w-8 h-4 bg-gray-200 rounded-full checked:bg-primary cursor-pointer transition-colors" />
                                        <label :for="key" class="absolute top-0.5 left-0.5 bg-white w-3 h-3 rounded-full transition-transform peer-checked:translate-x-4 cursor-pointer shadow-sm"></label>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Toolkit Editor -->
                         <div class="bg-white rounded-[2rem] p-8 soft-shadow border border-primary/5 relative h-full">
                             <div class="flex justify-between items-center mb-4">
                                <h3 class="text-lg font-bold flex items-center gap-2">
                                    <span class="material-symbols-outlined text-primary">auto_awesome</span> Toolkit
                                </h3>
                                <button @click="showToolkitConfig = !showToolkitConfig" class="text-primary text-sm font-bold hover:underline">{{ showToolkitConfig ? 'Done' : 'Edit' }}</button>
                             </div>
                             
                             <div  class="flex flex-wrap gap-2 max-h-[180px] overflow-y-auto">
                                <div v-for="(tool, idx) in contentStore.toolkit" :key="idx" class="px-3 py-1 bg-background-light rounded-full text-xs font-bold flex items-center gap-1 border border-transparent hover:border-primary/20">
                                    <span class="material-symbols-outlined text-sm">{{ tool.icon }}</span>
                                    {{ tool.label }}
                                    <button v-if="showToolkitConfig" @click="removeTool(idx)" class="text-red-400 hover:text-red-600 ml-1">×</button>
                                </div>
                             </div>
                             
                             <div v-if="showToolkitConfig" class="mt-4 pt-4 border-t border-dashed border-gray-200 space-y-2">
                                 <input v-model="newTool.icon" placeholder="Icon (e.g. brush)" class="w-full text-xs bg-gray-50 p-2 rounded-lg" />
                                 <div class="flex gap-2">
                                     <input v-model="newTool.label" placeholder="Label" class="w-full text-xs bg-gray-50 p-2 rounded-lg" />
                                     <button @click="addTool" class="bg-primary text-white text-xs px-3 rounded-lg font-bold">+</button>
                                 </div>
                                 <p class="text-[10px] opacity-60 text-center"><a href="https://fonts.google.com/icons" target="_blank" class="underline">Find Icons Here</a></p>
                             </div>
                         </div>
                     </div>
                </div>

                <!-- Right Column: Image & Tips -->
                <div class="flex flex-col gap-8 h-full">
                     <!-- Stats Card (Moved to Top) -->
                     <div class="bg-pastel-lavender/30 rounded-[2rem] p-8 text-center relative overflow-hidden border border-white/50">
                        <div class="absolute -top-6 -right-6 text-white/40 rotate-12">
                             <span class="material-symbols-outlined text-[120px]">insights</span>
                        </div>
                        <h4 class="text-xs font-bold tracking-widest text-primary uppercase mb-2">Portfolio Visitors</h4>
                        <div class="text-5xl font-bold text-[#4a2c32] mb-2">{{ contentStore.stats.visitors.toLocaleString() }}</div>
                         <p class="text-xs font-bold opacity-40">All time views</p>
                    </div>

                     <!-- Draggable Hero Image (Image 2 Style) -->
                     <div class="bg-white rounded-[2rem] p-6 soft-shadow border border-primary/5 flex flex-col items-center">
                        <h3 class="font-bold mb-4 text-primary text-sm self-start">Active Hero Image</h3>
                        
                         <div class="relative size-60 blob-shape bg-soft-pink/30 flex items-center justify-center p-2 mb-4 overflow-hidden border-2 border-dashed border-primary/20 group cursor-move" @mousedown="handleMouseDown">
                             <div class="absolute inset-0 blob-shape bg-no-repeat bg-cover pointer-events-none transition-[background-image] duration-300" 
                                  :style="{ backgroundImage: `url(${contentStore.hero.image})`, backgroundPosition: `${contentStore.hero.position.x}% ${contentStore.hero.position.y}%` }">
                             </div>
                             <!-- Overlay Hint -->
                             <div class="absolute inset-0 flex items-center justify-center bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity rounded-full">
                                 <span class="text-white text-xs font-bold drop-shadow-md">Drag to adjust</span>
                             </div>
                             <!-- Sparkles -->
                             <span class="material-symbols-outlined absolute -top-2 -right-2 text-pastel-pink text-3xl">auto_awesome</span>
                             <span class="material-symbols-outlined absolute bottom-4 left-0 text-pastel-pink text-2xl">star</span>
                         </div>
                         
                        <input type="file" ref="fileInput" accept="image/*" class="hidden" @change="handleHeroImageUpload" />
                        <button @click="triggerHeroImageUpload" class="w-full py-3 rounded-xl border border-gray-200 font-bold hover:border-primary/30 hover:bg-primary/5 hover:text-primary transition-all text-xs">
                            Change Image
                        </button>
                    </div>
                    
                    <!-- Adjusted Quick Tip -->
                     <div class="bg-[#FFF8E1] rounded-[2rem] p-6 border border-[#FFECB3] relative overflow-hidden flex-1 flex flex-col justify-center">
                         <div class="relative z-10">
                            <h4 class="font-bold text-[#F57F17] mb-2 text-sm flex items-center gap-2">
                                <span class="material-symbols-outlined">lightbulb</span> Quick Tip
                            </h4>
                            <p class="text-xs leading-relaxed text-[#F57F17]/80 font-medium">
                                Drag the image box above to adjust how your face appears on the circle frame in the Home page. No more headless photos! ✨
                            </p>
                         </div>
                         <span class="material-symbols-outlined absolute -bottom-4 -right-4 text-[#ffe0b2] text-9xl -z-0 rotate-12">lightbulb</span>
                     </div>

                </div>
            </div>

             <!-- Other Tabs remain similar logic, just ensure they are present (omitted for brevity if no changes, but I will include them to be safe) -->
            <div v-if="currentTab === 'projects'" class="space-y-6">
                <button @click="showProjectModal = true" class="bg-primary text-white px-6 py-3 rounded-full font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-transform flex items-center gap-2 ml-auto">
                    <span class="material-symbols-outlined">add</span> New Project
                </button>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div v-for="(project, index) in contentStore.projects" :key="index" class="bg-white p-6 rounded-[2rem] soft-shadow border border-primary/5 flex gap-6 group">
                        <div class="size-24 rounded-2xl bg-cover bg-center shrink-0 border border-gray-100" :style="{ backgroundImage: `url(${project.image})` }"></div>
                        <div class="flex-1">
                            <h4 class="font-bold text-lg truncate">{{ project.title }}</h4>
                            <div class="flex gap-2 mt-2">
                                <button class="text-xs font-bold text-red-400 hover:text-red-500" @click="deleteProject(index)">Delete</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
             <div v-if="currentTab === 'about'" class="max-w-xl mx-auto bg-white rounded-[2rem] p-8 soft-shadow border border-primary/5 space-y-4">
                 <h3 class="text-xl font-bold text-center mb-6">Contact Info</h3>
                 <input v-model="contentStore.about.email" class="w-full bg-background-light p-4 rounded-2xl font-bold text-sm" placeholder="Email"/>
                 <input v-model="contentStore.about.social.facebook" class="w-full bg-background-light p-4 rounded-2xl font-bold text-sm" placeholder="Facebook"/>
                 <input v-model="contentStore.about.social.instagram" class="w-full bg-background-light p-4 rounded-2xl font-bold text-sm" placeholder="Instagram"/>
                 <button @click="saveChanges" class="w-full bg-primary text-white py-3 rounded-xl font-bold mt-4">Save</button>
            </div>

             <div v-if="currentTab === 'messages'" class="space-y-4 max-w-2xl mx-auto">
                 <div v-if="contentStore.messages.length === 0" class="text-center py-10 opacity-50 font-bold">No messages yet.</div>
                 <div v-for="(msg, idx) in contentStore.messages" :key="idx" class="bg-white p-6 rounded-[2rem] border border-primary/5">
                     <div class="flex justify-between mb-2">
                         <span class="font-bold">{{ msg.name }}</span>
                         <span class="text-xs opacity-50">{{ new Date(msg.date).toLocaleDateString() }}</span>
                     </div>
                     <p class="text-sm opacity-70 mb-4">{{ msg.content }}</p>
                     <button @click="deleteMessage(idx)" class="text-xs font-bold text-red-400 hover:text-red-600">Delete</button>
                </div>
            </div>
        </div>
        
        <!-- Modals (Settings & Project) same as before -->
        <div v-if="showProjectModal" class="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div class="bg-white w-full max-w-lg rounded-[2.5rem] p-8 shadow-2xl relative">
                <button @click="showProjectModal = false" class="absolute top-6 right-6 text-gray-400"><span class="material-symbols-outlined">close</span></button>
                <h2 class="text-2xl font-bold mb-6">New Project</h2>
                <div class="space-y-4">
                     <input v-model="newProject.title" class="w-full bg-background-light rounded-2xl p-4 font-bold" placeholder="Title" />
                     <input v-model="newProject.tag" class="w-full bg-background-light rounded-2xl p-4 font-bold" placeholder="Tag" />
                     <textarea v-model="newProject.description" class="w-full bg-background-light rounded-2xl p-4" rows="3" placeholder="Desc..."></textarea>
                     <input type="file" ref="projectFileInput" accept="image/*" class="hidden" @change="handleProjectImageUpload" />
                     <div class="flex items-center gap-4"><button @click="triggerProjectImageUpload" class="text-primary font-bold text-sm">Upload Cover</button></div>
                     <button @click="addProject" class="w-full bg-primary text-white py-4 rounded-full font-bold mt-4">Create</button>
                </div>
            </div>
        </div>
         <div v-if="showSettings" class="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div class="bg-white w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl relative text-center">
                 <button @click="showSettings = false" class="absolute top-6 right-6 text-gray-400"><span class="material-symbols-outlined">close</span></button>
                 <h2 class="text-2xl font-bold mb-2">Change Password</h2>
                 <div class="space-y-4 mt-6">
                     <input v-model="newPassword" type="password" class="w-full bg-background-light rounded-2xl p-4 font-bold" placeholder="New Pass" />
                     <input v-model="confirmPassword" type="password" class="w-full bg-background-light rounded-2xl p-4 font-bold" placeholder="Confirm Pass" />
                     <button @click="handlePasswordChange" class="w-full bg-primary text-white py-4 rounded-full font-bold mt-2">Update</button>
                 </div>
            </div>
        </div>

        <!-- Logout Modal -->
         <div v-if="showLogoutModal" class="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div class="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative text-center">
                 <div class="size-16 rounded-full bg-red-50 text-red-400 flex items-center justify-center mx-auto mb-4">
                     <span class="material-symbols-outlined text-3xl">logout</span>
                 </div>
                 <h2 class="text-xl font-bold mb-2">Logging Out?</h2>
                 <p class="text-sm opacity-60 mb-6">Are you sure you want to end your session?</p>
                 <div class="flex gap-3">
                     <button @click="showLogoutModal = false" class="flex-1 py-3 rounded-xl font-bold bg-gray-100 hover:bg-gray-200 transition-colors">Cancel</button>
                     <button @click="confirmLogout" class="flex-1 py-3 rounded-xl font-bold bg-red-400 text-white hover:bg-red-500 transition-colors shadow-lg shadow-red-200">Logout</button>
                 </div>
            </div>
        </div>

    </main>
</div>
</template>
