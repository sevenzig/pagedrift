<script lang="ts">
	import { booksStore } from '$lib/stores/books.svelte';
	import Button from './ui/Button.svelte';
	import Card from './ui/Card.svelte';
	import UploadZone from './UploadZone.svelte';

	let showUpload = $state(true);

	async function deleteBook(id: string) {
		if (confirm('Are you sure you want to delete this book?')) {
			await booksStore.deleteBook(id);
		}
	}

	function formatDate(date: Date): string {
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<div class="min-h-screen bg-background">
	<header class="border-b bg-card">
		<div class="max-w-7xl mx-auto px-6 py-6">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-3xl font-bold">Markdown eBook Reader</h1>
					<p class="text-sm text-muted-foreground mt-1">
						Your personal reading library
					</p>
				</div>
				<Button onclick={() => (showUpload = !showUpload)}>
					{showUpload ? 'Hide Upload' : 'Upload Book'}
				</Button>
			</div>
		</div>
	</header>

	<main class="max-w-7xl mx-auto px-6 py-8">
		{#if showUpload}
			<div class="mb-8">
				<UploadZone />
			</div>
		{/if}

		{#if booksStore.loading}
			<div class="text-center py-12">
				<p class="text-muted-foreground">Loading library...</p>
			</div>
		{:else if booksStore.books.length === 0}
			<div class="text-center py-12">
				<div class="text-6xl mb-4">📚</div>
				<h2 class="text-2xl font-semibold mb-2">Your library is empty</h2>
				<p class="text-muted-foreground mb-6">
					Upload your first eBook to get started
				</p>
			</div>
		{:else}
			<div>
				<h2 class="text-2xl font-semibold mb-6">
					My Books ({booksStore.books.length})
				</h2>
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
					{#each booksStore.books as book}
						<Card class="overflow-hidden hover:shadow-lg transition-shadow">
							<div class="p-6">
								<div class="flex items-start justify-between mb-4">
									<div class="flex-1">
										<h3 class="font-semibold text-lg mb-1 line-clamp-2">
											{book.title}
										</h3>
										{#if book.author}
											<p class="text-sm text-muted-foreground">{book.author}</p>
										{/if}
									</div>
									<span
										class="text-xs font-medium px-2 py-1 rounded bg-secondary text-secondary-foreground"
									>
										{book.format.toUpperCase()}
									</span>
								</div>

								<div class="text-xs text-muted-foreground mb-4">
									<div>Uploaded: {formatDate(book.uploadDate)}</div>
									<div>{book.chapters.length} chapters</div>
								</div>

								<div class="flex gap-2">
									<a href="/reader/{book.id}" class="flex-1">
										<Button class="w-full">Read</Button>
									</a>
									<Button
										variant="destructive"
										size="sm"
										onclick={() => deleteBook(book.id)}
									>
										Delete
									</Button>
								</div>
							</div>
						</Card>
					{/each}
				</div>
			</div>
		{/if}
	</main>
</div>
