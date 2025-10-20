/**
 * Client-side storage utilities for browser localStorage
 * Safe to import in Svelte components and stores
 */

import type { ReaderSettings, ReaderState, Book } from '$lib/types';

/**
 * Save reader settings to localStorage
 */
export async function saveSettings(settings: ReaderSettings): Promise<void> {
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem('reader-settings', JSON.stringify(settings));
	}
}

/**
 * Load reader settings from localStorage
 */
export async function loadSettings(): Promise<ReaderSettings> {
	if (typeof localStorage !== 'undefined') {
		const saved = localStorage.getItem('reader-settings');
		if (saved) {
			try {
				return JSON.parse(saved);
			} catch (error) {
				console.error('Error parsing saved settings:', error);
			}
		}
	}
	
	// Return default settings
	return {
		fontSize: 'md',
		fontFamily: 'serif',
		lineHeight: 'relaxed',
		theme: 'system'
	};
}

/**
 * Save reader state to localStorage
 */
export async function saveReaderState(state: ReaderState): Promise<void> {
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem('reader-state', JSON.stringify(state));
	}
}

/**
 * Load reader state from localStorage
 */
export async function loadReaderState(): Promise<ReaderState> {
	if (typeof localStorage !== 'undefined') {
		const saved = localStorage.getItem('reader-state');
		if (saved) {
			try {
				return JSON.parse(saved);
			} catch (error) {
				console.error('Error parsing saved reader state:', error);
			}
		}
	}
	
	// Return default state
	return {
		currentBookId: null,
		currentChapterId: null,
		scrollPosition: 0
	};
}

/**
 * Save books to localStorage
 * Note: This is a client-side cache, actual data comes from the server
 */
export async function saveBooks(books: Book[]): Promise<void> {
	if (typeof localStorage !== 'undefined') {
		localStorage.setItem('books-cache', JSON.stringify(books));
	}
}

/**
 * Load books from localStorage
 * Note: This is a client-side cache, actual data comes from the server
 */
export async function loadBooks(): Promise<Book[]> {
	if (typeof localStorage !== 'undefined') {
		const saved = localStorage.getItem('books-cache');
		if (saved) {
			try {
				return JSON.parse(saved);
			} catch (error) {
				console.error('Error parsing saved books:', error);
			}
		}
	}
	
	return [];
}

