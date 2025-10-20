import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchBooks } from '$lib/utils/book-management';

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const query = url.searchParams.get('q') || undefined;
		const author = url.searchParams.get('author') || undefined;
		const year = url.searchParams.get('year') ? parseInt(url.searchParams.get('year')!) : undefined;
		const isbn = url.searchParams.get('isbn') || undefined;
		const language = url.searchParams.get('language') || undefined;
		const format = url.searchParams.get('format') || undefined;

		const books = await searchBooks({
			query,
			author,
			year,
			isbn,
			language,
			format
		});

		return json({ books });
	} catch (error) {
		console.error('Error searching books:', error);
		return json({ error: 'Search failed' }, { status: 500 });
	}
};
