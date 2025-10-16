import type { PageServerLoad } from './$types';
import { getAllBooks } from '$lib/server/db/books';

export const load: PageServerLoad = async () => {
	const books = await getAllBooks();

	// Return books without markdown content for performance
	const booksWithoutContent = books.map((book) => ({
		id: book.id,
		title: book.title,
		author: book.author,
		format: book.format,
		uploadDate: book.uploadDate,
		coverImage: book.coverImage,
		uploadedBy: (book as any).uploadedBy
	}));

	return {
		books: booksWithoutContent
	};
};

