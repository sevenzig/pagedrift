/**
 * External metadata API service
 * Queries Google Books and Open Library for book metadata
 */

export interface MetadataResult {
	isbn?: string;
	isbn13?: string;
	publisher?: string;
	publicationYear?: number;
	description?: string;
	coverImageUrl?: string;
	title?: string;
	author?: string;
	source: 'google' | 'openlibrary' | 'book-content';
	confidence?: number;
}

/**
 * Look up book metadata by ISBN
 * Tries Google Books first, then Open Library
 */
export async function lookupByIsbn(isbn: string): Promise<MetadataResult | null> {
	if (!isbn) return null;

	// Clean ISBN
	const cleanedIsbn = isbn.replace(/[^\dX]/gi, '');
	
	// Try Google Books first
	try {
		const result = await queryGoogleBooks({ isbn: cleanedIsbn });
		if (result && !Array.isArray(result)) return result;
	} catch (error) {
		console.error('Google Books API error:', error);
	}

	// Fall back to Open Library
	try {
		const result = await queryOpenLibrary({ isbn: cleanedIsbn });
		if (result && !Array.isArray(result)) return result;
	} catch (error) {
		console.error('Open Library API error:', error);
	}

	return null;
}

/**
 * Search for book metadata by title and author
 * Returns multiple results sorted by relevance
 */
export async function searchByTitleAuthor(
	title: string,
	author?: string
): Promise<MetadataResult[]> {
	if (!title) return [];

	const results: MetadataResult[] = [];

	// Try Google Books
	try {
		const googleResults = await queryGoogleBooks({ title, author });
		if (googleResults) {
			if (Array.isArray(googleResults)) {
				results.push(...googleResults);
			} else {
				results.push(googleResults);
			}
		}
	} catch (error) {
		console.error('Google Books search error:', error);
	}

	// Try Open Library for additional results
	try {
		const openLibResults = await queryOpenLibrary({ title, author });
		if (openLibResults) {
			if (Array.isArray(openLibResults)) {
				results.push(...openLibResults);
			} else {
				results.push(openLibResults);
			}
		}
	} catch (error) {
		console.error('Open Library search error:', error);
	}

	// Sort by confidence and limit results
	return results
		.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
		.slice(0, 10);
}

/**
 * Query Google Books API
 */
async function queryGoogleBooks(params: {
	isbn?: string;
	title?: string;
	author?: string;
}): Promise<MetadataResult | MetadataResult[] | null> {
	let query = '';

	if (params.isbn) {
		query = `isbn:${params.isbn}`;
	} else if (params.title) {
		query = `intitle:${encodeURIComponent(params.title)}`;
		if (params.author) {
			query += `+inauthor:${encodeURIComponent(params.author)}`;
		}
	} else {
		return null;
	}

	const url = `https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=5`;
	const response = await fetch(url, {
		headers: {
			'Accept': 'application/json'
		}
	});

	if (!response.ok) {
		throw new Error(`Google Books API error: ${response.status}`);
	}

	const data = await response.json();

	if (!data.items || data.items.length === 0) {
		return null;
	}

	// Parse results
	const results: MetadataResult[] = data.items.map((item: any, index: number) => {
		const volumeInfo = item.volumeInfo || {};
		const industryIdentifiers = volumeInfo.industryIdentifiers || [];

		// Extract ISBNs
		let isbn: string | undefined;
		let isbn13: string | undefined;

		for (const identifier of industryIdentifiers) {
			if (identifier.type === 'ISBN_13') {
				isbn13 = identifier.identifier;
			} else if (identifier.type === 'ISBN_10') {
				isbn = identifier.identifier;
			}
		}

		// Parse publication year
		let publicationYear: number | undefined;
		if (volumeInfo.publishedDate) {
			const yearMatch = volumeInfo.publishedDate.match(/\d{4}/);
			if (yearMatch) {
				publicationYear = parseInt(yearMatch[0]);
			}
		}

		// Get cover image
		let coverImageUrl: string | undefined;
		if (volumeInfo.imageLinks) {
			coverImageUrl = volumeInfo.imageLinks.thumbnail || 
			               volumeInfo.imageLinks.smallThumbnail;
		}

		// Calculate confidence based on position and data completeness
		let confidence = 100 - (index * 10); // First result = 100, second = 90, etc.
		if (isbn13 || isbn) confidence += 20;
		if (volumeInfo.publisher) confidence += 10;
		if (publicationYear) confidence += 10;

		return {
			isbn: isbn || isbn13,
			isbn13,
			publisher: volumeInfo.publisher,
			publicationYear,
			description: volumeInfo.description,
			coverImageUrl,
			title: volumeInfo.title,
			author: volumeInfo.authors?.join(', '),
			source: 'google' as const,
			confidence: Math.min(confidence, 100)
		};
	});

	// If searching by ISBN, return single result
	if (params.isbn) {
		return results[0] || null;
	}

	return results;
}

