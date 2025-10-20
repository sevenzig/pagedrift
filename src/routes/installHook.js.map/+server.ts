import type { RequestHandler } from './$types';

/**
 * Dummy endpoint to silence browser extension 404 errors
 * Some browser extensions (React DevTools, Redux DevTools, etc.) 
 * try to inject this file for debugging purposes
 */
export const GET: RequestHandler = async () => {
	return new Response('', {
		status: 204,
		headers: {
			'Content-Type': 'text/plain'
		}
	});
};

