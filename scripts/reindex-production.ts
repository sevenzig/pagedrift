#!/usr/bin/env tsx
/**
 * Production Reindexing Script
 * 
 * This script reindexes all books in the production database into Meilisearch.
 * Use this after fixing indexing bugs or when setting up a new Meilisearch instance.
 * 
 * Usage:
 *   npm run reindex:production
 * 
 * Environment Variables Required:
 *   - DATABASE_URL: PostgreSQL/SQLite database connection string
 *   - MEILISEARCH_HOST: Meilisearch server URL (e.g., http://meilisearch:7700)
 *   - MEILISEARCH_KEY: Meilisearch API key (master key)
 */

import { config } from 'dotenv';
config();

import { PrismaClient } from '@prisma/client';
import { MeiliSearch } from 'meilisearch';

const db = new PrismaClient();

const MEILISEARCH_HOST = process.env.MEILISEARCH_HOST || 'http://localhost:7700';
const MEILISEARCH_KEY = process.env.MEILISEARCH_KEY || 'masterKey';

const searchClient = new MeiliSearch({
	host: MEILISEARCH_HOST,
	apiKey: MEILISEARCH_KEY
});

const BOOKS_INDEX = 'books';
const CHAPTERS_INDEX = 'chapters';

interface IndexStats {
	totalBooks: number;
	totalChapters: number;
	successfulBooks: number;
	failedBooks: number;
	errors: Array<{ bookId: string; title: string; error: string }>;
}

async function initializeIndexes() {
	console.log('\n📋 Initializing Meilisearch indexes...');
	
	try {
		// Create Books index with primary key
		try {
			await searchClient.createIndex(BOOKS_INDEX, { primaryKey: 'id' });
			console.log('✅ Created books index');
		} catch (error: any) {
			if (!error.message?.includes('already exists')) {
				console.log('ℹ️  Books index note:', error.message);
			} else {
				console.log('ℹ️  Books index already exists');
			}
		}

		// Create Chapters index with primary key
		try {
			await searchClient.createIndex(CHAPTERS_INDEX, { primaryKey: 'id' });
			console.log('✅ Created chapters index');
		} catch (error: any) {
			if (!error.message?.includes('already exists')) {
				console.log('ℹ️  Chapters index note:', error.message);
			} else {
				console.log('ℹ️  Chapters index already exists');
			}
		}

		// Configure books index
		const booksIndex = searchClient.index(BOOKS_INDEX);
		await booksIndex.updateSettings({
			searchableAttributes: [
				'title',
				'author',
				'description',
				'subjects',
				'isbn',
				'publisher',
				'tags'
			],
			filterableAttributes: [
				'format',
				'uploadedById',
				'uploadDate',
				'publicationYear',
				'language',
				'isbn',
				'contentType',
				'publisher',
				'pageCount',
				'fileSize',
				'tags'
			],
			sortableAttributes: [
				'uploadDate',
				'title',
				'author',
				'publicationYear',
				'fileSize',
				'pageCount'
			],
			displayedAttributes: [
				'id',
				'title',
				'author',
				'format',
				'uploadDate',
				'coverImage',
				'publicationYear',
				'language',
				'tags',
				'description',
				'contentType',
				'publisher',
				'isbn',
				'pageCount',
				'fileSize'
			],
			typoTolerance: {
				enabled: true,
				minWordSizeForTypos: {
					oneTypo: 4,
					twoTypos: 8
				}
			},
			synonyms: {
				ebook: ['electronic book', 'digital book', 'e-book'],
				pdf: ['portable document format']
			}
		});

		// Configure chapters index
		const chaptersIndex = searchClient.index(CHAPTERS_INDEX);
		await chaptersIndex.updateSettings({
			searchableAttributes: ['title', 'content'],
			filterableAttributes: ['bookId'],
			displayedAttributes: ['id', 'bookId', 'title', 'content', 'order'],
			typoTolerance: {
				enabled: true,
				minWordSizeForTypos: {
					oneTypo: 4,
					twoTypos: 8
				}
			}
		});

		console.log('✅ Indexes configured successfully\n');
	} catch (error) {
		console.error('❌ Error initializing indexes:', error);
		throw error;
	}
}

async function indexBook(
	book: any,
	chapters: any[],
	tags: Array<{ tag: { name: string } }>
): Promise<void> {
	// Flatten tags to array of strings for searching
	const tagNames = tags.map((bt) => bt.tag.name);

	// Index book metadata
	const booksIndex = searchClient.index(BOOKS_INDEX);
	await booksIndex.addDocuments([
		{
			id: book.id,
			title: book.title,
			author: book.author,
			format: book.format,
			uploadedById: book.uploadedById,
			uploadDate: book.uploadDate.toISOString(),
			coverImage: book.coverImage,
			// Enhanced metadata fields
			isbn: book.isbn,
			publisher: book.publisher,
			publicationYear: book.publicationYear,
			language: book.language,
			description: book.description,
			subjects: book.subjects,
			pageCount: book.pageCount,
			fileSize: book.fileSize,
			contentType: book.contentType,
			// Tags as searchable array
			tags: tagNames
		}
	]);

	// Index chapters for full-text search
	const chaptersIndex = searchClient.index(CHAPTERS_INDEX);
	const chapterDocs = chapters.map((chapter) => ({
		id: chapter.id,
		bookId: chapter.bookId,
		title: chapter.title,
		content: chapter.content,
		order: chapter.order
	}));
	await chaptersIndex.addDocuments(chapterDocs);
}

