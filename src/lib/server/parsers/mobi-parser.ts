import type { Chapter } from '$lib/types';
import { extractAndNormalizeMetadata, type BookMetadata } from '$lib/utils/metadata';

interface ParsedBook {
	title: string;
	author?: string;
	coverImage?: string;
	markdown: string;
	chapters: Omit<Chapter, 'id'>[];
	metadata?: BookMetadata;
	firstPagesText?: string;
}

function cleanMobiText(text: string): string {
	return text
		.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F-\x9F]/g, ' ')
		.replace(/ {2,}/g, ' ')
		.replace(/\r\n/g, '\n')
		.replace(/\r/g, '\n')
		.replace(/\n{3,}/g, '\n\n')
		.trim();
}

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

function formatParagraphs(paragraphs: string[]): string {
	return paragraphs
		.map((para) => {
			const trimmed = para.trim();
			if (!trimmed) return '';

			if (isLikelyHeading(trimmed)) {
				return `\n### ${trimmed}\n`;
			}

			return trimmed;
		})
		.filter((p) => p.length > 0)
		.join('\n\n');
}

function generateId(): string {
	return Math.random().toString(36).substring(2, 15);
}

export async function parseMobi(buffer: Buffer, filename: string): Promise<ParsedBook> {
	try {
		const title = filename.replace(/\.mobi$/i, '');
		
		// Generate normalized metadata (MOBI files have limited metadata)
		const bookMetadata = extractAndNormalizeMetadata(title, undefined, {
			pageCount: Math.ceil(buffer.length / 1000) // Rough estimate
		});

		// Try different encodings
		let text = '';
		try {
			text = buffer.toString('utf-8');
		} catch (error) {
			text = buffer.toString('latin1');
		}

		const cleanText = cleanMobiText(text);

		if (cleanText.length < 100) {
			throw new Error('MOBI file appears to be empty or corrupted');
		}

		const rawParagraphs = cleanText
			.split(/\n\n+/)
			.map((p) => p.trim())
			.filter((p) => p.length > 20);

		if (rawParagraphs.length === 0) {
			throw new Error('No readable content found in MOBI file');
		}

		const chunkSize = Math.max(Math.ceil(rawParagraphs.length / 10), 5);
		const chapters: Omit<Chapter, 'id'>[] = [];
		let fullMarkdown = '';

		for (let i = 0; i < rawParagraphs.length; i += chunkSize) {
			const chapterParagraphs = rawParagraphs.slice(i, i + chunkSize);
			const chapterContent = formatParagraphs(chapterParagraphs);
			const chapterNum = Math.floor(i / chunkSize) + 1;
			const chapterTitle = `Chapter ${chapterNum}`;

			const chapter: Omit<Chapter, 'id'> = {
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

		// Extract first chapter text (limited to 5000 chars)
		const firstPagesText = validChapters.length > 0 
			? validChapters[0].content.substring(0, 5000)
			: '';

		return {
			title,
			author: undefined,
			coverImage: undefined,
			markdown: fullMarkdown.trim(),
			chapters: validChapters,
			metadata: bookMetadata,
			firstPagesText
		};
	} catch (error) {
		console.error('MOBI parsing error:', error);
		throw new Error(`Failed to parse MOBI: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

