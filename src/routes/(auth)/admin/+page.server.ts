import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAllUsers } from '$lib/server/db/users';

export const load: PageServerLoad = async ({ locals }) => {
	// Only admins can access
	if (locals.user?.role !== 'admin') {
		throw error(403, 'Forbidden: Admin access required');
	}

	const users = await getAllUsers();

	// Remove password hashes
	const safeUsers = users.map((user) => ({
		id: user.id,
		email: user.email,
		role: user.role,
		canUpload: user.canUpload,
		canDelete: user.canDelete,
		createdAt: user.createdAt
	}));

	return {
		users: safeUsers
	};
};


