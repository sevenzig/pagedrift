<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Button from './ui/Button.svelte';
	import Card from './ui/Card.svelte';
	import TagInput from './TagInput.svelte';
	import { uploadQueue } from '$lib/stores/upload-queue.svelte';
	import { CONTENT_TYPES } from '$lib/constants/content-types';

	let uploading = $state(false);
	let error = $state<string | null>(null);
	let lookingUpMetadata = $state(false);
	let metadataError = $state<string | null>(null);

	const current = $derived(uploadQueue.current);
	const hasNext = $derived(uploadQueue.hasNext);
	const currentIdx = $derived(uploadQueue.currentIdx);
	const total = $derived(uploadQueue.total);
	const hasPrevious = $derived(uploadQueue.previous !== null);

	function updateMetadata(field: string, value: any) {
		uploadQueue.updateMetadata({ [field]: value });
	}

	function copyFromPrevious() {
		uploadQueue.copyFromPrevious();
	}

	async function handleAutoLookup() {
		if (!current) return;

		metadataError = null;
		lookingUpMetadata = true;

		try {
			// First, we need to create a temporary FormData to search
			const searchQuery = {
				title: current.metadata.title || current.preview?.title || '',
				author: current.metadata.author || current.preview?.author || ''
			};

			if (!searchQuery.title) {
				metadataError = 'No title available for metadata lookup';
				return;
			}

			const response = await fetch('/api/books/metadata-search', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(searchQuery),
				credentials: 'include'  // Ensure cookies are sent
			});

			// Check if response is JSON before parsing
			const contentType = response.headers.get('content-type');
			if (!contentType || !contentType.includes('application/json')) {
				const textContent = await response.text();
				console.error('Non-JSON response from metadata-search:', textContent.substring(0, 500));
				throw new Error(`Server returned ${response.status}: ${response.statusText}. Expected JSON but got ${contentType}`);
			}

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Metadata lookup failed');
			}

			// Update the metadata with the first result
			if (data.result) {
				if (data.result.title) updateMetadata('title', data.result.title);
				if (data.result.author) updateMetadata('author', data.result.author);
				if (data.result.publicationYear) {
					updateMetadata('publicationYear', data.result.publicationYear.toString());
				}
				if (data.result.isbn) updateMetadata('isbn', data.result.isbn);
				if (data.result.description) updateMetadata('description', data.result.description);
			}
		} catch (err) {
			console.error('Metadata lookup error:', err);
			metadataError = err instanceof Error ? err.message : 'Failed to lookup metadata';
		} finally {
			lookingUpMetadata = false;
		}
	}

	async function handleFinalize() {
		if (!current) return;

		// Validate content type
		if (!current.metadata.contentType) {
			error = 'Please select a content type';
			return;
		}

		error = null;
		uploading = true;

		try {
			const formData = new FormData();
			formData.append('file', current.file);
			formData.append('contentType', current.metadata.contentType);
			formData.append('tags', JSON.stringify(current.metadata.tags));
			if (current.metadata.title) formData.append('title', current.metadata.title);
			if (current.metadata.author) formData.append('author', current.metadata.author);
			if (current.metadata.publicationYear)
				formData.append('publicationYear', current.metadata.publicationYear);
			if (current.metadata.isbn) formData.append('isbn', current.metadata.isbn);
			if (current.metadata.description)
				formData.append('description', current.metadata.description);

			const response = await fetch('/api/books/upload', {
				method: 'POST',
				body: formData,
				credentials: 'include'  // Ensure cookies are sent
			});

			// Check if response is JSON before parsing
			const contentType = response.headers.get('content-type');
			if (!contentType || !contentType.includes('application/json')) {
				const textContent = await response.text();
				console.error('Non-JSON response from upload:', textContent.substring(0, 500));
				throw new Error(`Server returned ${response.status}: ${response.statusText}. Expected JSON but got ${contentType}`);
			}

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Upload failed');
			}

			// Mark as completed and move to next
			uploadQueue.completeCurrentAndNext();

			// If no more files, refresh and clear queue
			if (uploadQueue.isComplete) {
				await invalidateAll();
				uploadQueue.clear();
			}
		} catch (err) {
			console.error('Upload error:', err);
			error = err instanceof Error ? err.message : 'Failed to upload book';
		} finally {
			uploading = false;
		}
	}

	function handleSkip() {
		if (current) {
			uploadQueue.remove(current.id);
			if (uploadQueue.files.length === 0) {
				uploadQueue.clear();
			}
		}
	}
