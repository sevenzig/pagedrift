/**
 * Server-side storage utilities for organizing books in /author/title/ folder structure
 * Handles path generation, conflict resolution, and file operations
 * 
 * WARNING: This file uses Node.js fs/promises and should only be imported in server-side code (+server.ts files)
 */

import { readdir, stat, mkdir, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { generateBookPath, handleEditionConflict, type BookMetadata } from './metadata';

export interface StorageOptions {
	basePath: string;
	createDirectories?: boolean;
	handleConflicts?: boolean;
}

/**
 * Generate a unique storage path for a book
 */
export async function generateStoragePath(
	metadata: BookMetadata,
	options: StorageOptions
): Promise<string> {
	const basePath = options.basePath;
	const bookPath = generateBookPath(metadata);
	const fullPath = join(basePath, bookPath);
	
	// Check if path already exists
	if (options.handleConflicts !== false) {
		const existingPaths = await getExistingPaths(basePath, bookPath);
		if (existingPaths.length > 0) {
			return handleEditionConflict(bookPath, existingPaths);
		}
	}
	
	return bookPath;
}

/**
 * Get existing paths that match the base book path
 */
async function getExistingPaths(basePath: string, bookPath: string): Promise<string[]> {
	try {
		const authorDir = join(basePath, dirname(bookPath));
		const authorName = dirname(bookPath);
		
		// Check if author directory exists
		try {
			await stat(authorDir);
		} catch {
			return []; // Author directory doesn't exist
		}
		
		// Get all directories in author folder
		const entries = await readdir(authorDir, { withFileTypes: true });
		const directories = entries
			.filter(entry => entry.isDirectory())
			.map(entry => join(authorName, entry.name));
		
		return directories;
	} catch (error) {
		console.error('Error checking existing paths:', error);
		return [];
	}
}

/**
 * Create directory structure for book storage
 */
export async function createBookDirectory(
	basePath: string,
	bookPath: string
): Promise<string> {
	const fullPath = join(basePath, bookPath);
	
	try {
		await mkdir(fullPath, { recursive: true });
		return fullPath;
	} catch (error) {
		console.error('Error creating book directory:', error);
		throw new Error(`Failed to create directory: ${fullPath}`);
	}
}

/**
 * Save book file to organized storage structure
 */
export async function saveBookFile(
	buffer: Buffer,
	metadata: BookMetadata,
	originalFilename: string,
	options: StorageOptions
): Promise<{ filePath: string; storagePath: string }> {
	// Generate storage path
	const storagePath = await generateStoragePath(metadata, options);
	
	// Create directory structure
	const fullDirPath = await createBookDirectory(options.basePath, storagePath);
	
	// Determine filename (use original extension, but name it 'book')
	const extension = originalFilename.split('.').pop() || 'bin';
	const filename = `book.${extension}`;
	const filePath = join(fullDirPath, filename);
	
	// Write file
	await writeFile(filePath, buffer);
	
	return {
		filePath,
		storagePath
	};
}

/**
 * Get all books organized by author
 */
export async function getBooksByAuthor(basePath: string): Promise<Record<string, string[]>> {
	try {
		const authors: Record<string, string[]> = {};
		
		const entries = await readdir(basePath, { withFileTypes: true });
		const authorDirs = entries.filter(entry => entry.isDirectory());
		
		for (const authorDir of authorDirs) {
			const authorPath = join(basePath, authorDir.name);
			const bookEntries = await readdir(authorPath, { withFileTypes: true });
			const bookDirs = bookEntries.filter(entry => entry.isDirectory());
			
			authors[authorDir.name] = bookDirs.map(book => book.name);
		}
		
		return authors;
	} catch (error) {
		console.error('Error getting books by author:', error);
		return {};
	}
}

/**
 * Find book by normalized author and title
 */
export async function findBookPath(
	basePath: string,
	normalizedAuthor: string,
	normalizedTitle: string
): Promise<string | null> {
	try {
		const authorPath = join(basePath, normalizedAuthor);
		await stat(authorPath); // Check if author directory exists
		
		const bookPath = join(authorPath, normalizedTitle);
		await stat(bookPath); // Check if book directory exists
		
		return join(normalizedAuthor, normalizedTitle);
	} catch {
		return null;
	}
}

/**
 * Get storage statistics
 */
export async function getStorageStats(basePath: string): Promise<{
	totalAuthors: number;
	totalBooks: number;
	totalSize: number;
}> {
	let totalAuthors = 0;
	let totalBooks = 0;
	let totalSize = 0;
	
	try {
		const entries = await readdir(basePath, { withFileTypes: true });
		const authorDirs = entries.filter(entry => entry.isDirectory());
		totalAuthors = authorDirs.length;
		
		for (const authorDir of authorDirs) {
			const authorPath = join(basePath, authorDir.name);
			const bookEntries = await readdir(authorPath, { withFileTypes: true });
			const bookDirs = bookEntries.filter(entry => entry.isDirectory());
			totalBooks += bookDirs.length;
			
			// Calculate size for each book
			for (const bookDir of bookDirs) {
				const bookPath = join(authorPath, bookDir.name);
				const bookFiles = await readdir(bookPath, { withFileTypes: true });
				
				for (const file of bookFiles) {
					if (file.isFile()) {
						const filePath = join(bookPath, file.name);
						const stats = await stat(filePath);
						totalSize += stats.size;
					}
				}
			}
		}
	} catch (error) {
		console.error('Error getting storage stats:', error);
	}
	
	return {
		totalAuthors,
		totalBooks,
		totalSize
	};
}