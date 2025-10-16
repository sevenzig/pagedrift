import { db } from './index';
import type { User } from '@prisma/client';

export async function createUser(data: {
	email: string;
	passwordHash: string;
	role?: string;
	canUpload?: boolean;
	canDelete?: boolean;
}): Promise<User> {
	return db.user.create({
		data: {
			email: data.email,
			passwordHash: data.passwordHash,
			role: data.role || 'user',
			canUpload: data.canUpload ?? false,
			canDelete: data.canDelete ?? false
		}
	});
}

export async function getUserByEmail(email: string): Promise<User | null> {
	return db.user.findUnique({
		where: { email }
	});
}

export async function getUserById(id: string): Promise<User | null> {
	return db.user.findUnique({
		where: { id }
	});
}

export async function getAllUsers(): Promise<User[]> {
	return db.user.findMany({
		orderBy: { createdAt: 'desc' }
	});
}

export async function updateUserPermissions(
	userId: string,
	data: {
		role?: string;
		canUpload?: boolean;
		canDelete?: boolean;
	}
): Promise<User> {
	return db.user.update({
		where: { id: userId },
		data
	});
}

export async function isFirstUser(): Promise<boolean> {
	const count = await db.user.count();
	return count === 0;
}

