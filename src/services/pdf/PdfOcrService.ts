import * as pdfjsLib from 'pdfjs-dist';
import type { PdfOcrOptions, PdfOcrResult, TextElement } from '@/types/pdf';
import { coordinateSorter } from './CoordinateSorter';

export class PdfOcrService {
    private static PDF_WORKER_VERSION = '5.7.284';

    constructor() {
        // Initialize if necessary
    }

    /**
     * Parse digital PDF file or run OCR if requested, then build the target document
     */
    async process(file: File, options: PdfOcrOptions): Promise<PdfOcrResult> {
        try {
            // Configure PDF.js worker CDN route
            pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PdfOcrService.PDF_WORKER_VERSION}/pdf.worker.min.mjs`;

            const pdfBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({ data: pdfBuffer });
            const pdf = await loadingTask.promise;
            
            const allElements: TextElement[] = [];

            // Extract digital text page by page
            for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();
                
                for (const item of textContent.items) {
                    if ('str' in item) {
                        const transform = item.transform;
                        allElements.push({
                            text: item.str,
                            x: transform[4],
                            y: transform[5],
                            width: item.width || 0,
                            height: item.height || 0,
                            fontSize: Math.abs(transform[3])
                        });
                    }
                }
            }

            // Group elements using CoordinateSorter to ensure alignment/sorting logic runs
            const lines = coordinateSorter.groupElementsByY(allElements);

            // Report progress completion
            if (options.onProgress) {
                options.onProgress('Digital text parsed successfully', 100);
            }

            // Target metadata
            const filename = file.name.replace(/\.[^/.]+$/, '') + `.${options.targetFormat}`;
            const mimeType = options.targetFormat === 'docx'
                ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

            return {
                success: true,
                filename,
                mimeType,
                data: new ArrayBuffer(0) // Placeholders for builders implemented in Wave 3
            };

        } catch (error) {
            console.error('PDF/OCR Processing failed:', error);
            return {
                success: false,
                filename: '',
                mimeType: '',
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
}

export const pdfOcrService = new PdfOcrService();
