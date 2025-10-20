import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { deleteSession } from '$lib/server/db/sessions';

export const POST: RequestHandler = async ({ cookies }) => {
	try {
		const token = cookies.get('auth_token');

		if (token) {
			// Delete session from database
			await deleteSession(token);
		}

		// Clear cookie
		cookies.delete('auth_token', { path: '/' });

		return json({ success: true });
	} catch (error) {
		console.error('Logout error:', error);
		return json({ error: 'Logout failed' }, { status: 500 });
	}
};


