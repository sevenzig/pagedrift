import type { ReaderState } from '$lib/types';
import { saveReaderState, loadReaderState } from '$lib/utils/client-storage';

class ReaderStore {
	state = $state<ReaderState>({
		currentBookId: null,
		currentChapterId: null,
		scrollPosition: 0
	});

	async init() {
		this.state = await loadReaderState();
	}

	async setCurrentBook(bookId: string | null, chapterId: string | null = null) {
		this.state.currentBookId = bookId;
		this.state.currentChapterId = chapterId;
		this.state.scrollPosition = 0;
		await saveReaderState(this.state);
	}

	async setCurrentChapter(chapterId: string) {
		this.state.currentChapterId = chapterId;
		this.state.scrollPosition = 0;
		await saveReaderState(this.state);
	}

	async setScrollPosition(position: number) {
		this.state.scrollPosition = position;
		await saveReaderState(this.state);
	}
}

export const readerStore = new ReaderStore();
