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

interface TextItem {
	str: string;
	transform: number[];
	width: number;
	height: number;
	fontName?: string;
}

interface ImageCacheEntry {
	dataUrl: string;
	width: number;
	height: number;
}

/**
 * Clean markdown output to match EPUB quality
 * Ported from epub-parser.ts
 */
function cleanMarkdown(markdown: string): string {
	// First pass: Fix broken table cells (GFM plugin adds newlines in cells with <p> tags)
	// Strategy: Detect tables and ensure all rows have matching column counts
	const lines = markdown.split('\n');
	const fixedLines: string[] = [];
	let expectedPipeCount: number | null = null;
	let inTable = false;
	
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trim();
		
		// Check if this line has pipes
		const pipeCount = (trimmed.match(/\|/g) || []).length;
		const hasPipes = pipeCount > 0;
		
		if (!hasPipes && trimmed.length === 0) {
			// Empty line - might end a table
			if (inTable) {
				inTable = false;
				expectedPipeCount = null;
			}
			continue; // Skip empty lines
		}
		
		if (!hasPipes && inTable) {
			// Non-table line while in table - skip it, might be cell content to accumulate
			continue;
		}
		
		if (!hasPipes) {
			// Regular non-table line
			fixedLines.push(line);
			continue;
		}
		
		// Line has pipes - it's a table row (or part of one)
		const startsWithPipe = trimmed.startsWith('|');
		const endsWithPipe = trimmed.endsWith('|');
		
		// Check if this is a separator row (all dashes and pipes)
		const isSeparator = /^\|\s*[-:]+\s*(\|\s*[-:]+\s*)*\|$/.test(trimmed);
		
		// If this is the first row with pipes, it sets the expected count
		if (!inTable && startsWithPipe && endsWithPipe && pipeCount >= 3) {
			expectedPipeCount = pipeCount;
			inTable = true;
			fixedLines.push(trimmed.replace(/\s{2,}/g, ' '));
			continue;
		}
		
		// If we're in a table and this is a separator, use it
		if (inTable && isSeparator) {
			if (pipeCount !== expectedPipeCount) {
				expectedPipeCount = pipeCount; // Update from separator
			}
			fixedLines.push(trimmed.replace(/\s{2,}/g, ' '));
			continue;
		}
		
		// Check if this row matches expected column count
		if (inTable && expectedPipeCount && pipeCount === expectedPipeCount && startsWithPipe && endsWithPipe) {
			// Complete row with correct column count
			fixedLines.push(trimmed.replace(/\s{2,}/g, ' '));
			continue;
		}
		
		// Row is incomplete - try to accumulate until we have expected column count
		if (inTable && expectedPipeCount && pipeCount < expectedPipeCount) {
			let accumulated = trimmed;
			let j = i + 1;
			let currentPipes = pipeCount;
			
			// Keep accumulating until we have the right number of pipes
			while (j < lines.length && j < i + 30 && currentPipes < expectedPipeCount) {
				const nextLine = lines[j].trim();
				
				if (nextLine.length === 0) {
					j++;
					continue;
				}
				
				accumulated += ' ' + nextLine;
				currentPipes = (accumulated.match(/\|/g) || []).length;
				j++;
				
				// If we've reached the expected count and the row is properly formed, stop
				if (currentPipes === expectedPipeCount && 
				    accumulated.trim().startsWith('|') && 
				    accumulated.trim().endsWith('|')) {
					break;
				}
				
				// Safety: if we've gone way over, stop
				if (currentPipes > expectedPipeCount + 2) {
					break;
				}
			}
			
			// Add the accumulated row
			if (currentPipes === expectedPipeCount || currentPipes >= 3) {
				fixedLines.push(accumulated.replace(/\s{2,}/g, ' '));
				i = j - 1; // Skip consumed lines
			} else {
				// Couldn't complete the row, add what we have
				fixedLines.push(trimmed);
			}
			continue;
		}
		
		// Default: just add the line
		fixedLines.push(trimmed.replace(/\s{2,}/g, ' '));
	}
	
	// Second pass: Process line by line to handle table spacing
	const processed: string[] = [];
	let inTableSpacing = false;
	let prevLineEmpty = false;
	
	for (let i = 0; i < fixedLines.length; i++) {
		const line = fixedLines[i];
		const trimmed = line.trim();
		
		// Detect complete table rows (lines that start and end with |)
		const isTableRow = trimmed.length > 0 && trimmed.startsWith('|') && trimmed.endsWith('|');
		
		if (isTableRow) {
			// Starting a new table
			if (!inTableSpacing && processed.length > 0 && !prevLineEmpty) {
				processed.push(''); // Blank line before table
			}
			processed.push(line);
			inTableSpacing = true;
			prevLineEmpty = false;
		} else if (trimmed.length === 0) {
			// Empty line - skip if we're in a table
			if (inTableSpacing) {
				continue;
			}
			if (!prevLineEmpty) {
				processed.push('');
				prevLineEmpty = true;
			}
		} else {
			// Regular content line
			if (inTableSpacing) {
				// Table ended, add blank line
				processed.push('');
				inTableSpacing = false;
			}
			
			// Add blank line before non-table content if needed
			if (processed.length > 0 && !prevLineEmpty && !trimmed.match(/^#{1,6}\s/)) {
				const lastLine = processed[processed.length - 1];
				if (lastLine.trim().length > 0 && !lastLine.trim().match(/^[*\-+]\s/)) {
					processed.push('');
				}
			}
			
			processed.push(line);
			prevLineEmpty = false;
		}
	}
	
	// Add blank line after table if it's the last thing
	if (inTableSpacing && processed.length > 0) {
		processed.push('');
	}
	
	// Clean up excessive newlines and ensure proper spacing
	return processed
		.join('\n')
		.replace(/\n{4,}/g, '\n\n\n') // Max 3 newlines (2 blank lines)
		.replace(/^(#{1,6}\s+.+)$/gm, '$1\n') // Add newline after headings
		.trim();
}

/**
 * Detect MIME type from PDF image data
 */
function detectImageMimeType(bytes: Uint8Array): string {
	// Check magic numbers (file headers)
	if (bytes.length >= 4) {
		// PNG: 89 50 4E 47
		if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
			return 'image/png';
		}
		
		// JPEG: FF D8 FF
		if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
			return 'image/jpeg';
		}
		
		// GIF: 47 49 46 38
		if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) {
			return 'image/gif';
		}
		
		// WebP: RIFF ... WEBP
		if (bytes.length >= 12 && 
			bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46 &&
			bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) {
			return 'image/webp';
		}
	}
	
	// Default to JPEG
	return 'image/jpeg';
}

