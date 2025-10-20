import type { PageServerLoad } from './$types';
import { getAllBooks } from '$lib/server/db/books';
import { getUserProgress } from '$lib/server/db/progress';

export const load: PageServerLoad = async ({ locals }) => {
	const books = await getAllBooks();
	
	// Get user progress for all books
	let userProgress: any[] = [];
	if (locals.user) {
		userProgress = await getUserProgress(locals.user.id);
	}
	
	// Create a map of bookId -> progress for O(1) lookup
	const progressMap = new Map();
	userProgress.forEach(progress => {
		progressMap.set(progress.bookId, progress);
	});

	// Return books without markdown content for performance, including progress data
	const booksWithoutContent = books.map((book) => ({
		id: book.id,
		title: book.title,
		author: book.author,
		format: book.format,
		contentType: book.contentType,
		uploadDate: book.uploadDate,
		coverImage: book.coverImage,
		publicationYear: book.publicationYear,
		publisher: book.publisher,
		isbn: book.isbn,
		description: book.description,
		uploadedBy: (book as any).uploadedBy,
		tags: (book as any).tags,
		progress: progressMap.get(book.id)?.progress || 0
	}));

	return {
		books: booksWithoutContent
	};
};

