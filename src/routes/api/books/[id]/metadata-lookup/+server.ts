import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getBookById } from '$lib/server/db/books';
import { extractPublicationInfoFromText } from '$lib/utils/metadata';
import { lookupByIsbn, searchByTitleAuthor, type MetadataResult } from '$lib/server/metadata/api-service';

export const GET: RequestHandler = async ({ params, url, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const bookId = params.id;
		const strategy = url.searchParams.get('strategy') || 'auto';

		// Fetch the book
		const book = await getBookById(bookId);
		if (!book) {
			return json({ error: 'Book not found' }, { status: 404 });
		}

		const results: MetadataResult[] = [];

		if (strategy === 'auto') {
			// Strategy 1: Extract from firstPagesText if available
			let scrapedInfo: { isbn?: string; publisher?: string; publicationYear?: number } = {};
			
			if (book.firstPagesText) {
				scrapedInfo = extractPublicationInfoFromText(book.firstPagesText);
				console.log('Scraped info from book content:', scrapedInfo);

				// Add scraped info as a result if we found anything
				if (scrapedInfo.isbn || scrapedInfo.publisher || scrapedInfo.publicationYear) {
					results.push({
						isbn: scrapedInfo.isbn,
						publisher: scrapedInfo.publisher,
						publicationYear: scrapedInfo.publicationYear,
						source: 'book-content',
						confidence: 90
					});
				}
			}

			// Strategy 2: If we found an ISBN, look it up
			const isbnToLookup = scrapedInfo.isbn || book.isbn;
			if (isbnToLookup) {
				console.log('Looking up ISBN:', isbnToLookup);
				const isbnResult = await lookupByIsbn(isbnToLookup);
				if (isbnResult) {
					results.push(isbnResult);
				}
			}

			// Strategy 3: If no ISBN or no results, search by title/author
			if (results.length === 0 && book.title) {
				console.log('Searching by title/author:', book.title, book.author);
				const searchResults = await searchByTitleAuthor(book.title, book.author || undefined);
				results.push(...searchResults);
			}

			// If we have only one high-confidence result, return it directly
			if (results.length === 1 || (results.length > 0 && results[0].confidence && results[0].confidence >= 90)) {
				return json({ 
					result: results[0],
					multipleResults: false
				});
			}

			// Multiple results - let user choose
			return json({ 
				results: results.slice(0, 5),
				multipleResults: true
			});

		} else if (strategy === 'isbn-only') {
			// Only look up by ISBN
			const isbnToLookup = book.isbn;
			if (!isbnToLookup) {
				return json({ error: 'No ISBN available for this book' }, { status: 400 });
			}

			const result = await lookupByIsbn(isbnToLookup);
			if (!result) {
				return json({ error: 'No results found for ISBN' }, { status: 404 });
			}

			return json({ result, multipleResults: false });

		} else if (strategy === 'title-search') {
			// Only search by title/author
			if (!book.title) {
				return json({ error: 'No title available for this book' }, { status: 400 });
			}

			const searchResults = await searchByTitleAuthor(book.title, book.author || undefined);
			if (searchResults.length === 0) {
				return json({ error: 'No results found' }, { status: 404 });
			}

			return json({ 
				results: searchResults,
				multipleResults: true
			});
		}

		return json({ error: 'Invalid strategy' }, { status: 400 });

	} catch (error) {
		console.error('Metadata lookup error:', error);
		const message = error instanceof Error ? error.message : 'Lookup failed';
		return json({ error: message }, { status: 500 });
	}
};

export const POST: RequestHandler = async ({ params, request, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { title, author } = await request.json();

		if (!title) {
			return json({ error: 'Title is required' }, { status: 400 });
		}

		// Search by provided title/author
		const results = await searchByTitleAuthor(title, author);

		if (results.length === 0) {
			return json({ error: 'No results found' }, { status: 404 });
		}

		return json({ 
			results,
			multipleResults: true
		});

	} catch (error) {
		console.error('Manual search error:', error);
		const message = error instanceof Error ? error.message : 'Search failed';
		return json({ error: message }, { status: 500 });
	}
};