/**
 * Query Open Library API
 */
async function queryOpenLibrary(params: {
	isbn?: string;
	title?: string;
	author?: string;
}): Promise<MetadataResult | MetadataResult[] | null> {
	if (params.isbn) {
		// ISBN lookup
		const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${params.isbn}&format=json&jscmd=data`;
		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(`Open Library API error: ${response.status}`);
		}

		const data = await response.json();
		const bookKey = `ISBN:${params.isbn}`;
		const bookData = data[bookKey];

		if (!bookData) return null;

		// Parse publication year
		let publicationYear: number | undefined;
		if (bookData.publish_date) {
			const yearMatch = bookData.publish_date.match(/\d{4}/);
			if (yearMatch) {
				publicationYear = parseInt(yearMatch[0]);
			}
		}

		// Get cover image
		let coverImageUrl: string | undefined;
		if (bookData.cover) {
			coverImageUrl = bookData.cover.large || bookData.cover.medium || bookData.cover.small;
		}

		return {
			isbn: params.isbn,
			publisher: bookData.publishers?.[0]?.name,
			publicationYear,
			description: bookData.notes || bookData.subtitle,
			coverImageUrl,
			title: bookData.title,
			author: bookData.authors?.map((a: any) => a.name).join(', '),
			source: 'openlibrary',
			confidence: 80
		};
	} else if (params.title) {
		// Title/author search
		let query = params.title;
		if (params.author) {
			query += ` ${params.author}`;
		}

		const url = `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5`;
		const response = await fetch(url);

		if (!response.ok) {
			throw new Error(`Open Library API error: ${response.status}`);
		}

		const data = await response.json();

		if (!data.docs || data.docs.length === 0) {
			return null;
		}

		// Parse results
		const results: MetadataResult[] = data.docs.map((doc: any, index: number) => {
			// Extract ISBN
			const isbn13 = doc.isbn?.[0];
			const isbn = isbn13 || doc.isbn?.[1];

			// Parse publication year
			let publicationYear: number | undefined;
			if (doc.first_publish_year) {
				publicationYear = doc.first_publish_year;
			} else if (doc.publish_date?.[0]) {
				const yearMatch = doc.publish_date[0].match(/\d{4}/);
				if (yearMatch) {
					publicationYear = parseInt(yearMatch[0]);
				}
			}

			// Get cover image
			let coverImageUrl: string | undefined;
			if (doc.cover_i) {
				coverImageUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`;
			}

			// Calculate confidence
			let confidence = 70 - (index * 8);
			if (isbn) confidence += 15;
			if (doc.publisher?.[0]) confidence += 10;

			return {
				isbn,
				isbn13,
				publisher: doc.publisher?.[0],
				publicationYear,
				description: undefined,
				coverImageUrl,
				title: doc.title,
				author: doc.author_name?.join(', '),
				source: 'openlibrary' as const,
				confidence: Math.min(confidence, 100)
			};
		});

		return results;
	}

	return null;
}

