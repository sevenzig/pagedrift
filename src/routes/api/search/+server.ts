import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { searchClient, BOOKS_INDEX, CHAPTERS_INDEX } from '$lib/server/search/client';
import { parseSearchQuery, buildTextQuery } from '$lib/utils/search-parser';
import type { FilterValue } from '$lib/types';

export const GET: RequestHandler = async ({ url, locals }) => {
	try {
		if (!locals.user) {
			return json({ error: 'Unauthorized' }, { status: 401 });
		}

		const query = url.searchParams.get('q') || '';
		const type = url.searchParams.get('type') || undefined; // deprecated in favor of scope
		const scope = url.searchParams.get('scope') || (type ?? 'metadata'); // 'metadata' | 'fulltext' | 'both'
		const limit = parseInt(url.searchParams.get('limit') || '20');

		if (!query.trim()) {
			return json({ results: [] });
		}

		// Parse the search query for advanced syntax
		const parsedQuery = parseSearchQuery(query);
		
		// Build the actual search text (combining text query and exact phrases)
		const searchText = buildTextQuery(parsedQuery.textQuery, parsedQuery.exactPhrases);
		
	// Build MeiliSearch filters from parsed query
	const filters = buildMeiliSearchFilters(parsedQuery.filters, locals.user.id);
	// Join filters with AND - MeiliSearch expects a single string or array
	const filterString = filters.length > 0 ? filters.join(' AND ') : undefined;

	if (scope === 'fulltext') {
		// Search in chapters (full-text)
		const chaptersIndex = searchClient.index(CHAPTERS_INDEX);
		// When searchText is empty, use empty string to search with filters only
		const searchQuery = searchText.trim() ? searchText : '';
		const results = await chaptersIndex.search(searchQuery, {
			limit,
			filter: filterString,
			attributesToCrop: ['content'],
			cropLength: 200,
			attributesToHighlight: ['title', 'content'],
			showMatchesPosition: true
		});

            // Enrich chapter results with book metadata
            const enrichedResults = await Promise.all(
                results.hits.map(async (hit: any) => {
                    try {
                        const booksIndex = searchClient.index(BOOKS_INDEX);
                        const bookResult = await booksIndex.getDocument(hit.bookId);
                        return {
                            ...hit,
                            bookTitle: bookResult.title,
                            bookAuthor: bookResult.author,
                            bookFormat: bookResult.format
                        };
                    } catch (error) {
                        console.error('Error fetching book metadata:', error);
                        return hit;
                    }
                })
            );

			return json({
				results: enrichedResults,
				metadata: [],
				fulltext: enrichedResults,
				parsedQuery
			});
	} else if (scope === 'metadata') {
		// Search in books (metadata)
		const booksIndex = searchClient.index(BOOKS_INDEX);
		// When searchText is empty, use empty string to search with filters only
		const searchQuery = searchText.trim() ? searchText : '';
		const results = await booksIndex.search(searchQuery, {
			limit,
			filter: filterString,
			attributesToHighlight: ['title', 'author', 'description']
		});

			// Filter out excluded terms from results
			let filteredHits = results.hits;
			if (parsedQuery.excludeTerms.length > 0) {
				filteredHits = filterExcludedTerms(results.hits, parsedQuery.excludeTerms);
			}

			return json({
				results: filteredHits,
				metadata: filteredHits,
				fulltext: [],
				parsedQuery
			});
	} else {
		// both
		const [booksIndex, chaptersIndex] = [
			searchClient.index(BOOKS_INDEX),
			searchClient.index(CHAPTERS_INDEX)
		];
		// When searchText is empty, use empty string to search with filters only
		const searchQuery = searchText.trim() ? searchText : '';
		const [booksRes, chaptersRes] = await Promise.all([
			booksIndex.search(searchQuery, {
				limit,
				filter: filterString,
				attributesToHighlight: ['title', 'author', 'description']
			}),
			chaptersIndex.search(searchQuery, {
				limit,
				filter: filterString,
				attributesToCrop: ['content'],
				cropLength: 200,
				attributesToHighlight: ['title', 'content'],
				showMatchesPosition: true
			})
		]);

            // Enrich chapter results with book metadata
            const enrichedChapterResults = await Promise.all(
                chaptersRes.hits.map(async (hit: any) => {
                    try {
                        const bookResult = await booksIndex.getDocument(hit.bookId);
                        return {
                            ...hit,
                            bookTitle: bookResult.title,
                            bookAuthor: bookResult.author,
                            bookFormat: bookResult.format
                        };
                    } catch (error) {
                        console.error('Error fetching book metadata:', error);
                        return hit;
                    }
                })
            );

			// Filter out excluded terms from results
			let filteredBooksHits = booksRes.hits;
			let filteredChapterHits = enrichedChapterResults;
			if (parsedQuery.excludeTerms.length > 0) {
				filteredBooksHits = filterExcludedTerms(booksRes.hits, parsedQuery.excludeTerms);
				filteredChapterHits = filterExcludedTerms(
					enrichedChapterResults,
					parsedQuery.excludeTerms
				);
			}

			return json({
				results: [...filteredBooksHits, ...filteredChapterHits],
				metadata: filteredBooksHits,
				fulltext: filteredChapterHits,
				parsedQuery
			});
		}
	} catch (error) {
		console.error('Search error:', error);
		return json({ error: 'Search failed' }, { status: 500 });
	}
};

/**
 * Build MeiliSearch filter strings from parsed query filters
 */
