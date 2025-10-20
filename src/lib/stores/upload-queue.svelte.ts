/**
 * Upload queue store for managing staged book uploads
 * Handles file storage in browser memory and metadata for each upload
 */

export interface StagingMetadata {
	contentType: string;
	tags: string[];
	title: string;
	author: string;
	publicationYear: string;
	isbn: string;
	description: string;
}

export interface QueuedFile {
	id: string;
	file: File;
	fileName: string;
	fileSize: number;
	preview?: {
		title: string;
		author?: string;
		format: string;
		coverImage?: string;
		metadata?: any;
		chaptersCount: number;
	};
	metadata: StagingMetadata;
	status: 'pending' | 'previewing' | 'ready' | 'uploading' | 'completed' | 'error';
	error?: string;
}

class UploadQueue {
	private queue = $state<QueuedFile[]>([]);
	private currentIndex = $state<number>(0);
	private previousMetadata = $state<StagingMetadata | null>(null);

	get files(): QueuedFile[] {
		return this.queue;
	}

	get current(): QueuedFile | null {
		return this.queue[this.currentIndex] || null;
	}

	get currentIdx(): number {
		return this.currentIndex;
	}

	get total(): number {
		return this.queue.length;
	}

	get hasNext(): boolean {
		return this.currentIndex < this.queue.length - 1;
	}

	get hasPrevious(): boolean {
		return this.currentIndex > 0;
	}

	get isComplete(): boolean {
		return this.queue.length > 0 && this.queue.every((f) => f.status === 'completed');
	}

	get previous(): StagingMetadata | null {
		return this.previousMetadata;
	}

	/**
	 * Add files to the queue
	 */
	addFiles(files: File[]) {
		const newFiles: QueuedFile[] = files.map((file) => ({
			id: crypto.randomUUID(),
			file,
			fileName: file.name,
			fileSize: file.size,
			status: 'pending',
			metadata: {
				contentType: 'Book',
				tags: [],
				title: '',
				author: '',
				publicationYear: '',
				isbn: '',
				description: ''
			}
		}));

		this.queue.push(...newFiles);
	}

	/**
	 * Update preview data for a file
	 */
	updatePreview(id: string, preview: any) {
		const file = this.queue.find((f) => f.id === id);
		if (file) {
			file.preview = preview;
			file.status = 'ready';
			// Pre-fill metadata from preview
			if (preview.title) file.metadata.title = preview.title;
			if (preview.author) file.metadata.author = preview.author;
			if (preview.metadata?.publicationYear) {
				file.metadata.publicationYear = preview.metadata.publicationYear.toString();
			}
			if (preview.metadata?.isbn) file.metadata.isbn = preview.metadata.isbn;
			if (preview.metadata?.description) file.metadata.description = preview.metadata.description;
		}
	}

	/**
	 * Update metadata for current file
	 */
	updateMetadata(metadata: Partial<StagingMetadata>) {
		const current = this.current;
		if (current) {
			current.metadata = { ...current.metadata, ...metadata };
		}
	}

	/**
	 * Update status for a file
	 */
	updateStatus(id: string, status: QueuedFile['status'], error?: string) {
		const file = this.queue.find((f) => f.id === id);
		if (file) {
			file.status = status;
			if (error) file.error = error;
		}
	}

	/**
	 * Copy metadata from previous file
	 */
	copyFromPrevious() {
		if (this.previousMetadata && this.current) {
			this.current.metadata = {
				...this.current.metadata,
				contentType: this.previousMetadata.contentType,
				tags: [...this.previousMetadata.tags]
			};
		}
	}

	/**
	 * Mark current file as completed and move to next
	 */
	completeCurrentAndNext() {
		const current = this.current;
		if (current) {
			current.status = 'completed';
			// Save metadata for "copy from previous" feature
			this.previousMetadata = { ...current.metadata };
		}

		if (this.hasNext) {
			this.currentIndex++;
		}
	}

	/**
	 * Move to next file
	 */
	next() {
		if (this.hasNext) {
			this.currentIndex++;
		}
	}

	/**
	 * Move to previous file
	 */
	back() {
		if (this.hasPrevious) {
			this.currentIndex--;
		}
	}

	/**
	 * Remove a file from queue
	 */
	remove(id: string) {
		const index = this.queue.findIndex((f) => f.id === id);
		if (index !== -1) {
			this.queue.splice(index, 1);
			// Adjust current index if needed
			if (this.currentIndex >= this.queue.length) {
				this.currentIndex = Math.max(0, this.queue.length - 1);
			}
		}
	}

	/**
	 * Clear the entire queue
	 */
	clear() {
		this.queue = [];
		this.currentIndex = 0;
		this.previousMetadata = null;
	}

	/**
	 * Reset to first file
	 */
	reset() {
		this.currentIndex = 0;
	}
}

export const uploadQueue = new UploadQueue();

