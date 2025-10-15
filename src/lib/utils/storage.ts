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
	await localforage.setItem(BOOKS_KEY, books);
}

export async function loadBooks(): Promise<Book[]> {
	const books = await localforage.getItem<Book[]>(BOOKS_KEY);
	return books || [];
}

export async function saveReaderState(state: ReaderState): Promise<void> {
	await localforage.setItem(READER_STATE_KEY, state);
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
	await localforage.setItem(SETTINGS_KEY, settings);
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
