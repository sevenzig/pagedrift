/**
 * Migration script to update existing books with new metadata structure
 * This script will:
 * 1. Extract metadata from existing book files
 * 2. Update database records with normalized fields
 * 3. Reorganize files into the new /author/title/ structure
 */

import { PrismaClient } from '@prisma/client';
import { readFile, stat, mkdir, copyFile, unlink } from 'fs/promises';
import { join, dirname, basename } from 'path';
import { parseBook } from '../src/lib/server/parsers';
import { extractAndNormalizeMetadata, generateBookPath } from '../src/lib/utils/metadata';
import { createBookDirectory } from '../src/lib/utils/storage';

const prisma = new PrismaClient();
const BOOKS_STORAGE_PATH = process.env.BOOKS_STORAGE_PATH || './data/books';

interface BookToMigrate {
	id: string;
	title: string;
	author?: string;
	format: string;
	filePath: string;
}

async function getBooksToMigrate(): Promise<BookToMigrate[]> {
	return prisma.book.findMany({
		select: {
			id: true,
			title: true,
			author: true,
			format: true,
			filePath: true,
			normalizedAuthor: true,
			normalizedTitle: true
		},
		where: {
			OR: [
				{ normalizedAuthor: null },
				{ normalizedTitle: null }
			]
		}
	});
}

async function migrateBook(book: BookToMigrate): Promise<void> {
	try {
		console.log(`Migrating book: ${book.title} by ${book.author || 'Unknown'}`);
		
		// Check if file exists
		try {
			await stat(book.filePath);
		} catch {
			console.log(`  ⚠️  File not found: ${book.filePath}`);
			return;
		}
		
		// Read and parse the book file
		const buffer = await readFile(book.filePath);
		const parsed = await parseBook(buffer, basename(book.filePath), book.format as any);
		
		// Generate normalized metadata
		const metadata = extractAndNormalizeMetadata(
			parsed.title || book.title,
			parsed.author || book.author,
			parsed.metadata
		);
		
		// Add file size
		metadata.fileSize = buffer.length;
		
		// Generate new storage path
		const newStoragePath = generateBookPath(metadata);
		const newFullPath = join(BOOKS_STORAGE_PATH, newStoragePath);
		
		// Create new directory structure
		await createBookDirectory(BOOKS_STORAGE_PATH, newStoragePath);
		
		// Copy file to new location
		const extension = book.filePath.split('.').pop() || 'bin';
		const newFilePath = join(newFullPath, `book.${extension}`);
		await copyFile(book.filePath, newFilePath);
		
		// Update database record
		await prisma.book.update({
			where: { id: book.id },
			data: {
				// Update metadata fields
				isbn: metadata.isbn,
				publisher: metadata.publisher,
				publicationYear: metadata.publicationYear,
				language: metadata.language,
				description: metadata.description,
				subjects: metadata.subjects?.join(', '),
				pageCount: metadata.pageCount,
				fileSize: metadata.fileSize,
				normalizedAuthor: metadata.normalizedAuthor,
				normalizedTitle: metadata.normalizedTitle,
				// Update file path
				filePath: newFilePath
			}
		});
		
		console.log(`  ✅ Migrated to: ${newStoragePath}`);
		
		// Optionally remove old file (uncomment if you want to clean up)
		// await unlink(book.filePath);
		
	} catch (error) {
		console.error(`  ❌ Error migrating book ${book.id}:`, error);
	}
}

async function main() {
	try {
		console.log('Starting book migration...');
		
		const books = await getBooksToMigrate();
		console.log(`Found ${books.length} books to migrate`);
		
		if (books.length === 0) {
			console.log('No books need migration');
			return;
		}
		
		for (const book of books) {
			await migrateBook(book);
		}
		
		console.log('Migration completed!');
		
	} catch (error) {
		console.error('Migration failed:', error);
	} finally {
		await prisma.$disconnect();
	}
}

// Run migration if this script is executed directly
if (require.main === module) {
	main();
}
