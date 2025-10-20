import { searchClient, BOOKS_INDEX, CHAPTERS_INDEX } from './client';
import type { Book, Chapter } from '@prisma/client';

export async function indexBook(
	book: Book,
	chapters: Chapter[],
	tags?: Array<{ tag: { name: string } }>
) {
	try {
		// Flatten tags to array of strings for searching
		const tagNames = tags?.map((bt) => bt.tag.name) || [];

		// Index book metadata with all fields
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

		console.log(`Indexed book: ${book.title} with ${chapters.length} chapters`);
	} catch (error) {
		console.error('Error indexing book:', error);
		throw error;
	}
}

export async function removeBookFromIndex(bookId: string) {
	try {
		// Remove book from books index
		const booksIndex = searchClient.index(BOOKS_INDEX);
		await booksIndex.deleteDocument(bookId);

		// Remove all chapters for this book
		const chaptersIndex = searchClient.index(CHAPTERS_INDEX);
		await chaptersIndex.deleteDocuments({
			filter: `bookId = ${bookId}`
		});

		console.log(`Removed book ${bookId} from search index`);
	} catch (error) {
		console.error('Error removing book from index:', error);
		throw error;
	}
}

export async function updateBookInIndex(
	bookId: string,
	updates: {
		title?: string;
		author?: string;
		coverImage?: string;
		isbn?: string | null;
		publisher?: string | null;
		publicationYear?: number | null;
		language?: string | null;
		description?: string | null;
		contentType?: string;
		tags?: string[];
	}
) {
	try {
		const booksIndex = searchClient.index(BOOKS_INDEX);
		await booksIndex.updateDocuments([
			{
				id: bookId,
				...updates
			}
		]);

		console.log(`Updated book ${bookId} in search index`);
	} catch (error) {
		console.error('Error updating book in index:', error);
		throw error;
	}
}

