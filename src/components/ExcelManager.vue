<script setup lang="ts">
import { ref } from 'vue';
import { excelService } from '../services';
import type { IColumnConfig } from '../excel/types';

const tableData = ref<any[]>([]);
const tableHeaders = ref<string[]>([]);

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (target.files && target.files[0]) {
    const file = target.files[0];
    if (!file.name.match(/\.(xlsx|xls)$/)) {
        alert('Invalid file format. Please upload an Excel file.');
        return;
    }
    try {
      const data = await excelService.importData<Record<string, any>>(file);
      if (data.length > 0 && data[0]) {
        tableData.value = data;
        tableHeaders.value = Object.keys(data[0]);
      }
    } catch (error) {
      console.error('Import failed', error);
      alert('Failed to import spellbook!');
    }
  }
};

const handleExport = async () => {
  if (tableData.value.length === 0) {
    alert('No data to export!');
    return;
  }
  
  const columns: IColumnConfig[] = tableHeaders.value.map(header => ({
    header,
    key: header,
    width: 20
  }));

  try {
    await excelService.exportData(tableData.value, columns, 'magic-export');
  } catch (error) {
    console.error('Export failed', error);
    alert('Failed to cast export spell!');
  }
};
</script>

<template>
  <section class="py-10 bg-white/20 rounded-3xl border border-white/30 backdrop-blur-sm mt-10 mx-10">
    <div class="flex flex-col items-center gap-4 mb-10">
      <h2 class="text-3xl md:text-4xl font-bold text-center text-[#4a2c32] dark:text-white">Excel Magic Tool</h2>
      <div class="h-1.5 w-24 bg-primary rounded-full glow-primary"></div>
    </div>

    <div class="flex flex-col gap-8 px-10">
      <!-- Actions -->
      <div class="flex flex-wrap justify-center gap-6">
        <!-- Import -->
        <label class="group relative cursor-pointer min-w-[200px] h-14 flex items-center justify-center gap-2 rounded-full border-2 border-strawberry-cream bg-white/50 hover:bg-white text-primary font-bold text-lg transition-all shadow-sm">
          <span class="material-symbols-outlined">upload_file</span>
          <span>Open Spellbook</span>
          <input type="file" accept=".xlsx" class="hidden" @change="handleFileUpload" />
        </label>

        <!-- Export -->
        <button @click="handleExport" class="min-w-[200px] h-14 flex items-center justify-center gap-2 rounded-full bg-primary text-white font-bold text-lg glow-primary hover:scale-105 transition-transform">
          <span class="material-symbols-outlined">download</span>
          <span>Cast Export</span>
        </button>
      </div>

      <!-- Data Table -->
      <div v-if="tableData.length > 0" class="overflow-x-auto rounded-xl bg-white/60 border border-strawberry-cream/20 shadow-inner max-h-[500px]">
        <table class="w-full text-left border-collapse">
          <thead>
            <tr class="bg-primary/10 text-[#4a2c32]">
              <th v-for="header in tableHeaders" :key="header" class="p-4 font-bold border-b border-strawberry-cream/20 whitespace-nowrap">
                {{ header }}
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(row, i) in tableData" :key="i" class="hover:bg-primary/5 transition-colors border-b border-strawberry-cream/10 last:border-0">
              <td v-for="header in tableHeaders" :key="header" class="p-4 text-sm text-[#4a2c32]/80">
                {{ row[header] }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="text-center py-10 text-[#4a2c32]/50 italic">
        No magic spells loaded yet...
      </div>
    </div>
  </section>
</template>
