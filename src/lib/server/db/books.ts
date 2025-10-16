import { db } from './index';
import type { Book, Chapter } from '@prisma/client';

export type BookWithChapters = Book & {
	chapters: Chapter[];
};

export async function createBook(data: {
	title: string;
	author?: string;
	format: string;
	uploadedById: string;
	filePath: string;
	coverImage?: string;
	markdown: string;
	chapters: Array<{
		title: string;
		content: string;
		level: number;
		order: number;
	}>;
}): Promise<BookWithChapters> {
	return db.book.create({
		data: {
			title: data.title,
			author: data.author,
			format: data.format,
			uploadedById: data.uploadedById,
			filePath: data.filePath,
			coverImage: data.coverImage,
			markdown: data.markdown,
			chapters: {
				create: data.chapters
			}
		},
		include: {
			chapters: {
				orderBy: { order: 'asc' }
			}
		}
	});
}

export async function getAllBooks(): Promise<Book[]> {
	return db.book.findMany({
		orderBy: { uploadDate: 'desc' },
		include: {
			uploadedBy: {
				select: {
					email: true
				}
			}
		}
	});
}

export async function getBookById(id: string): Promise<BookWithChapters | null> {
	return db.book.findUnique({
		where: { id },
		include: {
			chapters: {
				orderBy: { order: 'asc' }
			}
		}
	});
}

export async function deleteBook(id: string): Promise<void> {
	await db.book.delete({
		where: { id }
	});
}

export async function updateBook(
	id: string,
	data: {
		title?: string;
		author?: string;
		coverImage?: string;
	}
): Promise<Book> {
	return db.book.update({
		where: { id },
		data
	});
}

export async function getBooksByUserId(userId: string): Promise<Book[]> {
	return db.book.findMany({
		where: { uploadedById: userId },
		orderBy: { uploadDate: 'desc' }
	});
}

