/**
 * Shared markdown processing utilities for EPUB and MOBI parsers
 */

/**
 * Cleans and formats markdown content for better readability
 * Fixes broken table cells and ensures proper spacing
 */
export function cleanMarkdown(markdown: string): string {
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
 * Detect MIME type from file buffer using magic numbers
 */
export function detectMimeType(buffer: Buffer | Uint8Array | string, extension: string = ''): string {
	// Convert to Buffer if needed
	if (typeof buffer === 'string') {
		return 'image/jpeg'; // Default for data URLs
	}
	
	// Convert Uint8Array to Buffer for Node.js
	const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
	
	// Check magic numbers (file headers)
	if (buf.length >= 4) {
		const header = buf.slice(0, 12);
		
		// PNG: 89 50 4E 47
		if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
			return 'image/png';
		}
		
		// JPEG: FF D8 FF
		if (header[0] === 0xFF && header[1] === 0xD8 && header[2] === 0xFF) {
			return 'image/jpeg';
		}
		
		// GIF: 47 49 46 38
		if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x38) {
			return 'image/gif';
		}
		
		// WebP: RIFF ... WEBP
		if (header.length >= 12 && 
			header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46 &&
			header[8] === 0x57 && header[9] === 0x45 && header[10] === 0x42 && header[11] === 0x50) {
			return 'image/webp';
		}
		
		// BMP: 42 4D
		if (header[0] === 0x42 && header[1] === 0x4D) {
			return 'image/bmp';
		}
		
		// TIFF: 49 49 2A 00 (little-endian) or 4D 4D 00 2A (big-endian)
		if ((header[0] === 0x49 && header[1] === 0x49 && header[2] === 0x2A && header[3] === 0x00) ||
			(header[0] === 0x4D && header[1] === 0x4D && header[2] === 0x00 && header[3] === 0x2A)) {
			return 'image/tiff';
		}
	}
	
	// Check for SVG (XML-based)
	const textContent = buf.toString('utf8', 0, Math.min(buf.length, 200));
	if (textContent.includes('<?xml') || textContent.includes('<svg')) {
		return 'image/svg+xml';
	}
	
	// Fall back to extension-based detection
	const ext = extension.toLowerCase().replace('.', '');
	const extensionMap: Record<string, string> = {
		'png': 'image/png',
		'jpg': 'image/jpeg',
		'jpeg': 'image/jpeg',
		'gif': 'image/gif',
		'webp': 'image/webp',
		'svg': 'image/svg+xml',
		'bmp': 'image/bmp',
		'tiff': 'image/tiff',
		'tif': 'image/tiff'
	};
	
	return extensionMap[ext] || 'image/jpeg';
}

/**
 * Create a Turndown service configured for ebook parsing
 */
export function createTurndownService(): any {
	const TurndownService = require('turndown');
	const { gfm } = require('turndown-plugin-gfm');
	
	const turndownService = new TurndownService({
		headingStyle: 'atx',
		codeBlockStyle: 'fenced',
		hr: '---',
		bulletListMarker: '-',
		emDelimiter: '*',
		strongDelimiter: '**'
	});
	
	// Add GitHub Flavored Markdown support (tables, strikethrough, etc.)
	turndownService.use(gfm);
	
	// Add rule for better image handling
	turndownService.addRule('images', {
		filter: 'img',
		replacement: function (content: string, node: any) {
			const alt = node.getAttribute('alt') || '';
			const src = node.getAttribute('src') || '';
			const title = node.getAttribute('title') || '';
			
			if (!src) return '';
			
			const titlePart = title ? ` "${title}"` : '';
			return `\n\n![${alt}](${src}${titlePart})\n\n`;
		}
	});
	
	// Add rule for better paragraph spacing
	turndownService.addRule('paragraphs', {
		filter: 'p',
		replacement: function (content: string) {
			const trimmed = content.trim();
			return trimmed ? '\n' + trimmed + '\n' : '';
		}
	});
	
	// Add rule for converting internal links
	turndownService.addRule('internalLinks', {
		filter: function (node: any) {
			return (
				node.nodeName === 'A' &&
				node.getAttribute('href')
			);
		},
		replacement: function (content: string, node: any) {
			const href = node.getAttribute('href') || '';
			const text = content.trim() || '';
			
			// Check if this is an internal link
			const isInternalLink = 
				href.includes('.xhtml') ||
				href.includes('.html') ||
				href.startsWith('#');
			
			if (isInternalLink) {
				// Extract the anchor ID from the href
				let anchorId = '';
				
				if (href.includes('#')) {
					anchorId = '#' + href.split('#')[1];
				}
				
				// If we have an anchor ID, create an HTML anchor link
				if (anchorId) {
					return `<a href="${anchorId}">${text}</a>`;
				} else {
					return text;
				}
			} else {
				// External link - preserve as markdown
				const title = node.getAttribute('title');
				const titlePart = title ? ` "${title}"` : '';
				return `[${text}](${href}${titlePart})`;
			}
		}
	});
	
	return turndownService;
}

