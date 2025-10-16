import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBookById, deleteBook as deleteBookFromDb, updateBook } from '$lib/server/db/books';
import { requirePermission } from '$lib/server/middleware/permissions';
import { removeBookFromIndex, updateBookInIndex } from '$lib/server/search/indexing';
import { unlink, rm } from 'fs/promises';
import { dirname } from 'path';

export const GET: RequestHandler = async ({ params, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const book = await getBookById(params.id);

		if (!book) {
			return json({ error: 'Book not found' }, { status: 404 });
		}

		return json({ book });
	} catch (error) {
		console.error('Error fetching book:', error);
		return json({ error: 'Failed to fetch book' }, { status: 500 });
	}
};

export const DELETE: RequestHandler = async ({ params, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Check delete permission
		requirePermission(locals.user, 'delete');

		const book = await getBookById(params.id);

		if (!book) {
			return json({ error: 'Book not found' }, { status: 404 });
		}

		// Delete file from disk
		try {
			const bookDir = dirname(book.filePath);
			await rm(bookDir, { recursive: true, force: true });
		} catch (error) {
			console.error('Error deleting book file:', error);
			// Continue with database deletion even if file deletion fails
		}

		// Delete from database
		await deleteBookFromDb(params.id);

		// Remove from Meilisearch
		try {
			await removeBookFromIndex(params.id);
		} catch (searchError) {
			console.error('Failed to remove book from Meilisearch:', searchError);
		}

		return json({ success: true });
	} catch (error) {
		console.error('Delete error:', error);
		const message = error instanceof Error ? error.message : 'Delete failed';
		return json({ error: message }, { status: 500 });
	}
};

export const PUT: RequestHandler = async ({ params, request, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		// Only admins can update book metadata
		if (locals.user.role !== 'admin') {
			return json({ error: 'Forbidden: Admin access required' }, { status: 403 });
		}

		const { title, author, coverImage } = await request.json();

		const book = await updateBook(params.id, {
			title,
			author,
			coverImage
		});

		// Update in Meilisearch
		try {
			await updateBookInIndex(params.id, { title, author, coverImage });
		} catch (searchError) {
			console.error('Failed to update book in Meilisearch:', searchError);
		}

		return json({ book });
	} catch (error) {
		console.error('Update error:', error);
		return json({ error: 'Update failed' }, { status: 500 });
	}
};

