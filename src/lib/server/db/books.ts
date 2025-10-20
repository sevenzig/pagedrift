import { db } from './index';
import type { Book, Chapter, Tag } from '@prisma/client';
import type { BookMetadata } from '$lib/utils/metadata';

export type BookWithChapters = Book & {
	chapters: Chapter[];
};

export type BookWithRelations = Book & {
	chapters: Chapter[];
	tags: Array<{ tag: Tag }>;
};

export async function createBook(data: {
	title: string;
	author?: string;
	format: string;
	contentType?: string;
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
	metadata?: BookMetadata;
	tags?: string[];
	firstPagesText?: string;
}): Promise<BookWithChapters> {
	// Handle tag creation/lookup
	const tagIds: string[] = [];
	if (data.tags && data.tags.length > 0) {
		for (const tagName of data.tags) {
			const trimmedName = tagName.trim();
			if (!trimmedName) continue;

			// Find or create tag
			const tag = await db.tag.upsert({
				where: { name: trimmedName },
				update: {},
				create: { name: trimmedName }
			});
			tagIds.push(tag.id);
		}
	}

	return db.book.create({
		data: {
			title: data.title,
			author: data.author,
			format: data.format,
			contentType: data.contentType || 'Book',
			uploadedById: data.uploadedById,
			filePath: data.filePath,
			coverImage: data.coverImage,
			markdown: data.markdown,
			// Enhanced metadata fields
			isbn: data.metadata?.isbn,
			publisher: data.metadata?.publisher,
			publicationYear: data.metadata?.publicationYear,
			language: data.metadata?.language,
			description: data.metadata?.description,
			subjects: data.metadata?.subjects?.join(', '),
			pageCount: data.metadata?.pageCount,
			fileSize: data.metadata?.fileSize,
			normalizedAuthor: data.metadata?.normalizedAuthor,
			normalizedTitle: data.metadata?.normalizedTitle,
			firstPagesText: data.firstPagesText,
			chapters: {
				create: data.chapters
			},
			tags: {
				create: tagIds.map((tagId) => ({
					tagId
				}))
			}
		},
		include: {
			chapters: {
				orderBy: { order: 'asc' }
			}
		}
	});
}

export async function getAllBooks(): Promise<any[]> {
	return db.book.findMany({
		orderBy: { uploadDate: 'desc' },
		include: {
			uploadedBy: {
				select: {
					email: true
				}
			},
			tags: {
				include: {
					tag: true
				}
			}
		}
	});
}

export async function getBookById(id: string): Promise<any | null> {
	return db.book.findUnique({
		where: { id },
		include: {
			chapters: {
				orderBy: { order: 'asc' }
			},
			tags: {
				include: {
					tag: true
				}
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
		contentType?: string;
		publicationYear?: number;
		isbn?: string;
		description?: string;
		publisher?: string;
		tags?: string[];
	}
): Promise<BookWithRelations> {
	// Handle tag updates if provided
	if (data.tags !== undefined) {
		// First, remove all existing tag relationships
		await db.bookTag.deleteMany({
			where: { bookId: id }
		});

		// Then create new tag relationships
		if (data.tags.length > 0) {
			const tagIds: string[] = [];
			for (const tagName of data.tags) {
				const trimmedName = tagName.trim();
				if (!trimmedName) continue;

				// Find or create tag
				const tag = await db.tag.upsert({
					where: { name: trimmedName },
					update: {},
					create: { name: trimmedName }
				});
				tagIds.push(tag.id);
			}

			// Create new book-tag relationships
			await db.bookTag.createMany({
				data: tagIds.map((tagId) => ({
					bookId: id,
					tagId
				}))
			});
		}
	}

	// Update the book with other fields (filter out undefined values)  
	const { tags, ...restData } = data;
	
	// Build update object with only defined values
	const updateData: Record<string, any> = {};
	Object.keys(restData).forEach(key => {
		const value = (restData as any)[key];
		if (value !== undefined) {
			updateData[key] = value;
		}
	});
	
	console.log('=== UPDATE DEBUG ===');
	console.log('Received data:', data);
	console.log('Update data to Prisma:', JSON.stringify(updateData, null, 2));
	console.log('===================');
	
	return db.book.update({
		where: { id },
		data: updateData,
		include: {
			chapters: {
				orderBy: { order: 'asc' }
			},
			tags: {
				include: {
					tag: true
				}
			}
		}
	});
}

export async function getBooksByUserId(userId: string): Promise<Book[]> {
	return db.book.findMany({
		where: { uploadedById: userId },
		orderBy: { uploadDate: 'desc' }
	});
}

