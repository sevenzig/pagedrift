<script lang="ts">
	// @ts-ignore - markdown-it types issue
	import MarkdownIt from 'markdown-it';
	import { goto } from '$app/navigation';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import Button from './ui/Button.svelte';
	import Card from './ui/Card.svelte';
	import type { Chapter } from '$lib/types';
	import { onMount } from 'svelte';

	interface Props {
		book: {
			id: string;
			title: string;
			author?: string | null;
			chapters: Chapter[];
		};
		initialProgress?: {
			currentChapterId?: string | null;
			progress?: number;
		} | null;
	}

	let { book, initialProgress }: Props = $props();

	const md = new MarkdownIt({
		html: true,
		linkify: true,
		typographer: true,
		breaks: false
	});

	// Custom image renderer
	const defaultImageRender = md.renderer.rules.image || function(tokens: any, idx: number, options: any, env: any, self: any) {
		return self.renderToken(tokens, idx, options);
	};

	md.renderer.rules.image = function (tokens: any, idx: number, options: any, env: any, self: any) {
		const token = tokens[idx];
		const srcIndex = token.attrIndex('src');
		
		if (srcIndex >= 0) {
			token.attrPush(['loading', 'lazy']);
			token.attrPush(['style', 'max-width: 100%; height: auto;']);
		}
		
		return defaultImageRender(tokens, idx, options, env, self);
	};

	// Find initial chapter from progress
	let initialChapterIndex = 0;
	if (initialProgress?.currentChapterId) {
		const foundIndex = book.chapters.findIndex(ch => ch.id === initialProgress.currentChapterId);
		if (foundIndex !== -1) {
			initialChapterIndex = foundIndex;
		}
	}

	let currentChapterIndex = $state(initialChapterIndex);
	let scrollContainer: HTMLDivElement | undefined;
	let showTOC = $state(false);
	let savingProgress = $state(false);

	let currentChapter = $derived(book.chapters[currentChapterIndex]);
	let renderedContent = $derived(
		currentChapter ? md.render(currentChapter.content) : ''
	);

	// Initialize settings store
	onMount(async () => {
		await settingsStore.init();
	});

	async function saveProgress() {
		if (savingProgress) return;

		savingProgress = true;
		try {
			await fetch(`/api/books/${book.id}/progress`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					currentChapterId: currentChapter.id,
					progress: (currentChapterIndex / book.chapters.length) * 100
				})
			});
		} catch (error) {
			console.error('Failed to save progress:', error);
		} finally {
			savingProgress = false;
		}
	}

	function previousChapter() {
		if (currentChapterIndex > 0) {
			currentChapterIndex--;
			scrollToTop();
			saveProgress();
		}
	}

	function nextChapter() {
		if (currentChapterIndex < book.chapters.length - 1) {
			currentChapterIndex++;
			scrollToTop();
			saveProgress();
		}
	}

	function goToChapter(index: number) {
		currentChapterIndex = index;
		showTOC = false;
		scrollToTop();
		saveProgress();
	}

	function scrollToTop() {
		if (scrollContainer) {
			scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
		}
	}

	let fontSize = $derived(settingsStore.settings.fontSize);
	let fontFamily = $derived(settingsStore.settings.fontFamily);
	let lineHeight = $derived(settingsStore.settings.lineHeight);
	let theme = $derived(settingsStore.settings.theme);
</script>

