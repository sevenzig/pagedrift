export interface Book {
	id: string;
	title: string;
	author?: string;
	format: 'epub' | 'mobi' | 'pdf';
	uploadDate: Date;
	lastRead?: Date;
	progress: number;
	coverImage?: string;
	markdown: string;
	chapters: Chapter[];
}

export interface Chapter {
	id: string;
	title: string;
	content: string;
	level: number;
	order: number;
}

export interface ReaderSettings {
	fontSize: 'sm' | 'md' | 'lg' | 'xl';
	fontFamily: 'serif' | 'sans' | 'mono';
	lineHeight: 'relaxed' | 'normal' | 'loose';
	theme: 'light' | 'dark' | 'system';
}

export interface ReaderState {
	currentBookId: string | null;
	currentChapterId: string | null;
	scrollPosition: number;
}
