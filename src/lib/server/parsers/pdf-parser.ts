import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
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

function cleanPdfText(text: string): string {
	return text
		.replace(/(\w+)-\s*\n\s*(\w+)/g, '$1$2')
		.replace(/\s+/g, ' ')
		.replace(/\.\s+([A-Z])/g, '.\n\n$1')
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

function generateId(): string {
	return Math.random().toString(36).substring(2, 15);
}

export async function parsePdf(buffer: Buffer, filename: string): Promise<ParsedBook> {
	try {
		const loadingTask = pdfjsLib.getDocument({
			data: new Uint8Array(buffer),
			useSystemFonts: true,
			disableFontFace: false
		});

		const pdf = await loadingTask.promise;
		const title = filename.replace(/\.pdf$/i, '');
		let fullMarkdown = '';
		const chapters: Omit<Chapter, 'id'>[] = [];
		const numPages = pdf.numPages;

		if (numPages === 0) {
			throw new Error('PDF file appears to be empty or corrupted');
		}

		// Extract metadata
		const metadata = await pdf.getMetadata();
		const author = metadata.info?.Author || undefined;
		
		// Extract additional metadata from PDF info
		const additionalMetadata: Record<string, any> = {};
		
		if (metadata.info) {
			// Publisher
			if (metadata.info.Producer) {
				additionalMetadata.publisher = metadata.info.Producer;
			}
			
			// Creation date
			if (metadata.info.CreationDate) {
				additionalMetadata.publicationYear = metadata.info.CreationDate;
			}
			
			// Subject/Description
			if (metadata.info.Subject) {
				additionalMetadata.description = metadata.info.Subject;
			}
			
			// Keywords
			if (metadata.info.Keywords) {
				additionalMetadata.subjects = metadata.info.Keywords.split(/[,;]/).map(s => s.trim());
			}
		}
		
		// Page count
		additionalMetadata.pageCount = numPages;
		
		// Generate normalized metadata
		const bookMetadata = extractAndNormalizeMetadata(title, author, additionalMetadata);

		// Store text from first 5 pages for metadata extraction
		let firstPagesText = '';
		const firstPagesCount = Math.min(5, numPages);

		for (let pageNum = 1; pageNum <= numPages; pageNum++) {
			try {
				const page = await pdf.getPage(pageNum);
				const textContent = await page.getTextContent();

				let pageText = '';
				let lastY = 0;
				let lastHeight = 0;

				textContent.items.forEach((item: any, index: number) => {
					if ('str' in item && item.str.trim()) {
						const currentY = item.transform[5];
						const currentHeight = item.height || 12;

						if (index > 0) {
							const yDiff = Math.abs(currentY - lastY);

							if (yDiff > lastHeight * 1.5) {
								pageText += '\n\n';
							} else if (yDiff > lastHeight * 0.5) {
								pageText += ' ';
							} else {
								pageText += ' ';
							}
						}

						pageText += item.str;
						lastY = currentY;
						lastHeight = currentHeight;
					}
				});

				pageText = cleanPdfText(pageText);

				// Collect first pages text
				if (pageNum <= firstPagesCount && pageText.trim()) {
					firstPagesText += pageText + '\n\n';
					if (firstPagesText.length > 5000) {
						firstPagesText = firstPagesText.substring(0, 5000);
					}
				}

				if (pageText.trim()) {
					const chunkSize = 10;
					const chapterIndex = Math.floor((pageNum - 1) / chunkSize);

					if (!chapters[chapterIndex]) {
						const startPage = chapterIndex * chunkSize + 1;
						const endPage = Math.min(startPage + chunkSize - 1, numPages);
						const chapterTitle = numPages > chunkSize ? `Pages ${startPage}-${endPage}` : 'Content';

						chapters[chapterIndex] = {
							title: chapterTitle,
							content: '',
							level: 1,
							order: chapterIndex
						};
					}

					chapters[chapterIndex].content += `\n\n${pageText}\n`;
				}
			} catch (error) {
				console.error(`Error parsing page ${pageNum}:`, error);
			}
		}

		// Format chapters as markdown
		chapters.forEach((chapter) => {
			let content = chapter.content.trim();
			const paragraphs = content.split(/\n\n+/);
			const formattedParagraphs = paragraphs.map((para) => {
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
			author,
			coverImage: undefined,
			markdown: fullMarkdown.trim(),
			chapters: validChapters,
			metadata: bookMetadata,
			firstPagesText: firstPagesText.substring(0, 5000)
		};
	} catch (error) {
		console.error('PDF parsing error:', error);
		throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

