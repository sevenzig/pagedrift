<script lang="ts">
	import MarkdownIt from 'markdown-it';
	import { booksStore } from '$lib/stores/books.svelte';
	import { readerStore } from '$lib/stores/reader.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import Button from './ui/Button.svelte';
	import Card from './ui/Card.svelte';
	import type { Book, Chapter } from '$lib/types';

	interface Props {
		bookId: string;
	}

	let { bookId }: Props = $props();

	const md = new MarkdownIt();

	let book = $derived(booksStore.getBook(bookId));
	let currentChapterIndex = $state(0);
	let scrollContainer: HTMLDivElement;

	$effect(() => {
		if (book) {
			readerStore.setCurrentBook(bookId, book.chapters[currentChapterIndex]?.id);
		}
	});

	let currentChapter = $derived(book?.chapters[currentChapterIndex]);
	let renderedContent = $derived(
		currentChapter ? md.render(currentChapter.content) : ''
	);

	function nextChapter() {
		if (book && currentChapterIndex < book.chapters.length - 1) {
			currentChapterIndex++;
			scrollContainer?.scrollTo(0, 0);
		}
	}

	function prevChapter() {
		if (currentChapterIndex > 0) {
			currentChapterIndex--;
			scrollContainer?.scrollTo(0, 0);
		}
	}

	function selectChapter(index: number) {
		currentChapterIndex = index;
		scrollContainer?.scrollTo(0, 0);
	}

	const fontSizeClasses = {
		sm: 'text-sm',
		md: 'text-base',
		lg: 'text-lg',
		xl: 'text-xl'
	};

	const fontFamilyClasses = {
		serif: 'font-serif',
		sans: 'font-sans',
		mono: 'font-mono'
	};

	const lineHeightClasses = {
		normal: 'leading-normal',
		relaxed: 'leading-relaxed',
		loose: 'leading-loose'
	};
</script>

{#if !book}
	<div class="flex items-center justify-center h-screen">
		<p class="text-muted-foreground">Book not found</p>
	</div>
{:else}
	<div class="flex flex-col h-screen">
		<header class="border-b bg-card p-4">
			<div class="max-w-4xl mx-auto flex items-center justify-between">
				<div class="flex-1">
					<h1 class="text-xl font-semibold">{book.title}</h1>
					{#if book.author}
						<p class="text-sm text-muted-foreground">{book.author}</p>
					{/if}
				</div>
				<div class="flex gap-2">
					<a href="/">
						<Button variant="outline" size="sm">← Library</Button>
					</a>
				</div>
			</div>
		</header>

		<div class="flex flex-1 overflow-hidden">
			<aside class="w-64 border-r bg-card overflow-y-auto hidden md:block">
				<div class="p-4">
					<h2 class="font-semibold mb-4">Table of Contents</h2>
					<nav class="space-y-1">
						{#each book.chapters as chapter, index}
							<button
								onclick={() => selectChapter(index)}
								class="w-full text-left px-3 py-2 rounded text-sm transition-colors {currentChapterIndex ===
								index
									? 'bg-primary text-primary-foreground'
									: 'hover:bg-accent'}"
							>
								{chapter.title}
							</button>
						{/each}
					</nav>
				</div>
			</aside>

			<main class="flex-1 overflow-y-auto" bind:this={scrollContainer}>
				<div class="max-w-3xl mx-auto px-6 py-8">
					<Card class="p-8">
						<article
							class="prose dark:prose-invert max-w-none {fontSizeClasses[
								settingsStore.settings.fontSize
							]} {fontFamilyClasses[settingsStore.settings.fontFamily]} {lineHeightClasses[
								settingsStore.settings.lineHeight
							]}"
						>
							{@html renderedContent}
						</article>

						<div class="flex justify-between mt-8 pt-8 border-t">
							<Button
								onclick={prevChapter}
								variant="outline"
								disabled={currentChapterIndex === 0}
							>
								← Previous
							</Button>
							<span class="text-sm text-muted-foreground self-center">
								Chapter {currentChapterIndex + 1} of {book.chapters.length}
							</span>
							<Button
								onclick={nextChapter}
								variant="outline"
								disabled={currentChapterIndex === book.chapters.length - 1}
							>
								Next →
							</Button>
						</div>
					</Card>
				</div>
			</main>

			<aside class="w-64 border-l bg-card p-4 hidden lg:block">
				<h2 class="font-semibold mb-4">Settings</h2>
				<div class="space-y-4">
					<div>
						<label class="text-sm font-medium mb-2 block">Font Size</label>
						<div class="grid grid-cols-2 gap-2">
							{#each ['sm', 'md', 'lg', 'xl'] as size}
								<Button
									variant={settingsStore.settings.fontSize === size
										? 'default'
										: 'outline'}
									size="sm"
									onclick={() => settingsStore.setFontSize(size as any)}
								>
									{size.toUpperCase()}
								</Button>
							{/each}
						</div>
					</div>

					<div>
						<label class="text-sm font-medium mb-2 block">Font Family</label>
						<div class="space-y-2">
							{#each ['serif', 'sans', 'mono'] as family}
								<Button
									variant={settingsStore.settings.fontFamily === family
										? 'default'
										: 'outline'}
									size="sm"
									class="w-full"
									onclick={() => settingsStore.setFontFamily(family as any)}
								>
									{family.charAt(0).toUpperCase() + family.slice(1)}
								</Button>
							{/each}
						</div>
					</div>

					<div>
						<label class="text-sm font-medium mb-2 block">Theme</label>
						<div class="space-y-2">
							{#each ['light', 'dark', 'system'] as theme}
								<Button
									variant={settingsStore.settings.theme === theme ? 'default' : 'outline'}
									size="sm"
									class="w-full"
									onclick={() => settingsStore.setTheme(theme as any)}
								>
									{theme.charAt(0).toUpperCase() + theme.slice(1)}
								</Button>
							{/each}
						</div>
					</div>
				</div>
			</aside>
		</div>
	</div>
{/if}
