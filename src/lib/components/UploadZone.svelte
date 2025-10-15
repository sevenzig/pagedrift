<script lang="ts">
        import { validateFile, getFileFormat, generateId } from '$lib/utils/file-validation';
        import { parseEpub } from '$lib/parsers/epub-parser';
        import { parsePdf } from '$lib/parsers/pdf-parser';
        import { parseMobi } from '$lib/parsers/mobi-parser';
        import { booksStore } from '$lib/stores/books.svelte';
        import Button from './ui/Button.svelte';
        import Card from './ui/Card.svelte';
        import type { Book } from '$lib/types';

        let dragging = $state(false);
        let uploading = $state(false);
        let error = $state<string | null>(null);
        let fileInput: HTMLInputElement;

        async function handleFile(file: File) {
                error = null;
                const validation = validateFile(file);

                if (!validation.valid) {
                        error = validation.error || 'Invalid file';
                        return;
                }

                uploading = true;

                try {
                        const format = getFileFormat(file);
                        if (!format) {
                                throw new Error('Unsupported file format');
                        }

                        let bookData: Omit<Book, 'id' | 'uploadDate'>;

                        if (format === 'epub') {
                                bookData = await parseEpub(file);
                        } else if (format === 'pdf') {
                                bookData = await parsePdf(file);
                        } else if (format === 'mobi') {
                                bookData = await parseMobi(file);
                        } else {
                                throw new Error('Unsupported format');
                        }

                        const book: Book = {
                                ...bookData,
                                id: generateId(),
                                uploadDate: new Date()
                        };

                        await booksStore.addBook(book);
                } catch (err) {
                        console.error('Error processing file:', err);
                        error = err instanceof Error ? err.message : 'Error processing file';
                } finally {
                        uploading = false;
                }
        }

        function handleDrop(e: DragEvent) {
                e.preventDefault();
                dragging = false;

                const files = e.dataTransfer?.files;
                if (files && files.length > 0) {
                        handleFile(files[0]);
                }
        }

        function handleDragOver(e: DragEvent) {
                e.preventDefault();
                dragging = true;
        }

        function handleDragLeave() {
                dragging = false;
        }

        function handleFileSelect(e: Event) {
                const input = e.target as HTMLInputElement;
                if (input.files && input.files.length > 0) {
                        handleFile(input.files[0]);
                }
        }

        function openFileDialog() {
                fileInput.click();
        }
</script>

<Card class="p-8">
        <div
                role="button"
                tabindex="0"
                class="border-2 border-dashed rounded-lg p-12 text-center transition-colors {dragging
                        ? 'border-primary bg-primary/5'
                        : 'border-muted-foreground/25'}"
                ondrop={handleDrop}
                ondragover={handleDragOver}
                ondragleave={handleDragLeave}
                onkeydown={(e) => e.key === 'Enter' && openFileDialog()}
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
        />
</Card>