function buildMeiliSearchFilters(filters: Record<string, FilterValue>, userId: string): string[] {
	const meiliFilters: string[] = [];

	// Always filter by user (books uploaded by this user)
	// Note: This is commented out to allow searching across all books
	// Uncomment if you want to restrict searches to user's own books
	// meiliFilters.push(`uploadedById = "${userId}"`);

	Object.entries(filters).forEach(([key, filter]) => {
		switch (key.toLowerCase()) {
			case 'format':
				if (filter.value) {
					meiliFilters.push(`format = "${filter.value}"`);
				}
				break;

			case 'year':
			case 'publicationyear':
				if (typeof filter.value === 'number') {
					meiliFilters.push(`publicationYear = ${filter.value}`);
				} else if (filter.gt !== undefined) {
					meiliFilters.push(`publicationYear > ${filter.gt}`);
				} else if (filter.lt !== undefined) {
					meiliFilters.push(`publicationYear < ${filter.lt}`);
				} else if (filter.gte !== undefined) {
					meiliFilters.push(`publicationYear >= ${filter.gte}`);
				} else if (filter.lte !== undefined) {
					meiliFilters.push(`publicationYear <= ${filter.lte}`);
				} else if (filter.min !== undefined && filter.max !== undefined) {
					meiliFilters.push(
						`publicationYear >= ${filter.min} AND publicationYear <= ${filter.max}`
					);
				}
				break;

			case 'language':
			case 'lang':
				if (filter.value) {
					meiliFilters.push(`language = "${filter.value}"`);
				}
				break;

			case 'tag':
			case 'tags':
				if (filter.value) {
					// Tag substring matching - search for tags containing the value
					meiliFilters.push(`tags CONTAINS "${filter.value}"`);
				}
				break;

			case 'isbn':
				if (filter.value) {
					meiliFilters.push(`isbn = "${filter.value}"`);
				}
				break;

			case 'contenttype':
			case 'type':
				if (filter.value) {
					meiliFilters.push(`contentType = "${filter.value}"`);
				}
				break;

			case 'publisher':
				if (filter.value) {
					meiliFilters.push(`publisher = "${filter.value}"`);
				}
				break;

			case 'pages':
			case 'pagecount':
				if (typeof filter.value === 'number') {
					meiliFilters.push(`pageCount = ${filter.value}`);
				} else if (filter.gt !== undefined) {
					meiliFilters.push(`pageCount > ${filter.gt}`);
				} else if (filter.lt !== undefined) {
					meiliFilters.push(`pageCount < ${filter.lt}`);
				} else if (filter.gte !== undefined) {
					meiliFilters.push(`pageCount >= ${filter.gte}`);
				} else if (filter.lte !== undefined) {
					meiliFilters.push(`pageCount <= ${filter.lte}`);
				} else if (filter.min !== undefined && filter.max !== undefined) {
					meiliFilters.push(`pageCount >= ${filter.min} AND pageCount <= ${filter.max}`);
				}
				break;

			case 'size':
			case 'filesize':
				// File size is stored in bytes
				if (typeof filter.value === 'number') {
					meiliFilters.push(`fileSize = ${filter.value}`);
				} else if (filter.gt !== undefined) {
					meiliFilters.push(`fileSize > ${filter.gt}`);
				} else if (filter.lt !== undefined) {
					meiliFilters.push(`fileSize < ${filter.lt}`);
				} else if (filter.gte !== undefined) {
					meiliFilters.push(`fileSize >= ${filter.gte}`);
				} else if (filter.lte !== undefined) {
					meiliFilters.push(`fileSize <= ${filter.lte}`);
				} else if (filter.min !== undefined && filter.max !== undefined) {
					meiliFilters.push(`fileSize >= ${filter.min} AND fileSize <= ${filter.max}`);
				}
				break;

			case 'added':
			case 'uploaddate':
				// Date filtering
				if (filter.value) {
					const dateValue = new Date(filter.value as string).getTime() / 1000;
					meiliFilters.push(`uploadDate = ${dateValue}`);
				} else if (filter.gt !== undefined) {
					const dateValue =
						typeof filter.gt === 'string'
							? new Date(filter.gt).getTime() / 1000
							: filter.gt;
					meiliFilters.push(`uploadDate > ${dateValue}`);
				} else if (filter.lt !== undefined) {
					const dateValue =
						typeof filter.lt === 'string' ? new Date(filter.lt).getTime() / 1000 : filter.lt;
					meiliFilters.push(`uploadDate < ${dateValue}`);
				} else if (filter.gte !== undefined) {
					const dateValue =
						typeof filter.gte === 'string'
							? new Date(filter.gte).getTime() / 1000
							: filter.gte;
					meiliFilters.push(`uploadDate >= ${dateValue}`);
				} else if (filter.lte !== undefined) {
					const dateValue =
						typeof filter.lte === 'string'
							? new Date(filter.lte).getTime() / 1000
							: filter.lte;
					meiliFilters.push(`uploadDate <= ${dateValue}`);
				}
				break;

			case 'title':
				// Title is handled via text search, not filter
				break;

			case 'author':
				// Author is handled via text search, not filter
				break;

			default:
				console.warn(`Unknown filter key: ${key}`);
		}
	});

	return meiliFilters;
}

/**
 * Filter out results containing excluded terms
 */
function filterExcludedTerms(hits: any[], excludeTerms: string[]): any[] {
	if (excludeTerms.length === 0) return hits;

	return hits.filter((hit) => {
		const searchableText = [
			hit.title,
			hit.author,
			hit.description,
			hit.content,
			...(hit.tags || [])
		]
			.filter(Boolean)
			.join(' ')
			.toLowerCase();

		return !excludeTerms.some((term) => searchableText.includes(term.toLowerCase()));
	});
}
