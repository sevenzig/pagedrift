<script lang="ts">
        import { onMount } from 'svelte';
        import { invalidateAll } from '$app/navigation';
        import Button from './ui/Button.svelte';
        import Card from './ui/Card.svelte';

        let dragging = $state(false);
        let uploading = $state(false);
        let error = $state<string | null>(null);
        let success = $state<string | null>(null);
        let uploadProgress = $state<string>('');
        let fileInput: HTMLInputElement;

        // Prevent default drag behavior globally to stop browser from opening files
        onMount(() => {
                const preventDefaults = (e: Event) => {
                        // Only prevent if the drag is not over our upload zone
                        const target = e.target as Element;
                        if (!target.closest('[data-upload-zone]')) {
                                e.preventDefault();
                                e.stopPropagation();
                        }
                };

                // Prevent browser from opening files when dragged onto window
                window.addEventListener('dragover', preventDefaults);
                window.addEventListener('drop', preventDefaults);

                return () => {
                        window.removeEventListener('dragover', preventDefaults);
                        window.removeEventListener('drop', preventDefaults);
                };
        });

        async function handleFile(file: File) {
                error = null;
                success = null;
                uploadProgress = '';

                // Basic validation
                const MAX_SIZE = 50 * 1024 * 1024; // 50MB
                if (file.size > MAX_SIZE) {
                        error = 'File size exceeds 50MB limit';
                        return;
                }

                const filename = file.name.toLowerCase();
                if (!filename.endsWith('.epub') && !filename.endsWith('.pdf') && !filename.endsWith('.mobi')) {
                        error = 'Only EPUB, PDF, and MOBI files are supported';
                        return;
                }

                uploading = true;
                uploadProgress = 'Uploading file...';

                try {
                        const formData = new FormData();
                        formData.append('file', file);

                        uploadProgress = 'Processing book...';

                        const response = await fetch('/api/books/upload', {
                                method: 'POST',
                                body: formData
                        });

                        const data = await response.json();

                        if (!response.ok) {
                                throw new Error(data.error || 'Upload failed');
                        }

                        // Reset file input after successful upload
                        if (fileInput) {
                                fileInput.value = '';
                        }

                        success = `Successfully uploaded "${data.book.title}"!`;
                        uploadProgress = '';
                        
                        // Refresh the page data
                        await invalidateAll();
                        
                        // Clear success message after 3 seconds
                        setTimeout(() => {
                                success = null;
                        }, 3000);
                } catch (err) {
                        console.error('Upload error:', err);
                        error = err instanceof Error ? err.message : 'Failed to upload book';
                        uploadProgress = '';
                } finally {
                        uploading = false;
                }
        }

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragging = false;

		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			console.log('File dropped:', files[0].name);
			handleFile(files[0]);
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragging = true;
	}

	function handleDragEnter(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragging = true;
	}

	function handleDragLeave(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragging = false;
	}

        function handleFileSelect(e: Event) {
                const input = e.target as HTMLInputElement;
                if (input.files && input.files.length > 0) {
                        console.log('File selected:', input.files[0].name);
                        handleFile(input.files[0]);
                }
        }

        function openFileDialog() {
                console.log('Opening file dialog, fileInput:', fileInput);
                if (fileInput) {
                        fileInput.click();
                } else {
                        console.error('File input not found');
                }
        }
</script>

<Card class="p-8">
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		data-upload-zone
		role="button"
		tabindex="0"
		class="border-2 border-dashed rounded-lg p-12 text-center transition-colors {dragging
			? 'border-primary bg-primary/5'
			: 'border-muted-foreground/25'}"
		ondrop={handleDrop}
		ondragover={handleDragOver}
		ondragenter={handleDragEnter}
		ondragleave={handleDragLeave}
		onkeydown={(e) => e.key === 'Enter' && openFileDialog()}
		onclick={openFileDialog}
	>
                {#if uploading}
                        <div class="space-y-4">
                                <div class="text-lg font-medium">Processing book...</div>
                                <div class="text-sm text-muted-foreground">This may take a moment</div>
                        </div>
                {:else}
                        <div class="space-y-4">
                                <div class="text-4xl">📚</div>
                                <div class="space-y-2">
                                        <h3 class="text-xl font-semibold">Upload your eBook</h3>
                                        <p class="text-sm text-muted-foreground">
                                                Drag and drop an EPUB, MOBI, or PDF file here, or click to browse
                                        </p>
                                </div>
                                <Button onclick={openFileDialog}>Select File</Button>
                                <p class="text-xs text-muted-foreground">Maximum file size: 50MB</p>
                        </div>
                {/if}

                {#if success}
                        <div class="mt-4 p-3 bg-green-100 text-green-800 rounded-md text-sm">
                                {success}
                        </div>
                {/if}

                {#if error}
                        <div class="mt-4 p-3 bg-destructive/10 text-destructive rounded-md text-sm">
                                {error}
                        </div>
                {/if}
        </div>

        <input
                bind:this={fileInput}
                type="file"
                accept=".epub,.mobi,.pdf"
                onchange={handleFileSelect}
                class="hidden"
                id="file-upload-input"
        />
</Card>
