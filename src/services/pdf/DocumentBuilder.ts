import * as ExcelJS from 'exceljs';
import { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, BorderStyle, WidthType, PageBreak } from 'docx';
import type { LineGroup, TextElement } from '@/types/pdf';

interface ColInterval {
    minX: number;
    maxX: number;
}

export class DocumentBuilder {
    /**
     * Merges elements on the same line that are close to each other
     */
    mergeCloseElements(lines: LineGroup[]): LineGroup[] {
        const mergedLines: LineGroup[] = [];
        
        for (const line of lines) {
            if (line.elements.length <= 1) {
                mergedLines.push(line);
                continue;
            }
            
            // Sort elements left-to-right
            const sorted = [...line.elements].sort((a, b) => a.x - b.x);
            const mergedElements: TextElement[] = [];
            let current = { ...sorted[0]! };
            
            for (let i = 1; i < sorted.length; i++) {
                const next = sorted[i]!;
                const gap = next.x - (current.x + current.width);
                const threshold = 1.0 * Math.max(current.fontSize, next.fontSize);
                
                if (gap < threshold) {
                    current.text = (current.text + ' ' + next.text).trim();
                    current.width = (next.x + next.width) - current.x;
                    current.height = Math.max(current.height, next.height);
                    current.fontSize = Math.max(current.fontSize, next.fontSize);
                } else {
                    mergedElements.push(current);
                    current = { ...next };
                }
            }
            mergedElements.push(current);
            
            mergedLines.push({
                y: line.y,
                averageFontSize: line.averageFontSize,
                elements: mergedElements
            });
        }
        
        return mergedLines;
    }

    /**
     * Detects column boundaries using header-anchored gap-voting from RAW elements.
     */
    detectColumnBoundaries(lines: LineGroup[]): number[] {
        const intervals = this.detectColumnIntervals(lines);
        if (intervals.length < 2) return [];

        // Find header block indices for gap-voting to exclude header rows from gap collection
        let mainHeaderIdx = -1;
        let maxElements = 0;
        const searchLimit = Math.min(10, lines.length);
        for (let i = 0; i < searchLimit; i++) {
            if (lines[i]!.elements.length > maxElements) {
                maxElements = lines[i]!.elements.length;
                mainHeaderIdx = i;
            }
        }

        let minHeaderIdx = mainHeaderIdx;
        let maxHeaderIdx = mainHeaderIdx;
        if (mainHeaderIdx !== -1 && maxElements > 2) {
            // Grow header block upward
            for (let i = mainHeaderIdx - 1; i >= 0; i--) {
                const line = lines[i]!;
                if (line.elements.length === 0 || this.checkPhysicalOverlap(line, lines[mainHeaderIdx]!)) {
                    break;
                }
                minHeaderIdx = i;
            }
            // Grow header block downward
            for (let i = mainHeaderIdx + 1; i < lines.length; i++) {
                const line = lines[i]!;
                if (line.elements.length === 0) break;
                const isSmallCount = line.elements.length <= Math.max(2, Math.floor(maxElements * 0.4));
                if (!isSmallCount) break;
                let overlapsWithHeader = false;
                for (let h = minHeaderIdx; h <= maxHeaderIdx; h++) {
                    if (this.checkPhysicalOverlap(line, lines[h]!)) {
                        overlapsWithHeader = true;
                        break;
                    }
                }
                if (!overlapsWithHeader) break;
                maxHeaderIdx = i;
            }
        }

        // Define gap regions between adjacent header columns
        const gapRegions: { left: number; right: number; fallback: number }[] = [];
        for (let i = 0; i < intervals.length - 1; i++) {
            gapRegions.push({
                left: intervals[i]!.maxX,
                right: intervals[i + 1]!.minX,
                fallback: (intervals[i]!.maxX + intervals[i + 1]!.minX) / 2
            });
        }

        // Collect data row gaps and match to gap regions
        const matchedGaps: { leftRight: number; rightLeft: number }[][] = gapRegions.map(() => []);
        const TOLERANCE = 5;

        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            if (lineIdx >= minHeaderIdx && lineIdx <= maxHeaderIdx) continue;
            const line = lines[lineIdx]!;
            if (line.elements.length < 2) continue;

            const sorted = [...line.elements].sort((a, b) => a.x - b.x);
            for (let j = 1; j < sorted.length; j++) {
                const leftRight = sorted[j - 1]!.x + sorted[j - 1]!.width;
                const rightLeft = sorted[j]!.x;
                if (rightLeft <= leftRight) continue;
                const gapCenter = (leftRight + rightLeft) / 2;

                for (let g = 0; g < gapRegions.length; g++) {
                    if (gapCenter >= gapRegions[g]!.left - TOLERANCE && gapCenter <= gapRegions[g]!.right + TOLERANCE) {
                        const leftHeaderCenter = (intervals[g]!.minX + intervals[g]!.maxX) / 2;
                        const rightHeaderCenter = (intervals[g + 1]!.minX + intervals[g + 1]!.maxX) / 2;
                        const crossingThreshold = (leftHeaderCenter + rightHeaderCenter) / 2;
                        const leftElemCenter = sorted[j - 1]!.x + sorted[j - 1]!.width / 2;

                        if (leftElemCenter < crossingThreshold) {
                            matchedGaps[g]!.push({ leftRight, rightLeft });
                        }
                        break;
                    }
                }
            }
        }

