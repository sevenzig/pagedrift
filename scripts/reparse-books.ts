/**
 * Script to re-parse all books in the library
 * This will update the database with freshly parsed content
 * Useful after parser improvements (like table formatting fixes)
 * 
 * Run with: npx tsx scripts/reparse-books.ts
 */

import { PrismaClient } from '@prisma/client';
import { readFile } from 'fs/promises';
import { basename } from 'path';
import { parseBook } from '../src/lib/server/parsers/index.js';

const prisma = new PrismaClient();

async function reparseAllBooks() {
	try {
		console.log('🔄 Starting to re-parse all books...\n');
		
		// Get all books from the database
		const books = await prisma.book.findMany({
			select: {
				id: true,
				title: true,
				author: true,
				format: true,
				filePath: true
			}
		});
		
		console.log(`📚 Found ${books.length} books to re-parse\n`);
		
		if (books.length === 0) {
			console.log('No books found in the library');
			return;
		}
		
		let successCount = 0;
		let errorCount = 0;
		
		for (let i = 0; i < books.length; i++) {
			const book = books[i];
			console.log(`[${i + 1}/${books.length}] Re-parsing: "${book.title}" by ${book.author || 'Unknown'}`);
			
			try {
				// Read the book file
				const buffer = await readFile(book.filePath);
				
				// Parse the book
				const parsed = await parseBook(
					buffer,
					basename(book.filePath),
					book.format as 'epub' | 'pdf' | 'mobi'
				);
				
				// Delete existing chapters
				await prisma.chapter.deleteMany({
					where: { bookId: book.id }
				});
				
				// Update book with new parsed data
				await prisma.book.update({
					where: { id: book.id },
					data: {
						title: parsed.title,
						author: parsed.author,
						coverImage: parsed.coverImage,
						markdown: parsed.markdown,
						// Update metadata if available
						isbn: parsed.metadata?.isbn,
						publisher: parsed.metadata?.publisher,
						publicationYear: parsed.metadata?.publicationYear,
						language: parsed.metadata?.language,
						description: parsed.metadata?.description,
						subjects: parsed.metadata?.subjects?.join(', '),
						pageCount: parsed.metadata?.pageCount,
						normalizedAuthor: parsed.metadata?.normalizedAuthor,
						normalizedTitle: parsed.metadata?.normalizedTitle,
						// Create new chapters
						chapters: {
							create: parsed.chapters.map((chapter, index) => ({
								title: chapter.title,
								content: chapter.content,
								level: chapter.level,
								order: chapter.order ?? index
							}))
						}
					}
				});
				
				console.log(`  ✅ Successfully re-parsed (${parsed.chapters.length} chapters)\n`);
				successCount++;
				
			} catch (error) {
				console.error(`  ❌ Error re-parsing book:`, error instanceof Error ? error.message : error);
				console.error(`     File path: ${book.filePath}\n`);
				errorCount++;
			}
		}
		
		console.log('─'.repeat(60));
		console.log(`\n✨ Re-parsing complete!`);
		console.log(`   Success: ${successCount}/${books.length}`);
		if (errorCount > 0) {
			console.log(`   Failed:  ${errorCount}/${books.length}`);
		}
		console.log('');
		
	} catch (error) {
		console.error('Fatal error during re-parsing:', error);
		throw error;
	} finally {
		await prisma.$disconnect();
	}
}

// Run if executed directly
reparseAllBooks()
	.then(() => {
		process.exit(0);
	})
	.catch((error) => {
		console.error('Script failed:', error);
		process.exit(1);
	});

