import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getProgress, updateProgress } from '$lib/server/db/progress';
import { db } from '$lib/server/db';

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

		const { currentChapterId, progress, scrollPosition } = await request.json();

		const updatedProgress = await updateProgress(locals.user.id, params.id, {
			currentChapterId,
			progress,
			scrollPosition
		});

		return json({ progress: updatedProgress });
	} catch (error) {
		console.error('Error updating progress:', error);
		return json({ error: 'Failed to update progress' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Delete the user's progress for this book
		await db.userBookProgress.deleteMany({
			where: {
				userId: locals.user.id,
				bookId: params.id
			}
		});

		return json({ success: true });
	} catch (error) {
		console.error('Error clearing progress:', error);
		return json({ error: 'Failed to clear progress' }, { status: 500 });
	}
};