/**
 * Extract images from a PDF page and convert to base64 data URLs
 */
async function extractImagesFromPage(page: any, imageCache: Map<string, ImageCacheEntry>): Promise<Map<string, ImageCacheEntry>> {
	const pageImages = new Map<string, ImageCacheEntry>();
	
	try {
		const operatorList = await page.getOperatorList();
		const commonObjs = page.commonObjs;
		const objs = page.objs;
		
		// Look for image operations
		for (let i = 0; i < operatorList.fnArray.length; i++) {
			const fn = operatorList.fnArray[i];
			const args = operatorList.argsArray[i];
			
			// Check for image painting operations (paintImageXObject, paintInlineImageXObject, etc.)
			if (fn === pdfjsLib.OPS.paintImageXObject || fn === pdfjsLib.OPS.paintImageMaskXObject) {
				try {
					const imageName = args[0];
					
					// Check cache first
					if (imageCache.has(imageName)) {
						pageImages.set(imageName, imageCache.get(imageName)!);
						continue;
					}
					
					// Get the image object
					let imgData = null;
					
					// Try to get from page objects first
					if (objs.has(imageName)) {
						imgData = objs.get(imageName);
					}
					// Then try common objects
					else if (commonObjs.has(imageName)) {
						imgData = commonObjs.get(imageName);
					}
					
					if (imgData && imgData.data) {
						const imageBytes = imgData.data;
						const width = imgData.width || 0;
						const height = imgData.height || 0;
						
						// Convert to base64
						let base64 = '';
						if (imageBytes instanceof Uint8Array) {
							base64 = Buffer.from(imageBytes).toString('base64');
						} else if (Array.isArray(imageBytes)) {
							base64 = Buffer.from(imageBytes).toString('base64');
						}
						
						if (base64 && width > 10 && height > 10) { // Filter out tiny images
							const mimeType = detectImageMimeType(imageBytes);
							const dataUrl = `data:${mimeType};base64,${base64}`;
							
							const cacheEntry: ImageCacheEntry = { dataUrl, width, height };
							pageImages.set(imageName, cacheEntry);
							imageCache.set(imageName, cacheEntry);
						}
					}
				} catch (imgError) {
					// Silent fail for individual images
					console.warn(`Failed to extract image: ${imgError}`);
				}
			}
		}
	} catch (error) {
		console.warn('Error extracting images from page:', error);
	}
	
	return pageImages;
}

/**
 * Enhanced text extraction with structure detection
 */
interface StructuredTextItem {
	text: string;
	x: number;
	y: number;
	width: number;
	height: number;
	fontSize: number;
	fontName: string;
	isBold: boolean;
	isItalic: boolean;
}

