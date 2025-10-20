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

	// Chapters index (full-text search) - configure settings
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

		console.log('Meilisearch indexes initialized successfully');
	} catch (error) {
		console.error('Error initializing Meilisearch indexes:', error);
	}
}

