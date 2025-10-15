import type { Book, Chapter } from '$lib/types';
import { generateId } from '$lib/utils/file-validation';

export async function parseMobi(file: File): Promise<Omit<Book, 'id' | 'uploadDate'>> {
	const arrayBuffer = await file.arrayBuffer();
	const dataView = new DataView(arrayBuffer);

	const title = file.name.replace('.mobi', '');

	const textDecoder = new TextDecoder('utf-8');
	const text = textDecoder.decode(arrayBuffer);

	const cleanText = text
		.replace(/[\x00-\x1F\x7F-\x9F]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();

	const paragraphs = cleanText.split(/\s{2,}/).filter((p) => p.length > 50);

	const chunkSize = Math.ceil(paragraphs.length / 10) || 1;
	const chapters: Chapter[] = [];
	let fullMarkdown = '';

	for (let i = 0; i < paragraphs.length; i += chunkSize) {
		const chapterParagraphs = paragraphs.slice(i, i + chunkSize);
		const chapterContent = chapterParagraphs.join('\n\n');
		const chapterNum = Math.floor(i / chunkSize) + 1;
		const chapterTitle = `Chapter ${chapterNum}`;

		const chapter: Chapter = {
			id: generateId(),
			title: chapterTitle,
			content: chapterContent,
			level: 1,
			order: chapterNum - 1
		};

		chapters.push(chapter);
		fullMarkdown += `\n\n# ${chapterTitle}\n\n${chapterContent}`;
	}

	return {
		title,
		author: undefined,
		format: 'mobi',
		progress: 0,
		markdown: fullMarkdown.trim(),
		chapters: chapters.filter((c) => c.content.length > 0),
		lastRead: undefined,
		coverImage: undefined
	};
}
