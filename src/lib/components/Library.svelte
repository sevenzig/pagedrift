<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import Button from './ui/Button.svelte';
	import Card from './ui/Card.svelte';
	import UploadZone from './UploadZone.svelte';
	import SearchBar from './SearchBar.svelte';
	import type { AuthUser } from '$lib/server/auth';

	interface Props {
		books: any[];
		user: AuthUser;
	}

	let { books, user }: Props = $props();
	let showUpload = $state(true);
	let deleting = $state<string | null>(null);

	async function deleteBook(id: string) {
		if (!confirm('Are you sure you want to delete this book?')) {
			return;
		}

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

	async function handleLogout() {
		try {
			await fetch('/api/auth/logout', { method: 'POST' });
			goto('/login');
		} catch (error) {
			console.error('Logout failed:', error);
		}
	}

	function formatDate(date: Date | string): string {
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
					<h1 class="text-3xl font-bold">EBook Voyage</h1>
					<p class="text-sm text-muted-foreground mt-1">
						Shared book library
					</p>
				</div>
				<div class="flex items-center gap-4">
					<span class="text-sm text-muted-foreground">
						{user.email}
						{#if user.role === 'admin'}
							<span class="ml-2 px-2 py-1 bg-primary text-primary-foreground text-xs rounded">
								Admin
							</span>
						{/if}
					</span>
					{#if user.role === 'admin'}
						<Button variant="outline" onclick={() => goto('/admin')}>
							Manage Users
						</Button>
					{/if}
					{#if user.canUpload}
						<Button onclick={() => (showUpload = !showUpload)}>
							{showUpload ? 'Hide Upload' : 'Upload Book'}
						</Button>
					{/if}
					<Button variant="outline" onclick={handleLogout}>
						Logout
					</Button>
				</div>
			</div>
		</div>
	</header>

	<main class="max-w-7xl mx-auto px-6 py-8">
		{#if showUpload && user.canUpload}
			<div class="mb-8">
				<UploadZone />
			</div>
		{/if}

		<!-- Search Bar -->
		<div class="mb-8">
			<SearchBar />
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
					Library ({books.length} {books.length === 1 ? 'book' : 'books'})
				</h2>
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
					{#each books as book}
						<Card class="overflow-hidden hover:shadow-lg transition-shadow">
							{#if book.coverImage}
								<div class="aspect-[2/3] overflow-hidden bg-muted">
									<img 
										src={book.coverImage} 
										alt="{book.title} cover" 
										class="w-full h-full object-cover"
									/>
								</div>
							{:else}
								<div class="aspect-[2/3] bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
									<div class="text-center p-6">
										<div class="text-6xl mb-2">📖</div>
										<div class="text-xs font-medium text-muted-foreground uppercase">
											{book.format}
										</div>
									</div>
								</div>
							{/if}
							
							<div class="p-4">
								<div class="mb-3">
									<h3 class="font-semibold text-base mb-1 line-clamp-2">
										{book.title}
									</h3>
									{#if book.author}
										<p class="text-sm text-muted-foreground line-clamp-1">{book.author}</p>
									{/if}
								</div>

								<div class="text-xs text-muted-foreground mb-3 space-y-1">
									<div class="flex items-center justify-between">
										<span>Uploaded:</span>
										<span>{formatDate(book.uploadDate)}</span>
									</div>
									{#if book.uploadedBy}
										<div class="flex items-center justify-between">
											<span>By:</span>
											<span class="truncate ml-2">{book.uploadedBy.email}</span>
										</div>
									{/if}
								</div>

								<div class="flex gap-2">
									<a href="/reader/{book.id}" class="flex-1">
										<Button class="w-full" size="sm">Read</Button>
									</a>
									{#if user.canDelete}
										<Button
											variant="destructive"
											size="sm"
											onclick={() => deleteBook(book.id)}
											disabled={deleting === book.id}
										>
											{deleting === book.id ? '...' : '🗑️'}
										</Button>
									{/if}
								</div>
							</div>
						</Card>
					{/each}
				</div>
			</div>
		{/if}
	</main>
</div>
