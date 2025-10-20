/**
 * Content type classifications for uploaded content
 * Used across frontend and backend for consistent categorization
 */

export const CONTENT_TYPES = [
	'Book',
	'Journal Article',
	'Magazine Article',
	'Paper/Preprint',
	'Thesis',
	'Report',
	'Short Story/Essay',
	'Comic/Graphic Novel',
	'Other'
] as const;

export type ContentType = (typeof CONTENT_TYPES)[number];

/**
 * Validate if a string is a valid content type
 */
export function isValidContentType(value: string): value is ContentType {
	return CONTENT_TYPES.includes(value as ContentType);
}

/**
 * Get default content type
 */
export function getDefaultContentType(): ContentType {
	return 'Book';
}

