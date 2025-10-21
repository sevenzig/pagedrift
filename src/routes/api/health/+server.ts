import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { db } from '$lib/server/db';
import { searchClient } from '$lib/server/search/client';

/**
 * GET /api/health
 * Comprehensive health check endpoint that verifies:
 * - Server is running (200 response)
 * - Database connectivity (Prisma connection test)
 * - Meilisearch connectivity (search service availability)
 */
export const GET: RequestHandler = async () => {
	const checks: Record<string, string> = {};
	let overallStatus = 'healthy';

	try {
		// Test database connectivity
		await db.$queryRaw`SELECT 1`;
		checks.database = 'ok';
	} catch (error) {
		checks.database = 'error';
		overallStatus = 'unhealthy';
		console.error('Database health check failed:', error);
	}

	try {
		// Test Meilisearch connectivity
		await searchClient.getStats();
		checks.meilisearch = 'ok';
	} catch (error) {
		checks.meilisearch = 'error';
		overallStatus = 'unhealthy';
		console.error('Meilisearch health check failed:', error);
	}

	// Add server status
	checks.server = 'ok';

	const statusCode = overallStatus === 'healthy' ? 200 : 503;
	const response = {
		status: overallStatus,
		timestamp: new Date().toISOString(),
		checks
	};

	return json(response, { status: statusCode });
};
