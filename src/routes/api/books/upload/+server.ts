import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requirePermission } from '$lib/server/middleware/permissions';
import { db } from '$lib/server/db';
import { createBook } from '$lib/server/db/books';
import { parseBook } from '$lib/server/parsers';
import { indexBook } from '$lib/server/search/indexing';
import { saveBookFile } from '$lib/utils/storage';
import { env } from '$env/dynamic/private';
import { isValidContentType } from '$lib/constants/content-types';

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

		// Get staging metadata from form data
		const contentType = formData.get('contentType') as string;
		const tagsJson = formData.get('tags') as string;
		const title = formData.get('title') as string | null;
		const author = formData.get('author') as string | null;
		const publicationYear = formData.get('publicationYear') as string | null;
		const isbn = formData.get('isbn') as string | null;
		const description = formData.get('description') as string | null;

		// Validate content type (required)
		if (!contentType || !isValidContentType(contentType)) {
			return json({ error: 'Valid content type is required' }, { status: 400 });
		}

		// Parse tags
		let tags: string[] = [];
		if (tagsJson) {
			try {
				tags = JSON.parse(tagsJson);
				if (!Array.isArray(tags)) {
					tags = [];
				}
			} catch {
				tags = [];
			}
		}

		// Validate file size (1GB max)
		const MAX_SIZE = 1024 * 1024 * 1024;
		if (file.size > MAX_SIZE) {
			return json({ error: 'File size exceeds 1GB limit' }, { status: 400 });
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

		// Override parsed metadata with user-provided values
		if (parsed.metadata) {
			parsed.metadata.fileSize = buffer.length;
			if (title) parsed.metadata.title = title;
			if (author) parsed.metadata.author = author;
			if (isbn) parsed.metadata.isbn = isbn;
			if (description) parsed.metadata.description = description;
			if (publicationYear) {
				const year = parseInt(publicationYear);
				if (!isNaN(year)) {
					parsed.metadata.publicationYear = year;
				}
			}
		}

		// Use user-provided title/author if available, otherwise use parsed values
		const finalTitle = title || parsed.title;
		const finalAuthor = author || parsed.author;

		// Save file using organized storage structure
		const { filePath, storagePath } = await saveBookFile(
			buffer,
			parsed.metadata || { title: finalTitle, author: finalAuthor },
			file.name,
			{
				basePath: BOOKS_STORAGE_PATH,
				createDirectories: true,
				handleConflicts: true
			}
		);

		// Create book in database with staging metadata
		const book = await createBook({
			title: finalTitle,
			author: finalAuthor,
			format,
			contentType,
			uploadedById: locals.user.id,
			filePath,
			coverImage: parsed.coverImage,
			markdown: parsed.markdown,
			chapters: parsed.chapters.map((chapter, index) => ({
				title: chapter.title,
				content: chapter.content,
				level: chapter.level,
				order: index
			})),
			metadata: parsed.metadata,
			tags,
			firstPagesText: parsed.firstPagesText
		});

		// Index in Meilisearch with tags
		try {
			// Fetch book with tags for indexing
			const bookWithTags = await db.book.findUnique({
				where: { id: book.id },
				include: {
					tags: {
						include: {
							tag: true
						}
					}
				}
			});
			await indexBook(book, book.chapters, bookWithTags?.tags);
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

