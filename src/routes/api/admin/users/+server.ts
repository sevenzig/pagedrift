import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAllUsers } from '$lib/server/db/users';

export const GET: RequestHandler = async ({ locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		if (locals.user.role !== 'admin') {
			return json({ error: 'Forbidden: Admin access required' }, { status: 403 });
		}

		const users = await getAllUsers();

		// Remove password hashes from response
		const safeUsers = users.map((user) => ({
			id: user.id,
			email: user.email,
			role: user.role,
			canUpload: user.canUpload,
			canDelete: user.canDelete,
			createdAt: user.createdAt
		}));

		return json({ users: safeUsers });
	} catch (error) {
		console.error('Error fetching users:', error);
		return json({ error: 'Failed to fetch users' }, { status: 500 });
	}
};


