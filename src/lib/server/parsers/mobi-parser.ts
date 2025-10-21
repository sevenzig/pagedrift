import type { Chapter } from '$lib/types';
import { extractAndNormalizeMetadata, type BookMetadata } from '$lib/utils/metadata';
import { cleanMarkdown, detectMimeType, createTurndownService } from '$lib/utils/markdown-processor';
import { JSDOM } from 'jsdom';

interface ParsedBook {
	title: string;
	author?: string;
	coverImage?: string;
	markdown: string;
	chapters: Omit<Chapter, 'id'>[];
	metadata?: BookMetadata;
	firstPagesText?: string;
}

/**
 * Extract chapter structure from MOBI TOC or HTML headings
 */
function extractChapters(
	htmlContent: string,
	tocEntries: any[] | null,
	turndownService: any
): { chapters: Omit<Chapter, 'id'>[]; fullMarkdown: string } {
	const dom = new JSDOM(htmlContent);
	const document = dom.window.document;
	
	const chapters: Omit<Chapter, 'id'>[] = [];
	let fullMarkdown = '';
	
	// Try to use TOC if available
	if (tocEntries && tocEntries.length > 0) {
		console.log(`📚 MOBI: Found ${tocEntries.length} chapters in TOC`);
		
		// Build chapter map from TOC
		for (let i = 0; i < tocEntries.length; i++) {
			const tocEntry = tocEntries[i];
			const chapterTitle = tocEntry.label || `Chapter ${i + 1}`;
			
			// Try to extract content for this chapter
			// Note: This is simplified - actual implementation depends on TOC structure
			let chapterContent = '';
			
			// For now, we'll split by headings if we can't map TOC to content
			const headings = document.querySelectorAll('h1, h2, h3');
			if (headings[i]) {
				// Get content between this heading and the next
				let currentNode: any = headings[i];
				let html = currentNode.outerHTML;
				
				while (currentNode.nextSibling && currentNode.nextSibling !== headings[i + 1]) {
					currentNode = currentNode.nextSibling;
					if (currentNode.nodeType === 1) { // Element node
						html += currentNode.outerHTML;
					} else if (currentNode.nodeType === 3) { // Text node
						html += currentNode.textContent;
					}
				}
				
				chapterContent = turndownService.turndown(html);
			}
			
			if (chapterContent.trim()) {
				const chapter: Omit<Chapter, 'id'> = {
					title: chapterTitle,
					content: cleanMarkdown(chapterContent),
					level: 1,
					order: i
				};
				
				chapters.push(chapter);
				fullMarkdown += `\n\n# ${chapterTitle}\n\n${chapter.content}\n\n---\n`;
			}
		}
	}
	
	// Fallback: Split by heading tags if no TOC or TOC extraction failed
	if (chapters.length === 0) {
		console.log('📚 MOBI: No TOC found, splitting by headings');
		
		const headings = document.querySelectorAll('h1, h2');
		
		if (headings.length > 0) {
			for (let i = 0; i < headings.length; i++) {
				const heading = headings[i];
				const chapterTitle = heading.textContent?.trim() || `Chapter ${i + 1}`;
				
				// Get content between this heading and the next
				let currentNode: any = heading.nextSibling;
				let html = heading.outerHTML;
				
				while (currentNode && (i === headings.length - 1 || currentNode !== headings[i + 1])) {
					if (currentNode.nodeType === 1) { // Element node
						// Stop if we hit another heading of same or higher level
						if (currentNode.tagName === 'H1' || currentNode.tagName === 'H2') {
							break;
						}
						html += currentNode.outerHTML;
					} else if (currentNode.nodeType === 3 && currentNode.textContent?.trim()) {
						html += currentNode.textContent;
					}
					currentNode = currentNode.nextSibling;
				}
				
				const markdown = turndownService.turndown(html);
				const cleanedMarkdown = cleanMarkdown(markdown);
				
				if (cleanedMarkdown.trim().length > 50) { // Only include substantial chapters
					const chapter: Omit<Chapter, 'id'> = {
						title: chapterTitle,
						content: cleanedMarkdown,
						level: heading.tagName === 'H1' ? 1 : 2,
						order: chapters.length
					};
					
					chapters.push(chapter);
					fullMarkdown += `\n\n# ${chapterTitle}\n\n${cleanedMarkdown}\n\n---\n`;
				}
			}
		} else {
			// Last resort: treat entire content as single chapter
			console.log('📚 MOBI: No headings found, creating single chapter');
			
			const markdown = turndownService.turndown(document.body.innerHTML);
			const cleanedMarkdown = cleanMarkdown(markdown);
			
			const chapter: Omit<Chapter, 'id'> = {
				title: 'Content',
				content: cleanedMarkdown,
				level: 1,
				order: 0
			};
			
			chapters.push(chapter);
			fullMarkdown = `\n\n# Content\n\n${cleanedMarkdown}\n\n---\n`;
		}
	}
	
	return { chapters, fullMarkdown };
}

