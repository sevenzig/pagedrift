import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';

/**
 * GET /api/tags
 * List all existing tags for autocomplete
 */
export const GET: RequestHandler = async ({ locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const tags = await db.tag.findMany({
			orderBy: { name: 'asc' },
			select: {
				id: true,
				name: true,
				_count: {
					select: { books: true }
				}
			}
		});

		return json({ tags });
	} catch (error) {
		console.error('Error fetching tags:', error);
		return json({ error: 'Failed to fetch tags' }, { status: 500 });
	}
};

/**
 * POST /api/tags
 * Create a new tag
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { name } = await request.json();

		if (!name || typeof name !== 'string' || name.trim().length === 0) {
			return json({ error: 'Tag name is required' }, { status: 400 });
		}

		const tagName = name.trim();

		// Check if tag already exists
		const existingTag = await db.tag.findUnique({
			where: { name: tagName }
		});

		if (existingTag) {
			return json({ tag: existingTag });
		}

		// Create new tag
		const tag = await db.tag.create({
			data: { name: tagName }
		});

		return json({ tag }, { status: 201 });
	} catch (error) {
		console.error('Error creating tag:', error);
		return json({ error: 'Failed to create tag' }, { status: 500 });
	}
};

