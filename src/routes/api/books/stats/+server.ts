import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getLibraryStats } from '$lib/utils/book-management';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const stats = await getLibraryStats();
		return json(stats);
	} catch (error) {
		console.error('Error getting library stats:', error);
		return json({ error: 'Failed to get library statistics' }, { status: 500 });
	}
};
