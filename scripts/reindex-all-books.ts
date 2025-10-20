/**
 * Reindex All Books Script
 * 
 * This script reindexes all books in the database with the updated MeiliSearch configuration.
 * It includes all metadata fields and tags to support advanced search syntax.
 * 
 * Usage: npx tsx scripts/reindex-all-books.ts
 */

import { PrismaClient } from '@prisma/client';
import { searchClient, BOOKS_INDEX, CHAPTERS_INDEX, initializeIndexes } from '../src/lib/server/search/client';
import { indexBook } from '../src/lib/server/search/indexing';

const db = new PrismaClient();

async function reindexAllBooks() {
	console.log('Starting reindex of all books...');
	
	try {
		// Step 1: Clear existing indexes
		console.log('\n1. Clearing existing indexes...');
		try {
			await searchClient.deleteIndex(BOOKS_INDEX);
			console.log(`   Deleted ${BOOKS_INDEX} index`);
		} catch (error) {
			console.log(`   ${BOOKS_INDEX} index doesn't exist or already deleted`);
		}
		
		try {
			await searchClient.deleteIndex(CHAPTERS_INDEX);
			console.log(`   Deleted ${CHAPTERS_INDEX} index`);
		} catch (error) {
			console.log(`   ${CHAPTERS_INDEX} index doesn't exist or already deleted`);
		}
		
		// Wait a moment for indexes to be fully deleted
		await new Promise(resolve => setTimeout(resolve, 1000));
		
		// Step 2: Reinitialize indexes with new configuration
		console.log('\n2. Reinitializing indexes with new configuration...');
		await initializeIndexes();
		console.log('   Indexes reinitialized successfully');
		
		// Wait for settings to be applied
		await new Promise(resolve => setTimeout(resolve, 2000));
		
		// Step 3: Fetch all books from database with tags
		console.log('\n3. Fetching all books from database...');
		const books = await db.book.findMany({
			include: {
				chapters: true,
				tags: {
					include: {
						tag: true
					}
				}
			}
		});
		console.log(`   Found ${books.length} books to reindex`);
		
		// Step 4: Reindex each book
		console.log('\n4. Reindexing books...');
		let successCount = 0;
		let errorCount = 0;
		
		for (const book of books) {
			try {
				await indexBook(book, book.chapters, book.tags);
				successCount++;
				console.log(`   ✓ Indexed: ${book.title} (${book.chapters.length} chapters, ${book.tags.length} tags)`);
			} catch (error) {
				errorCount++;
				console.error(`   ✗ Failed to index ${book.title}:`, error);
			}
		}
		
		// Step 5: Summary
		console.log('\n5. Reindexing complete!');
		console.log(`   Success: ${successCount} books`);
		console.log(`   Errors: ${errorCount} books`);
		console.log(`   Total: ${books.length} books`);
		
		// Verify indexes
		console.log('\n6. Verifying indexes...');
		const booksIndex = searchClient.index(BOOKS_INDEX);
		const chaptersIndex = searchClient.index(CHAPTERS_INDEX);
		
		const booksStats = await booksIndex.getStats();
		const chaptersStats = await chaptersIndex.getStats();
		
		console.log(`   Books index: ${booksStats.numberOfDocuments} documents`);
		console.log(`   Chapters index: ${chaptersStats.numberOfDocuments} documents`);
		
		console.log('\n✓ Reindexing completed successfully!');
		
	} catch (error) {
		console.error('\n✗ Error during reindexing:', error);
		process.exit(1);
	} finally {
		await db.$disconnect();
	}
}

// Run the reindex
reindexAllBooks()
	.then(() => {
		console.log('\nDone!');
		process.exit(0);
	})
	.catch((error) => {
		console.error('\nFatal error:', error);
		process.exit(1);
	});

