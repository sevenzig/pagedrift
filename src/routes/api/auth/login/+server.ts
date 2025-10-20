import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getUserByEmail } from '$lib/server/db/users';
import { verifyPassword } from '$lib/server/auth/password';
import { generateToken, getTokenExpiration } from '$lib/server/auth/jwt';
import { createSession } from '$lib/server/db/sessions';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const { email, password } = await request.json();

		if (!email || !password) {
			return json({ error: 'Email and password are required' }, { status: 400 });
		}

		// Find user
		const user = await getUserByEmail(email);
		if (!user) {
			return json({ error: 'Invalid credentials' }, { status: 401 });
		}

		// Verify password
		const valid = await verifyPassword(password, user.passwordHash);
		if (!valid) {
			return json({ error: 'Invalid credentials' }, { status: 401 });
		}

		// Generate JWT token
		const token = generateToken({
			userId: user.id,
			email: user.email,
			role: user.role
		});

		// Create session in database
		const expiresAt = getTokenExpiration();
		await createSession(user.id, token, expiresAt);

		// Set httpOnly cookie
		cookies.set('auth_token', token, {
			path: '/',
			httpOnly: true,
			secure: process.env.NODE_ENV === 'production',
			sameSite: 'lax',
			maxAge: 60 * 60 * 24 * 7 // 7 days
		});

		return json({
			user: {
				id: user.id,
				email: user.email,
				role: user.role,
				canUpload: user.canUpload,
				canDelete: user.canDelete
			}
		});
	} catch (error) {
		console.error('Login error:', error);
		return json({ error: 'Login failed' }, { status: 500 });
	}
};


