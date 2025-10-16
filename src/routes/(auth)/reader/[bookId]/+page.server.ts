import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getBookById } from '$lib/server/db/books';
import { getProgress } from '$lib/server/db/progress';

export const load: PageServerLoad = async ({ params, locals }) => {
	const book = await getBookById(params.bookId);

	if (!book) {
		throw error(404, 'Book not found');
	}

	// Get user's reading progress
	const progress = await getProgress(locals.user!.id, params.bookId);

	return {
		book,
		progress
	};
};