async function reindexAllBooks(): Promise<IndexStats> {
	const stats: IndexStats = {
		totalBooks: 0,
		totalChapters: 0,
		successfulBooks: 0,
		failedBooks: 0,
		errors: []
	};

	try {
		console.log('🔍 Fetching all books from database...');
		
		// Fetch all books with their chapters and tags
		const books = await db.book.findMany({
			include: {
				chapters: {
					orderBy: {
						order: 'asc'
					}
				},
				tags: {
					include: {
						tag: true
					}
				}
			}
		});

		stats.totalBooks = books.length;
		console.log(`📚 Found ${books.length} books to index\n`);

		if (books.length === 0) {
			console.log('ℹ️  No books found in database');
			return stats;
		}

		// Index each book
		for (let i = 0; i < books.length; i++) {
			const book = books[i];
			const progress = `[${i + 1}/${books.length}]`;
			
			try {
				console.log(`${progress} Indexing: "${book.title}" by ${book.author}`);
				
				await indexBook(book, book.chapters, book.tags);
				
				stats.successfulBooks++;
				stats.totalChapters += book.chapters.length;
				
				console.log(`  ✅ Indexed ${book.chapters.length} chapters`);
			} catch (error) {
				stats.failedBooks++;
				const errorMessage = error instanceof Error ? error.message : 'Unknown error';
				stats.errors.push({
					bookId: book.id,
					title: book.title,
					error: errorMessage
				});
				console.error(`  ❌ Failed: ${errorMessage}`);
			}
		}

		return stats;
	} catch (error) {
		console.error('❌ Fatal error during reindexing:', error);
		throw error;
	}
}

async function verifyMeilisearchConnection(): Promise<boolean> {
	console.log('\n🔌 Verifying Meilisearch connection...');
	console.log(`   Host: ${MEILISEARCH_HOST}`);
	
	try {
		const health = await searchClient.health();
		console.log(`✅ Meilisearch is healthy: ${JSON.stringify(health)}`);
		return true;
	} catch (error) {
		console.error('❌ Cannot connect to Meilisearch:', error);
		console.error('\nPlease verify:');
		console.error('  1. MEILISEARCH_HOST is set correctly');
		console.error('  2. MEILISEARCH_KEY is set correctly');
		console.error('  3. Meilisearch service is running');
		console.error('  4. Network connectivity to Meilisearch');
		return false;
	}
}

async function verifyDatabaseConnection(): Promise<boolean> {
	console.log('\n🗄️  Verifying database connection...');
	console.log(`   Database: ${process.env.DATABASE_URL?.replace(/:[^:]*@/, ':***@')}`);
	
	try {
		await db.$queryRaw`SELECT 1`;
		console.log('✅ Database connection successful');
		return true;
	} catch (error) {
		console.error('❌ Cannot connect to database:', error);
		console.error('\nPlease verify:');
		console.error('  1. DATABASE_URL is set correctly');
		console.error('  2. Database service is running');
		console.error('  3. Database migrations are up to date');
		return false;
	}
}

async function printStats(stats: IndexStats): Promise<void> {
	console.log('\n' + '='.repeat(60));
	console.log('📊 REINDEXING SUMMARY');
	console.log('='.repeat(60));
	console.log(`Total Books:        ${stats.totalBooks}`);
	console.log(`Successful:         ${stats.successfulBooks} ✅`);
	console.log(`Failed:             ${stats.failedBooks} ❌`);
	console.log(`Total Chapters:     ${stats.totalChapters}`);
	console.log('='.repeat(60));

	if (stats.errors.length > 0) {
		console.log('\n❌ ERRORS:');
		stats.errors.forEach((error, index) => {
			console.log(`\n${index + 1}. Book: ${error.title} (ID: ${error.bookId})`);
			console.log(`   Error: ${error.error}`);
		});
		console.log('');
	}

	// Get index stats
	try {
		const booksIndex = searchClient.index(BOOKS_INDEX);
		const chaptersIndex = searchClient.index(CHAPTERS_INDEX);
		
		const booksStats = await booksIndex.getStats();
		const chaptersStats = await chaptersIndex.getStats();

		console.log('\n📈 MEILISEARCH INDEX STATS:');
		console.log(`Books Index:        ${booksStats.numberOfDocuments} documents`);
		console.log(`Chapters Index:     ${chaptersStats.numberOfDocuments} documents`);
	} catch (error) {
		console.error('⚠️  Could not fetch index stats:', error);
	}

	console.log('\n✨ Reindexing complete!\n');
}

async function main() {
	console.log('\n' + '='.repeat(60));
	console.log('🚀 PRODUCTION REINDEXING SCRIPT');
	console.log('='.repeat(60));

	try {
		// Step 1: Verify connections
		const dbOk = await verifyDatabaseConnection();
		const searchOk = await verifyMeilisearchConnection();

		if (!dbOk || !searchOk) {
			console.error('\n❌ Cannot proceed due to connection errors');
			process.exit(1);
		}

		// Step 2: Initialize indexes
		await initializeIndexes();

		// Step 3: Reindex all books
		console.log('🔄 Starting reindexing process...\n');
		const stats = await reindexAllBooks();

		// Step 4: Print summary
		await printStats(stats);

		// Exit with appropriate code
		if (stats.failedBooks > 0) {
			console.error('⚠️  Some books failed to index. Please review errors above.');
			process.exit(1);
		} else {
			process.exit(0);
		}
	} catch (error) {
		console.error('\n❌ FATAL ERROR:', error);
		process.exit(1);
	} finally {
		await db.$disconnect();
	}
}

// Run the script
main();

