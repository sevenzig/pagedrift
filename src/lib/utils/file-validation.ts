const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES = {
	epub: ['application/epub+zip'],
	pdf: ['application/pdf'],
	mobi: ['application/x-mobipocket-ebook', 'application/octet-stream']
};

export function validateFile(file: File): { valid: boolean; error?: string } {
	if (file.size > MAX_FILE_SIZE) {
		return {
			valid: false,
			error: `File size exceeds 50MB limit. File size: ${(file.size / 1024 / 1024).toFixed(2)}MB`
		};
	}

	const extension = file.name.split('.').pop()?.toLowerCase();

	if (!extension || !['epub', 'pdf', 'mobi'].includes(extension)) {
		return {
			valid: false,
			error: 'Invalid file type. Please upload an EPUB, MOBI, or PDF file.'
		};
	}

	return { valid: true };
}

export function getFileFormat(file: File): 'epub' | 'mobi' | 'pdf' | null {
	const extension = file.name.split('.').pop()?.toLowerCase();

	if (extension === 'epub') return 'epub';
	if (extension === 'pdf') return 'pdf';
	if (extension === 'mobi') return 'mobi';

	return null;
}

export function generateId(): string {
	return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
