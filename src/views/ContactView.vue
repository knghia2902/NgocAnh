<script setup lang="ts">
import { ref } from 'vue';
import { contentStore } from '../stores/content';

const name = ref('');
const email = ref('');
const message = ref('');
const isSubmitting = ref(false);
const sentSuccess = ref(false);

const sendMessage = () => {
    isSubmitting.value = true;
    
    // Simulate API delay
    setTimeout(() => {
        contentStore.messages.unshift({
            id: Date.now(),
            name: name.value,
            email: email.value,
            content: message.value,
            date: new Date().toISOString()
        });
        
        // Reset form
        name.value = '';
        email.value = '';
        message.value = '';
        
        isSubmitting.value = false;
        sentSuccess.value = true;
        
        setTimeout(() => sentSuccess.value = false, 5000);
    }, 1000);
};
</script>

<template>
    <div class="min-h-screen font-display text-[#1b0d11] dark:text-[#fcf8f9] pt-10">
        <main class="flex-1 flex flex-col max-w-[1000px] mx-auto px-4 md:px-10 py-16 items-center">
            <div class="text-center mb-12">
                <h1 class="text-4xl md:text-5xl font-bold text-primary mb-4">Gửi lời nhắn cho mình nhé!</h1>
                <p class="text-lg text-[#1b0d11]/70 font-medium">I'd love to hear from you and start something magical together ✨</p>
            </div>
            
            <div class="relative w-full max-w-2xl bg-white rounded-2xl p-8 md:p-12 love-letter-shadow border-t-[12px] border-pastel-pink transition-all">
                <div class="absolute -top-7 left-1/2 -translate-x-1/2 heart-seal size-14 rounded-full flex items-center justify-center text-white z-10">
                    <span class="material-symbols-outlined text-3xl">favorite</span>
                </div>
                
                <div v-if="sentSuccess" class="text-center py-10 animate-fade-in">
                    <div class="size-20 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span class="material-symbols-outlined text-4xl">check_circle</span>
                    </div>
                    <h3 class="text-2xl font-bold text-primary">Tin nhắn đã được gửi!</h3>
                    <p class="mt-2 opacity-60">Cảm ơn bạn đã liên hệ, mình sẽ trả lời sớm nhất nha.</p>
                     <button @click="sentSuccess = false" class="mt-6 text-sm font-bold text-primary underline">Gửi tin nhắn khác</button>
                </div>

                <form v-else @submit.prevent="sendMessage" class="space-y-6">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div class="space-y-2">
                            <label class="block text-sm font-bold text-primary px-2">Tên của bạn</label>
                            <input v-model="name" class="w-full bg-pastel-peach/30 border-2 border-pastel-pink focus:border-primary focus:ring-0 rounded-2xl px-5 py-4 font-body placeholder:text-pink-300 transition-all outline-none" placeholder="Your sweet name" type="text" required/>
                        </div>
                        <div class="space-y-2">
                            <label class="block text-sm font-bold text-primary px-2">Email</label>
                            <input v-model="email" class="w-full bg-pastel-peach/30 border-2 border-pastel-pink focus:border-primary focus:ring-0 rounded-2xl px-5 py-4 font-body placeholder:text-pink-300 transition-all outline-none" placeholder="your@email.com" type="email" required/>
                        </div>
                    </div>
                    <div class="space-y-2">
                        <label class="block text-sm font-bold text-primary px-2">Lời nhắn</label>
                        <textarea v-model="message" class="w-full bg-pastel-peach/30 border-2 border-pastel-pink focus:border-primary focus:ring-0 rounded-2xl px-5 py-4 font-body placeholder:text-pink-300 transition-all resize-none outline-none" placeholder="Write your magic letter here..." rows="5" required></textarea>
                    </div>
                    <button :disabled="isSubmitting" class="w-full py-5 bg-primary text-white font-bold text-xl rounded-full shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed" type="submit">
                        <span v-if="isSubmitting">Đang gửi... 🚀</span>
                        <span v-else>Gửi đi nè! <span class="material-symbols-outlined">send</span></span>
                    </button>
                </form>
            </div>

             <div class="mt-20 text-center">
                <h3 class="text-2xl font-bold text-primary/80 mb-8">Follow my adventures</h3>
                <div class="flex flex-wrap justify-center gap-8">
                     <!-- Social links from store -->
                    <a v-for="(link, platform) in contentStore.about.social" :key="platform" :href="link" target="_blank" class="group relative">
                        <div class="size-20 bg-pastel-peach rounded-full flex items-center justify-center text-primary group-hover:scale-125 transition-all duration-300 shadow-lg border-4 border-white capitalize">
                            <span v-if="platform === 'facebook'" class="material-symbols-outlined text-4xl">public</span>
                            <span v-else-if="platform === 'instagram'" class="material-symbols-outlined text-4xl">photo_camera</span>
                            <span v-else class="material-symbols-outlined text-4xl">link</span>
                        </div>
                    </a>
                </div>
            </div>
        </main>
    </div>
</template>
