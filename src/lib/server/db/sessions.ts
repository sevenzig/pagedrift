import { db } from './index';
import type { Session } from '@prisma/client';

export async function createSession(userId: string, token: string, expiresAt: Date): Promise<Session> {
	return db.session.create({
		data: {
			userId,
			token,
			expiresAt
		}
	});
}

export async function getSessionByToken(token: string): Promise<Session | null> {
	return db.session.findUnique({
		where: { token },
		include: {
			user: true
		}
	});
}

export async function deleteSession(token: string): Promise<void> {
	await db.session.delete({
		where: { token }
	});
}

export async function deleteExpiredSessions(): Promise<void> {
	await db.session.deleteMany({
		where: {
			expiresAt: {
				lt: new Date()
			}
		}
	});
}

export async function deleteUserSessions(userId: string): Promise<void> {
	await db.session.deleteMany({
		where: { userId }
	});
}