function analyzeTextStructure(textContent: any): StructuredTextItem[] {
	const items: StructuredTextItem[] = [];
	
	for (const item of textContent.items) {
		if ('str' in item && item.str.trim()) {
			const transform = item.transform || [1, 0, 0, 1, 0, 0];
			const fontName = item.fontName || '';
			
			items.push({
				text: item.str,
				x: transform[4],
				y: transform[5],
				width: item.width || 0,
				height: item.height || 12,
				fontSize: Math.abs(transform[0]), // Approximate font size from transform matrix
				fontName,
				isBold: fontName.toLowerCase().includes('bold'),
				isItalic: fontName.toLowerCase().includes('italic')
			});
		}
	}
	
	return items;
}

/**
 * Detect if text is likely a heading based on font size and position
 */
function detectHeadingLevel(item: StructuredTextItem, avgFontSize: number): number {
	const sizeRatio = item.fontSize / avgFontSize;
	
	if (sizeRatio > 1.8 || (item.isBold && sizeRatio > 1.5)) return 1;
	if (sizeRatio > 1.5 || (item.isBold && sizeRatio > 1.3)) return 2;
	if (sizeRatio > 1.3 || (item.isBold && sizeRatio > 1.1)) return 3;
	if (item.isBold && !item.text.endsWith('.')) return 4;
	
	return 0; // Not a heading
}

/**
 * Detect if text is a list item
 */
function detectListItem(text: string): { isList: boolean; type: 'ordered' | 'unordered' | null; content: string } {
	const trimmed = text.trim();
	
	// Ordered list patterns: "1.", "1)", "a.", "i."
	const orderedMatch = trimmed.match(/^(?:\d+|[a-z]|[ivxlcdm]+)[.)]\s+(.+)$/i);
	if (orderedMatch) {
		return { isList: true, type: 'ordered', content: orderedMatch[1] };
	}
	
	// Unordered list patterns: "•", "-", "*", "○"
	const unorderedMatch = trimmed.match(/^[•\-*○●▪▫]\s+(.+)$/);
	if (unorderedMatch) {
		return { isList: true, type: 'unordered', content: unorderedMatch[1] };
	}
	
	return { isList: false, type: null, content: trimmed };
}

/**
 * Convert structured text to markdown
 */
function convertToMarkdown(items: StructuredTextItem[], pageImages: Map<string, ImageCacheEntry>): string {
	if (items.length === 0) return '';
	
	// Calculate average font size
	const avgFontSize = items.reduce((sum, item) => sum + item.fontSize, 0) / items.length;
	
	let markdown = '';
	let currentParagraph = '';
	let lastY = items[0].y;
	let lastHeight = items[0].height;
	let inList = false;
	let listType: 'ordered' | 'unordered' | null = null;
	
	// Add images at the start if any (cover-like images)
	if (pageImages.size > 0) {
		const sortedImages = Array.from(pageImages.values())
			.sort((a, b) => b.width * b.height - a.width * a.height); // Largest first
		
		// Add the largest image (likely cover or main image)
		if (sortedImages[0] && sortedImages[0].width > 100) {
			markdown += `![Image](${sortedImages[0].dataUrl})\n\n`;
		}
	}
	
	for (let i = 0; i < items.length; i++) {
		const item = items[i];
		const yDiff = Math.abs(item.y - lastY);
		
		// Detect paragraph breaks (large vertical gaps)
		const isNewParagraph = yDiff > lastHeight * 1.5;
		
		// Check if this is a heading
		const headingLevel = detectHeadingLevel(item, avgFontSize);
		
		// Check if this is a list item
		const listInfo = detectListItem(item.text);
		
		// Handle heading
		if (headingLevel > 0 && item.text.length > 3 && item.text.length < 200) {
			if (currentParagraph.trim()) {
				markdown += currentParagraph.trim() + '\n\n';
				currentParagraph = '';
			}
			if (inList) {
				markdown += '\n';
				inList = false;
			}
			
			const hashes = '#'.repeat(headingLevel);
			markdown += `${hashes} ${item.text.trim()}\n\n`;
			
			lastY = item.y;
			lastHeight = item.height;
			continue;
		}
		
		// Handle list items
		if (listInfo.isList) {
			if (currentParagraph.trim()) {
				markdown += currentParagraph.trim() + '\n\n';
				currentParagraph = '';
			}
			
			if (!inList || listType !== listInfo.type) {
				if (inList) markdown += '\n';
				inList = true;
				listType = listInfo.type;
			}
			
			const prefix = listInfo.type === 'ordered' ? '1. ' : '- ';
			markdown += `${prefix}${listInfo.content}\n`;
			
			lastY = item.y;
			lastHeight = item.height;
			continue;
		}
		
		// Regular text
		if (inList) {
			markdown += '\n';
			inList = false;
			listType = null;
		}
		
		if (isNewParagraph && currentParagraph.trim()) {
			markdown += currentParagraph.trim() + '\n\n';
			currentParagraph = '';
		}
		
		// Add text with appropriate spacing
		if (currentParagraph && !currentParagraph.endsWith(' ') && !item.text.startsWith(' ')) {
			currentParagraph += ' ';
		}
		currentParagraph += item.text;
		
		lastY = item.y;
		lastHeight = item.height;
	}
	
	// Add remaining paragraph
	if (currentParagraph.trim()) {
		markdown += currentParagraph.trim() + '\n\n';
	}
	
	return markdown;
}

