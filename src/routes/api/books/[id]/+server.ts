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

		// Only admins can update book metadata (or users with upload permission for their own books)
		const existingBook = await getBookById(params.id);
		if (!existingBook) {
			return json({ error: 'Book not found' }, { status: 404 });
		}

		// Allow admins or the original uploader to edit
		if (locals.user.role !== 'admin' && existingBook.uploadedById !== locals.user.id) {
			return json({ error: 'Forbidden: You can only edit your own books' }, { status: 403 });
		}

		const { 
			title, 
			author, 
			coverImage, 
			contentType, 
			publicationYear, 
			isbn, 
			description, 
			publisher,
			tags 
		} = await request.json();

		console.log('Update request data:', { title, author, contentType, publicationYear, isbn, publisher, tags });

		// Convert publicationYear to number if it's a string, handle empty strings
		let yearAsNumber: number | undefined = undefined;
		if (publicationYear !== null && publicationYear !== undefined && publicationYear !== '') {
			const parsed = parseInt(publicationYear.toString(), 10);
			if (!isNaN(parsed)) {
				yearAsNumber = parsed;
			}
		}

		console.log('Converted year:', yearAsNumber);

		let book;
		try {
			book = await updateBook(params.id, {
				title,
				author,
				coverImage,
				contentType,
				publicationYear: yearAsNumber,
				isbn,
				description,
				publisher,
				tags
			});
			console.log('Book updated successfully');
		} catch (dbError) {
			console.error('Database update error:', dbError);
			throw dbError;
		}

		// Update in Meilisearch with tags
		try {
			// Get tag names for search index
			const bookWithTags = await db.book.findUnique({
				where: { id: params.id },
				include: {
					tags: {
						include: {
							tag: true
						}
					}
				}
			});
			const tagNames = bookWithTags?.tags.map(bt => bt.tag.name) || [];
			
			await updateBookInIndex(params.id, { 
				title, 
				author, 
				coverImage,
				contentType,
				publicationYear: yearAsNumber,
				isbn,
				description,
				publisher,
				tags: tagNames
			});
		} catch (searchError) {
			console.error('Failed to update book in Meilisearch:', searchError);
		}

		return json({ book });
	} catch (error) {
		console.error('Update error:', error);
		// Return detailed error message for debugging
		const errorMessage = error instanceof Error ? error.message : 'Update failed';
		console.error('Full error details:', errorMessage);
		return json({ error: errorMessage }, { status: 500 });
	}
};

