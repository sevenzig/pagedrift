import { db } from './index';
import type { UserBookProgress } from '@prisma/client';

export async function getProgress(userId: string, bookId: string): Promise<UserBookProgress | null> {
	return db.userBookProgress.findUnique({
		where: {
			userId_bookId: {
				userId,
				bookId
			}
		}
	});
}

export async function updateProgress(
	userId: string,
	bookId: string,
	data: {
		currentChapterId?: string | null;
		progress?: number;
		scrollPosition?: number;
	}
): Promise<UserBookProgress> {
	return db.userBookProgress.upsert({
		where: {
			userId_bookId: {
				userId,
				bookId
			}
		},
		update: {
			...data,
			lastRead: new Date()
		},
		create: {
			userId,
			bookId,
			currentChapterId: data.currentChapterId || null,
			progress: data.progress || 0,
			scrollPosition: data.scrollPosition || 0,
			lastRead: new Date()
		}
	});
}

export async function getUserProgress(userId: string): Promise<UserBookProgress[]> {
	return db.userBookProgress.findMany({
		where: { userId },
		include: {
			book: true
		},
		orderBy: { lastRead: 'desc' }
	});
}

