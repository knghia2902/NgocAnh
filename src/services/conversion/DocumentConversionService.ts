import { ExcelService } from '@/services/excel/ExcelService';
import { renderAsync } from 'docx-preview';
import { ConversionOptions, ConversionResult } from '@/types/conversion';

class DocumentConversionService {
    private excelService: ExcelService;
    private readonly MAX_FILE_SIZE_MB = 15;

    constructor() {
        this.excelService = new ExcelService();
    }

    validateFile(file: File): { isValid: boolean; error?: string } {
        const isValid = this.excelService.validateFileSize(file, this.MAX_FILE_SIZE_MB);
        if (!isValid) {
            return { isValid: false, error: 'File size exceeds 15MB limit' };
        }
        return { isValid: true };
    }

    async processDocxToPreview(file: File, container: HTMLElement, options?: ConversionOptions): Promise<ConversionResult> {
        try {
            const validation = this.validateFile(file);
            if (!validation.isValid) {
                return { success: false, error: validation.error };
            }

            options?.onProgress?.('Đọc file...', 0);
            const buffer = await file.arrayBuffer();

            options?.onProgress?.('Đang chuẩn bị render...', 20);
            await renderAsync(buffer, container, container, { inWrapper: false, ignoreWidth: false, ignoreHeight: false });

            options?.onProgress?.('Render preview hoàn tất', 70);
            return { success: true };
        } catch (error: any) {
            console.error('Error processing docx to preview:', error);
            return { success: false, error: error.message || 'Unknown error occurred' };
        }
    }

    async exportToPdf(container: HTMLElement, originalFilename: string, options?: ConversionOptions): Promise<ConversionResult> {
        try {
            options?.onProgress?.('Đang xuất PDF...', 70);
            const html2pdf = (await import('html2pdf.js')).default;

            const filename = originalFilename.replace(/\.[^/.]+$/, '') + '_converted.pdf';
            const opt = { 
                margin: 10, 
                filename: filename, 
                image: { type: 'jpeg', quality: 0.98 }, 
                html2canvas: { scale: 2 }, 
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' } 
            };

            await html2pdf().set(opt).from(container).save();

            options?.onProgress?.('Hoàn tất', 100);
            return { success: true, filename };
        } catch (error: any) {
            console.error('Error exporting to pdf:', error);
            return { success: false, error: error.message || 'Unknown error occurred' };
        }
    }
}

export const documentConversionService = new DocumentConversionService();