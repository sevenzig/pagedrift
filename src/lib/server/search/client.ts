import { MeiliSearch } from 'meilisearch';
import { env } from '$env/dynamic/private';

const MEILISEARCH_HOST = env.MEILISEARCH_HOST || 'http://localhost:7700';
const MEILISEARCH_KEY = env.MEILISEARCH_KEY || 'masterKey';

export const searchClient = new MeiliSearch({
	host: MEILISEARCH_HOST,
	apiKey: MEILISEARCH_KEY
});

export const BOOKS_INDEX = 'books';
export const CHAPTERS_INDEX = 'chapters';

// Initialize indexes with configuration
export async function initializeIndexes() {
	try {
		// Create Books index with primary key
		try {
			await searchClient.createIndex(BOOKS_INDEX, { primaryKey: 'id' });
			console.log('Created books index');
		} catch (error: any) {
			// Index might already exist
			if (!error.message?.includes('already exists')) {
				console.log('Books index creation note:', error.message);
			}
		}

		// Create Chapters index with primary key
		try {
			await searchClient.createIndex(CHAPTERS_INDEX, { primaryKey: 'id' });
			console.log('Created chapters index');
		} catch (error: any) {
			// Index might already exist
			if (!error.message?.includes('already exists')) {
				console.log('Chapters index creation note:', error.message);
			}
		}

		// Books index (metadata search) - configure settings
		const booksIndex = searchClient.index(BOOKS_INDEX);
		await booksIndex.updateSettings({
			searchableAttributes: ['title', 'author'],
			filterableAttributes: ['format', 'uploadedById', 'uploadDate'],
			sortableAttributes: ['uploadDate', 'title'],
			displayedAttributes: ['id', 'title', 'author', 'format', 'uploadDate', 'coverImage']
		});

		// Chapters index (full-text search) - configure settings
		const chaptersIndex = searchClient.index(CHAPTERS_INDEX);
		await chaptersIndex.updateSettings({
			searchableAttributes: ['title', 'content'],
			filterableAttributes: ['bookId'],
			displayedAttributes: ['id', 'bookId', 'title', 'content', 'order']
		});

		console.log('Meilisearch indexes initialized successfully');
	} catch (error) {
		console.error('Error initializing Meilisearch indexes:', error);
	}
}

