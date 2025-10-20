/**
 * Metadata extraction and normalization utilities for books
 * Handles text normalization, ISBN validation, and folder structure generation
 */

export interface BookMetadata {
	title: string;
	author?: string;
	isbn?: string;
	publisher?: string;
	publicationYear?: number;
	language?: string;
	description?: string;
	subjects?: string[];
	pageCount?: number;
	fileSize?: number;
	normalizedAuthor?: string;
	normalizedTitle?: string;
}

/**
 * Normalize text for folder/file names
 * Converts to lowercase, replaces spaces with hyphens, removes special characters
 */
export function normalizeText(text: string): string {
	return text
		.toLowerCase()
		.trim()
		// Replace spaces and common separators with hyphens
		.replace(/[\s\-_\.]+/g, '-')
		// Remove special characters except hyphens
		.replace(/[^a-z0-9\-]/g, '')
		// Remove multiple consecutive hyphens
		.replace(/-+/g, '-')
		// Remove leading/trailing hyphens
		.replace(/^-+|-+$/g, '');
}

/**
 * Handle multiple authors by using primary author or combining them
 */
export function normalizeAuthor(author: string): string {
	if (!author) return 'unknown-author';
	
	// Split by common separators
	const authors = author
		.split(/[,;&|]/)
		.map(a => a.trim())
		.filter(a => a.length > 0);
	
	if (authors.length === 0) return 'unknown-author';
	
	// Use primary author (first one)
	const primaryAuthor = authors[0];
	
	// If multiple authors, append "-and-others" for clarity
	if (authors.length > 1) {
		return normalizeText(primaryAuthor) + '-and-others';
	}
	
	return normalizeText(primaryAuthor);
}

/**
 * Normalize title for folder structure
 */
export function normalizeTitle(title: string): string {
	if (!title) return 'untitled';
	return normalizeText(title);
}

/**
 * Validate and clean ISBN
 */
export function validateIsbn(isbn: string): string | null {
	if (!isbn) return null;
	
	// Remove all non-digit characters except X
	const cleaned = isbn.replace(/[^\dX]/gi, '');
	
	// Check if it's a valid ISBN-10 or ISBN-13
	if (cleaned.length === 10) {
		// ISBN-10 validation
		const digits = cleaned.split('');
		const checkDigit = digits[9].toUpperCase();
		const sum = digits.slice(0, 9).reduce((acc, digit, index) => {
			return acc + parseInt(digit) * (10 - index);
		}, 0);
		
		const remainder = sum % 11;
		const calculatedCheck = remainder === 0 ? '0' : remainder === 1 ? 'X' : (11 - remainder).toString();
		
		if (checkDigit === calculatedCheck) {
			return cleaned;
		}
	} else if (cleaned.length === 13) {
		// ISBN-13 validation
		const digits = cleaned.split('').map(d => parseInt(d));
		const sum = digits.slice(0, 12).reduce((acc, digit, index) => {
			return acc + digit * (index % 2 === 0 ? 1 : 3);
		}, 0);
		
		const remainder = sum % 10;
		const calculatedCheck = remainder === 0 ? 0 : 10 - remainder;
		
		if (digits[12] === calculatedCheck) {
			return cleaned;
		}
	}
	
	return null;
}

/**
 * Extract year from various formats
 */
export function extractYear(text: string): number | null {
	if (!text) return null;
	
	// Look for 4-digit years (1900-2100)
	const yearMatch = text.match(/\b(19|20)\d{2}\b/);
	if (yearMatch) {
		const year = parseInt(yearMatch[0]);
		if (year >= 1900 && year <= 2100) {
			return year;
		}
	}
	
	return null;
}

/**
 * Extract language from text or metadata
 */
export function extractLanguage(text: string): string | null {
	if (!text) return null;
	
	// Common language patterns
	const languageMap: Record<string, string> = {
		'english': 'en',
		'eng': 'en',
		'french': 'fr',
		'français': 'fr',
		'spanish': 'es',
		'español': 'es',
		'german': 'de',
		'deutsch': 'de',
		'italian': 'it',
		'italiano': 'it',
		'portuguese': 'pt',
		'português': 'pt',
		'russian': 'ru',
		'русский': 'ru',
		'chinese': 'zh',
		'中文': 'zh',
		'japanese': 'ja',
		'日本語': 'ja',
		'korean': 'ko',
		'한국어': 'ko'
	};
	
	const lowerText = text.toLowerCase();
	for (const [key, code] of Object.entries(languageMap)) {
		if (lowerText.includes(key)) {
			return code;
		}
	}
	
	return null;
}

/**
 * Generate folder path for book storage
 */
export function generateBookPath(metadata: BookMetadata): string {
	const author = metadata.normalizedAuthor || 'unknown-author';
	const title = metadata.normalizedTitle || 'untitled';
	
	return `${author}/${title}`;
}

/**
 * Handle edition conflicts by adding edition suffix
 */
export function handleEditionConflict(basePath: string, existingPaths: string[]): string {
	let counter = 2;
	let newPath = `${basePath}-${counter}nd-ed`;
	
	while (existingPaths.includes(newPath)) {
		counter++;
		const suffix = counter === 3 ? 'rd' : 'th';
		newPath = `${basePath}-${counter}${suffix}-ed`;
	}
	
	return newPath;
}

