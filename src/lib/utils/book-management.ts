/**
 * Book management utilities for handling edge cases and advanced operations
 * Includes duplicate detection, metadata enhancement, and bulk operations
 */

import { db } from '$lib/server/db';
import { getBooksByAuthor, findBookPath, getStorageStats } from './storage';
import { normalizeAuthor, normalizeTitle, validateIsbn, type BookMetadata } from './metadata';

export interface BookConflict {
	type: 'duplicate_isbn' | 'duplicate_title_author' | 'similar_title';
	existingBook: any;
	newBook: BookMetadata;
	confidence: number;
}

export interface BookEnhancement {
	bookId: string;
	enhancedMetadata: Partial<BookMetadata>;
	source: 'isbn_lookup' | 'manual_edit' | 'ai_analysis';
}

/**
 * Check for potential book conflicts before upload
 */
export async function checkBookConflicts(
	metadata: BookMetadata,
	excludeBookId?: string
): Promise<BookConflict[]> {
	const conflicts: BookConflict[] = [];
	
	// Check for duplicate ISBN
	if (metadata.isbn) {
		const existingByIsbn = await db.book.findFirst({
			where: {
				isbn: metadata.isbn,
				...(excludeBookId && { id: { not: excludeBookId } })
			}
		});
		
		if (existingByIsbn) {
			conflicts.push({
				type: 'duplicate_isbn',
				existingBook: existingByIsbn,
				newBook: metadata,
				confidence: 0.95
			});
		}
	}
	
	// Check for duplicate title + author combination
	if (metadata.title && metadata.author) {
		const existingByTitleAuthor = await db.book.findFirst({
			where: {
				title: { equals: metadata.title, mode: 'insensitive' },
				author: { equals: metadata.author, mode: 'insensitive' },
				...(excludeBookId && { id: { not: excludeBookId } })
			}
		});
		
		if (existingByTitleAuthor) {
			conflicts.push({
				type: 'duplicate_title_author',
				existingBook: existingByTitleAuthor,
				newBook: metadata,
				confidence: 0.9
			});
		}
	}
	
	// Check for similar titles (fuzzy matching)
	if (metadata.title) {
		const normalizedTitle = normalizeTitle(metadata.title);
		const similarBooks = await db.book.findMany({
			where: {
				normalizedTitle: { contains: normalizedTitle.substring(0, 10) },
				...(excludeBookId && { id: { not: excludeBookId } })
			}
		});
		
		for (const book of similarBooks) {
			const similarity = calculateTitleSimilarity(metadata.title, book.title);
			if (similarity > 0.8) {
				conflicts.push({
					type: 'similar_title',
					existingBook: book,
					newBook: metadata,
					confidence: similarity
				});
			}
		}
	}
	
	return conflicts;
}

/**
 * Calculate similarity between two titles using simple string comparison
 */
function calculateTitleSimilarity(title1: string, title2: string): number {
	const t1 = title1.toLowerCase().replace(/[^\w\s]/g, '');
	const t2 = title2.toLowerCase().replace(/[^\w\s]/g, '');
	
	const words1 = t1.split(/\s+/);
	const words2 = t2.split(/\s+/);
	
	const commonWords = words1.filter(word => words2.includes(word));
	const totalWords = Math.max(words1.length, words2.length);
	
	return commonWords.length / totalWords;
}

/**
 * Enhance book metadata using external sources
 */
export async function enhanceBookMetadata(
	bookId: string,
	enhancement: BookEnhancement
): Promise<void> {
	await db.book.update({
		where: { id: bookId },
		data: {
			...(enhancement.enhancedMetadata.isbn && { isbn: enhancement.enhancedMetadata.isbn }),
			...(enhancement.enhancedMetadata.publisher && { publisher: enhancement.enhancedMetadata.publisher }),
			...(enhancement.enhancedMetadata.publicationYear && { publicationYear: enhancement.enhancedMetadata.publicationYear }),
			...(enhancement.enhancedMetadata.language && { language: enhancement.enhancedMetadata.language }),
			...(enhancement.enhancedMetadata.description && { description: enhancement.enhancedMetadata.description }),
			...(enhancement.enhancedMetadata.subjects && { subjects: enhancement.enhancedMetadata.subjects.join(', ') }),
			...(enhancement.enhancedMetadata.pageCount && { pageCount: enhancement.enhancedMetadata.pageCount }),
			...(enhancement.enhancedMetadata.normalizedAuthor && { normalizedAuthor: enhancement.enhancedMetadata.normalizedAuthor }),
			...(enhancement.enhancedMetadata.normalizedTitle && { normalizedTitle: enhancement.enhancedMetadata.normalizedTitle })
		}
	});
}

/**
 * Get books organized by author for library browsing
 */
export async function getBooksByAuthorGrouped(): Promise<Record<string, any[]>> {
	const books = await db.book.findMany({
		orderBy: [
			{ normalizedAuthor: 'asc' },
			{ normalizedTitle: 'asc' }
		],
		include: {
			uploadedBy: {
				select: { email: true }
			}
		}
	});
	
	const grouped: Record<string, any[]> = {};
	
	for (const book of books) {
		const author = book.normalizedAuthor || 'unknown-author';
		if (!grouped[author]) {
			grouped[author] = [];
		}
		grouped[author].push(book);
	}
	
	return grouped;
}

