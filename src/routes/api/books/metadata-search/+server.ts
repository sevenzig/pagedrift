import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchByTitleAuthor, type MetadataResult } from '$lib/server/metadata/api-service';
import { previewCache } from '$lib/server/cache/preview-cache';
import { extractPublicationInfoFromText } from '$lib/utils/metadata';

/**
 * POST /api/books/metadata-search
 * Search for book metadata by title and author during upload staging
 */
export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const { title, author, fileId } = await request.json();

		if (!title) {
			return json({ error: 'Title is required' }, { status: 400 });
		}

		const results: MetadataResult[] = [];

		// Check cache for firstPagesText if fileId provided
		let firstPagesText: string | undefined;
		if (fileId) {
			const cached = previewCache.get(locals.user.id, fileId);
			if (cached?.firstPagesText) {
				firstPagesText = cached.firstPagesText;
				console.log('Using cached firstPagesText for metadata extraction');
			}
		}

		// Extract publication info from firstPagesText if available
		if (firstPagesText) {
			const scrapedInfo = extractPublicationInfoFromText(firstPagesText);
			console.log('Scraped info from cached preview:', scrapedInfo);
			
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

		// Search by title/author with timeout handling
		const searchResults = await Promise.race([
			searchByTitleAuthor(title, author),
			new Promise<MetadataResult[]>((_, reject) => 
				setTimeout(() => reject(new Error('Search timeout')), 10000)
			)
		]).catch((err) => {
			console.warn('Metadata search timed out or failed:', err);
			return [] as MetadataResult[];
		});

		results.push(...searchResults);

		if (results.length === 0) {
			return json({ error: 'No results found' }, { status: 404 });
		}

		// Return the first result as the primary result
		return json({ 
			result: results[0],
			alternativeResults: results.slice(1, 5),
			multipleResults: results.length > 1
		});

	} catch (error) {
		console.error('Metadata search error:', error);
		const message = error instanceof Error ? error.message : 'Search failed';
		return json({ error: message }, { status: 500 });
	}
};

