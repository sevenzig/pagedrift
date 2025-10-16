import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProgress, updateProgress } from '$lib/server/db/progress';

export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const progress = await getProgress(locals.user.id, params.id);

		return json({ progress });
	} catch (error) {
		console.error('Error fetching progress:', error);
		return json({ error: 'Failed to fetch progress' }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { currentChapterId, progress } = await request.json();

		const updatedProgress = await updateProgress(locals.user.id, params.id, {
			currentChapterId,
			progress
		});

		return json({ progress: updatedProgress });
	} catch (error) {
		console.error('Error updating progress:', error);
		return json({ error: 'Failed to update progress' }, { status: 500 });
	}
};

