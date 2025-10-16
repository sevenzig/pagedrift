import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchClient, BOOKS_INDEX, CHAPTERS_INDEX } from '$lib/server/search/client';

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const query = url.searchParams.get('q') || '';
		const type = url.searchParams.get('type') || 'metadata'; // 'metadata' or 'fulltext'
		const limit = parseInt(url.searchParams.get('limit') || '20');

		if (!query.trim()) {
			return json({ results: [] });
		}

		if (type === 'fulltext') {
			// Search in chapters (full-text)
			const chaptersIndex = searchClient.index(CHAPTERS_INDEX);
			const results = await chaptersIndex.search(query, {
				limit,
				attributesToCrop: ['content'],
				cropLength: 200,
				attributesToHighlight: ['title', 'content']
			});

			return json({ results: results.hits });
		} else {
			// Search in books (metadata)
			const booksIndex = searchClient.index(BOOKS_INDEX);
			const results = await booksIndex.search(query, {
				limit,
				attributesToHighlight: ['title', 'author']
			});

			return json({ results: results.hits });
		}
	} catch (error) {
		console.error('Search error:', error);
		return json({ error: 'Search failed' }, { status: 500 });
	}
};

