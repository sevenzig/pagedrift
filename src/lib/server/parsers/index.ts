import { parseEpub } from './epub-parser';
import { parsePdf } from './pdf-parser';
import { parseMobi } from './mobi-parser';
import type { Chapter } from '$lib/types';
import type { BookMetadata } from '$lib/utils/metadata';

export interface ParsedBook {
	title: string;
	author?: string;
	coverImage?: string;
	markdown: string;
	chapters: Omit<Chapter, 'id'>[];
	metadata?: BookMetadata;
	firstPagesText?: string;
}

export async function parseBook(
	buffer: Buffer,
	filename: string,
	format: 'epub' | 'pdf' | 'mobi',
	options?: { quickPreview?: boolean }
): Promise<ParsedBook> {
	switch (format) {
		case 'epub':
			return parseEpub(buffer);
		case 'pdf':
			return parsePdf(buffer, filename, options);
		case 'mobi':
			return parseMobi(buffer, filename);
		default:
			throw new Error(`Unsupported format: ${format}`);
	}
}

