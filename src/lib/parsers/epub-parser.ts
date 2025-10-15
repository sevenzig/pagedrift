import ePub from 'epubjs';
import TurndownService from 'turndown';
import type { Book, Chapter } from '$lib/types';
import { generateId } from '$lib/utils/file-validation';

const turndownService = new TurndownService({
        headingStyle: 'atx',
        codeBlockStyle: 'fenced'
});

export async function parseEpub(file: File): Promise<Omit<Book, 'id' | 'uploadDate'>> {
        const arrayBuffer = await file.arrayBuffer();
        const book = ePub(arrayBuffer);

        await book.ready;

        const metadata = await book.loaded.metadata;
        const navigation = await book.loaded.navigation;

        const title = metadata.title || file.name.replace('.epub', '');
        const author = metadata.creator || undefined;

        const chapters: Chapter[] = [];
        let fullMarkdown = '';

        const spine = await book.loaded.spine;
        const spineItems = (spine as any).items;

        for (let i = 0; i < spineItems.length; i++) {
                const item = spineItems[i];
                try {
                        const doc: any = await book.load(item.href);
                        const content = doc.body || doc.documentElement;
                        const html = content.innerHTML;
                        const markdown = turndownService.turndown(html);

                        const chapterTitle =
                                navigation.toc[i]?.label || item.id || `Chapter ${i + 1}`;

                        const chapter: Chapter = {
                                id: generateId(),
                                title: chapterTitle,
                                content: markdown,
                                level: 1,
                                order: i
                        };

                        chapters.push(chapter);
                        fullMarkdown += `\n\n# ${chapterTitle}\n\n${markdown}`;
                } catch (error) {
                        console.error(`Error parsing chapter ${i}:`, error);
                }
        }

        return {
                title,
                author,
                format: 'epub',
                progress: 0,
                markdown: fullMarkdown.trim(),
                chapters,
                lastRead: undefined,
                coverImage: undefined
        };
}
