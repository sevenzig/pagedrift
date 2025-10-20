import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * Dummy endpoint to silence browser extension 404 errors
 * Some browser extensions (React DevTools, Redux DevTools, etc.) 
 * try to inject this file for debugging purposes
 * 
 * Returns an empty source map to satisfy the browser's expectations
 */
export const GET: RequestHandler = async () => {
	// Return a minimal valid source map
	const emptySourceMap = {
		version: 3,
		sources: [],
		names: [],
		mappings: ''
	};
	
	return json(emptySourceMap, {
		headers: {
			'Content-Type': 'application/json'
		}
	});
};

