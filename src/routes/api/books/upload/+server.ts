import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requirePermission } from '$lib/server/middleware/permissions';
import { createBook } from '$lib/server/db/books';
import { parseBook } from '$lib/server/parsers';
import { indexBook } from '$lib/server/search/indexing';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { env } from '$env/dynamic/private';

const BOOKS_STORAGE_PATH = env.BOOKS_STORAGE_PATH || './data/books';

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Check upload permission
		requirePermission(locals.user, 'upload');

		const formData = await request.formData();
		const file = formData.get('file') as File;

		if (!file) {
			return json({ error: 'No file provided' }, { status: 400 });
		}

		// Validate file size (50MB max)
		const MAX_SIZE = 50 * 1024 * 1024;
		if (file.size > MAX_SIZE) {
			return json({ error: 'File size exceeds 50MB limit' }, { status: 400 });
		}

		// Validate file format
		const filename = file.name.toLowerCase();
		let format: 'epub' | 'pdf' | 'mobi';
		if (filename.endsWith('.epub')) {
			format = 'epub';
		} else if (filename.endsWith('.pdf')) {
			format = 'pdf';
		} else if (filename.endsWith('.mobi')) {
			format = 'mobi';
		} else {
			return json({ error: 'Unsupported file format. Use EPUB, PDF, or MOBI' }, { status: 400 });
		}

		// Read file buffer
		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		// Parse the book
		const parsed = await parseBook(buffer, file.name, format);

		// Generate book ID
		const bookId = Math.random().toString(36).substring(2, 15);

		// Save file to disk
		const bookDir = join(BOOKS_STORAGE_PATH, bookId);
		await mkdir(bookDir, { recursive: true });
		const filePath = join(bookDir, file.name);
		await writeFile(filePath, buffer);

		// Create book in database
		const book = await createBook({
			title: parsed.title,
			author: parsed.author,
			format,
			uploadedById: locals.user.id,
			filePath,
			coverImage: parsed.coverImage,
			markdown: parsed.markdown,
			chapters: parsed.chapters.map((chapter, index) => ({
				title: chapter.title,
				content: chapter.content,
				level: chapter.level,
				order: index
			}))
		});

		// Index in Meilisearch
		try {
			await indexBook(book, book.chapters);
		} catch (searchError) {
			console.error('Failed to index book in Meilisearch:', searchError);
			// Don't fail the upload if search indexing fails
		}

		return json({ book });
	} catch (error) {
		console.error('Upload error:', error);
		const message = error instanceof Error ? error.message : 'Upload failed';
		return json({ error: message }, { status: 500 });
	}
};

