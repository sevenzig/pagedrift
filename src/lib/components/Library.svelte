<script lang="ts">
    import { goto } from '$app/navigation';
    import { invalidateAll } from '$app/navigation';
    import Button from './ui/Button.svelte';
    import Card from './ui/Card.svelte';
    import BookEditModal from './BookEditModal.svelte';
    import ResumeBookModal from './ResumeBookModal.svelte';
    import type { AuthUser } from '$lib/server/auth';
    import { CONTENT_TYPES } from '$lib/constants/content-types';

    interface Props {
        books: any[];
        user: AuthUser;
    }

    let { books, user }: Props = $props();
    let deleting = $state<string | null>(null);
    let editingBook = $state<any | null>(null);
    let resumingBook = $state<any | null>(null);
    let query = $state('');
    let selectedContentType = $state<string>('');
    let selectedTags = $state<string[]>([]);

    // Get all unique tags from books
    const allTags = $derived(() => {
        const tagSet = new Set<string>();
        books.forEach(book => {
            book.tags?.forEach((bt: any) => {
                tagSet.add(bt.tag.name);
            });
        });
        return Array.from(tagSet).sort();
    });

    function matches(book: any, q: string) {
        const term = q.trim().toLowerCase();
        if (!term) return true;
        const title = (book.title || '').toLowerCase();
        const author = (book.author || '').toLowerCase();
        
        // Also search in tags
        const bookTags = book.tags?.map((bt: any) => bt.tag.name.toLowerCase()) || [];
        const tagsMatch = bookTags.some((tag: string) => tag.includes(term));
        
        return title.includes(term) || author.includes(term) || tagsMatch;
    }

    function matchesContentType(book: any) {
        if (!selectedContentType) return true;
        return book.contentType === selectedContentType;
    }

    function matchesTags(book: any) {
        if (selectedTags.length === 0) return true;
        const bookTags = book.tags?.map((bt: any) => bt.tag.name) || [];
        return selectedTags.every(tag => bookTags.includes(tag));
    }

    const filteredBooks = $derived(
        books.filter((b) => matches(b, query) && matchesContentType(b) && matchesTags(b))
    );

    function toggleTag(tag: string) {
        if (selectedTags.includes(tag)) {
            selectedTags = selectedTags.filter(t => t !== tag);
        } else {
            selectedTags = [...selectedTags, tag];
        }
    }

    function clearFilters() {
        query = '';
        selectedContentType = '';
        selectedTags = [];
    }

	async function deleteBook(id: string) {
		deleting = id;

		try {
			const response = await fetch(`/api/books/${id}`, {
				method: 'DELETE'
			});

			if (response.ok) {
				// Refresh the page data
				await invalidateAll();
			} else {
				const data = await response.json();
				alert(data.error || 'Failed to delete book');
			}
		} catch (error) {
			alert('Network error. Please try again.');
		} finally {
			deleting = null;
		}
	}

	function openEditModal(book: any) {
		editingBook = book;
	}

	function closeEditModal() {
		editingBook = null;
	}

	function openBook(book: any) {
		// Check if book has progress > 0
		console.log('Opening book:', book.title, 'Progress:', book.progress);
		if (book.progress > 0) {
			resumingBook = book;
		} else {
			goto(`/reader/${book.id}`);
		}
	}

	function closeResumeModal() {
		resumingBook = null;
	}
    </script>

