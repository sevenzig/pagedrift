import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { JSDOM } from 'jsdom';
import type { Chapter } from '$lib/types';
import AdmZip from 'adm-zip';
import { parseStringPromise } from 'xml2js';
import { extractAndNormalizeMetadata, type BookMetadata } from '$lib/utils/metadata';
import { cleanMarkdown as sharedCleanMarkdown, detectMimeType as sharedDetectMimeType } from '$lib/utils/markdown-processor';

// Archive index interface for fast image lookup
interface ArchiveIndex {
	filenameToPathsMap: Map<string, string[]>;
	allPaths: Set<string>;
}

interface ParsedBook {
	title: string;
	author?: string;
	coverImage?: string;
	markdown: string;
	chapters: Omit<Chapter, 'id'>[];
	metadata?: BookMetadata;
	firstPagesText?: string;
}

// Use shared cleanMarkdown function
const cleanMarkdown = sharedCleanMarkdown;

/**
 * Build an index of all files in the archive for fast lookup
 */
function buildArchiveIndex(zipEntries: AdmZip.IZipEntry[]): ArchiveIndex {
	const filenameToPathsMap = new Map<string, string[]>();
	const allPaths = new Set<string>();
	
	for (const entry of zipEntries) {
		const path = entry.entryName;
		allPaths.add(path);
		
		// Extract just the filename
		const filename = path.split('/').pop();
		if (filename) {
			const normalizedFilename = decodeURIComponent(filename.toLowerCase());
			const existingPaths = filenameToPathsMap.get(normalizedFilename) || [];
			existingPaths.push(path);
			filenameToPathsMap.set(normalizedFilename, existingPaths);
		}
	}
	
	console.log(`📚 Archive index built: ${allPaths.size} files, ${filenameToPathsMap.size} unique filenames`);
	return { filenameToPathsMap, allPaths };
}

// Use shared detectMimeType function
const detectMimeType = sharedDetectMimeType;

/**
 * Resolve image path using comprehensive strategies
 */
