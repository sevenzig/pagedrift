/**
 * In-memory cache for preview data during upload staging
 * Stores firstPagesText and metadata temporarily for metadata search
 */

interface CachedPreview {
	firstPagesText?: string;
	metadata?: any;
	timestamp: number;
}

class PreviewCache {
	private cache = new Map<string, CachedPreview>();
	private TTL = 15 * 60 * 1000; // 15 minutes

	/**
	 * Store preview data for a user's file
	 */
	set(userId: string, fileId: string, data: Omit<CachedPreview, 'timestamp'>) {
		const key = `${userId}:${fileId}`;
		this.cache.set(key, { ...data, timestamp: Date.now() });
		this.cleanup();
	}

	/**
	 * Retrieve cached preview data
	 * Returns null if not found or expired
	 */
	get(userId: string, fileId: string): CachedPreview | null {
		const key = `${userId}:${fileId}`;
		const cached = this.cache.get(key);
		
		if (!cached) return null;
		
		// Check if expired
		if (Date.now() - cached.timestamp > this.TTL) {
			this.cache.delete(key);
			return null;
		}
		
		return cached;
	}

	/**
	 * Remove expired entries from cache
	 */
	private cleanup() {
		const now = Date.now();
		for (const [key, value] of this.cache.entries()) {
			if (now - value.timestamp > this.TTL) {
				this.cache.delete(key);
			}
		}
	}

	/**
	 * Clear all cached data (useful for testing)
	 */
	clear() {
		this.cache.clear();
	}

	/**
	 * Get cache statistics
	 */
	getStats() {
		return {
			size: this.cache.size,
			entries: Array.from(this.cache.keys())
		};
	}
}

export const previewCache = new PreviewCache();