/**
 * Detect chapter boundaries based on heading patterns
 */
function detectChapters(pages: Array<{ markdown: string; pageNum: number; avgFontSize: number }>): Omit<Chapter, 'id'>[] {
	const chapters: Omit<Chapter, 'id'>[] = [];
	let currentChapter: Omit<Chapter, 'id'> | null = null;
	
	// Keywords that indicate chapter starts
	const chapterKeywords = /^(chapter|part|section|book|prologue|epilogue|introduction|preface|appendix)/i;
	
	for (const page of pages) {
		const lines = page.markdown.split('\n');
		let pageContent = '';
		
		for (const line of lines) {
			const trimmed = line.trim();
			
			// Check for chapter-level headings (# or ##)
			const h1Match = trimmed.match(/^#\s+(.+)$/);
			const h2Match = trimmed.match(/^##\s+(.+)$/);
			
			if (h1Match || (h2Match && chapterKeywords.test(trimmed))) {
				// Found a new chapter
				if (currentChapter && currentChapter.content.trim()) {
					chapters.push(currentChapter);
				}
				
				const title = h1Match ? h1Match[1] : h2Match![1];
				const level = h1Match ? 1 : 2;
				
				currentChapter = {
					title: title.trim(),
					content: '',
					level,
					order: chapters.length
				};
			} else if (currentChapter) {
				pageContent += line + '\n';
			} else {
				// No chapter yet, accumulate content
				pageContent += line + '\n';
			}
		}
		
		// Add page content to current chapter
		if (currentChapter) {
			currentChapter.content += pageContent;
		} else if (pageContent.trim()) {
			// No chapters detected yet, create first chapter
			currentChapter = {
				title: `Pages ${page.pageNum}+`,
				content: pageContent,
				level: 1,
				order: 0
			};
		}
	}
	
	// Add final chapter
	if (currentChapter && currentChapter.content.trim()) {
		chapters.push(currentChapter);
	}
	
	return chapters;
}

/**
 * Fallback: Create page-based chapters if no natural chapters detected
 */
function createPageBasedChapters(pages: Array<{ markdown: string; pageNum: number }>, chunkSize: number = 10): Omit<Chapter, 'id'>[] {
	const chapters: Omit<Chapter, 'id'>[] = [];
	const numPages = pages.length;
	
	for (let i = 0; i < pages.length; i += chunkSize) {
		const chapterPages = pages.slice(i, i + chunkSize);
		const startPage = chapterPages[0].pageNum;
		const endPage = chapterPages[chapterPages.length - 1].pageNum;
		
		const content = chapterPages.map(p => p.markdown).join('\n\n');
		
		if (content.trim()) {
			const chapterTitle = numPages > chunkSize ? `Pages ${startPage}-${endPage}` : 'Content';
			
			chapters.push({
				title: chapterTitle,
				content: content.trim(),
				level: 1,
				order: chapters.length
			});
		}
	}
	
	return chapters;
}

export async function parsePdf(
	buffer: Buffer, 
	filename: string,
	options?: { quickPreview?: boolean }
): Promise<ParsedBook> {
	try {
		const isQuickPreview = options?.quickPreview || false;
		console.log(`Starting ${isQuickPreview ? 'quick preview' : 'enhanced'} PDF parsing...`);
		
		const loadingTask = pdfjsLib.getDocument({
			data: new Uint8Array(buffer),
			useSystemFonts: true,
			disableFontFace: false
		});

		const pdf = await loadingTask.promise;
		const title = filename.replace(/\.pdf$/i, '');
		const numPages = pdf.numPages;

		if (numPages === 0) {
			throw new Error('PDF file appears to be empty or corrupted');
		}

		// In quick preview mode, only process first 10 pages
		const pagesToProcess = isQuickPreview ? Math.min(10, numPages) : numPages;
		console.log(`Processing PDF: ${pagesToProcess}/${numPages} pages${isQuickPreview ? ' (quick preview)' : ''}`);

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
				additionalMetadata.subjects = metadata.info.Keywords.split(/[,;]/).map((s: string) => s.trim());
			}
		}
		
		// Page count
		additionalMetadata.pageCount = numPages;
		
		// Generate normalized metadata
		const bookMetadata = extractAndNormalizeMetadata(title, author, additionalMetadata);

		// Image cache to avoid duplicate processing (skip in quick preview for performance)
		const imageCache = new Map<string, ImageCacheEntry>();

		// Store text from first 5 pages for metadata extraction
		let firstPagesText = '';
		const firstPagesCount = Math.min(5, numPages);

		// Process all pages with enhanced structure detection
		const pages: Array<{ markdown: string; pageNum: number; avgFontSize: number }> = [];

		for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
			try {
				const page = await pdf.getPage(pageNum);
				
				// Extract images from page (skip in quick preview for performance)
				const pageImages = isQuickPreview 
					? new Map<string, ImageCacheEntry>()
					: await extractImagesFromPage(page, imageCache);
				
				// Extract text with structure
				const textContent = await page.getTextContent();
				const structuredItems = analyzeTextStructure(textContent);
				
				// Calculate average font size for this page
				const avgFontSize = structuredItems.length > 0
					? structuredItems.reduce((sum, item) => sum + item.fontSize, 0) / structuredItems.length
					: 12;
				
				// Convert to markdown with structure preservation
				const pageMarkdown = convertToMarkdown(structuredItems, pageImages);

				// Collect first pages text
				if (pageNum <= firstPagesCount && pageMarkdown.trim()) {
					firstPagesText += pageMarkdown + '\n\n';
					if (firstPagesText.length > 5000) {
						firstPagesText = firstPagesText.substring(0, 5000);
					}
				}

				pages.push({
					markdown: pageMarkdown,
					pageNum,
					avgFontSize
				});
				
				if (pageNum % 10 === 0) {
					console.log(`Processed ${pageNum}/${pagesToProcess} pages, ${imageCache.size} images extracted`);
				}
			} catch (error) {
				console.error(`Error parsing page ${pageNum}:`, error);
				// Add empty page to maintain numbering
				pages.push({ markdown: '', pageNum, avgFontSize: 12 });
			}
		}

		console.log(`Text extraction complete. Detecting chapters...`);

		// Detect chapters intelligently
		let chapters = detectChapters(pages);
		
		// Fallback to page-based chunking if no chapters detected or chapters are too few
		if (chapters.length === 0 || (chapters.length === 1 && pagesToProcess > 20)) {
			console.log('No clear chapter structure detected, using page-based chunking');
			chapters = createPageBasedChapters(pages, 10);
		} else {
			console.log(`Detected ${chapters.length} chapters`);
		}
		
		// Add note to first chapter if this is a quick preview
		if (isQuickPreview && pagesToProcess < numPages && chapters.length > 0) {
			chapters[0].title = `${chapters[0].title} (Preview - first ${pagesToProcess} pages)`;
		}

		// Clean markdown for each chapter
		chapters = chapters.map(chapter => ({
			...chapter,
			content: cleanMarkdown(chapter.content)
		}));

		// Build full markdown
		let fullMarkdown = '';
		chapters.forEach((chapter) => {
			fullMarkdown += `\n\n# ${chapter.title}\n\n${chapter.content}\n\n---\n`;
		});

		const validChapters = chapters.filter((c) => c.content.trim().length > 0);

		if (validChapters.length === 0) {
			// Check if this is likely a scanned PDF (no text extracted at all)
			const hasAnyText = pages.some(p => p.markdown.trim().length > 0);
			if (!hasAnyText) {
				throw new Error('No readable text found in PDF file. This may be a scanned PDF that requires OCR (Optical Character Recognition) to extract text. Please use a PDF with extractable text or consider using OCR software first.');
			}
			throw new Error('No readable text found in PDF file');
		}

		console.log(`PDF parsing complete: ${validChapters.length} chapters, ${imageCache.size} images embedded`);

		return {
			title,
			author,
			coverImage: undefined, // TODO: Could render first page as image in future
			markdown: cleanMarkdown(fullMarkdown.trim()),
			chapters: validChapters,
			metadata: bookMetadata,
			firstPagesText: firstPagesText.substring(0, 5000)
		};
	} catch (error) {
		console.error('PDF parsing error:', error);
		throw new Error(`Failed to parse PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}
