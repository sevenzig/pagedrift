import type { Book, Chapter } from '$lib/types';
import { generateId } from '$lib/utils/file-validation';

export async function parsePdf(file: File): Promise<Omit<Book, 'id' | 'uploadDate'>> {
        const pdfjsLib = await import('pdfjs-dist');
        
        if (typeof window !== 'undefined') {
                pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;
        }

        const arrayBuffer = await file.arrayBuffer();
        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const pdf = await loadingTask.promise;

        const title = file.name.replace('.pdf', '');
        let fullMarkdown = '';
        const chapters: Chapter[] = [];

        const numPages = pdf.numPages;

        for (let pageNum = 1; pageNum <= numPages; pageNum++) {
                const page = await pdf.getPage(pageNum);
                const textContent = await page.getTextContent();

                const pageText = textContent.items
                        .map((item: any) => {
                                if ('str' in item) {
                                        return item.str;
                                }
                                return '';
                        })
                        .join(' ');

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

                        chapters[chapterIndex].content += `\n\n${pageText}`;
                }
        }

        chapters.forEach((chapter) => {
                const content = chapter.content.trim();
                chapter.content = content;
                fullMarkdown += `\n\n# ${chapter.title}\n\n${content}`;
        });

        return {
                title,
                author: undefined,
                format: 'pdf',
                progress: 0,
                markdown: fullMarkdown.trim(),
                chapters: chapters.filter((c) => c.content.trim().length > 0),
                lastRead: undefined,
                coverImage: undefined
        };
}