<div class="min-h-screen bg-background">
	<!-- Header -->
	<header class="border-b bg-card sticky top-0 z-10">
		<div class="max-w-5xl mx-auto px-4 py-4">
			<div class="flex items-center justify-between gap-4">
				<Button variant="outline" size="sm" onclick={() => goto('/')}>
					← Library
				</Button>
				
				<div class="flex-1 text-center min-w-0">
					<h1 class="text-lg font-semibold truncate">{book.title}</h1>
					{#if book.author}
						<p class="text-sm text-muted-foreground truncate">{book.author}</p>
					{/if}
				</div>

				<div class="flex items-center gap-2">
					<Button variant="outline" size="sm" onclick={() => (showTOC = !showTOC)}>
						{showTOC ? 'Hide' : 'Chapters'}
					</Button>
					<Button variant="outline" size="sm" onclick={() => (settingsStore.showSettings = !settingsStore.showSettings)}>
						Settings
					</Button>
				</div>
			</div>
		</div>
	</header>

	<div class="flex">
		<!-- Table of Contents -->
		{#if showTOC}
			<aside class="w-64 border-r bg-card h-[calc(100vh-73px)] sticky top-[73px] overflow-y-auto">
				<div class="p-4">
					<h2 class="text-lg font-semibold mb-4">Chapters</h2>
					<nav class="space-y-1">
						{#each book.chapters as chapter, index}
							<button
								onclick={() => goToChapter(index)}
								class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors {index === currentChapterIndex
									? 'bg-primary text-primary-foreground'
									: 'hover:bg-muted'}"
							>
								<div class="font-medium truncate">{chapter.title}</div>
							</button>
						{/each}
					</nav>
				</div>
			</aside>
		{/if}

		<!-- Main Content -->
		<main class="flex-1">
			<div class="max-w-3xl mx-auto px-6 py-8">
				<!-- Chapter Title -->
				<Card class="mb-6 p-6">
					<h2 class="text-2xl font-bold mb-2">{currentChapter.title}</h2>
					<p class="text-sm text-muted-foreground">
						Chapter {currentChapterIndex + 1} of {book.chapters.length}
					</p>
					{#if savingProgress}
						<p class="text-xs text-muted-foreground mt-2">Saving progress...</p>
					{/if}
				</Card>

				<!-- Chapter Content -->
				<Card class="p-8">
					<div
						bind:this={scrollContainer}
						class="prose max-w-none
							{fontSize === 'sm' ? 'text-sm' : ''}
							{fontSize === 'md' ? 'text-base' : ''}
							{fontSize === 'lg' ? 'text-lg' : ''}
							{fontSize === 'xl' ? 'text-xl' : ''}
							{fontFamily === 'serif' ? 'font-serif' : ''}
							{fontFamily === 'sans' ? 'font-sans' : ''}
							{fontFamily === 'mono' ? 'font-mono' : ''}
							{lineHeight === 'normal' ? 'leading-normal' : ''}
							{lineHeight === 'relaxed' ? 'leading-relaxed' : ''}
							{lineHeight === 'loose' ? 'leading-loose' : ''}"
					>
						{@html renderedContent}
					</div>
				</Card>

				<!-- Navigation -->
				<div class="flex justify-between items-center mt-8">
					<Button
						variant="outline"
						onclick={previousChapter}
						disabled={currentChapterIndex === 0}
					>
						← Previous
					</Button>

					<span class="text-sm text-muted-foreground">
						{currentChapterIndex + 1} / {book.chapters.length}
					</span>

					<Button
						variant="outline"
						onclick={nextChapter}
						disabled={currentChapterIndex === book.chapters.length - 1}
					>
						Next →
					</Button>
				</div>
			</div>
		</main>
	</div>

	<!-- Settings Panel -->
	{#if settingsStore.showSettings}
		<div
			class="fixed inset-0 bg-black/50 z-20"
			role="button"
			tabindex="0"
			onclick={() => (settingsStore.showSettings = false)}
			onkeydown={(e) => {
				if (e.key === 'Enter' || e.key === ' ') {
					e.preventDefault();
					settingsStore.showSettings = false;
				}
			}}
		></div>
		<div class="fixed right-0 top-0 h-full w-80 bg-card border-l z-30 overflow-y-auto">
			<div class="p-6">
				<div class="flex items-center justify-between mb-6">
					<h2 class="text-xl font-semibold">Settings</h2>
					<Button variant="outline" size="sm" onclick={() => (settingsStore.showSettings = false)}>
						Close
					</Button>
				</div>

				<div class="space-y-6">
					<!-- Font Size -->
					<div>
						<div class="text-sm font-medium block mb-2">Font Size</div>
						<div class="grid grid-cols-4 gap-2" role="group" aria-label="Font Size">
							{#each (['sm', 'md', 'lg', 'xl'] as const) as size}
								<Button
									variant={fontSize === size ? 'default' : 'outline'}
									size="sm"
									onclick={() => settingsStore.setFontSize(size)}
								>
									{size.toUpperCase()}
								</Button>
							{/each}
						</div>
					</div>

					<!-- Font Family -->
					<div>
						<div class="text-sm font-medium block mb-2">Font Family</div>
						<div class="space-y-2" role="group" aria-label="Font Family">
							{#each [
								{ value: 'serif' as const, label: 'Serif' },
								{ value: 'sans' as const, label: 'Sans-serif' },
								{ value: 'mono' as const, label: 'Monospace' }
							] as font}
								<Button
									variant={fontFamily === font.value ? 'default' : 'outline'}
									class="w-full"
									size="sm"
									onclick={() => settingsStore.setFontFamily(font.value)}
								>
									{font.label}
								</Button>
							{/each}
						</div>
					</div>

					<!-- Line Height -->
					<div>
						<div class="text-sm font-medium block mb-2">Line Height</div>
						<div class="space-y-2" role="group" aria-label="Line Height">
							{#each [
								{ value: 'normal' as const, label: 'Normal' },
								{ value: 'relaxed' as const, label: 'Relaxed' },
								{ value: 'loose' as const, label: 'Loose' }
							] as height}
								<Button
									variant={lineHeight === height.value ? 'default' : 'outline'}
									class="w-full"
									size="sm"
									onclick={() => settingsStore.setLineHeight(height.value)}
								>
									{height.label}
								</Button>
							{/each}
						</div>
					</div>

					<!-- Theme -->
					<div>
						<div class="text-sm font-medium block mb-2">Theme</div>
						<div class="space-y-2" role="group" aria-label="Theme">
							{#each [
								{ value: 'light' as const, label: 'Light' },
								{ value: 'dark' as const, label: 'Dark' },
								{ value: 'system' as const, label: 'System' }
							] as themeOption}
								<Button
									variant={theme === themeOption.value ? 'default' : 'outline'}
									class="w-full"
									size="sm"
									onclick={() => settingsStore.setTheme(themeOption.value)}
								>
									{themeOption.label}
								</Button>
							{/each}
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>