</script>

{#if current}
	<div class="staging-container">
		<!-- Progress indicator -->
		<div class="progress-header">
			<h2 class="text-xl font-semibold">
				Review & Add Metadata ({currentIdx + 1} of {total})
			</h2>
			<div class="progress-bar">
				<div class="progress-fill" style="width: {((currentIdx + 1) / total) * 100}%"></div>
			</div>
		</div>

		<div class="staging-grid">
			<!-- Left: Preview -->
			<Card class="preview-card">
				<div class="preview-content">
					<h3 class="text-lg font-semibold mb-4">Preview</h3>

					{#if current.preview?.coverImage}
						<div class="cover-preview">
							<img src={current.preview.coverImage} alt="Cover" class="cover-image" />
						</div>
					{:else}
						<div class="cover-placeholder">
							<div class="text-6xl mb-2">📖</div>
							<div class="text-sm text-muted-foreground uppercase">
								{current.preview?.format || 'Book'}
							</div>
						</div>
					{/if}

					<div class="preview-info">
						<div class="preview-item">
							<span class="preview-label">File:</span>
							<span class="preview-value">{current.fileName}</span>
						</div>
						<div class="preview-item">
							<span class="preview-label">Size:</span>
							<span class="preview-value"
								>{(current.fileSize / 1024 / 1024).toFixed(2)} MB</span
							>
						</div>
						{#if current.preview?.chaptersCount}
							<div class="preview-item">
								<span class="preview-label">Chapters:</span>
								<span class="preview-value">{current.preview.chaptersCount}</span>
							</div>
						{/if}
					</div>
				</div>
			</Card>

			<!-- Center: Metadata form -->
			<Card class="metadata-card">
				<div class="metadata-content">
					<div class="section-header">
						<h3 class="text-lg font-semibold">Metadata</h3>
						{#if hasPrevious}
							<Button variant="outline" size="sm" onclick={copyFromPrevious}>
								Copy from Previous
							</Button>
						{/if}
					</div>

					<form class="metadata-form" onsubmit={(e) => e.preventDefault()}>
						<!-- Content Type (Required) -->
						<div class="form-group">
							<label for="contentType" class="form-label required">
								Content Type <span class="text-red-500">*</span>
							</label>
							<select
								id="contentType"
								bind:value={current.metadata.contentType}
								class="form-select"
								required
								disabled={uploading}
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
								bind:value={current.metadata.title}
								class="form-input"
								placeholder="Book title"
								disabled={uploading}
							/>
						</div>

						<!-- Author -->
						<div class="form-group">
							<label for="author" class="form-label">Author(s)</label>
							<input
								id="author"
								type="text"
								bind:value={current.metadata.author}
								class="form-input"
								placeholder="Author name"
								disabled={uploading}
							/>
						</div>

						<!-- Publication Year -->
						<div class="form-group">
							<label for="publicationYear" class="form-label">Publication Year</label>
							<input
								id="publicationYear"
								type="text"
								bind:value={current.metadata.publicationYear}
								class="form-input"
								placeholder="YYYY"
								pattern="[0-9]{4}"
								disabled={uploading}
							/>
						</div>

						<!-- ISBN -->
						<div class="form-group">
							<label for="isbn" class="form-label">ISBN</label>
							<input
								id="isbn"
								type="text"
								bind:value={current.metadata.isbn}
								class="form-input"
								placeholder="ISBN-10 or ISBN-13"
								disabled={uploading}
							/>
						</div>

						<!-- Tags -->
						<div class="form-group">
							<label for="tags" class="form-label">Tags</label>
							<div id="tags">
								<TagInput bind:tags={current.metadata.tags} disabled={uploading} />
							</div>
							<p class="form-hint">Press Enter to add tags. Used for filtering and search.</p>
						</div>

						<!-- Description -->
						<div class="form-group">
							<label for="description" class="form-label">Description / Notes</label>
							<textarea
								id="description"
								bind:value={current.metadata.description}
								class="form-textarea"
								placeholder="Brief description or notes about this content"
								rows="3"
								disabled={uploading}
							></textarea>
						</div>

						{#if error}
							<div class="error-message">
								{error}
							</div>
						{/if}
					</form>
				</div>
			</Card>

			<!-- Right: Actions -->
			<Card class="actions-card">
				<div class="actions-content">
					<h3 class="text-lg font-semibold mb-4">Actions</h3>

					<div class="actions-section">
						<h4 class="text-sm font-medium mb-2 text-muted-foreground">Metadata Lookup</h4>
						<Button 
							variant="outline" 
							onclick={handleAutoLookup} 
							disabled={uploading || lookingUpMetadata}
							class="w-full mb-2"
						>
							{lookingUpMetadata ? 'Searching...' : '🔍 Search for Metadata'}
						</Button>
						{#if metadataError}
							<div class="text-xs text-destructive mb-2">
								{metadataError}
							</div>
						{/if}
						<p class="text-xs text-muted-foreground">
							Automatically find book information from online databases
						</p>
					</div>

					<div class="divider"></div>

					<div class="actions-section">
						<h4 class="text-sm font-medium mb-2 text-muted-foreground">Save</h4>
						<Button 
							onclick={handleFinalize} 
							disabled={uploading}
							class="w-full mb-2"
						>
							{uploading ? 'Saving...' : hasNext ? 'Save & Next' : 'Save & Complete'}
						</Button>
						<Button 
							variant="outline" 
							onclick={handleSkip} 
							disabled={uploading}
							class="w-full"
						>
							Skip This File
						</Button>
					</div>
				</div>
			</Card>
		</div>
	</div>
{/if}

<style>
	.staging-container {
		width: 100%;
		height: 100%;
		display: flex;
		flex-direction: column;
		padding: 1.5rem;
		max-height: calc(100vh - 4rem);
		overflow: hidden;
	}

	.progress-header {
		flex-shrink: 0;
		margin-bottom: 1.5rem;
	}

	.progress-bar {
		width: 100%;
		height: 0.5rem;
		background: hsl(var(--muted));
		border-radius: 9999px;
		overflow: hidden;
		margin-top: 0.5rem;
	}

	.progress-fill {
		height: 100%;
		background: hsl(var(--primary));
		transition: width 0.3s ease;
	}

	.staging-grid {
		display: grid;
		grid-template-columns: minmax(280px, 1fr) minmax(400px, 2fr) minmax(280px, 1fr);
		gap: 1.5rem;
		flex: 1;
		min-height: 0;
		overflow: hidden;
	}

	@media (max-width: 1200px) {
		.staging-grid {
			grid-template-columns: 1fr;
			overflow-y: auto;
		}
	}

	/* Card styles with scrolling */
	:global(.preview-card),
	:global(.metadata-card),
	:global(.actions-card) {
		display: flex;
		flex-direction: column;
		padding: 1.5rem;
		overflow: hidden;
	}

	:global(.metadata-card) {
		overflow-y: auto;
	}

	.preview-content {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		overflow-y: auto;
	}

	.cover-preview {
		width: 100%;
		aspect-ratio: 2/3;
		overflow: hidden;
		border-radius: 0.5rem;
		background: hsl(var(--muted));
		flex-shrink: 0;
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
		flex-shrink: 0;
	}

	.preview-info {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		flex-shrink: 0;
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
		overflow-y: auto;
		flex: 1;
	}

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-shrink: 0;
		gap: 0.5rem;
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
		padding: 0.5rem 0.75rem;
		border: 1px solid hsl(var(--border));
		border-radius: 0.375rem;
		background: hsl(var(--background));
		font-size: 0.875rem;
		transition: border-color 0.2s;
	}

	.form-input:focus,
	.form-select:focus,
	.form-textarea:focus {
		outline: none;
		border-color: hsl(var(--ring));
		box-shadow: 0 0 0 3px hsl(var(--ring) / 0.1);
	}

	.form-input:disabled,
	.form-select:disabled,
	.form-textarea:disabled {
		opacity: 0.5;
		cursor: not-allowed;
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

	.actions-content {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
		overflow-y: auto;
	}

	.actions-section {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.divider {
		height: 1px;
		background: hsl(var(--border));
		margin: 0.5rem 0;
	}
</style>

