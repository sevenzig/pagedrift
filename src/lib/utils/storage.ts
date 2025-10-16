import localforage from 'localforage';
import type { Book, ReaderState, ReaderSettings } from '$lib/types';

const BOOKS_KEY = 'ebook-reader-books';
const READER_STATE_KEY = 'ebook-reader-state';
const SETTINGS_KEY = 'ebook-reader-settings';

localforage.config({
	name: 'MarkdownEbookReader',
	storeName: 'books'
});

export async function saveBooks(books: Book[]): Promise<void> {
	// Deep clone to remove any proxy objects and serialize dates
	const serialized = JSON.parse(JSON.stringify(books));
	await localforage.setItem(BOOKS_KEY, serialized);
}

export async function loadBooks(): Promise<Book[]> {
	const books = await localforage.getItem<Book[]>(BOOKS_KEY);
	if (!books) return [];
	
	// Restore Date objects
	return books.map(book => ({
		...book,
		uploadDate: new Date(book.uploadDate),
		lastRead: book.lastRead ? new Date(book.lastRead) : undefined
	}));
}

export async function saveReaderState(state: ReaderState): Promise<void> {
	// Deep clone to remove any proxy objects
	const serialized = JSON.parse(JSON.stringify(state));
	await localforage.setItem(READER_STATE_KEY, serialized);
}

export async function loadReaderState(): Promise<ReaderState> {
	const state = await localforage.getItem<ReaderState>(READER_STATE_KEY);
	return (
		state || {
			currentBookId: null,
			currentChapterId: null,
			scrollPosition: 0
		}
	);
}

export async function saveSettings(settings: ReaderSettings): Promise<void> {
	// Deep clone to remove any proxy objects
	const serialized = JSON.parse(JSON.stringify(settings));
	await localforage.setItem(SETTINGS_KEY, serialized);
}

export async function loadSettings(): Promise<ReaderSettings> {
	const settings = await localforage.getItem<ReaderSettings>(SETTINGS_KEY);
	return (
		settings || {
			fontSize: 'md',
			fontFamily: 'serif',
			lineHeight: 'relaxed',
			theme: 'system'
		}
	);
}
