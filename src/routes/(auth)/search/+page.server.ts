import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, fetch }) => {
    const q = url.searchParams.get('q') ?? '';
    const scope = url.searchParams.get('scope') ?? 'both';

    if (!q) {
        return { q, scope, results: { metadata: [], fulltext: [] } };
    }

    const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&scope=${scope}`);
    if (!res.ok) {
        return { q, scope, results: { metadata: [], fulltext: [] }, error: 'Search failed' };
    }
    const data = await res.json();
    return { q, scope, results: data };
};


