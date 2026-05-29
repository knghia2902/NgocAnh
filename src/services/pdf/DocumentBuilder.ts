import * as ExcelJS from 'exceljs';
import { Document, Packer, Paragraph, TextRun } from 'docx';
import type { LineGroup } from '@/types/pdf';

export class DocumentBuilder {
    /**
     * Maps line groups to a 2D Excel string grid based on X coordinate clustering.
     */
    mapToExcelGrid(lines: LineGroup[], clusterThreshold: number = 12): string[][] {
        const xCoordinates: number[] = [];
        for (const line of lines) {
            for (const el of line.elements) {
                xCoordinates.push(el.x);
            }
        }

        if (xCoordinates.length === 0) {
            return [];
        }

        xCoordinates.sort((a, b) => a - b);

        const columnClusters: number[][] = [];
        for (const x of xCoordinates) {
            let added = false;
            for (const cluster of columnClusters) {
                const avg = cluster.reduce((sum, val) => sum + val, 0) / cluster.length;
                if (Math.abs(x - avg) < clusterThreshold) {
                    cluster.push(x);
                    added = true;
                    break;
                }
            }
            if (!added) {
                columnClusters.push([x]);
            }
        }

        const columnHeaders = columnClusters
            .map(cluster => cluster.reduce((sum, val) => sum + val, 0) / cluster.length)
            .sort((a, b) => a - b);

        const grid: string[][] = [];
        for (const line of lines) {
            const row = Array(columnHeaders.length).fill('');
            for (const el of line.elements) {
                let closestIdx = 0;
                let minDiff = Infinity;
                for (let i = 0; i < columnHeaders.length; i++) {
                    const diff = Math.abs(el.x - columnHeaders[i]!);
                    if (diff < minDiff) {
                        minDiff = diff;
                        closestIdx = i;
                    }
                }
                row[closestIdx] = row[closestIdx]
                    ? (row[closestIdx] + ' ' + el.text).trim()
                    : el.text;
            }
            grid.push(row);
        }

        return grid;
    }

    /**
     * Build excel file from LineGroups
     */
    async buildExcelDocument(lines: LineGroup[]): Promise<ArrayBuffer> {
        const grid = this.mapToExcelGrid(lines, 12);
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Extracted Text');

        for (const row of grid) {
            worksheet.addRow(row);
        }

        worksheet.columns.forEach(column => {
            if (column && column.eachCell) {
                let maxLength = 0;
                column.eachCell({ includeEmpty: false }, cell => {
                    const cellValue = cell.value ? String(cell.value) : '';
                    maxLength = Math.max(maxLength, cellValue.length);
                });
                column.width = Math.min(maxLength + 2, 50);
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        
        // exceljs in Node returns Buffer, in browser returns ArrayBuffer.
        // Convert Buffer to ArrayBuffer safely:
        if (typeof Buffer !== 'undefined' && Buffer.isBuffer(buffer)) {
            return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
        }
        return buffer as ArrayBuffer;
    }
}

export const documentBuilder = new DocumentBuilder();
