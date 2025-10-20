import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { requirePermission } from '$lib/server/middleware/permissions';
import { parseBook } from '$lib/server/parsers';

/**
 * POST /api/books/preview
 * Parse uploaded file and return extracted metadata without saving
 * Used by the staging interface for initial form population
 */
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

	// Add file size to metadata
	if (parsed.metadata) {
		parsed.metadata.fileSize = buffer.length;
	}

	// Log parsed metadata for debugging
	console.log('Parsed book data:', {
		title: parsed.title,
		author: parsed.author,
		hasCover: !!parsed.coverImage,
		coverLength: parsed.coverImage?.length,
		metadata: {
			publicationYear: parsed.metadata?.publicationYear,
			isbn: parsed.metadata?.isbn,
			publisher: parsed.metadata?.publisher,
			description: parsed.metadata?.description?.substring(0, 100)
		}
	});

	// Validate cover image data URL
	let coverImage = parsed.coverImage;
	if (coverImage && !coverImage.startsWith('data:')) {
		console.warn('Cover image does not appear to be a valid data URL, removing');
		coverImage = undefined;
	}

	// Return preview data (without saving anything)
	return json({
		preview: {
			title: parsed.title,
			author: parsed.author,
			format,
			coverImage,
			metadata: parsed.metadata,
			fileName: file.name,
			fileSize: buffer.length,
			chaptersCount: parsed.chapters.length
		}
	});
	} catch (error) {
		console.error('Preview error:', error);
		const message = error instanceof Error ? error.message : 'Preview failed';
		return json({ error: message }, { status: 500 });
	}
};

