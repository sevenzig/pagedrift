import type { Book, Chapter } from '$lib/types';
import { generateId } from '$lib/utils/file-validation';

/**
 * Cleans and formats MOBI text for better readability
 */
function cleanMobiText(text: string): string {
	return text
		// Remove control characters but preserve newlines
		.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
		// Fix multiple spaces
		.replace(/ {2,}/g, ' ')
		// Normalize line breaks
		.replace(/\r\n/g, '\n')
		.replace(/\r/g, '\n')
		// Remove excessive blank lines
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

/**
 * Detects if text looks like a heading
 */
function isLikelyHeading(text: string): boolean {
	const trimmed = text.trim();
	return (
		trimmed.length > 0 &&
		trimmed.length < 60 &&
		!trimmed.endsWith('.') &&
		!trimmed.endsWith(',') &&
		(trimmed === trimmed.toUpperCase() || /^[A-Z][a-z]+(\s+[A-Z][a-z]+)*$/.test(trimmed))
	);
}

/**
 * Formats paragraphs with proper markdown
 */
function formatParagraphs(paragraphs: string[]): string {
	return paragraphs
		.map(para => {
			const trimmed = para.trim();
			if (!trimmed) return '';
			
			// Check if it's a heading
			if (isLikelyHeading(trimmed)) {
				return `\n### ${trimmed}\n`;
			}
			
			return trimmed;
		})
		.filter(p => p.length > 0)
		.join('\n\n');
}

export async function parseMobi(file: File): Promise<Omit<Book, 'id' | 'uploadDate'>> {
	try {
		const arrayBuffer = await file.arrayBuffer();

		const title = file.name.replace(/\.mobi$/i, '');

		// Try different encodings for better text extraction
		let text = '';
		try {
			const textDecoder = new TextDecoder('utf-8');
			text = textDecoder.decode(arrayBuffer);
		} catch (error) {
			// Fallback to latin-1 if utf-8 fails
			const textDecoder = new TextDecoder('latin-1');
			text = textDecoder.decode(arrayBuffer);
		}

		const cleanText = cleanMobiText(text);

		if (cleanText.length < 100) {
			throw new Error('MOBI file appears to be empty or corrupted');
		}

		// Split by paragraph breaks (double newlines or significant spacing)
		const rawParagraphs = cleanText
			.split(/\n\n+/)
			.map(p => p.trim())
			.filter((p) => p.length > 20); // Filter out very short fragments

		if (rawParagraphs.length === 0) {
			throw new Error('No readable content found in MOBI file');
		}

		// Group paragraphs into chapters
		const chunkSize = Math.max(Math.ceil(rawParagraphs.length / 10), 5);
		const chapters: Chapter[] = [];
		let fullMarkdown = '';

		for (let i = 0; i < rawParagraphs.length; i += chunkSize) {
			const chapterParagraphs = rawParagraphs.slice(i, i + chunkSize);
			const chapterContent = formatParagraphs(chapterParagraphs);
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
			fullMarkdown += `\n\n# ${chapterTitle}\n\n${chapterContent}\n\n---\n`;
		}

		const validChapters = chapters.filter((c) => c.content.length > 0);

		if (validChapters.length === 0) {
			throw new Error('No readable content found in MOBI file');
		}

		return {
			title,
			author: undefined,
			format: 'mobi',
			progress: 0,
			markdown: fullMarkdown.trim(),
			chapters: validChapters,
			lastRead: undefined,
			coverImage: undefined
		};
	} catch (error) {
		console.error('MOBI parsing error:', error);
		throw new Error(`Failed to parse MOBI file: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}
