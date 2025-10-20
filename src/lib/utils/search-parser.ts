import type { SearchQuery, FilterValue } from '$lib/types';

/**
 * Parse a search query string into structured components
 * Supports:
 * - Field-specific filters: title:, author:, format:, year:, tag:, isbn:, language:, contentType:, publisher:, pages:, size:, added:
 * - Exact phrases: "quoted text"
 * - Exclusion terms: -unwanted
 * - Comparison operators: >, <, >=, <=
 * - Range operators: 2020..2023
 * - Boolean operators: AND, OR
 */
export function parseSearchQuery(query: string): SearchQuery {
	const result: SearchQuery = {
		originalQuery: query,
		filters: {},
		textQuery: '',
		excludeTerms: [],
		exactPhrases: []
	};

	let remainingQuery = query;

	// Extract exact phrases (quoted text)
	const phraseRegex = /"([^"]+)"/g;
	let match;
	const phrases: string[] = [];
	while ((match = phraseRegex.exec(query)) !== null) {
		phrases.push(match[1]);
		remainingQuery = remainingQuery.replace(match[0], '');
	}
	result.exactPhrases = phrases;

	// Extract field-specific filters (key:value pairs)
	// Supports: title:, author:, format:, year:, tag:, isbn:, language:, contentType:, publisher:, pages:, size:, added:
	const filterRegex = /(\w+):((?:"[^"]*")|(?:[^\s]+))/g;
	while ((match = filterRegex.exec(query)) !== null) {
		const [fullMatch, key, rawValue] = match;
		// Remove quotes from value if present
		const value = rawValue.replace(/^"(.*)"$/, '$1');
		result.filters[key.toLowerCase()] = parseFilterValue(value);
		remainingQuery = remainingQuery.replace(fullMatch, '');
	}

	// Extract exclusion terms (prefixed with -)
	const excludeRegex = /-(\w+)/g;
	while ((match = excludeRegex.exec(remainingQuery)) !== null) {
		result.excludeTerms.push(match[1]);
		remainingQuery = remainingQuery.replace(match[0], '');
	}

	// Remaining text is the general search query (clean up extra spaces)
	result.textQuery = remainingQuery.replace(/\s+/g, ' ').trim();

	return result;
}

/**
 * Parse a filter value, handling comparison operators and ranges
 */
export function parseFilterValue(value: string): FilterValue {
	// Handle range queries (e.g., "2020..2023")
	if (value.includes('..')) {
		const [min, max] = value.split('..');
		return {
			min: parseNumericValue(min),
			max: parseNumericValue(max)
		};
	}

	// Handle greater than or equal (>=)
	if (value.startsWith('>=')) {
		return { gte: parseNumericValue(value.slice(2)) };
	}

	// Handle less than or equal (<=)
	if (value.startsWith('<=')) {
		return { lte: parseNumericValue(value.slice(2)) };
	}

	// Handle greater than (>)
	if (value.startsWith('>')) {
		return { gt: parseNumericValue(value.slice(1)) };
	}

	// Handle less than (<)
	if (value.startsWith('<')) {
		return { lt: parseNumericValue(value.slice(1)) };
	}

	// Default: exact value match
	// Try to parse as number if possible, otherwise keep as string
	const numValue = parseFloat(value);
	return {
		value: !isNaN(numValue) && value === numValue.toString() ? numValue : value
	};
}

/**
 * Parse a string to a numeric value, handling special units
 */
function parseNumericValue(str: string): number {
	const trimmed = str.trim();
	
	// Handle size units (MB, GB, KB)
	const sizeMatch = trimmed.match(/^(\d+(?:\.\d+)?)(MB|GB|KB)?$/i);
	if (sizeMatch) {
		const num = parseFloat(sizeMatch[1]);
		const unit = sizeMatch[2]?.toUpperCase();
		
		if (unit === 'GB') return num * 1024 * 1024 * 1024;
		if (unit === 'MB') return num * 1024 * 1024;
		if (unit === 'KB') return num * 1024;
		return num;
	}
	
	return parseFloat(trimmed);
}

/**
 * Build a combined text query from text query and exact phrases
 */
export function buildTextQuery(textQuery: string, exactPhrases: string[]): string {
	const parts: string[] = [];
	
	if (textQuery.trim()) {
		parts.push(textQuery.trim());
	}
	
	// Add exact phrases back (MeiliSearch handles quotes)
	exactPhrases.forEach(phrase => {
		parts.push(`"${phrase}"`);
	});
	
	return parts.join(' ');
}

/**
 * Helper to check if a query contains advanced syntax
 */
export function hasAdvancedSyntax(query: string): boolean {
	return /(\w+:|"[^"]+"|-)/.test(query);
}

/**
 * Get a human-readable description of parsed filters
 */
export function describeFilters(parsed: SearchQuery): string[] {
	const descriptions: string[] = [];
	
	Object.entries(parsed.filters).forEach(([key, filter]) => {
		if (filter.value !== undefined) {
			descriptions.push(`${key}: ${filter.value}`);
		} else if (filter.min !== undefined && filter.max !== undefined) {
			descriptions.push(`${key}: ${filter.min}..${filter.max}`);
		} else if (filter.gt !== undefined) {
			descriptions.push(`${key}: >${filter.gt}`);
		} else if (filter.gte !== undefined) {
			descriptions.push(`${key}: >=${filter.gte}`);
		} else if (filter.lt !== undefined) {
			descriptions.push(`${key}: <${filter.lt}`);
		} else if (filter.lte !== undefined) {
			descriptions.push(`${key}: <=${filter.lte}`);
		}
	});
	
	if (parsed.exactPhrases.length > 0) {
		descriptions.push(`phrases: "${parsed.exactPhrases.join('", "')}"`);
	}
	
	if (parsed.excludeTerms.length > 0) {
		descriptions.push(`excluding: ${parsed.excludeTerms.join(', ')}`);
	}
	
	return descriptions;
}

