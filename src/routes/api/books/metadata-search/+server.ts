import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchByTitleAuthor } from '$lib/server/metadata/api-service';

/**
 * POST /api/books/metadata-search
 * Search for book metadata by title and author during upload staging
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { title, author } = await request.json();

		if (!title) {
			return json({ error: 'Title is required' }, { status: 400 });
		}

		// Search by provided title/author
		const results = await searchByTitleAuthor(title, author);

		if (results.length === 0) {
			return json({ error: 'No results found' }, { status: 404 });
		}

		// Return the first result as the primary result
		return json({ 
			result: results[0],
			alternativeResults: results.slice(1, 5),
			multipleResults: results.length > 1
		});

	} catch (error) {
		console.error('Metadata search error:', error);
		const message = error instanceof Error ? error.message : 'Search failed';
		return json({ error: message }, { status: 500 });
	}
};