<div class="min-h-screen bg-background">
    <main class="max-w-7xl mx-auto px-6 py-8">
		<!-- Library Filters -->
		<div class="mb-6 space-y-4">
			<!-- Search -->
			<input
				type="text"
				bind:value={query}
				placeholder="Search by title, author, or tags..."
				class="w-full px-4 py-2 border border-border rounded-lg bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
			/>

			<!-- Filter row -->
			<div class="flex flex-wrap gap-4 items-center">
				<!-- Content Type Filter -->
				<div class="flex items-center gap-2">
					<label for="contentTypeFilter" class="text-sm font-medium">Content Type:</label>
					<select
						id="contentTypeFilter"
						bind:value={selectedContentType}
						class="px-3 py-1.5 border border-border rounded-md text-sm bg-input text-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring"
					>
						<option value="">All Types</option>
						{#each CONTENT_TYPES as type}
							<option value={type}>{type}</option>
						{/each}
					</select>
				</div>

				<!-- Tag Filter -->
				{#if allTags().length > 0}
					<div class="flex items-center gap-2 flex-wrap">
						<span class="text-sm font-medium">Tags:</span>
						<div class="flex gap-2 flex-wrap">
							{#each allTags() as tag}
								<button
									type="button"
									class="tag-filter {selectedTags.includes(tag) ? 'tag-active' : 'tag-inactive'}"
									onclick={() => toggleTag(tag)}
								>
									{tag}
								</button>
							{/each}
						</div>
					</div>
				{/if}

				<!-- Clear Filters -->
				{#if query || selectedContentType || selectedTags.length > 0}
					<button
						type="button"
						onclick={clearFilters}
						class="ml-auto px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
					>
						Clear Filters
					</button>
				{/if}
			</div>
		</div>

		{#if books.length === 0}
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
					Library ({filteredBooks.length} of {books.length} {books.length === 1 ? 'book' : 'books'})
				</h2>
				{#if filteredBooks.length === 0}
					<p class="text-center text-muted-foreground py-12">No books match your filter</p>
				{:else}
				<div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
					{#each filteredBooks as book}
						<Card class="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onclick={() => openBook(book)}>
							<div class="relative group aspect-[1/1.6] overflow-hidden bg-muted">
								{#if book.coverImage}
									<img 
										src={book.coverImage} 
										alt="{book.title} cover" 
										class="w-full h-full object-cover"
									/>
								{:else}
									<div class="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
										<div class="text-center p-6">
											<div class="text-6xl mb-2">📖</div>
											<div class="text-xs font-medium text-muted-foreground uppercase">
												{book.format}
											</div>
										</div>
									</div>
								{/if}

								<!-- Progress Badge -->
								{#if book.progress > 0}
									<div class="absolute top-2 right-2 z-20">
										<span class="text-xs font-semibold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)] bg-black/60 backdrop-blur-sm px-2.5 py-1 rounded-full">
											{Math.round(book.progress)}%
										</span>
									</div>
								{/if}

								<!-- Hover overlay content -->
								<div class="absolute inset-x-0 bottom-0 p-3 bg-black/60 backdrop-blur-sm text-white translate-y-full opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
									<h3 class="font-semibold text-sm mb-1 line-clamp-2">{book.title}</h3>
									{#if book.author}
										<p class="text-xs text-white/80 mb-1 line-clamp-1">{book.author}</p>
									{/if}
									{#if book.contentType && book.contentType !== 'Book'}
										<p class="text-xs text-white/70 mb-1 italic">{book.contentType}</p>
									{/if}
									{#if book.publicationYear}
										<p class="text-xs text-white/60 mb-1">{book.publicationYear}</p>
									{/if}
									{#if book.publisher}
										<p class="text-xs text-white/60 mb-1 line-clamp-1">{book.publisher}</p>
									{/if}
									{#if book.tags && book.tags.length > 0}
										<div class="flex gap-1 mb-2 flex-wrap">
											{#each book.tags.slice(0, 3) as bookTag}
												<span class="text-xs px-1.5 py-0.5 bg-white/20 rounded">
													{bookTag.tag.name}
												</span>
											{/each}
											{#if book.tags.length > 3}
												<span class="text-xs text-white/60">+{book.tags.length - 3}</span>
											{/if}
										</div>
									{/if}
									<div class="flex gap-2">
										<a href="/reader/{book.id}" class="flex-1" onclick={(e) => e.stopPropagation()}>
											<Button variant="default" class="w-full" size="sm">Read</Button>
										</a>
										{#if user.role === 'admin' || user.canDelete}
											<Button
												variant="outline"
												size="sm"
												onclick={(e) => {
													e.stopPropagation();
													openEditModal(book);
												}}
											>
												✏️
											</Button>
										{/if}
									</div>
								</div>
							</div>
						</Card>
					{/each}
				</div>
				{/if}
			</div>
		{/if}
	</main>

	<!-- Edit Modal -->
	{#if editingBook}
		<BookEditModal 
			book={editingBook} 
			user={user}
			onClose={closeEditModal}
			onDelete={deleteBook}
		/>
	{/if}

	<!-- Resume Modal -->
	{#if resumingBook}
		<ResumeBookModal 
			book={resumingBook} 
			onClose={closeResumeModal}
		/>
	{/if}
</div>

<style>
	.tag-filter {
		padding: 0.25rem 0.75rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		font-weight: 500;
		transition: all 0.2s;
		border: 1px solid;
	}

	.tag-inactive {
		background: hsl(var(--background));
		border-color: hsl(var(--border));
		color: hsl(var(--muted-foreground));
	}

	.tag-inactive:hover {
		border-color: hsl(var(--primary));
		color: hsl(var(--primary));
	}

	.tag-active {
		background: hsl(var(--primary));
		border-color: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
	}
</style>