/**
 * Search books by various criteria
 */
export async function searchBooks(criteria: {
	query?: string;
	author?: string;
	year?: number;
	isbn?: string;
	language?: string;
	format?: string;
}): Promise<any[]> {
	const where: any = {};
	
	if (criteria.query) {
		where.OR = [
			{ title: { contains: criteria.query, mode: 'insensitive' } },
			{ author: { contains: criteria.query, mode: 'insensitive' } },
			{ description: { contains: criteria.query, mode: 'insensitive' } },
			{ subjects: { contains: criteria.query, mode: 'insensitive' } }
		];
	}
	
	if (criteria.author) {
		where.author = { contains: criteria.author, mode: 'insensitive' };
	}
	
	if (criteria.year) {
		where.publicationYear = criteria.year;
	}
	
	if (criteria.isbn) {
		where.isbn = criteria.isbn;
	}
	
	if (criteria.language) {
		where.language = criteria.language;
	}
	
	if (criteria.format) {
		where.format = criteria.format;
	}
	
	return db.book.findMany({
		where,
		orderBy: { uploadDate: 'desc' },
		include: {
			uploadedBy: {
				select: { email: true }
			}
		}
	});
}

/**
 * Get library statistics
 */
export async function getLibraryStats(): Promise<{
	totalBooks: number;
	totalAuthors: number;
	booksByFormat: Record<string, number>;
	booksByYear: Record<string, number>;
	booksByLanguage: Record<string, number>;
	averageFileSize: number;
	totalStorageUsed: number;
}> {
	const books = await db.book.findMany({
		select: {
			format: true,
			publicationYear: true,
			language: true,
			fileSize: true
		}
	});
	
	const stats = {
		totalBooks: books.length,
		totalAuthors: new Set(books.map(b => b.normalizedAuthor).filter(Boolean)).size,
		booksByFormat: {} as Record<string, number>,
		booksByYear: {} as Record<string, number>,
		booksByLanguage: {} as Record<string, number>,
		averageFileSize: 0,
		totalStorageUsed: 0
	};
	
	let totalFileSize = 0;
	
	for (const book of books) {
		// Count by format
		stats.booksByFormat[book.format] = (stats.booksByFormat[book.format] || 0) + 1;
		
		// Count by year
		if (book.publicationYear) {
			const year = book.publicationYear.toString();
			stats.booksByYear[year] = (stats.booksByYear[year] || 0) + 1;
		}
		
		// Count by language
		if (book.language) {
			stats.booksByLanguage[book.language] = (stats.booksByLanguage[book.language] || 0) + 1;
		}
		
		// Calculate file sizes
		if (book.fileSize) {
			totalFileSize += book.fileSize;
		}
	}
	
	stats.totalStorageUsed = totalFileSize;
	stats.averageFileSize = books.length > 0 ? totalFileSize / books.length : 0;
	
	return stats;
}

/**
 * Clean up orphaned files and directories
 */
export async function cleanupOrphanedFiles(basePath: string): Promise<{
	removedFiles: number;
	removedDirectories: number;
	freedSpace: number;
}> {
	// This would require file system operations to check for files
	// that exist on disk but not in the database
	// Implementation would depend on specific cleanup requirements
	
	return {
		removedFiles: 0,
		removedDirectories: 0,
		freedSpace: 0
	};
}

/**
 * Validate and fix metadata inconsistencies
 */
export async function validateMetadata(): Promise<{
	invalidIsbns: string[];
	missingNormalizedFields: string[];
	duplicateIsbns: string[];
}> {
	const books = await db.book.findMany({
		select: {
			id: true,
			title: true,
			author: true,
			isbn: true,
			normalizedAuthor: true,
			normalizedTitle: true
		}
	});
	
	const result = {
		invalidIsbns: [] as string[],
		missingNormalizedFields: [] as string[],
		duplicateIsbns: [] as string[]
	};
	
	const isbnCounts: Record<string, string[]> = {};
	
	for (const book of books) {
		// Check ISBN validity
		if (book.isbn && !validateIsbn(book.isbn)) {
			result.invalidIsbns.push(book.id);
		}
		
		// Check for missing normalized fields
		if (!book.normalizedAuthor || !book.normalizedTitle) {
			result.missingNormalizedFields.push(book.id);
		}
		
		// Check for duplicate ISBNs
		if (book.isbn) {
			if (!isbnCounts[book.isbn]) {
				isbnCounts[book.isbn] = [];
			}
			isbnCounts[book.isbn].push(book.id);
		}
	}
	
	// Find duplicate ISBNs
	for (const [isbn, bookIds] of Object.entries(isbnCounts)) {
		if (bookIds.length > 1) {
			result.duplicateIsbns.push(...bookIds);
		}
	}
	
	return result;
}
