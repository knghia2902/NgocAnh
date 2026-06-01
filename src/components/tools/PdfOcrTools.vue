<script setup lang="ts">
import { ref } from 'vue';
import { pdfOcrService } from '@/services/pdf/PdfOcrService';
import { documentConversionService } from '@/services/conversion/DocumentConversionService';
import { useToast } from '@/composables/useToast';
import FileDropzone from '@/components/ui/FileDropzone.vue';
import ConversionProgress from '@/components/ui/ConversionProgress.vue';

const activeTab = ref<'pdf' | 'ocr' | 'convert'>('pdf');
const targetFormat = ref<'docx' | 'xlsx'>('docx');
const progress = ref({ text: '', percentage: 0 });
const isProcessing = ref(false);
const previewContainer = ref<HTMLElement | null>(null);

const { addToast } = useToast();

const updateProgress = (msg: string, pct: number) => {
  progress.value = { text: msg, percentage: pct };
};

const onFileSelected = async (file: File) => {
  isProcessing.value = true;
  progress.value = { text: 'Starting...', percentage: 0 };
  
  try {
    if (activeTab.value === 'pdf' || activeTab.value === 'ocr') {
      const result = await pdfOcrService.process(file, {
        targetFormat: targetFormat.value,
        useOcr: activeTab.value === 'ocr',
        onProgress: updateProgress
      });
      
      if (result.success && result.data) {
        const blob = new Blob([result.data], { type: result.mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = result.filename;
        a.click();
        URL.revokeObjectURL(url);
        addToast('File processed successfully!', 'success');
      } else {
        addToast(result.error || 'Failed to process file', 'error');
      }
    } else if (activeTab.value === 'convert') {
      if (file.name.endsWith('.docx')) {
        const result = await documentConversionService.processDocxToPreview(file, previewContainer.value!, { onProgress: updateProgress });
        if (!result.success) throw new Error(result.error);
      } else if (file.name.endsWith('.xlsx')) {
        const result = await documentConversionService.processXlsxToPreview(file, previewContainer.value!, { onProgress: updateProgress });
        if (!result.success) throw new Error(result.error);
      } else {
        throw new Error('Unsupported file format for convert');
      }
      
      const pdfResult = await documentConversionService.exportToPdf(previewContainer.value!, file.name, { onProgress: updateProgress });
      if (pdfResult.success) {
         addToast('Converted to PDF successfully!', 'success');
      } else {
         throw new Error(pdfResult.error);
      }
    }
  } catch (error: any) {
    addToast(error.message || 'An error occurred', 'error');
  } finally {
    isProcessing.value = false;
  }
};
</script>

<template>
  <div class="bg-white/80 backdrop-blur-md rounded-[2rem] p-8 shadow-sm border border-primary/10">
    <div class="flex gap-4 border-b border-primary/10 pb-4 mb-6">
      <button 
        @click="activeTab = 'pdf'" 
        class="px-4 py-2 rounded-xl transition-colors"
        :class="activeTab === 'pdf' ? 'bg-primary/10 border border-primary font-bold text-primary' : 'hover:bg-gray-100'"
      >
        PDF Extract
      </button>
      <button 
        @click="activeTab = 'ocr'" 
        class="px-4 py-2 rounded-xl transition-colors"
        :class="activeTab === 'ocr' ? 'bg-primary/10 border border-primary font-bold text-primary' : 'hover:bg-gray-100'"
      >
        Image OCR
      </button>
      <button 
        @click="activeTab = 'convert'" 
        class="px-4 py-2 rounded-xl transition-colors"
        :class="activeTab === 'convert' ? 'bg-primary/10 border border-primary font-bold text-primary' : 'hover:bg-gray-100'"
      >
        Doc Convert
      </button>
    </div>

    <div v-if="activeTab === 'pdf' || activeTab === 'ocr'" class="mb-6 flex gap-4">
      <label class="flex items-center gap-2 cursor-pointer">
        <input type="radio" value="docx" v-model="targetFormat" /> Word (.docx)
      </label>
      <label class="flex items-center gap-2 cursor-pointer">
        <input type="radio" value="xlsx" v-model="targetFormat" /> Excel (.xlsx)
      </label>
    </div>

    <FileDropzone 
      @file-selected="onFileSelected" 
      @error="addToast($event, 'error')"
      :accept="activeTab === 'pdf' ? '.pdf' : activeTab === 'ocr' ? '.pdf,.png,.jpg,.jpeg' : '.docx,.xlsx'"
    >
      <div class="size-20 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto">
        <span class="material-symbols-outlined text-5xl">upload_file</span>
      </div>
      <div class="mt-4">
        <p class="font-bold text-primary text-lg">Upload file</p>
        <p class="text-xs opacity-50 mt-1">Maximum 15MB</p>
      </div>
    </FileDropzone>

    <div v-if="isProcessing" class="mt-6">
      <ConversionProgress :statusText="progress.text" :percentage="progress.percentage" />
    </div>

    <div ref="previewContainer" class="hidden"></div>
  </div>
</template>
