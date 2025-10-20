<script lang="ts">
        import { onMount } from 'svelte';
        import Button from './ui/Button.svelte';
        import Card from './ui/Card.svelte';
        import { uploadQueue } from '$lib/stores/upload-queue.svelte';

        let dragging = $state(false);
        let processing = $state(false);
        let error = $state<string | null>(null);
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

        async function handleFiles(files: File[]) {
                error = null;

                // Basic validation
                const MAX_SIZE = 50 * 1024 * 1024; // 50MB
                const validFiles: File[] = [];

                for (const file of files) {
                        if (file.size > MAX_SIZE) {
                                error = `File "${file.name}" exceeds 50MB limit`;
                                continue;
                        }

                        const filename = file.name.toLowerCase();
                        if (!filename.endsWith('.epub') && !filename.endsWith('.pdf') && !filename.endsWith('.mobi')) {
                                error = `File "${file.name}" is not supported. Only EPUB, PDF, and MOBI files are allowed.`;
                                continue;
                        }

                        validFiles.push(file);
                }

                if (validFiles.length === 0) {
                        return;
                }

                // Add files to queue
                uploadQueue.addFiles(validFiles);

                // Fetch preview for each file
                processing = true;
                for (const file of validFiles) {
                        await fetchPreview(file);
                }
                processing = false;

                // Reset file input
                if (fileInput) {
                        fileInput.value = '';
                }
        }

	async function fetchPreview(file: File) {
		const queuedFile = uploadQueue.files.find(f => f.file === file);
		if (!queuedFile) return;

		uploadQueue.updateStatus(queuedFile.id, 'previewing');

		try {
			const formData = new FormData();
			formData.append('file', file);

			const response = await fetch('/api/books/preview', {
				method: 'POST',
				body: formData,
				credentials: 'include'  // Ensure cookies are sent
			});

			// Log response status and headers for debugging
			console.log('Preview response status:', response.status);
			console.log('Preview response content-type:', response.headers.get('content-type'));
			
			// Check if response is JSON before parsing
			const contentType = response.headers.get('content-type');
			if (!contentType || !contentType.includes('application/json')) {
				const textContent = await response.text();
				console.error('Non-JSON response:', textContent.substring(0, 500));
				throw new Error(`Server returned ${response.status}: ${response.statusText}. Expected JSON but got ${contentType}`);
			}

			const data = await response.json();
			console.log('Preview response data:', data);

			if (!response.ok) {
				throw new Error(data.error || 'Preview failed');
			}

			console.log('Calling updatePreview with:', queuedFile.id, data.preview);
			uploadQueue.updatePreview(queuedFile.id, data.preview);
		} catch (err) {
			console.error('Preview error:', err);
			const errorMsg = err instanceof Error ? err.message : 'Failed to preview file';
			uploadQueue.updateStatus(queuedFile.id, 'error', errorMsg);
		}
	}

        async function handleFile(file: File) {
                await handleFiles([file]);
        }

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		e.stopPropagation();
		dragging = false;

		const files = e.dataTransfer?.files;
		if (files && files.length > 0) {
			console.log('Files dropped:', files.length);
			handleFiles(Array.from(files));
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
                        console.log('Files selected:', input.files.length);
                        handleFiles(Array.from(input.files));
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
                {#if processing}
                        <div class="space-y-4">
                                <div class="text-lg font-medium">Processing files...</div>
                                <div class="text-sm text-muted-foreground">This may take a moment</div>
                        </div>
                {:else}
                        <div class="space-y-4">
                                <div class="text-4xl">📚</div>
                                <div class="space-y-2">
                                        <h3 class="text-xl font-semibold">Upload your eBooks</h3>
                                        <p class="text-sm text-muted-foreground">
                                                Drag and drop EPUB, MOBI, or PDF files here, or click to browse
                                        </p>
                                </div>
                                <Button onclick={openFileDialog}>Select Files</Button>
                                <p class="text-xs text-muted-foreground">Maximum file size: 50MB per file. Multiple files supported.</p>
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
                multiple
                onchange={handleFileSelect}
                class="hidden"
                id="file-upload-input"
        />
</Card>
