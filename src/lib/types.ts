export interface Book {
	id: string;
	title: string;
	author?: string;
	format: 'epub' | 'mobi' | 'pdf';
	contentType: string;
	uploadDate: Date;
	lastRead?: Date;
	progress: number;
	coverImage?: string;
	markdown: string;
	chapters: Chapter[];
	tags?: BookTag[];
}

export interface Tag {
	id: string;
	name: string;
	createdAt: Date;
}

export interface BookTag {
	id: string;
	bookId: string;
	tagId: string;
	tag: Tag;
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

export interface FilterValue {
	value?: string | number;
	gt?: number;
	lt?: number;
	gte?: number;
	lte?: number;
	min?: number;
	max?: number;
}

export interface SearchQuery {
	originalQuery: string;
	filters: Record<string, FilterValue>;
	textQuery: string;
	excludeTerms: string[];
	exactPhrases: string[];
}
