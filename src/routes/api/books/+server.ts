import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllBooks } from '$lib/server/db/books';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const books = await getAllBooks();

		// Return books without full markdown content (for performance)
		const booksWithoutContent = books.map((book) => ({
			...book,
			markdown: undefined // Don't send full markdown in list view
		}));

		return json({ books: booksWithoutContent });
	} catch (error) {
		console.error('Error fetching books:', error);
		return json({ error: 'Failed to fetch books' }, { status: 500 });
	}
};

