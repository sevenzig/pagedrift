import { json, redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

/**
 * GET /
 * Root route handler for health checks and basic availability
 * - Responds with 200 OK for health checks (no authentication required)
 * - Redirects to library page for browser requests
 */
export const GET: RequestHandler = async ({ request, url }) => {
	const userAgent = request.headers.get('user-agent') || '';
	
	// Check if this is a health check request (wget, curl, or similar tools)
	const isHealthCheck = userAgent.includes('wget') || 
		userAgent.includes('curl') || 
		userAgent.includes('healthcheck') ||
		request.headers.get('x-health-check') === 'true';

	if (isHealthCheck) {
		// Return simple health response for Docker health checks
		return json({ 
			status: 'ok', 
			timestamp: new Date().toISOString() 
		});
	}

	// For browser requests, redirect to the library (authenticated route)
	// The (auth) layout will handle authentication and redirect to login if needed
	throw redirect(302, '/');
};
