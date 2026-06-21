import * as ExcelJS from 'exceljs';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, WidthType } from 'docx';
import type { LineGroup } from '@/types/pdf';

export class DocumentBuilder {
    /**
     * Gets sorted unique X coordinate column headers using clustering
     */
    getColumnHeaders(lines: LineGroup[], clusterThreshold: number = 12): number[] {
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

        return columnClusters
            .map(cluster => cluster.reduce((sum, val) => sum + val, 0) / cluster.length)
            .sort((a, b) => a - b);
    }

    /**
     * Maps line groups to a 2D Excel string grid based on X coordinate clustering.
     */
    mapToExcelGrid(lines: LineGroup[], clusterThreshold: number = 12): string[][] {
        const columnHeaders = this.getColumnHeaders(lines, clusterThreshold);
        if (columnHeaders.length === 0) {
            return [];
        }

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
        const ExcelJSClass = (ExcelJS as any).default || ExcelJS;
        const workbook = new ExcelJSClass.Workbook();
        const worksheet = workbook.addWorksheet('Extracted Text');

        for (const row of grid) {
            worksheet.addRow(row);
        }

        const maxCols = grid.length > 0 && grid[0] ? grid[0].length : 0;
        if (maxCols > 0) {
            worksheet.columns = Array.from({ length: maxCols }, () => ({}));
            worksheet.columns.forEach((column: any) => {
                if (column && column.eachCell) {
                    let maxLength = 0;
                    column.eachCell({ includeEmpty: false }, (cell: any) => {
                        const cellValue = cell.value ? String(cell.value) : '';
                        maxLength = Math.max(maxLength, cellValue.length);
                    });
                    column.width = Math.min(maxLength + 2, 50);
                }
            });
        }

        const buffer = await workbook.xlsx.writeBuffer();
        return buffer as ArrayBuffer;
    }

    /**
     * Build word document (.docx) from Y-coordinate groups
     */
    async buildWordDocument(lines: LineGroup[]): Promise<ArrayBuffer> {
        const grid = this.mapToExcelGrid(lines, 12);
        const columnHeaders = this.getColumnHeaders(lines, 12);
        const maxCols = grid.length > 0 && grid[0] ? grid[0].length : 0;
        
        let children: any[] = [];

        if (maxCols > 1 && columnHeaders.length > 0) {
            // Render as a table with invisible borders to preserve column layout
            // A4 page width is ~8.5 inches, margins are ~1 inch each side, leaving ~6.5 inches (9360 dxa)
            const totalWidthDxa = 9360;
            
            // Calculate proportional column widths
            const rawWidths: number[] = [];
            for (let i = 0; i < columnHeaders.length; i++) {
                const currentX = columnHeaders[i]!;
                const nextX = i < columnHeaders.length - 1 ? columnHeaders[i + 1]! : (currentX + 150);
                rawWidths.push(Math.max(nextX - currentX, 20));
            }
            const totalRawWidth = rawWidths.reduce((sum, val) => sum + val, 0) || 1;
            const colWidthsDxa = rawWidths.map(w => Math.max(Math.round((w / totalRawWidth) * totalWidthDxa), 144)); // min 0.1 inch (144 dxa)

            const table = new Table({
                width: {
                    size: totalWidthDxa,
                    type: WidthType.DXA,
                },
                rows: grid.map(row => new TableRow({
                    children: row.map((cellText, cellIdx) => new TableCell({
                        width: {
                            size: colWidthsDxa[cellIdx] || Math.round(totalWidthDxa / maxCols),
                            type: WidthType.DXA,
                        },
                        children: [new Paragraph({
                            children: [
                                new TextRun({
                                    text: cellText,
                                    font: 'Times New Roman',
                                    size: 22 // 11pt
                                })
                            ]
                        })],
                        borders: {
                            top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                            bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                            left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
                            right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
                        }
                    }))
                }))
            });
            children = [table];
        } else {
            // Single column - render as standard paragraphs
            for (const line of lines) {
                const lineText = line.elements.map(e => e.text).join(' ');
                const isHeading = line.averageFontSize > 18;

                children.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: lineText,
                                size: isHeading ? 32 : 24, // 16pt vs 12pt
                                bold: isHeading
                            })
                        ],
                        spacing: { after: 120 }
                    })
                );
            }
        }

        const doc = new Document({
            sections: [{ properties: {}, children }]
        });

        const blob = await Packer.toBlob(doc);
        return await blob.arrayBuffer();
    }
}

export const documentBuilder = new DocumentBuilder();