        const boundaries: number[] = [];
        for (let g = 0; g < gapRegions.length; g++) {
            const edges = matchedGaps[g]!;
            if (edges.length > 0) {
                const maxLeftRight = Math.max(...edges.map(e => e.leftRight));
                const minRightLeft = Math.min(...edges.map(e => e.rightLeft));
                boundaries.push((maxLeftRight + minRightLeft) / 2);
            } else {
                boundaries.push(gapRegions[g]!.fallback);
            }
        }

        return boundaries;
    }

    /**
     * Column-aware merge: prevent merging elements across column boundaries
     */
    mergeWithBoundaries(lines: LineGroup[], boundaries: number[]): LineGroup[] {
        const mergedLines: LineGroup[] = [];
        for (const line of lines) {
            if (line.elements.length <= 1) {
                mergedLines.push(line);
                continue;
            }
            const sorted = [...line.elements].sort((a, b) => a.x - b.x);
            const mergedElements: TextElement[] = [];
            let current = { ...sorted[0]! };
            for (let i = 1; i < sorted.length; i++) {
                const next = sorted[i]!;
                const gap = next.x - (current.x + current.width);
                const threshold = 1.0 * Math.max(current.fontSize, next.fontSize);
                
                // Check if a boundary falls between elements
                const curRight = current.x + current.width;
                const nextLeft = next.x;
                let crossesBoundary = false;
                for (const b of boundaries) {
                    if (b > curRight - 1 && b < nextLeft + 1) {
                        crossesBoundary = true;
                        break;
                    }
                }
                
                if (gap < threshold && !crossesBoundary) {
                    current.text = (current.text + ' ' + next.text).trim();
                    current.width = (next.x + next.width) - current.x;
                    current.height = Math.max(current.height, next.height);
                    current.fontSize = Math.max(current.fontSize, next.fontSize);
                } else {
                    mergedElements.push(current);
                    current = { ...next };
                }
            }
            mergedElements.push(current);
            mergedLines.push({
                y: line.y,
                averageFontSize: line.averageFontSize,
                elements: mergedElements
            });
        }
        return mergedLines;
    }

    /**
     * Map elements to grid using boundaries
     */
    mapWithBoundaries(lines: LineGroup[], boundaries: number[]): string[][] {
        const numCols = boundaries.length + 1;
        const grid: string[][] = [];
        for (const line of lines) {
            const row = Array(numCols).fill('');
            for (const el of line.elements) {
                const startX = el.x;
                const endX = el.x + el.width;
                let bestIdx = 0;
                let bestOv = 0;
                for (let i = 0; i < numCols; i++) {
                    const lo = i === 0 ? 0 : boundaries[i - 1]!;
                    const hi = i === numCols - 1 ? Infinity : boundaries[i]!;
                    const ov = Math.max(0, Math.min(endX, hi) - Math.max(startX, lo));
                    if (ov > bestOv) {
                        bestOv = ov;
                        bestIdx = i;
                    }
                }
                row[bestIdx] = row[bestIdx] ? (row[bestIdx] + ' ' + el.text).trim() : el.text;
            }
            grid.push(row);
        }
        return grid;
    }

    /**
     * Detects column intervals based on overlapping text spans on multi-element rows, excluding titles.
     */
    private detectColumnIntervals(lines: LineGroup[]): ColInterval[] {
        // Exclude title lines from contributing to column headers if possible
        let mainHeaderIdx = -1;
        let maxElements = 0;
        const searchLimit = Math.min(10, lines.length);

        for (let i = 0; i < searchLimit; i++) {
            const line = lines[i]!;
            if (line.elements.length > maxElements) {
                maxElements = line.elements.length;
                mainHeaderIdx = i;
            }
        }

        let minHeaderIdx = -1;
        let maxHeaderIdx = -1;
        if (mainHeaderIdx !== -1 && maxElements > 2) {
            minHeaderIdx = mainHeaderIdx;
            maxHeaderIdx = mainHeaderIdx;
            // Grow header block upward
            for (let i = mainHeaderIdx - 1; i >= 0; i--) {
                const line = lines[i]!;
                if (line.elements.length === 0) {
                    break;
                }
                if (this.checkPhysicalOverlap(line, lines[mainHeaderIdx]!)) {
                    break;
                }
                minHeaderIdx = i;
            }
            // Grow header block downward
            for (let i = mainHeaderIdx + 1; i < lines.length; i++) {
                const line = lines[i]!;
                if (line.elements.length === 0) {
                    break;
                }
                const isSmallCount = line.elements.length <= Math.max(2, Math.floor(maxElements * 0.4));
                if (!isSmallCount) {
                    break;
                }
                let overlapsWithHeader = false;
                for (let h = minHeaderIdx; h <= maxHeaderIdx; h++) {
                    if (this.checkPhysicalOverlap(line, lines[h]!)) {
                        overlapsWithHeader = true;
                        break;
                    }
                }
                if (!overlapsWithHeader) {
                    break;
                }
                maxHeaderIdx = i;
            }
        }

        let colElements: TextElement[] = [];
        if (minHeaderIdx !== -1 && maxHeaderIdx !== -1) {
            for (let i = minHeaderIdx; i <= maxHeaderIdx; i++) {
                const line = lines[i]!;
                colElements.push(...line.elements);
            }
        } else {
            for (const line of lines) {
                if (line.elements.length > 1) {
                    colElements.push(...line.elements);
                }
            }
        }

        // Fallback if no elements collected
        if (colElements.length === 0) {
            for (const line of lines) {
                colElements.push(...line.elements);
            }
        }

        // Build disjoint intervals by merging overlapping element ranges with padding = 0 (using a sorted interval merge)
        const rawRanges = colElements.map(el => ({
            minX: el.x,
            maxX: el.x + el.width
        })).sort((a, b) => a.minX - b.minX);

        const intervals: ColInterval[] = [];
        if (rawRanges.length > 0) {
            let current = { ...rawRanges[0]! };
            for (let i = 1; i < rawRanges.length; i++) {
                const next = rawRanges[i]!;
                const overlap = Math.max(0, Math.min(current.maxX, next.maxX) - Math.max(current.minX, next.minX));
                const isDuplicate = (next.maxX - next.minX) - overlap < 2 || (current.maxX - current.minX) - overlap < 2;
                
                if (next.minX < current.maxX && (overlap > 5 || isDuplicate)) {
                    current.maxX = Math.max(current.maxX, next.maxX);
                } else {
                    intervals.push(current);
                    current = { ...next };
                }
            }
            intervals.push(current);
        }

        intervals.sort((a, b) => a.minX - b.minX);
        return intervals;
    }

    /**
     * Gets sorted unique X coordinate column headers using interval detection
     */
    getColumnHeaders(lines: LineGroup[], _clusterThreshold: number = 12): number[] {
        const intervals = this.detectColumnIntervals(lines);
        return intervals.map(inv => (inv.minX + inv.maxX) / 2);
    }

    /**
     * Maps line groups to a 2D Excel string grid based on interval detection.
     */
    mapToExcelGrid(lines: LineGroup[], _clusterThreshold: number = 12): string[][] {
        const boundaries = this.detectColumnBoundaries(lines);
        if (boundaries.length === 0) {
            const intervals = this.detectColumnIntervals(lines);
            if (intervals.length === 0) {
                return [];
            }

            const grid: string[][] = [];
            for (const line of lines) {
                const row = Array(intervals.length).fill('');
                for (const el of line.elements) {
                    const startX = el.x;
                    const endX = el.x + el.width;

                    let closestIdx = 0;
                    let maxOverlap = 0;

                    for (let i = 0; i < intervals.length; i++) {
                        const colMinX = i === 0 ? 0 : (intervals[i - 1]!.maxX + intervals[i]!.minX) / 2;
                        const colMaxX = i === intervals.length - 1 ? Infinity : (intervals[i]!.maxX + intervals[i + 1]!.minX) / 2;

                        const overlap = Math.max(0, Math.min(endX, colMaxX) - Math.max(startX, colMinX));
                        if (overlap > maxOverlap) {
                            maxOverlap = overlap;
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

        return this.mapWithBoundaries(lines, boundaries);
    }

    private checkPhysicalOverlap(rowA: LineGroup, rowB: LineGroup): boolean {
        for (const elA of rowA.elements) {
            const startA = elA.x;
            const endA = elA.x + elA.width;
            
            for (const elB of rowB.elements) {
                const startB = elB.x;
                const endB = elB.x + elB.width;
                
                const overlapStart = Math.max(startA, startB);
                const overlapEnd = Math.min(endA, endB);
                
                if (overlapStart < overlapEnd - 2) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Build excel file from LineGroups (supports single-page LineGroup[] or multi-page LineGroup[][])
     */
    async buildExcelDocument(rawLines: LineGroup[] | LineGroup[][]): Promise<ArrayBuffer> {
        // Convert to 2D array of page lines
        const pagesLines: LineGroup[][] = (rawLines.length === 0 || (rawLines[0] && 'elements' in rawLines[0]))
            ? [rawLines as LineGroup[]]
            : rawLines as LineGroup[][];

        const ExcelJSClass = (ExcelJS as any).default || ExcelJS;
        const workbook = new ExcelJSClass.Workbook();
        const worksheet = workbook.addWorksheet('Extracted Text');

        let maxCols = 0;

        for (let p = 0; p < pagesLines.length; p++) {
            const pageLines = pagesLines[p]!;
            if (pageLines.length === 0) continue;

            const startRowIdx = worksheet.rowCount + 1;

            if (p > 0) {
                // Add blank rows and page header to separate pages in a single sheet
                worksheet.addRow([]);
                worksheet.addRow([`--- Page ${p + 1} ---`]);
                worksheet.addRow([]);
            }

            const gridStartRowIdx = worksheet.rowCount + 1;

            // 1. Merge close elements and map to grid using boundary detection
            const boundaries = this.detectColumnBoundaries(pageLines);
            let lines: LineGroup[];
            let grid: string[][];

            if (boundaries.length > 0) {
                lines = this.mergeWithBoundaries(pageLines, boundaries);
                grid = this.mapWithBoundaries(lines, boundaries);
            } else {
                lines = this.mergeCloseElements(pageLines);
                grid = this.mapToExcelGrid(lines, 25);
            }

            for (const row of grid) {
                worksheet.addRow(row);
                maxCols = Math.max(maxCols, row.length);
            }

            const gridEndRowIdx = worksheet.rowCount;

            // 2. Local Header & Title Detection for this page using lines array (restricted to first 10 rows to avoid data rows with high element counts)
            let mainHeaderIdx = -1;
            let maxElements = 0;
            const searchLimit = Math.min(10, lines.length);

            for (let i = 0; i < searchLimit; i++) {
                const line = lines[i]!;
                if (line.elements.length > maxElements) {
                    maxElements = line.elements.length;
                    mainHeaderIdx = i;
                }
            }

            let minHeaderIdx = -1;
            let maxHeaderIdx = -1;

            if (mainHeaderIdx !== -1 && maxElements > 2) {
                minHeaderIdx = mainHeaderIdx;
                maxHeaderIdx = mainHeaderIdx;

                // Grow header block upward
                for (let i = mainHeaderIdx - 1; i >= 0; i--) {
                    const line = lines[i]!;
                    if (line.elements.length === 0) {
                        break;
                    }
                    if (this.checkPhysicalOverlap(line, lines[mainHeaderIdx]!)) {
                        break;
                    }
                    minHeaderIdx = i;
                }

                // Grow header block downward
                for (let i = mainHeaderIdx + 1; i < lines.length; i++) {
                    const line = lines[i]!;
                    if (line.elements.length === 0) {
                        break;
                    }

                    // Must have a small number of elements to be a split header
                    const isSmallCount = line.elements.length <= Math.max(2, Math.floor(maxElements * 0.4));
                    if (!isSmallCount) {
                        break;
                    }

                    // Must physically overlap with at least one row already in the header block
                    let overlapsWithHeader = false;
                    for (let h = minHeaderIdx; h <= maxHeaderIdx; h++) {
                        if (this.checkPhysicalOverlap(line, lines[h]!)) {
                            overlapsWithHeader = true;
                            break;
                        }
                    }

                    if (!overlapsWithHeader) {
                        break;
                    }

                    maxHeaderIdx = i;
                }
            }

            // Convert lines indices to worksheet row indices
            const wsMinHeaderIdx = minHeaderIdx !== -1 ? gridStartRowIdx + minHeaderIdx : -1;
            const wsMaxHeaderIdx = maxHeaderIdx !== -1 ? gridStartRowIdx + maxHeaderIdx : -1;

            // 3. Perform local merging for this page
            if (wsMinHeaderIdx !== -1 && wsMaxHeaderIdx !== -1) {
                // Merge Title Rows
                for (let r = gridStartRowIdx; r < wsMinHeaderIdx; r++) {
                    const row = worksheet.getRow(r);
                    const values: string[] = [];
                    row.eachCell({ includeEmpty: false }, (cell: any) => {
                        const val = cell.value;
                        if (val !== null && val !== undefined && String(val).trim() !== '') {
                            values.push(String(val).trim());
                        }
                    });

                    if (values.length > 0) {
                        const titleVal = values.join(' ');
                        row.eachCell({ includeEmpty: true }, (cell: any) => {
                            cell.value = null;
                        });

                        const firstCell = row.getCell(1);
                        firstCell.value = titleVal;
                        firstCell.font = { name: 'Arial', size: 12, bold: true };
                        firstCell.alignment = { horizontal: 'center', vertical: 'middle' };
                        try {
                            worksheet.mergeCells(r, 1, r, maxCols);
                        } catch (e) {
                            // ignore
                        }
                    }
                }

                // Merge contiguous multi-row headers vertically
                if (wsMaxHeaderIdx > wsMinHeaderIdx) {
                    for (let c = 1; c <= maxCols; c++) {
                        const values: string[] = [];
                        for (let r = wsMinHeaderIdx; r <= wsMaxHeaderIdx; r++) {
                            const val = worksheet.getRow(r).getCell(c).value;
                            if (val !== null && val !== undefined && String(val).trim() !== '') {
                                values.push(String(val).trim());
                            }
                        }

                        for (let r = wsMinHeaderIdx; r <= wsMaxHeaderIdx; r++) {
                            worksheet.getRow(r).getCell(c).value = null;
                        }

                        if (values.length > 0) {
                            const joinedValue = values.join('\n');
                            const topCell = worksheet.getRow(wsMinHeaderIdx).getCell(c);
                            topCell.value = joinedValue;

                            try {
                                worksheet.mergeCells(wsMinHeaderIdx, c, wsMaxHeaderIdx, c);
                            } catch (e) {
                                // ignore
                            }
                        }
                    }
                }
            }

            // 4. Apply styles locally to this page
            for (let r = gridStartRowIdx; r <= gridEndRowIdx; r++) {
                const row = worksheet.getRow(r);
                const isHeaderRow = wsMinHeaderIdx !== -1 && r >= wsMinHeaderIdx && r <= wsMaxHeaderIdx;
                const isTitleRow = wsMinHeaderIdx !== -1 && r < wsMinHeaderIdx;
                const isDataRow = wsMaxHeaderIdx !== -1 && r > wsMaxHeaderIdx;

                if (isHeaderRow) {
                    // Header style
                    row.eachCell({ includeEmpty: true }, (cell: any) => {
                        cell.font = { name: 'Arial', size: 10, bold: true };
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFF2F2F2' }
                        };
                        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        };
                    });
                } else if (isTitleRow) {
                    // Title style
                    row.eachCell({ includeEmpty: true }, (cell: any) => {
                        cell.font = { name: 'Arial', size: 12, bold: true };
                        cell.alignment = { horizontal: 'center', vertical: 'middle' };
                    });
                } else if (isDataRow) {
                    // Data style
                    row.eachCell({ includeEmpty: true }, (cell: any) => {
                        cell.font = { name: 'Arial', size: 10 };
                        cell.border = {
                            top: { style: 'thin' },
                            left: { style: 'thin' },
                            bottom: { style: 'thin' },
                            right: { style: 'thin' }
                        };
                    });
                } else {
                    row.eachCell({ includeEmpty: true }, (cell: any) => {
                        cell.font = { name: 'Arial', size: 10 };
                    });
                }
            }

            // Style page separator if p > 0
            if (p > 0) {
                const sepRow = worksheet.getRow(startRowIdx + 1);
                sepRow.eachCell({ includeEmpty: true }, (cell: any) => {
                    cell.font = { name: 'Arial', size: 10, italic: true, bold: true };
                    cell.alignment = { horizontal: 'center' };
                });
            }
        }

        if (maxCols > 0) {
            worksheet.columns = Array.from({ length: maxCols }, () => ({}));
            worksheet.columns.forEach((column: any) => {
                if (column && column.eachCell) {
                    let maxLength = 0;
                    column.eachCell({ includeEmpty: false }, (cell: any) => {
                        const cellValue = cell.value ? String(cell.value) : '';
                        maxLength = Math.max(maxLength, cellValue.length);
                    });
                    column.width = Math.min(Math.max(maxLength + 2, 10), 50);
                }
            });
        }

        const buffer = await workbook.xlsx.writeBuffer();
        if (buffer instanceof ArrayBuffer) {
            return buffer;
        }
        // Safely convert Node Buffer to ArrayBuffer
        return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    }

    /**
     * Build word document (.docx) from Y-coordinate groups using contiguous table blocks (supports single-page or multi-page)
     */
    async buildWordDocument(rawLines: LineGroup[] | LineGroup[][]): Promise<ArrayBuffer> {
        // Convert to 2D array of page lines
        const pagesLines: LineGroup[][] = (rawLines.length === 0 || (rawLines[0] && 'elements' in rawLines[0]))
            ? [rawLines as LineGroup[]]
            : rawLines as LineGroup[][];

        let children: any[] = [];

        for (let p = 0; p < pagesLines.length; p++) {
            const pageLines = pagesLines[p]!;
            if (pageLines.length === 0) continue;

            if (p > 0) {
                // Add page break between pages
                children.push(new Paragraph({ children: [new PageBreak()] }));
            }

            // 1. Merge close elements on the same line
            const boundaries = this.detectColumnBoundaries(pageLines);
            let lines: LineGroup[];
            if (boundaries.length > 0) {
                lines = this.mergeWithBoundaries(pageLines, boundaries);
            } else {
                lines = this.mergeCloseElements(pageLines);
            }
            
            // Group lines into blocks of:
            // - Single column (Paragraph)
            // - Multi-column contiguous lines (Table)
            let currentTableBlock: LineGroup[] = [];

            const renderTableBlock = (tableLines: LineGroup[]) => {
                if (tableLines.length === 0) return;
                
                let grid: string[][];
                let columnHeaders: number[];

                if (boundaries.length > 0) {
                    grid = this.mapWithBoundaries(tableLines, boundaries);
                    const intervals = this.detectColumnIntervals(pageLines);
                    columnHeaders = intervals.map(inv => (inv.minX + inv.maxX) / 2);
                } else {
                    grid = this.mapToExcelGrid(tableLines, 25);
                    columnHeaders = this.getColumnHeaders(tableLines, 25);
                }
                const maxCols = grid.length > 0 && grid[0] ? grid[0].length : 0;
                
                if (maxCols > 1 && columnHeaders.length > 0) {
                    const totalWidthDxa = 9360; // 6.5 inches (printable area)
                    
                    // Calculate proportional column widths
                    const rawWidths: number[] = [];
                    for (let i = 0; i < columnHeaders.length; i++) {
                        const currentX = columnHeaders[i]!;
                        const nextX = i < columnHeaders.length - 1 ? columnHeaders[i + 1]! : (currentX + 150);
                        rawWidths.push(Math.max(nextX - currentX, 20));
                    }
                    const totalRawWidth = rawWidths.reduce((sum, val) => sum + val, 0) || 1;
                    const colWidthsDxa = rawWidths.map(w => Math.max(Math.round((w / totalRawWidth) * totalWidthDxa), 144));
                    
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
                    
                    children.push(table);
                } else {
                    // Fallback to standard paragraphs
                    for (const line of tableLines) {
                        renderParagraphBlock(line);
                    }
                }
            };

            const renderParagraphBlock = (line: LineGroup) => {
                const lineText = line.elements.map(e => e.text).join(' ');
                const isHeading = line.averageFontSize > 18;
                children.push(
                    new Paragraph({
                        children: [
                            new TextRun({
                                text: lineText,
                                size: isHeading ? 32 : 24, // 16pt vs 12pt
                                bold: isHeading,
                                font: 'Times New Roman'
                            })
                        ],
                        spacing: { after: 120 }
                    })
                );
            };

            for (const line of lines) {
                const isMultiColumn = line.elements.length > 1;
                
                if (isMultiColumn) {
                    currentTableBlock.push(line);
                } else {
                    // If we hit a single column line, render any accumulated table block first
                    if (currentTableBlock.length > 0) {
                        renderTableBlock(currentTableBlock);
                        currentTableBlock = [];
                    }
                    renderParagraphBlock(line);
                }
            }

            // Render any remaining table block
            if (currentTableBlock.length > 0) {
                renderTableBlock(currentTableBlock);
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