function resolveImagePath(
	src: string,
	chapterPath: string,
	archiveIndex: ArchiveIndex,
	opfDir: string
): string | null {
	const pathsToTry = new Set<string>();
	
	// Normalize src: decode URL encoding, strip query params and fragments
	let normalizedSrc = src;
	try {
		normalizedSrc = decodeURIComponent(src.split('?')[0].split('#')[0]);
	} catch (e) {
		// If decoding fails, use original
	}
	
	// Get the directory of the current chapter
	const chapterDir = chapterPath.includes('/') 
		? chapterPath.substring(0, chapterPath.lastIndexOf('/'))
		: '';
	
	// Strategy 1: Original path as-is
	pathsToTry.add(normalizedSrc);
	
	// Strategy 2: Resolve relative to current chapter
	if (normalizedSrc.startsWith('../')) {
		// Go up directories
		const upLevels = (normalizedSrc.match(/\.\.\//g) || []).length;
		const relativePath = normalizedSrc.replace(/^(\.\.\/)+/, '');
		const chapterDirParts = chapterDir.split('/').filter(p => p);
		const resolvedDirParts = chapterDirParts.slice(0, Math.max(0, chapterDirParts.length - upLevels));
		const resolvedPath = resolvedDirParts.length > 0 
			? `${resolvedDirParts.join('/')}/${relativePath}`
			: relativePath;
		pathsToTry.add(resolvedPath);
	} else if (normalizedSrc.startsWith('./')) {
		// Current directory
		const relativePath = normalizedSrc.substring(2);
		pathsToTry.add(chapterDir ? `${chapterDir}/${relativePath}` : relativePath);
	} else if (!normalizedSrc.startsWith('/')) {
		// Relative path without prefix - resolve relative to current chapter
		if (chapterDir) {
			pathsToTry.add(`${chapterDir}/${normalizedSrc}`);
		}
	}
	
	// Strategy 3: Try with and without leading slash
	if (normalizedSrc.startsWith('/')) {
		pathsToTry.add(normalizedSrc.substring(1));
	} else {
		pathsToTry.add(`/${normalizedSrc}`);
	}
	
	// Strategy 4: Try common ePub content directory prefixes
	const contentDirs = ['OEBPS', 'OPS', 'EPUB', 'content', 'Content', 'book', 'Book'];
	const srcWithoutLeadingSlash = normalizedSrc.startsWith('/') ? normalizedSrc.substring(1) : normalizedSrc;
	
	for (const dir of contentDirs) {
		if (!srcWithoutLeadingSlash.startsWith(dir + '/')) {
			pathsToTry.add(`${dir}/${srcWithoutLeadingSlash}`);
		}
	}
	
	// Strategy 5: Try common image directory names with just the filename
	const filename = normalizedSrc.split('/').pop();
	if (filename && filename !== normalizedSrc) {
		const imageDirs = ['images', 'Images', 'image', 'Image', 'img', 'Img', 'media', 'Media', 'graphics', 'Graphics', 'pics', 'Pics', 'pictures', 'Pictures', 'assets', 'Assets'];
		
		for (const imgDir of imageDirs) {
			pathsToTry.add(`${imgDir}/${filename}`);
			
			// Try with content directory prefixes
			for (const contentDir of contentDirs) {
				pathsToTry.add(`${contentDir}/${imgDir}/${filename}`);
			}
		}
	}
	
	// Strategy 6: Try paths relative to OPF directory
	if (opfDir) {
		pathsToTry.add(`${opfDir}${srcWithoutLeadingSlash}`);
		if (filename) {
			const imageDirs = ['images', 'Images', 'image', 'Image', 'img', 'Img', 'media', 'Media', 'graphics', 'Graphics'];
			for (const imgDir of imageDirs) {
				pathsToTry.add(`${opfDir}${imgDir}/${filename}`);
			}
		}
	}
	
	// Strategy 7: Check if any path exists in archive
	for (const pathToTry of Array.from(pathsToTry)) {
		if (archiveIndex.allPaths.has(pathToTry)) {
			return pathToTry;
		}
	}
	
	// Strategy 8: Fuzzy filename matching (case-insensitive)
	if (filename) {
		const normalizedFilename = filename.toLowerCase();
		const matches = archiveIndex.filenameToPathsMap.get(normalizedFilename);
		if (matches && matches.length > 0) {
			// If multiple matches, prefer the one closest to the chapter
			if (matches.length === 1) {
				return matches[0];
			}
			
			// Find the match that shares the most path components with the chapter
			let bestMatch = matches[0];
			let bestScore = 0;
			
			for (const match of matches) {
				const matchParts = match.split('/');
				const chapterParts = chapterPath.split('/');
				let score = 0;
				
				for (let i = 0; i < Math.min(matchParts.length, chapterParts.length); i++) {
					if (matchParts[i] === chapterParts[i]) {
						score++;
					} else {
						break;
					}
				}
				
				if (score > bestScore) {
					bestScore = score;
					bestMatch = match;
				}
			}
			
			return bestMatch;
		}
	}
	
	return null;
}

/**
 * Extract image from archive and convert to base64 data URL
 */
function extractImageFromArchive(
	imagePath: string,
	zipEntries: AdmZip.IZipEntry[]
): string | null {
	try {
		const imageEntry = zipEntries.find(entry => entry.entryName === imagePath);
		if (!imageEntry) {
			return null;
		}
		
		const imageBuffer = imageEntry.getData();
		if (!imageBuffer || imageBuffer.length === 0) {
			return null;
		}
		
		// Detect MIME type
		const extension = imagePath.split('.').pop() || '';
		const mimeType = detectMimeType(imageBuffer, extension);
		
		// Convert to base64
		const base64Data = imageBuffer.toString('base64');
		return `data:${mimeType};base64,${base64Data}`;
	} catch (error) {
		console.error(`Error extracting image ${imagePath}:`, error);
		return null;
	}
}

/**
 * Process all images in HTML content before converting to markdown
 */
function processImagesInHtml(
	dom: JSDOM,
	chapterPath: string,
	zipEntries: AdmZip.IZipEntry[],
	archiveIndex: ArchiveIndex,
	opfDir: string,
	imageCache: Map<string, string>
): { processed: number; failed: number; failedImages: string[] } {
	const images = dom.window.document.querySelectorAll('img');
	let processed = 0;
	let failed = 0;
	const failedImages: string[] = [];
	
	for (const img of images) {
		const src = img.getAttribute('src');
		if (!src || src.startsWith('data:') || src.startsWith('http://') || src.startsWith('https://')) {
			continue; // Skip data URLs and external images
		}
		
		// Check cache first
		if (imageCache.has(src)) {
			img.setAttribute('src', imageCache.get(src)!);
			processed++;
			continue;
		}
		
		// Try to resolve and extract the image
		const resolvedPath = resolveImagePath(src, chapterPath, archiveIndex, opfDir);
		
		if (resolvedPath) {
			const dataUrl = extractImageFromArchive(resolvedPath, zipEntries);
			
			if (dataUrl) {
				img.setAttribute('src', dataUrl);
				imageCache.set(src, dataUrl);
				processed++;
				console.log(`  ✓ Image embedded: ${src} → ${resolvedPath}`);
			} else {
				failed++;
				failedImages.push(src);
				console.log(`  ✗ Failed to extract: ${src} (resolved to ${resolvedPath})`);
			}
		} else {
			failed++;
			failedImages.push(src);
			console.log(`  ✗ Failed to resolve: ${src}`);
		}
	}
	
	return { processed, failed, failedImages };
}

export async function parseEpub(buffer: Buffer): Promise<ParsedBook> {
	try {
		console.log('Starting EPUB parsing...');
		const zip = new AdmZip(buffer);
		const zipEntries = zip.getEntries();
		
		// Build archive index for fast image lookup
		const archiveIndex = buildArchiveIndex(zipEntries);
		
		// Initialize image cache to avoid processing same image multiple times
		const imageCache = new Map<string, string>();
		
	// Find container.xml to get the OPF file location
	const containerEntry = zipEntries.find(entry => entry.entryName === 'META-INF/container.xml');
	if (!containerEntry) {
		throw new Error('Invalid EPUB: META-INF/container.xml not found');
	}
	
	const containerXml = containerEntry.getData().toString('utf8');
	const containerData = await parseStringPromise(containerXml);
	
	// Defensive parsing of container.xml with multiple fallback strategies
	let opfPath: string | undefined;
	
	try {
		// Strategy 1: Standard structure - rootfiles[0].rootfile[0].$
		if (containerData?.container?.rootfiles?.[0]?.rootfile?.[0]?.$?.['full-path']) {
			opfPath = containerData.container.rootfiles[0].rootfile[0].$['full-path'];
		}
		// Strategy 2: Direct rootfile access (single rootfile)
		else if (containerData?.container?.rootfiles?.[0]?.rootfile?.$?.['full-path']) {
			opfPath = containerData.container.rootfiles[0].rootfile.$['full-path'];
		}
		// Strategy 3: Alternative structure - rootfile as direct child
		else if (containerData?.container?.rootfile?.$?.['full-path']) {
			opfPath = containerData.container.rootfile.$['full-path'];
		}
		// Strategy 4: Try to find any rootfile in the structure
		else {
			const findRootfile = (obj: any): string | undefined => {
				if (typeof obj !== 'object' || obj === null) return undefined;
				
				if (obj.$ && obj.$['full-path']) {
					return obj.$['full-path'];
				}
				
				for (const key in obj) {
					if (key === 'rootfile' && obj[key]) {
						const result = findRootfile(obj[key]);
						if (result) return result;
					}
					if (Array.isArray(obj[key])) {
						for (const item of obj[key]) {
							const result = findRootfile(item);
							if (result) return result;
						}
					} else if (typeof obj[key] === 'object') {
						const result = findRootfile(obj[key]);
						if (result) return result;
					}
				}
				return undefined;
			};
			
			opfPath = findRootfile(containerData);
		}
	} catch (error) {
		console.error('Error parsing container.xml structure:', error);
		console.error('Container data structure:', JSON.stringify(containerData, null, 2));
	}
	
	if (!opfPath) {
		throw new Error(`Invalid EPUB: Could not find OPF file path in container.xml. Structure: ${JSON.stringify(containerData, null, 2)}`);
	}
	
	console.log('OPF path:', opfPath);
		
		// Get OPF file
		const opfEntry = zipEntries.find(entry => entry.entryName === opfPath);
		if (!opfEntry) {
			throw new Error(`OPF file not found: ${opfPath}`);
		}
		
		const opfXml = opfEntry.getData().toString('utf8');
		const opfData = await parseStringPromise(opfXml);
		const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);
		
		// Debug: Log OPF structure (remove in production)
		// console.log('OPF data structure:', JSON.stringify(opfData, null, 2));
		
		// Extract metadata with defensive checks
		// Try both 'metadata' and 'opf:metadata' as the structure can vary
		let metadata = opfData?.package?.metadata?.[0];
		if (!metadata) {
			metadata = opfData?.package?.['opf:metadata']?.[0];
		}
		if (!metadata) {
			console.error('OPF package structure:', JSON.stringify(opfData?.package, null, 2));
			throw new Error('Invalid EPUB: No metadata found in OPF file');
		}
		
		const title = metadata['dc:title']?.[0]?._ || metadata['dc:title']?.[0] || 'Untitled';
		const author = metadata['dc:creator']?.[0]?._ || metadata['dc:creator']?.[0] || undefined;
		console.log('Title:', title, 'Author:', author);
		
		// Extract additional metadata
		const additionalMetadata: Record<string, any> = {};
		
		// ISBN
		if (metadata['dc:identifier'] && Array.isArray(metadata['dc:identifier'])) {
			for (const identifier of metadata['dc:identifier']) {
				const id = identifier._ || identifier;
				const scheme = identifier.$?.scheme;
				if (scheme === 'ISBN' || /^[\d\-X]{10,13}$/.test(id)) {
					additionalMetadata.isbn = id;
					break;
				}
			}
		}
		
		// Publisher
		if (metadata['dc:publisher']?.[0]) {
			additionalMetadata.publisher = metadata['dc:publisher'][0]._ || metadata['dc:publisher'][0];
		}
		
		// Publication date
		if (metadata['dc:date']?.[0]) {
			additionalMetadata.publicationYear = metadata['dc:date'][0]._ || metadata['dc:date'][0];
		}
		
		// Language
		if (metadata['dc:language']?.[0]) {
			additionalMetadata.language = metadata['dc:language'][0]._ || metadata['dc:language'][0];
		}
		
		// Description
		if (metadata['dc:description']?.[0]) {
			additionalMetadata.description = metadata['dc:description'][0]._ || metadata['dc:description'][0];
		}
		
		// Subjects
		if (metadata['dc:subject'] && Array.isArray(metadata['dc:subject'])) {
			additionalMetadata.subjects = metadata['dc:subject'].map((s: any) => s._ || s);
		}
		
		// Page count (from manifest) - with defensive check
		const manifest = opfData?.package?.manifest?.[0];
		if (manifest?.item && Array.isArray(manifest.item)) {
			additionalMetadata.pageCount = manifest.item.length;
		}
		
		// Generate normalized metadata
		const bookMetadata = extractAndNormalizeMetadata(title, author, additionalMetadata);
		
		// Extract cover image with defensive checks
		let coverImage: string | undefined;
		try {
			const coverMeta = metadata.meta?.find((m: any) => m.$?.name === 'cover');
			if (coverMeta && coverMeta.$?.content) {
				const coverId = coverMeta.$.content;
				const manifest = opfData?.package?.manifest?.[0];
				if (manifest?.item && Array.isArray(manifest.item)) {
					const coverItem = manifest.item.find((item: any) => item.$?.id === coverId);
					if (coverItem && coverItem.$?.href) {
						const coverPath = opfDir + coverItem.$.href;
						const coverEntry = zipEntries.find(entry => entry.entryName === coverPath);
						if (coverEntry) {
							const coverBuffer = coverEntry.getData();
							const mimeType = coverItem.$['media-type'] || 'image/jpeg';
							coverImage = `data:${mimeType};base64,${coverBuffer.toString('base64')}`;
							console.log('Cover image extracted');
						}
					}
				}
			}
		} catch (error) {
			console.log('Could not extract cover image:', error);
		}
		
		// Get spine (reading order) with defensive checks
		const spineData = opfData?.package?.spine?.[0];
		if (!spineData) {
			throw new Error('Invalid EPUB: No spine found in OPF file');
		}
		
		const spine = spineData.itemref;
		if (!spine || !Array.isArray(spine)) {
			throw new Error('Invalid EPUB: Spine itemref is missing or not an array');
		}
		
		const manifestData = opfData?.package?.manifest?.[0];
		if (!manifestData?.item || !Array.isArray(manifestData.item)) {
			throw new Error('Invalid EPUB: Manifest items are missing or not an array');
		}
		
		const chapters: Omit<Chapter, 'id'>[] = [];
		let fullMarkdown = '';
		
		const turndownService = new TurndownService({
			headingStyle: 'atx',
			codeBlockStyle: 'fenced',
			emDelimiter: '_',
			bulletListMarker: '-'
		});
		
		// Add GitHub Flavored Markdown support (including tables)
		turndownService.use(gfm);
		
		console.log(`Processing ${spine.length} spine items...`);
		
		// Process each spine item
		for (let i = 0; i < spine.length; i++) {
			const spineItem = spine[i];
			if (!spineItem?.$?.idref) {
				console.log(`Spine item ${i} missing idref, skipping`);
				continue;
			}
			
			const idref = spineItem.$.idref;
			
			// Find the corresponding manifest item
			const manifestItem = manifestData.item.find((item: any) => item.$?.id === idref);
			if (!manifestItem) {
				console.log(`Manifest item not found for ${idref}`);
				continue;
			}
			
			if (!manifestItem.$?.href) {
				console.log(`Manifest item ${idref} missing href, skipping`);
				continue;
			}
			
			const href = manifestItem.$.href;
			const fullPath = opfDir + href;
			
			try {
				const contentEntry = zipEntries.find(entry => entry.entryName === fullPath);
				if (!contentEntry) {
					console.log(`Content file not found: ${fullPath}`);
					continue;
				}
				
				const htmlContent = contentEntry.getData().toString('utf8');
				
				// Parse HTML with jsdom
				const dom = new JSDOM(htmlContent);
				const bodyHtml = dom.window.document.body?.innerHTML || '';
				
				if (!bodyHtml || bodyHtml.trim().length === 0) {
					continue;
				}
				
				// Process images: extract from archive and embed as base64 before markdown conversion
				const imageStats = processImagesInHtml(dom, fullPath, zipEntries, archiveIndex, opfDir, imageCache);
				if (imageStats.processed > 0 || imageStats.failed > 0) {
					console.log(`  📷 Images in chapter ${i + 1}: ${imageStats.processed} embedded, ${imageStats.failed} failed`);
				}
				
				// Convert to markdown (with embedded base64 images)
				const updatedBodyHtml = dom.window.document.body?.innerHTML || bodyHtml;
				const markdown = turndownService.turndown(updatedBodyHtml);
				const cleanedMarkdown = cleanMarkdown(markdown);
				
				if (cleanedMarkdown.length < 50) {
					continue;
				}
				
				// Extract title from first heading or use default
				const titleMatch = cleanedMarkdown.match(/^#+ (.+)/m);
				const chapterTitle = titleMatch ? titleMatch[1] : `Chapter ${chapters.length + 1}`;
				
				// Determine heading level
				const levelMatch = cleanedMarkdown.match(/^(#+)/m);
				const level = levelMatch ? levelMatch[1].length : 1;
				
				const chapter: Omit<Chapter, 'id'> = {
					title: chapterTitle,
					content: cleanedMarkdown,
					level,
					order: chapters.length
				};
				
				chapters.push(chapter);
				fullMarkdown += `\n\n# ${chapterTitle}\n\n${cleanedMarkdown}\n\n---\n`;
				
				if (i % 10 === 0) {
					console.log(`Processed ${i + 1}/${spine.length} items, ${chapters.length} chapters extracted`);
				}
			} catch (error) {
				console.error(`Error parsing chapter ${i} (${fullPath}):`, error);
			}
		}
		
		// Log image processing summary
		const totalImages = imageCache.size;
		console.log(`EPUB parsing complete. Extracted ${chapters.length} chapters, embedded ${totalImages} unique images.`);
		
		if (chapters.length === 0) {
			throw new Error('No readable content found in EPUB file');
		}
		
		// Extract first pages text (first 3 chapters, limited to 5000 chars)
		let firstPagesText = '';
		const firstChaptersCount = Math.min(3, chapters.length);
		for (let i = 0; i < firstChaptersCount; i++) {
			firstPagesText += chapters[i].content + '\n\n';
			if (firstPagesText.length >= 5000) break;
		}
		firstPagesText = firstPagesText.substring(0, 5000);
		
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
		console.error('EPUB parsing error:', error);
		
		// Provide detailed error context
		let errorMessage = 'Failed to parse EPUB';
		if (error instanceof Error) {
			errorMessage = error.message;
		}
		
		// Add context about what was being processed when the error occurred
		if (errorMessage.includes('container.xml')) {
			errorMessage += '. This indicates the EPUB container structure is malformed.';
		} else if (errorMessage.includes('OPF file')) {
			errorMessage += '. This indicates the OPF (Open Packaging Format) file is missing or corrupted.';
		} else if (errorMessage.includes('spine')) {
			errorMessage += '. This indicates the EPUB spine (reading order) is malformed.';
		} else if (errorMessage.includes('metadata')) {
			errorMessage += '. This indicates the EPUB metadata is missing or malformed.';
		} else if (errorMessage.includes('manifest')) {
			errorMessage += '. This indicates the EPUB manifest (file list) is missing or malformed.';
		}
		
		throw new Error(errorMessage);
	}
}

