/**
 * Script to reindex all books in MeiliSearch
 * Run with: npx tsx scripts/reindex-books.ts
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

async function initializeIndexes() {
	try {
		// Create Books index with primary key
		try {
			await searchClient.createIndex(BOOKS_INDEX, { primaryKey: 'id' });
			console.log('Created books index');
		} catch (error: any) {
			if (!error.message?.includes('already exists')) {
				console.log('Books index note:', error.message);
			}
		}

		// Create Chapters index with primary key
		try {
			await searchClient.createIndex(CHAPTERS_INDEX, { primaryKey: 'id' });
			console.log('Created chapters index');
		} catch (error: any) {
			if (!error.message?.includes('already exists')) {
				console.log('Chapters index note:', error.message);
			}
		}

		// Configure books index
		const booksIndex = searchClient.index(BOOKS_INDEX);
		await booksIndex.updateSettings({
			searchableAttributes: ['title', 'author'],
			filterableAttributes: ['format', 'uploadedById', 'uploadDate'],
			sortableAttributes: ['uploadDate', 'title'],
			displayedAttributes: ['id', 'title', 'author', 'format', 'uploadDate', 'coverImage']
		});

		// Configure chapters index
		const chaptersIndex = searchClient.index(CHAPTERS_INDEX);
		await chaptersIndex.updateSettings({
			searchableAttributes: ['title', 'content'],
			filterableAttributes: ['bookId'],
			displayedAttributes: ['id', 'bookId', 'title', 'content', 'order']
		});

		console.log('Indexes configured successfully');
	} catch (error) {
		console.error('Error initializing indexes:', error);
		throw error;
	}
}

async function indexBook(book: any, chapters: any[]) {
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
			coverImage: book.coverImage
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

async function reindexAllBooks() {
	try {
		console.log('Initializing MeiliSearch indexes...');
		await initializeIndexes();
		
		console.log('Fetching all books from database...');
		const books = await db.book.findMany({
			include: {
				chapters: {
					orderBy: { order: 'asc' }
				}
			}
		});
		
		console.log(`Found ${books.length} books to reindex`);
		
		for (const book of books) {
			console.log(`\nIndexing: ${book.title} (${book.chapters.length} chapters)`);
			try {
				await indexBook(book, book.chapters);
				console.log(`✓ Successfully indexed: ${book.title}`);
			} catch (error) {
				console.error(`✗ Failed to index ${book.title}:`, error);
			}
		}
		
		console.log('\n✓ Reindexing complete!');
		process.exit(0);
	} catch (error) {
		console.error('Error during reindexing:', error);
		process.exit(1);
	}
}

reindexAllBooks();

