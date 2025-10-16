import { parseEpub } from './epub-parser';
import { parsePdf } from './pdf-parser';
import { parseMobi } from './mobi-parser';
import type { Chapter } from '$lib/types';

export interface ParsedBook {
	title: string;
	author?: string;
	coverImage?: string;
	markdown: string;
	chapters: Omit<Chapter, 'id'>[];
}

export async function parseBook(
	buffer: Buffer,
	filename: string,
	format: 'epub' | 'pdf' | 'mobi'
): Promise<ParsedBook> {
	switch (format) {
		case 'epub':
			return parseEpub(buffer);
		case 'pdf':
			return parsePdf(buffer, filename);
		case 'mobi':
			return parseMobi(buffer, filename);
		default:
			throw new Error(`Unsupported format: ${format}`);
	}
}

