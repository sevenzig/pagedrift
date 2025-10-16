import type { Book, Chapter } from '$lib/types';
import { generateId } from '$lib/utils/file-validation';

/**
 * Converts a canvas to base64 data URL
 */
function canvasToBase64(canvas: HTMLCanvasElement): string {
        return canvas.toDataURL('image/jpeg', 0.8);
}

/**
 * Cleans and formats PDF text for better readability
 */
function cleanPdfText(text: string): string {
        return text
                // Fix hyphenated words at line breaks
                .replace(/(\w+)-\s*\n\s*(\w+)/g, '$1$2')
                // Normalize whitespace
                .replace(/\s+/g, ' ')
                // Add proper paragraph breaks (heuristic: period followed by capital letter)
                .replace(/\.\s+([A-Z])/g, '.\n\n$1')
                // Clean up
                .trim();
}

/**
 * Detects if text looks like a heading (heuristic based on length and capitalization)
 */
function isLikelyHeading(text: string): boolean {
        const trimmed = text.trim();
        // Short text (< 60 chars), mostly uppercase or title case, no period at end
        return (
                trimmed.length > 0 &&
                trimmed.length < 60 &&
                !trimmed.endsWith('.') &&
                !trimmed.endsWith(',') &&
                (trimmed === trimmed.toUpperCase() || /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/.test(trimmed))
        );
}

export async function parsePdf(file: File): Promise<Omit<Book, 'id' | 'uploadDate'>> {
        try {
                const pdfjsLib = await import('pdfjs-dist');
                
                if (typeof window !== 'undefined') {
                        // Use a more reliable worker URL
                        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;
                }

                const arrayBuffer = await file.arrayBuffer();
                const loadingTask = pdfjsLib.getDocument({ 
                        data: arrayBuffer,
                        useSystemFonts: true,
                        disableFontFace: false
                });
                const pdf = await loadingTask.promise;

                const title = file.name.replace(/\.pdf$/i, '');
                let fullMarkdown = '';
                const chapters: Chapter[] = [];

                const numPages = pdf.numPages;

                if (numPages === 0) {
                        throw new Error('PDF file appears to be empty or corrupted');
                }

                // Try to extract cover image from first page
                let coverImage: string | undefined;
                try {
                        const firstPage = await pdf.getPage(1);
                        const viewport = firstPage.getViewport({ scale: 1.5 });
                        const canvas = document.createElement('canvas');
                        const context = canvas.getContext('2d');
                        
                        if (context) {
                                canvas.height = viewport.height;
                                canvas.width = viewport.width;
                                
                                await firstPage.render({
                                        canvasContext: context,
                                        viewport: viewport
                                }).promise;
                                
                                coverImage = canvasToBase64(canvas);
                        }
                } catch (error) {
                        console.log('Could not extract cover image from PDF');
                }

                for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                        try {
                                const page = await pdf.getPage(pageNum);
                                const textContent = await page.getTextContent();

                                // Build text with better structure detection
                                let pageText = '';
                                let lastY = 0;
                                let lastHeight = 0;
                                
                                textContent.items.forEach((item: any, index: number) => {
                                        if ('str' in item && item.str.trim()) {
                                                const currentY = item.transform[5];
                                                const currentHeight = item.height || 12;
                                                
                                                // Detect line breaks based on Y position
                                                if (index > 0) {
                                                        const yDiff = Math.abs(currentY - lastY);
                                                        
                                                        // Large vertical gap suggests paragraph break
                                                        if (yDiff > lastHeight * 1.5) {
                                                                pageText += '\n\n';
                                                        }
                                                        // Normal line break
                                                        else if (yDiff > lastHeight * 0.5) {
                                                                pageText += ' ';
                                                        }
                                                        // Same line
                                                        else {
                                                                pageText += ' ';
                                                        }
                                                }
                                                
                                                pageText += item.str;
                                                lastY = currentY;
                                                lastHeight = currentHeight;
                                        }
                                });

                                pageText = cleanPdfText(pageText);

                                if (pageText.trim()) {
                                        const chunkSize = 10;
                                        const chapterIndex = Math.floor((pageNum - 1) / chunkSize);

                                        if (!chapters[chapterIndex]) {
                                                const startPage = chapterIndex * chunkSize + 1;
                                                const endPage = Math.min(startPage + chunkSize - 1, numPages);
                                                const chapterTitle =
                                                        numPages > chunkSize
                                                                ? `Pages ${startPage}-${endPage}`
                                                                : 'Content';

                                                chapters[chapterIndex] = {
                                                        id: generateId(),
                                                        title: chapterTitle,
                                                        content: '',
                                                        level: 1,
                                                        order: chapterIndex
                                                };
                                        }

                                        // Add page marker for reference
                                        chapters[chapterIndex].content += `\n\n${pageText}\n`;
                                }
                        } catch (error) {
                                console.error(`Error parsing page ${pageNum}:`, error);
                                // Continue with other pages
                        }
                }

                // Process chapters to format as markdown
                chapters.forEach((chapter) => {
                        let content = chapter.content.trim();
                        
                        // Split into paragraphs and detect headings
                        const paragraphs = content.split(/\n\n+/);
                        const formattedParagraphs = paragraphs.map(para => {
                                const trimmed = para.trim();
                                if (isLikelyHeading(trimmed)) {
                                        return `\n\n### ${trimmed}\n`;
                                }
                                return trimmed;
                        });
                        
                        content = formattedParagraphs.join('\n\n');
                        chapter.content = content;
                        fullMarkdown += `\n\n# ${chapter.title}\n\n${content}\n\n---\n`;
                });

                const validChapters = chapters.filter((c) => c.content.trim().length > 0);
                
                if (validChapters.length === 0) {
                        throw new Error('No readable text found in PDF file');
                }

                return {
                        title,
                        author: undefined,
                        format: 'pdf',
                        progress: 0,
                        markdown: fullMarkdown.trim(),
                        chapters: validChapters,
                        lastRead: undefined,
                        coverImage
                };
        } catch (error) {
                console.error('PDF parsing error:', error);
                throw new Error(`Failed to parse PDF file: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
}