export async function parseMobi(buffer: Buffer, filename: string): Promise<ParsedBook> {
	try {
		console.log('📖 Starting MOBI parsing...');
		
		// Import the MOBI parser library
		const { initMobiFile } = await import('@lingo-reader/mobi-parser');
		
		// Parse MOBI file
		const mobi = await initMobiFile(buffer);
		console.log('✓ MOBI file initialized');
		
		// Extract metadata
		const mobiMetadata = mobi.getMetadata();
		const title = mobiMetadata.title || filename.replace(/\.mobi$/i, '');
		const author = mobiMetadata.author && mobiMetadata.author.length > 0 
			? mobiMetadata.author.join(', ') 
			: undefined;
		
		console.log(`📚 Title: ${title}, Author: ${author || 'Unknown'}`);
		
		// Extract cover image
		let coverImage: string | undefined;
		try {
			const coverDataUrl = mobi.getCoverImage();
			if (coverDataUrl && coverDataUrl.length > 0) {
				coverImage = coverDataUrl;
				console.log('✓ Cover image extracted');
			}
		} catch (error) {
			console.log('No cover image found');
		}
		
		// Get spine (list of chapters)
		const spine = mobi.getSpine();
		console.log(`📄 Found ${spine.length} spine items`);
		
		// Combine all HTML content from chapters
		let combinedHtml = '';
		const turndownService = createTurndownService();
		
		for (const spineItem of spine) {
			try {
				const processedChapter = mobi.loadChapter(spineItem.id);
				if (processedChapter && processedChapter.html) {
					combinedHtml += processedChapter.html;
				}
			} catch (error) {
				console.error(`Error loading chapter ${spineItem.id}:`, error);
			}
		}
		
		if (!combinedHtml || combinedHtml.trim().length < 100) {
			throw new Error('No readable HTML content found in MOBI file');
		}
		
		console.log(`✓ Extracted ${combinedHtml.length} characters of HTML`);
		
		// Get table of contents
		let tocEntries: any[] | null = null;
		try {
			tocEntries = mobi.getToc();
			if (tocEntries && tocEntries.length > 0) {
				console.log(`📑 Found ${tocEntries.length} TOC entries`);
			}
		} catch (error) {
			console.log('No TOC found, will use heading-based chapter detection');
		}
		
		// Extract chapters
		const { chapters, fullMarkdown } = extractChapters(combinedHtml, tocEntries, turndownService);
		
		if (chapters.length === 0) {
			throw new Error('No readable content found in MOBI file');
		}
		
		console.log(`✓ Extracted ${chapters.length} chapters`);
		
		// Extract publication year from published date string
		let publicationYear: number | undefined;
		if (mobiMetadata.published) {
			const yearMatch = mobiMetadata.published.match(/\d{4}/);
			if (yearMatch) {
				publicationYear = parseInt(yearMatch[0]);
			}
		}
		
		// Generate normalized metadata
		const bookMetadata = extractAndNormalizeMetadata(title, author, {
			publisher: mobiMetadata.publisher,
			isbn: mobiMetadata.isbn,
			publicationYear,
			language: Array.isArray(mobiMetadata.language) 
				? mobiMetadata.language[0] 
				: mobiMetadata.language,
			description: mobiMetadata.description,
			subjects: mobiMetadata.subject,
			pageCount: spine.length // Use spine items as page estimate
		});
		
		// Extract first pages text for metadata lookup
		const firstPagesText = chapters
			.slice(0, 3)
			.map(c => c.content)
			.join('\n\n')
			.substring(0, 5000);
		
		console.log('✓ MOBI parsing complete');
		
		return {
			title,
			author,
			coverImage,
			markdown: fullMarkdown.trim(),
			chapters,
			metadata: bookMetadata,
			firstPagesText
		};
	} catch (error) {
		console.error('MOBI parsing error:', error);
		throw new Error(`Failed to parse MOBI: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}
