import type { RequestEvent } from '@sveltejs/kit';
import { verifyToken } from './jwt';
import { getSessionByToken } from '../db/sessions';
import type { User } from '@prisma/client';

export interface AuthUser {
	id: string;
	email: string;
	role: string;
	canUpload: boolean;
	canDelete: boolean;
}

export async function getUser(event: RequestEvent): Promise<AuthUser | null> {
	const token = event.cookies.get('auth_token');
	
	if (!token) {
		return null;
	}

	// Verify JWT
	const payload = verifyToken(token);
	if (!payload) {
		// Invalid token, clear cookie
		event.cookies.delete('auth_token', { path: '/' });
		return null;
	}

	// Check session in database
	const session = await getSessionByToken(token);
	if (!session) {
		event.cookies.delete('auth_token', { path: '/' });
		return null;
	}

	// Check if session expired
	if (session.expiresAt < new Date()) {
		event.cookies.delete('auth_token', { path: '/' });
		return null;
	}

	const user = session.user as User;
	
	return {
		id: user.id,
		email: user.email,
		role: user.role,
		canUpload: user.canUpload,
		canDelete: user.canDelete
	};
}

export async function requireAuth(event: RequestEvent): Promise<AuthUser> {
	const user = await getUser(event);
	if (!user) {
		throw new Error('Unauthorized');
	}
	return user;
}

export async function requireAdmin(event: RequestEvent): Promise<AuthUser> {
	const user = await requireAuth(event);
	if (user.role !== 'admin') {
		throw new Error('Forbidden: Admin access required');
	}
	return user;
}

export function checkPermission(user: AuthUser, permission: 'upload' | 'delete' | 'admin'): boolean {
	if (user.role === 'admin') {
		return true;
	}

	switch (permission) {
		case 'upload':
			return user.canUpload;
		case 'delete':
			return user.canDelete;
		case 'admin':
			return false;
		default:
			return false;
	}
}


