import TurndownService from 'turndown';
import { JSDOM } from 'jsdom';
import type { Chapter } from '$lib/types';
import AdmZip from 'adm-zip';
import { parseStringPromise } from 'xml2js';

interface ParsedBook {
	title: string;
	author?: string;
	coverImage?: string;
	markdown: string;
	chapters: Omit<Chapter, 'id'>[];
}

function cleanMarkdown(markdown: string): string {
	return markdown
		.replace(/\n{4,}/g, '\n\n')
		.replace(/([^\n])\n([^\n])/g, '$1\n\n$2')
		.replace(/\n{3,}/g, '\n\n')
		.replace(/^(#{1,6}\s+.+)$/gm, '$1\n')
		.replace(/([^\n])\n([*\-+]\s)/g, '$1\n\n$2')
		.replace(/([*\-+]\s.+)\n([^\n*\-+])/g, '$1\n\n$2')
		.trim();
}

export async function parseEpub(buffer: Buffer): Promise<ParsedBook> {
	try {
		console.log('Starting EPUB parsing...');
		const zip = new AdmZip(buffer);
		const zipEntries = zip.getEntries();
		
		// Find container.xml to get the OPF file location
		const containerEntry = zipEntries.find(entry => entry.entryName === 'META-INF/container.xml');
		if (!containerEntry) {
			throw new Error('Invalid EPUB: META-INF/container.xml not found');
		}
		
		const containerXml = containerEntry.getData().toString('utf8');
		const containerData = await parseStringPromise(containerXml);
		const opfPath = containerData.container.rootfiles[0].rootfile[0].$['full-path'];
		console.log('OPF path:', opfPath);
		
		// Get OPF file
		const opfEntry = zipEntries.find(entry => entry.entryName === opfPath);
		if (!opfEntry) {
			throw new Error(`OPF file not found: ${opfPath}`);
		}
		
		const opfXml = opfEntry.getData().toString('utf8');
		const opfData = await parseStringPromise(opfXml);
		const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);
		
		// Extract metadata
		const metadata = opfData.package.metadata[0];
		const title = metadata['dc:title']?.[0]?._ || metadata['dc:title']?.[0] || 'Untitled';
		const author = metadata['dc:creator']?.[0]?._ || metadata['dc:creator']?.[0] || undefined;
		console.log('Title:', title, 'Author:', author);
		
		// Extract cover image
		let coverImage: string | undefined;
		try {
			const coverMeta = metadata.meta?.find((m: any) => m.$?.name === 'cover');
			if (coverMeta) {
				const coverId = coverMeta.$.content;
				const coverItem = opfData.package.manifest[0].item.find((item: any) => item.$.id === coverId);
				if (coverItem) {
					const coverPath = opfDir + coverItem.$.href;
					const coverEntry = zipEntries.find(entry => entry.entryName === coverPath);
					if (coverEntry) {
						const coverBuffer = coverEntry.getData();
						const mimeType = coverItem.$['media-type'];
						coverImage = `data:${mimeType};base64,${coverBuffer.toString('base64')}`;
						console.log('Cover image extracted');
					}
				}
			}
		} catch (error) {
			console.log('Could not extract cover image:', error);
		}
		
		// Get spine (reading order)
		const spine = opfData.package.spine[0].itemref;
		const manifest = opfData.package.manifest[0].item;
		const chapters: Omit<Chapter, 'id'>[] = [];
		let fullMarkdown = '';
		
		const turndownService = new TurndownService({
			headingStyle: 'atx',
			codeBlockStyle: 'fenced',
			emDelimiter: '_',
			bulletListMarker: '-'
		});
		
		console.log(`Processing ${spine.length} spine items...`);
		
		// Process each spine item
		for (let i = 0; i < spine.length; i++) {
			const spineItem = spine[i];
			const idref = spineItem.$.idref;
			
			// Find the corresponding manifest item
			const manifestItem = manifest.find((item: any) => item.$.id === idref);
			if (!manifestItem) {
				console.log(`Manifest item not found for ${idref}`);
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
				
				// Convert to markdown
				const markdown = turndownService.turndown(bodyHtml);
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
		
		console.log(`EPUB parsing complete. Extracted ${chapters.length} chapters.`);
		
		if (chapters.length === 0) {
			throw new Error('No readable content found in EPUB file');
		}
		
		return {
			title,
			author,
			coverImage,
			markdown: fullMarkdown.trim(),
			chapters
		};
	} catch (error) {
		console.error('EPUB parsing error:', error);
		throw new Error(`Failed to parse EPUB: ${error instanceof Error ? error.message : 'Unknown error'}`);
	}
}

