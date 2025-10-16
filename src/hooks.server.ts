import { getUser } from '$lib/server/auth';
import { initializeIndexes } from '$lib/server/search/client';
import type { Handle } from '@sveltejs/kit';

// Initialize Meilisearch on startup
let initialized = false;
if (!initialized) {
	initializeIndexes().catch(console.error);
	initialized = true;
}

export const handle: Handle = async ({ event, resolve }) => {
	// Get user from auth token
	event.locals.user = await getUser(event);

	return resolve(event);
};