/**
 * Publication info extracted from book content
 */
export interface PublicationInfo {
	isbn?: string;
	publisher?: string;
	publicationYear?: number;
}

/**
 * Extract publication information from the first pages of a book
 * Looks for ISBN, publisher names, and copyright years
 */
export function extractPublicationInfoFromText(text: string): PublicationInfo {
	if (!text) return {};
	
	const info: PublicationInfo = {};
	
	// ISBN patterns
	const isbn10Pattern = /ISBN[-\s]?(?:10)?[:\s]?([\dX-]{10,17})/gi;
	const isbn13Pattern = /ISBN[-\s]?(?:13)?[:\s]?(97[89][\d-]{10,17})/gi;
	
	// Try to find ISBN-13 first (preferred)
	let match = isbn13Pattern.exec(text);
	if (match) {
		const cleaned = match[1].replace(/[^\d]/g, '');
		if (cleaned.length === 13) {
			const validated = validateIsbn(cleaned);
			if (validated) {
				info.isbn = validated;
			}
		}
	}
	
	// Fall back to ISBN-10
	if (!info.isbn) {
		match = isbn10Pattern.exec(text);
		if (match) {
			const cleaned = match[1].replace(/[^\dX]/gi, '');
			if (cleaned.length === 10) {
				const validated = validateIsbn(cleaned);
				if (validated) {
					info.isbn = validated;
				}
			}
		}
	}
	
	// Publisher patterns - look for common phrases
	const publisherPatterns = [
		/Published\s+by[:\s]+([A-Z][^\n\r]{3,50}?)(?:\n|$|,|\s{2,})/i,
		/Publisher[:\s]+([A-Z][^\n\r]{3,50}?)(?:\n|$|,|\s{2,})/i,
		/Imprint[:\s]+([A-Z][^\n\r]{3,50}?)(?:\n|$|,|\s{2,})/i,
		/©\s*\d{4}\s+by\s+([A-Z][^\n\r]{3,50}?)(?:\n|$|,|\s{2,})/i,
		/Copyright\s+©?\s*\d{4}\s+by\s+([A-Z][^\n\r]{3,50}?)(?:\n|$|,|\s{2,})/i
	];
	
	for (const pattern of publisherPatterns) {
		match = pattern.exec(text);
		if (match && match[1]) {
			let publisher = match[1].trim();
			// Clean up common suffixes and artifacts
			publisher = publisher.replace(/\s+(Inc\.|LLC|Ltd\.|Press|Books|Publishing).*$/i, ' $1');
			publisher = publisher.replace(/\s{2,}/g, ' ').trim();
			if (publisher.length >= 3 && publisher.length <= 50) {
				info.publisher = publisher;
				break;
			}
		}
	}
	
	// Copyright year patterns
	const yearPatterns = [
		/Copyright\s+©?\s*(\d{4})/i,
		/©\s*(\d{4})/,
		/\(c\)\s*(\d{4})/i,
		/First\s+published\s+(?:in\s+)?(\d{4})/i,
		/Published\s+(?:in\s+)?(\d{4})/i
	];
	
	for (const pattern of yearPatterns) {
		match = pattern.exec(text);
		if (match && match[1]) {
			const year = parseInt(match[1]);
			if (year >= 1900 && year <= new Date().getFullYear() + 1) {
				info.publicationYear = year;
				break;
			}
		}
	}
	
	return info;
}

/**
 * Extract metadata from various sources and normalize it
 */
export function extractAndNormalizeMetadata(
	title: string,
	author?: string,
	additionalMetadata?: Record<string, any>
): BookMetadata {
	const metadata: BookMetadata = {
		title: title || 'Untitled',
		author: author || undefined,
		normalizedAuthor: author ? normalizeAuthor(author) : undefined,
		normalizedTitle: normalizeTitle(title)
	};
	
	// Extract additional metadata if provided
	if (additionalMetadata) {
		// ISBN
		if (additionalMetadata.isbn) {
			const validatedIsbn = validateIsbn(additionalMetadata.isbn);
			if (validatedIsbn) metadata.isbn = validatedIsbn;
		}
		
		// Publisher
		if (additionalMetadata.publisher) {
			metadata.publisher = additionalMetadata.publisher;
		}
		
		// Publication year
		if (additionalMetadata.publicationYear) {
			const year = extractYear(additionalMetadata.publicationYear.toString());
			if (year) metadata.publicationYear = year;
		} else if (additionalMetadata.date) {
			const year = extractYear(additionalMetadata.date.toString());
			if (year) metadata.publicationYear = year;
		}
		
		// Language
		if (additionalMetadata.language) {
			const lang = extractLanguage(additionalMetadata.language);
			if (lang) metadata.language = lang;
		}
		
		// Description
		if (additionalMetadata.description) {
			metadata.description = additionalMetadata.description;
		}
		
		// Subjects/Tags
		if (additionalMetadata.subjects) {
			const subjects = Array.isArray(additionalMetadata.subjects) 
				? additionalMetadata.subjects 
				: additionalMetadata.subjects.split(',').map((s: string) => s.trim());
			metadata.subjects = subjects.filter((s: string) => s.length > 0);
		}
		
		// Page count
		if (additionalMetadata.pageCount) {
			metadata.pageCount = parseInt(additionalMetadata.pageCount.toString());
		}
	}
	
	return metadata;
}
