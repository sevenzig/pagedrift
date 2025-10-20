<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Button from './ui/Button.svelte';
	import Card from './ui/Card.svelte';
	import TagInput from './TagInput.svelte';
	import { CONTENT_TYPES } from '$lib/constants/content-types';

	interface MetadataResult {
		isbn?: string;
		isbn13?: string;
		publisher?: string;
		publicationYear?: number;
		description?: string;
		coverImageUrl?: string;
		title?: string;
		author?: string;
		source: 'google' | 'openlibrary' | 'book-content';
		confidence?: number;
	}

	interface Props {
		book: any;
		user: any;
		onClose: () => void;
		onDelete: (bookId: string) => Promise<void>;
	}

	let { book, user, onClose, onDelete }: Props = $props();

	let saving = $state(false);
	let deleting = $state(false);
	let error = $state<string | null>(null);

	// Metadata lookup state
	let metadataLoading = $state(false);
	let metadataResults = $state<MetadataResult[]>([]);
	let showResultsModal = $state(false);
	let metadataError = $state<string | null>(null);
	let showManualSearch = $state(false);
	let searchTitle = $state(book.title || '');
	let searchAuthor = $state(book.author || '');

	// Form data
	let formData = $state({
		title: book.title || '',
		author: book.author || '',
		contentType: book.contentType || 'Book',
		publicationYear: book.publicationYear ? book.publicationYear.toString() : '',
		isbn: book.isbn || '',
		description: book.description || '',
		publisher: book.publisher || '',
		tags: book.tags?.map((bt: any) => bt.tag.name) || []
	});

	// Handle escape key
	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		}
	}

	// Handle backdrop click
	function handleBackdropClick(e: MouseEvent | KeyboardEvent) {
		if (e.target === e.currentTarget) {
			onClose();
		}
	}

	// Auto-lookup metadata
	async function autoLookup() {
		metadataError = null;
		metadataLoading = true;

		try {
			const response = await fetch(`/api/books/${book.id}/metadata-lookup?strategy=auto`);
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Lookup failed');
			}

			if (data.multipleResults) {
				// Show results modal for user to choose
				metadataResults = data.results || [];
				showResultsModal = true;
			} else if (data.result) {
				// Auto-fill with single result
				applyMetadata(data.result);
			} else {
				metadataError = 'No results found. Try manual search or enter data manually.';
			}
		} catch (err) {
			console.error('Metadata lookup error:', err);
			metadataError = err instanceof Error ? err.message : 'Failed to lookup metadata';
		} finally {
			metadataLoading = false;
		}
	}

	// Manual search
	async function manualSearch() {
		metadataError = null;
		metadataLoading = true;

		try {
			const response = await fetch(`/api/books/${book.id}/metadata-lookup`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({
					title: searchTitle,
					author: searchAuthor
				})
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Search failed');
			}

			metadataResults = data.results || [];
			showResultsModal = true;
		} catch (err) {
			console.error('Manual search error:', err);
			metadataError = err instanceof Error ? err.message : 'Failed to search metadata';
		} finally {
			metadataLoading = false;
		}
	}

	// Apply selected metadata result
	function applyMetadata(result: MetadataResult) {
		if (result.isbn || result.isbn13) {
			formData.isbn = result.isbn || result.isbn13 || formData.isbn;
		}
		if (result.publisher) {
			formData.publisher = result.publisher;
		}
		if (result.publicationYear) {
			formData.publicationYear = result.publicationYear.toString();
		}
		if (result.description && !formData.description) {
			formData.description = result.description;
		}

		// Close modal
		showResultsModal = false;
		metadataResults = [];

		// Show brief success feedback
		metadataError = null;
	}

	async function handleSave() {
		// Validate content type
		if (!formData.contentType) {
			error = 'Please select a content type';
			return;
		}

		error = null;
		saving = true;

		try {
			console.log('Saving book with formData:', formData);
			const response = await fetch(`/api/books/${book.id}`, {
				method: 'PUT',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify(formData)
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Update failed');
			}

			console.log('Server response:', data);
			console.log('Updated book from server:', data.book);

			// Refresh the page data
			await invalidateAll();
			onClose();
		} catch (err) {
			console.error('Update error:', err);
			error = err instanceof Error ? err.message : 'Failed to update book';
		} finally {
			saving = false;
		}
	}

	async function handleDelete() {
		if (!confirm('Are you sure you want to delete this book? This action cannot be undone.')) {
			return;
		}

		deleting = true;
		try {
			await onDelete(book.id);
			onClose();
		} catch (err) {
			console.error('Delete error:', err);
			error = err instanceof Error ? err.message : 'Failed to delete book';
		} finally {
			deleting = false;
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<!-- Modal backdrop -->
<div 
	class="modal-backdrop" 
	onclick={handleBackdropClick}
	onkeydown={(e) => e.key === 'Enter' && handleBackdropClick(e)}
	role="dialog"
	aria-modal="true"
	aria-labelledby="modal-title"
	tabindex="0"
>
	<div class="modal-container">
		<div class="modal-header">
			<h2 id="modal-title" class="modal-title">Edit Book Metadata</h2>
			<button 
				type="button" 
				class="modal-close" 
				onclick={onClose}
				aria-label="Close modal"
			>
				×
			</button>
		</div>

		<div class="modal-content">
			<div class="staging-grid">
				<!-- Left: Preview -->
				<Card class="p-6">
					<div class="preview-content">
						<h3 class="text-lg font-semibold mb-4">Preview</h3>

						{#if book.coverImage}
							<div class="cover-preview">
								<img src={book.coverImage} alt="Cover" class="cover-image" />
							</div>
						{:else}
							<div class="cover-placeholder">
								<div class="text-6xl mb-2">📖</div>
								<div class="text-sm text-muted-foreground uppercase">
									{book.format || 'Book'}
								</div>
							</div>
						{/if}

						<div class="preview-info">
							<div class="preview-item">
								<span class="preview-label">File:</span>
								<span class="preview-value">{book.filePath?.split(/[\\/]/).pop() || 'Unknown'}</span>
							</div>
							{#if book.fileSize}
								<div class="preview-item">
									<span class="preview-label">Size:</span>
									<span class="preview-value">{(book.fileSize / 1024 / 1024).toFixed(2)} MB</span>
								</div>
							{/if}
							{#if book.chapters?.length}
								<div class="preview-item">
									<span class="preview-label">Chapters:</span>
									<span class="preview-value">{book.chapters.length}</span>
								</div>
							{/if}
						</div>
					</div>
				</Card>

				<!-- Right: Metadata form -->
				<Card class="p-6">
					<div class="metadata-content">
						<h3 class="text-lg font-semibold mb-4">Metadata</h3>

						<form class="metadata-form" onsubmit={(e) => e.preventDefault()}>
							<!-- Content Type (Required) -->
							<div class="form-group">
								<label for="contentType" class="form-label required">
									Content Type <span class="text-red-500">*</span>
								</label>
								<select
									id="contentType"
									bind:value={formData.contentType}
									class="form-select"
									required
									disabled={saving}
								>
									{#each CONTENT_TYPES as type}
										<option value={type}>{type}</option>
									{/each}
								</select>
							</div>

							<!-- Title -->
							<div class="form-group">
								<label for="title" class="form-label">Title</label>
								<input
									id="title"
									type="text"
									bind:value={formData.title}
									class="form-input"
									placeholder="Book title"
									disabled={saving}
								/>
							</div>

							<!-- Author -->
							<div class="form-group">
								<label for="author" class="form-label">Author(s)</label>
								<input
									id="author"
									type="text"
									bind:value={formData.author}
									class="form-input"
									placeholder="Author name"
									disabled={saving}
								/>
							</div>

							<!-- Publication Year -->
							<div class="form-group">
								<label for="publicationYear" class="form-label">Publication Year</label>
								<input
									id="publicationYear"
									type="text"
									bind:value={formData.publicationYear}
									class="form-input"
									placeholder="YYYY"
									pattern="[0-9]{4}"
									disabled={saving}
								/>
							</div>

							<!-- Metadata Auto-lookup -->
							<div class="metadata-lookup-section">
								<button
									type="button"
									class="lookup-button"
									onclick={autoLookup}
									disabled={saving || metadataLoading}
								>
									{#if metadataLoading}
										<span class="spinner">🔍</span> Searching...
									{:else}
										🔍 Auto-lookup Metadata
									{/if}
								</button>
								<button
									type="button"
									class="manual-search-toggle"
									onclick={() => showManualSearch = !showManualSearch}
									disabled={saving}
								>
									{showManualSearch ? '− Hide' : '+ Manual'} Search
								</button>
							</div>

							{#if showManualSearch}
								<div class="manual-search">
									<h4 class="manual-search-title">Search by Title/Author</h4>
									<div class="search-inputs">
										<input
											type="text"
											bind:value={searchTitle}
											placeholder="Title"
											class="form-input"
											disabled={metadataLoading}
										/>
										<input
											type="text"
											bind:value={searchAuthor}
											placeholder="Author (optional)"
											class="form-input"
											disabled={metadataLoading}
										/>
										<Button onclick={manualSearch} disabled={metadataLoading || !searchTitle}>
											Search
										</Button>
									</div>
								</div>
							{/if}

							{#if metadataError}
								<div class="metadata-error">
									{metadataError}
								</div>
							{/if}

							<!-- ISBN -->
							<div class="form-group">
								<label for="isbn" class="form-label">ISBN</label>
								<input
									id="isbn"
									type="text"
									bind:value={formData.isbn}
									class="form-input"
									placeholder="ISBN-10 or ISBN-13"
									disabled={saving}
								/>
							</div>

							<!-- Publisher -->
							<div class="form-group">
								<label for="publisher" class="form-label">Publisher</label>
								<input
									id="publisher"
									type="text"
									bind:value={formData.publisher}
									class="form-input"
									placeholder="Publisher name"
									disabled={saving}
								/>
							</div>

							<!-- Tags -->
							<div class="form-group">
								<label for="tags" class="form-label">Tags</label>
								<div id="tags">
									<TagInput bind:tags={formData.tags} disabled={saving} />
								</div>
								<p class="form-hint">Press Enter to add tags. Used for filtering and search.</p>
							</div>

							<!-- Description -->
							<div class="form-group">
								<label for="description" class="form-label">Description / Notes</label>
								<textarea
									id="description"
									bind:value={formData.description}
									class="form-textarea"
									placeholder="Brief description or notes about this content"
									rows="3"
									disabled={saving}
								></textarea>
							</div>

							{#if error}
								<div class="error-message">
									{error}
								</div>
							{/if}

							<!-- Action buttons -->
							<div class="action-buttons">
								<Button variant="outline" onclick={onClose} disabled={saving || deleting}>
									Cancel
								</Button>
								{#if user.role === 'admin' || user.canDelete}
									<Button 
										variant="destructive" 
										onclick={handleDelete} 
										disabled={saving || deleting}
									>
										{deleting ? 'Deleting...' : 'Delete Book'}
									</Button>
								{/if}
								<Button onclick={handleSave} disabled={saving || deleting}>
									{saving ? 'Saving...' : 'Save Changes'}
								</Button>
							</div>
						</form>
					</div>
				</Card>
			</div>
		</div>
	</div>
</div>

<!-- Metadata Results Selection Modal -->
{#if showResultsModal && metadataResults.length > 0}
	<div 
		class="results-modal-backdrop" 
		role="dialog"
		aria-modal="true"
		tabindex="0"
		onclick={(e) => {
			if (e.target === e.currentTarget) {
				showResultsModal = false;
			}
		}}
		onkeydown={(e) => {
			if (e.key === 'Enter' && e.target === e.currentTarget) {
				showResultsModal = false;
			}
		}}
	>
		<div class="results-modal">
			<div class="results-header">
				<h3>Select Metadata</h3>
				<button 
					class="modal-close" 
					onclick={() => showResultsModal = false}
				>
					×
				</button>
			</div>
			<div class="results-list">
				{#each metadataResults as result}
					<div 
						class="result-item" 
						role="button"
						tabindex="0"
						onclick={() => applyMetadata(result)}
						onkeydown={(e) => e.key === 'Enter' && applyMetadata(result)}
					>
						<div class="result-content">
							{#if result.coverImageUrl}
								<img src={result.coverImageUrl} alt="Cover" class="result-cover" />
							{:else}
								<div class="result-cover-placeholder">📖</div>
							{/if}
							<div class="result-info">
								<div class="result-title">{result.title || 'Unknown Title'}</div>
								{#if result.author}
									<div class="result-author">by {result.author}</div>
								{/if}
								<div class="result-meta">
									{#if result.publisher}
										<span>{result.publisher}</span>
									{/if}
									{#if result.publicationYear}
										<span>• {result.publicationYear}</span>
									{/if}
									{#if result.isbn || result.isbn13}
										<span>• ISBN: {result.isbn || result.isbn13}</span>
									{/if}
								</div>
								<div class="result-source">
									Source: 
									{#if result.source === 'google'}
										<span class="badge badge-google">Google Books</span>
									{:else if result.source === 'openlibrary'}
										<span class="badge badge-openlibrary">Open Library</span>
									{:else}
										<span class="badge badge-content">Book Content</span>
									{/if}
								</div>
							</div>
						</div>
						<div class="result-action">
							<button class="select-btn">Select</button>
						</div>
					</div>
				{/each}
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.9);
		backdrop-filter: blur(8px);
		-webkit-backdrop-filter: blur(8px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1000;
		padding: 1rem;
	}

	.modal-container {
		background: hsl(var(--background));
		border-radius: 0.5rem;
		box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.25);
		max-width: 1200px;
		width: 100%;
		max-height: 90vh;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border-bottom: 1px solid hsl(var(--border));
	}

	.modal-title {
		font-size: 1.25rem;
		font-weight: 600;
		color: hsl(var(--foreground));
		margin: 0;
	}

	.modal-close {
		background: none;
		border: none;
		font-size: 1.5rem;
		cursor: pointer;
		color: hsl(var(--muted-foreground));
		padding: 0.25rem;
		border-radius: 0.25rem;
		transition: color 0.2s;
	}

	.modal-close:hover {
		color: hsl(var(--foreground));
	}

	.modal-content {
		flex: 1;
		overflow-y: auto;
		padding: 1.5rem;
	}

	.staging-grid {
		display: grid;
		grid-template-columns: 1fr 2fr;
		gap: 1.5rem;
	}

	@media (max-width: 768px) {
		.staging-grid {
			grid-template-columns: 1fr;
		}
	}

	.preview-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.cover-preview {
		width: 100%;
		aspect-ratio: 2/3;
		overflow: hidden;
		border-radius: 0.5rem;
		background: hsl(var(--muted));
	}

	.cover-image {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}

	.cover-placeholder {
		width: 100%;
		aspect-ratio: 2/3;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		background: linear-gradient(to bottom right, hsl(var(--primary) / 0.1), hsl(var(--primary) / 0.05));
		border-radius: 0.5rem;
	}

	.preview-info {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.preview-item {
		display: flex;
		justify-content: space-between;
		padding: 0.5rem 0;
		border-bottom: 1px solid hsl(var(--border));
	}

	.preview-label {
		font-weight: 500;
		color: hsl(var(--muted-foreground));
	}

	.preview-value {
		color: hsl(var(--foreground));
		text-align: right;
		word-break: break-word;
	}

	.metadata-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.metadata-form {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.form-label {
		font-size: 0.875rem;
		font-weight: 500;
		color: hsl(var(--foreground));
	}

	.form-label.required::after {
		content: ' *';
		color: hsl(var(--destructive));
	}

	.form-input,
	.form-select,
	.form-textarea {
		width: 100%;
		padding: 0.75rem 1rem;
		border: 2px solid hsl(var(--border));
		border-radius: 0.5rem;
		background: hsl(var(--background));
		color: hsl(var(--foreground));
		font-size: 0.875rem;
		transition: all 0.2s ease;
		box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
	}

	.form-input:hover,
	.form-select:hover,
	.form-textarea:hover {
		border-color: hsl(var(--primary) / 0.5);
		box-shadow: 0 2px 6px 0 rgb(0 0 0 / 0.15);
	}

	.form-input:focus,
	.form-select:focus,
	.form-textarea:focus {
		outline: none;
		border-color: hsl(var(--primary));
		box-shadow: 0 0 0 4px hsl(var(--primary) / 0.1), 0 4px 12px 0 rgb(0 0 0 / 0.15);
		transform: translateY(-1px);
	}

	.form-input:disabled,
	.form-select:disabled,
	.form-textarea:disabled {
		opacity: 0.6;
		cursor: not-allowed;
		background: hsl(var(--muted));
		border-color: hsl(var(--muted));
	}

	.form-select {
		/* Remove all native select styling first */
		appearance: none;
		-moz-appearance: none;
		-webkit-appearance: none;
		-ms-appearance: none;
		/* Custom arrow styling */
		background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e") !important;
		background-position: right 0.75rem center !important;
		background-repeat: no-repeat !important;
		background-size: 1.5em 1.5em !important;
		padding-right: 2.5rem;
		cursor: pointer;
	}
	
	/* Remove IE10+ native arrow */
	.form-select::-ms-expand {
		display: none;
	}

	.form-select option {
		background: hsl(var(--card));
		color: hsl(var(--card-foreground));
		padding: 0.5rem;
	}

	.form-select:focus {
		background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e");
	}

	/* Dark mode specific styling */
	@media (prefers-color-scheme: dark) {
		.form-input,
		.form-select,
		.form-textarea {
			background: hsl(var(--card));
			border-color: hsl(var(--border));
			color: hsl(var(--card-foreground));
		}

		.form-input:hover,
		.form-select:hover,
		.form-textarea:hover {
			border-color: hsl(var(--primary) / 0.7);
			background: hsl(var(--card) / 0.8);
		}

		.form-input:focus,
		.form-select:focus,
		.form-textarea:focus {
			background: hsl(var(--card));
			border-color: hsl(var(--primary));
		}

		.form-select {
			background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23d1d5db' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e") !important;
			background-repeat: no-repeat !important;
			background-position: right 0.75rem center !important;
			background-size: 1.5em 1.5em !important;
		}

		.form-select option {
			background: hsl(var(--card));
			color: hsl(var(--card-foreground));
		}

		.form-select:focus {
			background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%23d1d5db' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3e%3c/svg%3e") !important;
		}
	}

	.form-hint {
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
	}

	.error-message {
		padding: 0.75rem;
		background: hsl(var(--destructive) / 0.1);
		color: hsl(var(--destructive));
		border-radius: 0.375rem;
		font-size: 0.875rem;
	}

	.action-buttons {
		display: flex;
		gap: 1rem;
		margin-top: 1rem;
		justify-content: flex-end;
	}

	/* Metadata Lookup Styles */
	.metadata-lookup-section {
		display: flex;
		gap: 0.75rem;
		margin-bottom: 1rem;
	}

	.lookup-button,
	.manual-search-toggle {
		flex: 1;
		padding: 0.75rem 1rem;
		border: 2px solid hsl(var(--border));
		border-radius: 0.5rem;
		background: hsl(var(--background));
		color: hsl(var(--foreground));
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
	}

	.lookup-button {
		background: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
		border-color: hsl(var(--primary));
	}

	.lookup-button:hover:not(:disabled) {
		background: hsl(var(--primary) / 0.9);
		transform: translateY(-1px);
		box-shadow: 0 4px 12px hsl(var(--primary) / 0.3);
	}

	.manual-search-toggle:hover:not(:disabled) {
		border-color: hsl(var(--primary));
		background: hsl(var(--primary) / 0.05);
	}

	.lookup-button:disabled,
	.manual-search-toggle:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.spinner {
		display: inline-block;
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		from { transform: rotate(0deg); }
		to { transform: rotate(360deg); }
	}

	.manual-search {
		background: hsl(var(--muted) / 0.3);
		border: 1px solid hsl(var(--border));
		border-radius: 0.5rem;
		padding: 1rem;
		margin-bottom: 1rem;
	}

	.manual-search-title {
		font-size: 0.875rem;
		font-weight: 600;
		margin-bottom: 0.75rem;
		color: hsl(var(--foreground));
	}

	.search-inputs {
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.search-inputs input {
		flex: 1;
		min-width: 150px;
	}

	.metadata-error {
		padding: 0.75rem;
		background: hsl(var(--destructive) / 0.1);
		color: hsl(var(--destructive));
		border-radius: 0.375rem;
		font-size: 0.875rem;
		margin-bottom: 1rem;
	}

	/* Results Modal Styles */
	.results-modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.7);
		backdrop-filter: blur(4px);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 1100;
		padding: 1rem;
	}

	.results-modal {
		background: hsl(var(--background));
		border-radius: 0.75rem;
		max-width: 700px;
		width: 100%;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
		box-shadow: 0 25px 50px -12px rgb(0 0 0 / 0.5);
	}

	.results-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1.5rem;
		border-bottom: 1px solid hsl(var(--border));
	}

	.results-header h3 {
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0;
		color: hsl(var(--foreground));
	}

	.results-list {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
	}

	.result-item {
		display: flex;
		gap: 1rem;
		padding: 1rem;
		border: 2px solid hsl(var(--border));
		border-radius: 0.5rem;
		margin-bottom: 1rem;
		cursor: pointer;
		transition: all 0.2s ease;
		background: hsl(var(--background));
	}

	.result-item:hover {
		border-color: hsl(var(--primary));
		background: hsl(var(--primary) / 0.05);
		transform: translateY(-2px);
		box-shadow: 0 4px 12px hsl(var(--primary) / 0.2);
	}

	.result-content {
		display: flex;
		gap: 1rem;
		flex: 1;
	}

	.result-cover {
		width: 60px;
		height: 90px;
		object-fit: cover;
		border-radius: 0.25rem;
		flex-shrink: 0;
	}

	.result-cover-placeholder {
		width: 60px;
		height: 90px;
		display: flex;
		align-items: center;
		justify-content: center;
		background: hsl(var(--muted));
		border-radius: 0.25rem;
		font-size: 2rem;
		flex-shrink: 0;
	}

	.result-info {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.result-title {
		font-weight: 600;
		color: hsl(var(--foreground));
		font-size: 1rem;
	}

	.result-author {
		color: hsl(var(--muted-foreground));
		font-size: 0.875rem;
	}

	.result-meta {
		color: hsl(var(--muted-foreground));
		font-size: 0.75rem;
		margin-top: 0.25rem;
	}

	.result-source {
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
		margin-top: 0.5rem;
	}

	.badge {
		display: inline-block;
		padding: 0.125rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.75rem;
		font-weight: 500;
	}

	.badge-google {
		background: hsl(220, 90%, 95%);
		color: hsl(220, 90%, 40%);
	}

	.badge-openlibrary {
		background: hsl(140, 80%, 95%);
		color: hsl(140, 80%, 35%);
	}

	.badge-content {
		background: hsl(280, 70%, 95%);
		color: hsl(280, 70%, 40%);
	}

	.result-action {
		display: flex;
		align-items: center;
	}

	.select-btn {
		padding: 0.5rem 1rem;
		background: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
		border: none;
		border-radius: 0.375rem;
		font-size: 0.875rem;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.select-btn:hover {
		background: hsl(var(--primary) / 0.9);
	}

	@media (max-width: 640px) {
		.result-item {
			flex-direction: column;
		}

		.result-action {
			align-self: stretch;
		}

		.select-btn {
			width: 100%;
		}

		.metadata-lookup-section {
			flex-direction: column;
		}

		.search-inputs {
			flex-direction: column;
		}

		.search-inputs input {
			min-width: 100%;
		}
	}

	@media (prefers-color-scheme: dark) {
		.badge-google {
			background: hsl(220, 90%, 20%);
			color: hsl(220, 90%, 80%);
		}

		.badge-openlibrary {
			background: hsl(140, 80%, 20%);
			color: hsl(140, 80%, 80%);
		}

		.badge-content {
			background: hsl(280, 70%, 20%);
			color: hsl(280, 70%, 80%);
		}
	}
</style>
