<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import Button from './ui/Button.svelte';
	import Card from './ui/Card.svelte';
	import TagInput from './TagInput.svelte';
	import { uploadQueue } from '$lib/stores/upload-queue.svelte';
	import { CONTENT_TYPES } from '$lib/constants/content-types';

	let uploading = $state(false);
	let error = $state<string | null>(null);

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
				body: formData
			});

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
			<Card class="p-6">
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

			<!-- Right: Metadata form -->
			<Card class="p-6">
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

						<!-- Action buttons -->
						<div class="action-buttons">
							<Button variant="outline" onclick={handleSkip} disabled={uploading}>
								Skip This File
							</Button>
							<Button onclick={handleFinalize} disabled={uploading}>
								{uploading ? 'Saving...' : hasNext ? 'Save & Next' : 'Save & Complete'}
							</Button>
						</div>
					</form>
				</div>
			</Card>
		</div>
	</div>
{/if}

<style>
	.staging-container {
		max-width: 1200px;
		margin: 0 auto;
		padding: 1.5rem;
	}

	.progress-header {
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

	.section-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
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

	.action-buttons {
		display: flex;
		gap: 1rem;
		margin-top: 1rem;
	}
</style>

