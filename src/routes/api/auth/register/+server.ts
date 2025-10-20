import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { createUser, getUserByEmail, isFirstUser } from '$lib/server/db/users';
import { hashPassword } from '$lib/server/auth/password';
import { generateToken, getTokenExpiration } from '$lib/server/auth/jwt';
import { createSession } from '$lib/server/db/sessions';

export const POST: RequestHandler = async ({ request, cookies }) => {
	try {
		const { email, password } = await request.json();

		if (!email || !password) {
			return json({ error: 'Email and password are required' }, { status: 400 });
		}

		// Validate email format
		const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
		if (!emailRegex.test(email)) {
			return json({ error: 'Invalid email format' }, { status: 400 });
		}

		// Validate password length
		if (password.length < 8) {
			return json({ error: 'Password must be at least 8 characters' }, { status: 400 });
		}

		// Check if user already exists
		const existingUser = await getUserByEmail(email);
		if (existingUser) {
			return json({ error: 'User already exists' }, { status: 409 });
		}

		// Check if this is the first user (will become admin)
		const firstUser = await isFirstUser();
		const role = firstUser ? 'admin' : 'user';
		const canUpload = firstUser ? true : true; // First user (admin) and regular users can upload by default
		const canDelete = firstUser ? true : false; // Only first user (admin) can delete by default

		// Hash password and create user
		const passwordHash = await hashPassword(password);
		const user = await createUser({
			email,
			passwordHash,
			role,
			canUpload,
			canDelete
		});

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
		console.error('Registration error:', error);
		return json({ error: 'Registration failed' }, { status: 500 });
	}
};

