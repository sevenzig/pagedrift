import type { Book } from '$lib/types';
import { saveBooks, loadBooks } from '$lib/utils/client-storage';

class BooksStore {
	books = $state<Book[]>([]);
	loading = $state(false);

	async init() {
		this.loading = true;
		this.books = await loadBooks();
		this.loading = false;
	}

	async addBook(book: Book) {
		this.books = [...this.books, book];
		await saveBooks(this.books);
	}

	async updateBook(id: string, updates: Partial<Book>) {
		this.books = this.books.map((book) => (book.id === id ? { ...book, ...updates } : book));
		await saveBooks(this.books);
	}

	async deleteBook(id: string) {
		this.books = this.books.filter((book) => book.id !== id);
		await saveBooks(this.books);
	}

	getBook(id: string): Book | undefined {
		return this.books.find((book) => book.id === id);
	}
}

export const booksStore = new BooksStore();
