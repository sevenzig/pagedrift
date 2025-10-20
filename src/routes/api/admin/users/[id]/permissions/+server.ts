import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { updateUserPermissions, getUserById } from '$lib/server/db/users';

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		if (locals.user.role !== 'admin') {
			return json({ error: 'Forbidden: Admin access required' }, { status: 403 });
		}

		// Prevent admins from modifying their own permissions
		if (params.id === locals.user.id) {
			return json({ error: 'Cannot modify your own permissions' }, { status: 400 });
		}

		const targetUser = await getUserById(params.id);
		if (!targetUser) {
			return json({ error: 'User not found' }, { status: 404 });
		}

		const { role, canUpload, canDelete } = await request.json();

		// Validate role
		if (role && !['admin', 'user', 'guest'].includes(role)) {
			return json({ error: 'Invalid role' }, { status: 400 });
		}

		const updatedUser = await updateUserPermissions(params.id, {
			role,
			canUpload,
			canDelete
		});

		return json({
			user: {
				id: updatedUser.id,
				email: updatedUser.email,
				role: updatedUser.role,
				canUpload: updatedUser.canUpload,
				canDelete: updatedUser.canDelete
			}
		});
	} catch (error) {
		console.error('Error updating permissions:', error);
		return json({ error: 'Failed to update permissions' }, { status: 500 });
	}
};


