/**
 * Test script for image extraction implementation
 * Tests the robust image extraction with a real ePub file
 * 
 * Usage: npx tsx scripts/test-image-extraction.ts
 */

import { readFileSync } from 'fs';
import { parseEpub } from '../src/lib/server/parsers/epub-parser';
import { join } from 'path';

async function testImageExtraction() {
	console.log('='.repeat(80));
	console.log('Testing Robust Image Extraction Implementation');
	console.log('='.repeat(80));
	console.log();

	try {
		// Path to test ePub file
		const epubPath = join(process.cwd(), '../../test/2003 Ken Schramm - The Compleat Meadmaker_Ral.epub');
		
		console.log(`📖 Reading ePub file: ${epubPath}`);
		const buffer = readFileSync(epubPath);
		console.log(`✓ File loaded: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
		console.log();
		
		console.log('🔍 Parsing ePub with image extraction...');
		console.log('-'.repeat(80));
		const parsed = await parseEpub(buffer);
		console.log('-'.repeat(80));
		console.log();
		
		console.log('📊 Parsing Results:');
		console.log(`  Title: ${parsed.title}`);
		console.log(`  Author: ${parsed.author || 'Unknown'}`);
		console.log(`  Chapters: ${parsed.chapters.length}`);
		console.log(`  Has Cover: ${parsed.coverImage ? 'Yes' : 'No'}`);
		console.log();
		
		// Count embedded images in markdown
		const base64ImagePattern = /!\[.*?\]\(data:image\//g;
		let totalEmbeddedImages = 0;
		const chapterImageCounts: { chapter: string; count: number }[] = [];
		
		for (const chapter of parsed.chapters) {
			const matches = chapter.content.match(base64ImagePattern);
			const count = matches ? matches.length : 0;
			if (count > 0) {
				chapterImageCounts.push({ chapter: chapter.title, count });
			}
			totalEmbeddedImages += count;
		}
		
		console.log('🖼️  Embedded Images Analysis:');
		console.log(`  Total embedded images: ${totalEmbeddedImages}`);
		console.log();
		
		if (chapterImageCounts.length > 0) {
			console.log('  Images per chapter:');
			for (const { chapter, count } of chapterImageCounts) {
				console.log(`    - "${chapter}": ${count} image(s)`);
			}
			console.log();
			
			// Show sample of first embedded image
			const firstChapterWithImages = parsed.chapters.find(c => c.content.match(base64ImagePattern));
			if (firstChapterWithImages) {
				const firstImageMatch = firstChapterWithImages.content.match(/!\[.*?\]\(data:image\/([^;]+);base64,[A-Za-z0-9+/]{50}/);
				if (firstImageMatch) {
					console.log('  Sample embedded image:');
					console.log(`    Format: ${firstImageMatch[1]}`);
					console.log(`    Data: data:image/${firstImageMatch[1]};base64,[truncated]...`);
					console.log();
				}
			}
		}
		
		// Calculate markdown size
		const markdownSize = Buffer.byteLength(parsed.markdown, 'utf8');
		console.log('📝 Markdown Output:');
		console.log(`  Total size: ${(markdownSize / 1024).toFixed(2)} KB`);
		console.log(`  Size increase from images: ${totalEmbeddedImages > 0 ? 'Yes (base64 encoding adds ~33%)' : 'N/A'}`);
		console.log();
		
		console.log('='.repeat(80));
		if (totalEmbeddedImages > 0) {
			console.log('✅ SUCCESS: Images were extracted and embedded!');
		} else {
			console.log('ℹ️  NOTE: No images found in this ePub file.');
		}
		console.log('='.repeat(80));
		
	} catch (error) {
		console.error();
		console.error('❌ ERROR:', error instanceof Error ? error.message : error);
		console.error();
		if (error instanceof Error && error.stack) {
			console.error('Stack trace:');
			console.error(error.stack);
		}
		process.exit(1);
	}
}

// Run the test
testImageExtraction();

