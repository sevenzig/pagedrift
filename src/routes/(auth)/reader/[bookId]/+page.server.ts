import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getBookById } from '$lib/server/db/books';
import { getProgress } from '$lib/server/db/progress';

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const book = await getBookById(params.bookId);

	if (!book) {
		throw error(404, 'Book not found');
	}

	// Check for restart parameter
	const restart = url.searchParams.get('restart') === 'true';

	// Get user's reading progress (only if not restarting)
	let progress = null;
	if (!restart) {
		progress = await getProgress(locals.user!.id, params.bookId);
	}

	return {
		book,
		progress,
		restart
	};
};

