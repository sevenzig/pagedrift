<script lang="ts">
	import { goto } from '$app/navigation';
	import Button from './ui/Button.svelte';
	import Card from './ui/Card.svelte';

	let query = $state('');
	let searchType = $state<'metadata' | 'fulltext'>('metadata');
	let results = $state<any[]>([]);
	let searching = $state(false);
	let error = $state('');

	async function handleSearch() {
		if (!query.trim()) {
			results = [];
			return;
		}

		searching = true;
		error = '';

		try {
			const response = await fetch(
				`/api/search?q=${encodeURIComponent(query)}&type=${searchType}&limit=20`
			);

			if (!response.ok) {
				throw new Error('Search failed');
			}

			const data = await response.json();
			results = data.results || [];
		} catch (err) {
			error = 'Search failed. Please try again.';
			results = [];
		} finally {
			searching = false;
		}
	}

	// Debounced search
	let searchTimeout: ReturnType<typeof setTimeout>;
	$effect(() => {
		clearTimeout(searchTimeout);
		if (query.trim()) {
			searchTimeout = setTimeout(handleSearch, 300);
		} else {
			results = [];
		}
	});

	function highlightText(text: string): string {
		if (!text) return '';
		// Simple highlight - Meilisearch adds <em> tags
		return text.replace(/<em>/g, '<mark class="bg-yellow-200">').replace(/<\/em>/g, '</mark>');
	}
</script>

<div class="space-y-4">
	<Card class="p-4">
		<div class="flex gap-4">
			<input
				type="text"
				bind:value={query}
				placeholder="Search books..."
				class="flex-1 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
			/>
			<div class="flex gap-2">
				<Button
					variant={searchType === 'metadata' ? 'default' : 'outline'}
					onclick={() => (searchType = 'metadata')}
					size="sm"
				>
					Title/Author
				</Button>
				<Button
					variant={searchType === 'fulltext' ? 'default' : 'outline'}
					onclick={() => (searchType = 'fulltext')}
					size="sm"
				>
					Full Text
				</Button>
			</div>
		</div>

		{#if error}
			<p class="text-red-600 text-sm mt-2">{error}</p>
		{/if}
	</Card>

	{#if searching}
		<p class="text-center text-muted-foreground">Searching...</p>
	{:else if results.length > 0}
		<div class="space-y-2">
			{#each results as result}
				<Card class="p-4 hover:shadow-md transition-shadow cursor-pointer" onclick={() => {
					if (searchType === 'metadata') {
						goto(`/reader/${result.id}`);
					} else {
						goto(`/reader/${result.bookId}`);
					}
				}}>
					{#if searchType === 'metadata'}
						<h3 class="font-semibold mb-1">
							{@html highlightText(result._formatted?.title || result.title)}
						</h3>
						{#if result.author || result._formatted?.author}
							<p class="text-sm text-muted-foreground">
								by {@html highlightText(result._formatted?.author || result.author)}
							</p>
						{/if}
						<p class="text-xs text-muted-foreground mt-2">
							{result.format.toUpperCase()}
						</p>
					{:else}
						<h3 class="font-semibold mb-1">
							{@html highlightText(result._formatted?.title || result.title)}
						</h3>
						<p class="text-sm text-muted-foreground line-clamp-2">
							{@html highlightText(result._formatted?.content || result.content)}
						</p>
					{/if}
				</Card>
			{/each}
		</div>
	{:else if query.trim()}
		<p class="text-center text-muted-foreground">No results found</p>
	{/if}
</div>

