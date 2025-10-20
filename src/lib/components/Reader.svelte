<script lang="ts">
	// @ts-ignore - markdown-it types issue
	import MarkdownIt from 'markdown-it';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
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
			scrollPosition?: number;
		} | null;
	}

	interface Heading {
		id: string;
		text: string;
		level: number;
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

	// Custom heading renderer to add IDs
	const defaultHeadingRender = md.renderer.rules.heading_open || function(tokens: any, idx: number, options: any, env: any, self: any) {
		return self.renderToken(tokens, idx, options);
	};

	md.renderer.rules.heading_open = function (tokens: any, idx: number, options: any, env: any, self: any) {
		const token = tokens[idx];
		const contentToken = tokens[idx + 1];
		const headingText = contentToken.content;
		
		// Create a slug from the heading text
		const slug = headingText
			.toLowerCase()
			.replace(/[^\w\s-]/g, '')
			.replace(/\s+/g, '-')
			.replace(/--+/g, '-')
			.trim();
		
		const headingId = `heading-${slug}-${idx}`;
		token.attrPush(['id', headingId]);
		
		return defaultHeadingRender(tokens, idx, options, env, self);
	};

	// Custom table renderer to wrap tables in a scrollable container
	const defaultTableOpen = md.renderer.rules.table_open || function(tokens: any, idx: number, options: any, env: any, self: any) {
		return self.renderToken(tokens, idx, options);
	};

	const defaultTableClose = md.renderer.rules.table_close || function(tokens: any, idx: number, options: any, env: any, self: any) {
		return self.renderToken(tokens, idx, options);
	};

	md.renderer.rules.table_open = function (tokens: any, idx: number, options: any, env: any, self: any) {
		// Wrap table in a scrollable container with visual indicators
		return '<div class="table-wrapper"><div class="table-scroll-container">' + defaultTableOpen(tokens, idx, options, env, self);
	};

	md.renderer.rules.table_close = function (tokens: any, idx: number, options: any, env: any, self: any) {
		return defaultTableClose(tokens, idx, options, env, self) + '</div></div>';
	};

	// Extract headings from markdown content
	function extractHeadings(content: string): Heading[] {
		const headings: Heading[] = [];
		const tokens = md.parse(content, {});
		
		for (let i = 0; i < tokens.length; i++) {
			const token = tokens[i];
			if (token.type === 'heading_open') {
				const level = parseInt(token.tag.substring(1)); // h1 -> 1, h2 -> 2, etc.
				const contentToken = tokens[i + 1];
				const text = contentToken.content;
				
				// Generate same ID as renderer
				const slug = text
					.toLowerCase()
					.replace(/[^\w\s-]/g, '')
					.replace(/\s+/g, '-')
					.replace(/--+/g, '-')
					.trim();
				
				const id = `heading-${slug}-${i}`;
				headings.push({ id, text, level });
			}
		}
		
		return headings;
	}

	// Find initial chapter from URL parameter, progress, or default to first chapter
	let initialChapterIndex = 0;
	
	// Check for chapter parameter in URL first
	const chapterParam = $page.url.searchParams.get('chapter');
	if (chapterParam) {
		const foundIndex = book.chapters.findIndex(ch => ch.id === chapterParam);
		if (foundIndex !== -1) {
			initialChapterIndex = foundIndex;
		}
	} else if (initialProgress?.currentChapterId) {
		// Fall back to saved progress
		const foundIndex = book.chapters.findIndex(ch => ch.id === initialProgress.currentChapterId);
		if (foundIndex !== -1) {
			initialChapterIndex = foundIndex;
		}
	}

	// Extract search query from URL
	const searchQueryParam = $page.url.searchParams.get('search');
	let searchTerm = $state<string | undefined>(searchQueryParam || undefined);
	let searchMatches = $state<Array<{index: number, element: HTMLElement}>>([]);
	let currentMatchIndex = $state(0);
	let contentContainer = $state<HTMLElement | undefined>(undefined);

	let currentChapterIndex = $state(initialChapterIndex);
	let scrollContainer = $state<HTMLElement | undefined>(undefined);
	let showTOC = $state(false);
	let savingProgress = $state(false);
	let expandedChapters = $state<Set<number>>(new Set([initialChapterIndex]));
	let mouseX = $state(0);
	let isMouseInLeftZone = $derived(mouseX > 0 && mouseX < 100);
	let isMouseInRightZone = $derived(mouseX > 0 && mouseX > (typeof window !== 'undefined' ? window.innerWidth - 100 : 0));
	
	// Scroll tracking for progress indicator
	let scrollProgress = $state(0);
	let headingPositions = $state<Array<{id: string, position: number, text: string}>>([]);
	let isDraggingProgress = $state(false);
	let progressDragStartY = $state(0);
	let progressDragStartScroll = $state(0);
	
	// Auto-save debouncing
	let saveTimeout: NodeJS.Timeout | null = null;
	
	// TOC custom scrollbar
	let tocContainer = $state<HTMLElement | undefined>(undefined);
	let tocScrollProgress = $state(0);
	let isDraggingToc = $state(false);
	let dragStartY = $state(0);
	let dragStartScroll = $state(0);
	
	// Visual feedback for scroll position restoration
	let showRestoreNotification = $state(false);

	let currentChapter = $derived(book.chapters[currentChapterIndex]);
	let renderedContent = $derived(
		currentChapter ? md.render(currentChapter.content) : ''
	);
	let currentHeadings = $derived(
		currentChapter ? extractHeadings(currentChapter.content) : []
	);

	// Initialize settings store and scroll tracking
	onMount(() => {
		settingsStore.init();
		
		// Set up scroll tracking for mini-map
		const updateScrollProgress = () => {
			if (scrollContainer) {
				const { scrollTop, scrollHeight, clientHeight } = scrollContainer;
				const maxScroll = scrollHeight - clientHeight;
				scrollProgress = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;
				
				// Update heading positions
				updateHeadingPositions();
				
				// Trigger debounced save
				saveProgress(false);
			}
		};
		
		if (scrollContainer) {
			scrollContainer.addEventListener('scroll', updateScrollProgress);
			updateScrollProgress(); // Initial calculation
			
		// Restore scroll position if available
		if (initialProgress?.scrollPosition && initialProgress.scrollPosition > 0) {
			// More robust restoration mechanism that waits for content to be fully rendered
			const restoreScrollPosition = () => {
				if (scrollContainer && initialProgress.scrollPosition) {
					const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
					if (maxScroll > 0) {
						const targetPosition = Math.min(initialProgress.scrollPosition, maxScroll);
						scrollContainer.scrollTop = targetPosition;
						console.log('Scroll position restored to:', targetPosition);
						
						// Show visual feedback
						showRestoreNotification = true;
						setTimeout(() => {
							showRestoreNotification = false;
						}, 3000);
						
						return true;
					}
				}
				return false;
			};

			// Try immediate restoration
			if (!restoreScrollPosition()) {
				// If content isn't ready, use multiple attempts with increasing delays
				let attempts = 0;
				const maxAttempts = 10;
				const attemptRestore = () => {
					attempts++;
					if (restoreScrollPosition() || attempts >= maxAttempts) {
						return;
					}
					// Exponential backoff: 50ms, 100ms, 200ms, 400ms, etc.
					setTimeout(attemptRestore, Math.min(50 * Math.pow(2, attempts - 1), 1000));
				};
				setTimeout(attemptRestore, 50);
			}
		}
		}
		
		// Set up TOC scroll tracking
		if (tocContainer) {
			tocContainer.addEventListener('scroll', updateTocScrollProgress);
			updateTocScrollProgress(); // Initial calculation
		}
		
		// Add page unload handler to save progress immediately
		const handleBeforeUnload = () => {
			saveProgress(true);
		};
		window.addEventListener('beforeunload', handleBeforeUnload);
		
		// Trigger search if search query exists
		if (searchTerm && contentContainer) {
			// Wait for content to be fully rendered before searching
			setTimeout(() => {
				findAndHighlightMatches();
				if (searchMatches.length > 0) {
					// Scroll to first match after a brief delay
					setTimeout(() => scrollToMatch(0), 100);
				}
			}, 300);
		}
		
		// Cleanup
		return () => {
			if (scrollContainer) {
				scrollContainer.removeEventListener('scroll', updateScrollProgress);
			}
			if (tocContainer) {
				tocContainer.removeEventListener('scroll', updateTocScrollProgress);
			}
			window.removeEventListener('beforeunload', handleBeforeUnload);
			if (saveTimeout) {
				clearTimeout(saveTimeout);
			}
			// Clear search highlights on unmount
			clearHighlights();
		};
	});

	async function saveProgress(immediate = false) {
		if (savingProgress) return;

		// Clear any pending timeout if this is an immediate save
		if (immediate && saveTimeout) {
			clearTimeout(saveTimeout);
			saveTimeout = null;
		}

		// If not immediate, debounce the save
		if (!immediate) {
			if (saveTimeout) {
				clearTimeout(saveTimeout);
			}
			saveTimeout = setTimeout(() => saveProgress(true), 3000); // Save after 3 seconds of inactivity
			return;
		}

		savingProgress = true;
		try {
			const scrollPosition = scrollContainer?.scrollTop || 0;
			
			// Enhanced progress calculation that includes scroll position within current chapter
			let progressPercent = 0;
			if (book.chapters.length > 0) {
				// Base progress from completed chapters
				const completedChaptersProgress = (currentChapterIndex / book.chapters.length) * 100;
				
				// Additional progress from scroll position within current chapter
				if (scrollContainer) {
					const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
					if (maxScroll > 0) {
						const chapterProgress = (scrollPosition / maxScroll) / book.chapters.length * 100;
						progressPercent = completedChaptersProgress + chapterProgress;
					} else {
						progressPercent = completedChaptersProgress;
					}
				} else {
					progressPercent = completedChaptersProgress;
				}
			}
			
			console.log('Saving progress:', { 
				chapter: currentChapter.title, 
				progress: progressPercent.toFixed(1) + '%', 
				scrollPosition,
				chapterProgress: currentChapterIndex + 1 + '/' + book.chapters.length
			});
			await fetch(`/api/books/${book.id}/progress`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					currentChapterId: currentChapter.id,
					progress: progressPercent,
					scrollPosition
				})
			});
			console.log('Progress saved successfully');
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
			saveProgress(true); // Immediate save on chapter change
			// Update heading positions after chapter change
			setTimeout(() => updateHeadingPositions(), 100);
			// Re-run search if active
			if (searchTerm) {
				setTimeout(() => findAndHighlightMatches(), 200);
			}
		}
	}

	function nextChapter() {
		if (currentChapterIndex < book.chapters.length - 1) {
			currentChapterIndex++;
			scrollToTop();
			saveProgress(true); // Immediate save on chapter change
			// Update heading positions after chapter change
			setTimeout(() => updateHeadingPositions(), 100);
			// Re-run search if active
			if (searchTerm) {
				setTimeout(() => findAndHighlightMatches(), 200);
			}
		}
	}

	function goToChapter(index: number) {
		currentChapterIndex = index;
		showTOC = false;
		scrollToTop();
		saveProgress(true); // Immediate save on chapter change
		// Update heading positions after chapter change
		setTimeout(() => updateHeadingPositions(), 100);
		// Re-run search if active
		if (searchTerm) {
			setTimeout(() => findAndHighlightMatches(), 200);
		}
	}

	function toggleChapter(index: number) {
		const newExpanded = new Set(expandedChapters);
		if (newExpanded.has(index)) {
			newExpanded.delete(index);
		} else {
			newExpanded.add(index);
		}
		expandedChapters = newExpanded;
	}

	function scrollToHeading(headingId: string) {
		if (scrollContainer) {
			const element = scrollContainer.querySelector(`#${headingId}`) as HTMLElement | null;
			if (element) {
				element.scrollIntoView({ behavior: 'smooth', block: 'start' });
			}
		}
	}

	function scrollToTop() {
		if (scrollContainer) {
			scrollContainer.scrollTo({ top: 0, behavior: 'smooth' });
		}
	}

	function updateHeadingPositions() {
		if (!scrollContainer) return;
		
		const container = scrollContainer; // Store reference for type narrowing
		const { scrollHeight, clientHeight } = container;
		const maxScroll = scrollHeight - clientHeight;
		
		headingPositions = currentHeadings.map(heading => {
			const element = container.querySelector(`#${heading.id}`) as HTMLElement | null;
			if (element) {
				const rect = element.getBoundingClientRect();
				const containerRect = container.getBoundingClientRect();
				const relativeTop = rect.top - containerRect.top + container.scrollTop;
				const position = maxScroll > 0 ? (relativeTop / maxScroll) * 100 : 0;
				return {
					id: heading.id,
					position: Math.max(0, Math.min(100, position)),
					text: heading.text
				};
			}
			return { id: heading.id, position: 0, text: heading.text };
		});
	}

	function updateTocScrollProgress() {
		if (!tocContainer) return;
		
		const { scrollTop, scrollHeight, clientHeight } = tocContainer;
		const maxScroll = scrollHeight - clientHeight;
		tocScrollProgress = maxScroll > 0 ? (scrollTop / maxScroll) * 100 : 0;
	}

	function handleTocScrollbarMouseDown(e: MouseEvent) {
		if (!tocContainer) return;
		
		isDraggingToc = true;
		dragStartY = e.clientY;
		dragStartScroll = tocContainer.scrollTop;
		
		const handleMouseMove = (e: MouseEvent) => {
			if (!isDraggingToc || !tocContainer) return;
			
			const deltaY = e.clientY - dragStartY;
			const trackHeight = tocContainer.clientHeight;
			const scrollHeight = tocContainer.scrollHeight;
			const maxScroll = scrollHeight - trackHeight;
			
			const scrollDelta = (deltaY / trackHeight) * maxScroll;
			const newScrollTop = Math.max(0, Math.min(maxScroll, dragStartScroll + scrollDelta));
			
			tocContainer.scrollTop = newScrollTop;
		};
		
		const handleMouseUp = () => {
			isDraggingToc = false;
			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('mouseup', handleMouseUp);
		};
		
		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	}

	function handleTocTrackClick(e: MouseEvent) {
		if (!tocContainer) return;
		
		const track = e.currentTarget as HTMLElement;
		const rect = track.getBoundingClientRect();
		const clickY = e.clientY - rect.top;
		const percentage = clickY / rect.height;
		
		const maxScroll = tocContainer.scrollHeight - tocContainer.clientHeight;
		tocContainer.scrollTop = percentage * maxScroll;
	}

	function handleProgressScrollbarMouseDown(e: MouseEvent) {
		if (!scrollContainer) return;
		
		isDraggingProgress = true;
		progressDragStartY = e.clientY;
		progressDragStartScroll = scrollContainer.scrollTop;
		
		const handleMouseMove = (e: MouseEvent) => {
			if (!isDraggingProgress || !scrollContainer) return;
			
			const deltaY = e.clientY - progressDragStartY;
			const trackHeight = 300; // Height of progress container
			const scrollHeight = scrollContainer.scrollHeight;
			const clientHeight = scrollContainer.clientHeight;
			const maxScroll = scrollHeight - clientHeight;
			
			const scrollDelta = (deltaY / trackHeight) * maxScroll;
			const newScrollTop = Math.max(0, Math.min(maxScroll, progressDragStartScroll + scrollDelta));
			
			scrollContainer.scrollTop = newScrollTop;
		};
		
		const handleMouseUp = () => {
			isDraggingProgress = false;
			document.removeEventListener('mousemove', handleMouseMove);
			document.removeEventListener('mouseup', handleMouseUp);
		};
		
		document.addEventListener('mousemove', handleMouseMove);
		document.addEventListener('mouseup', handleMouseUp);
	}

	function handleProgressTrackClick(e: MouseEvent) {
		if (!scrollContainer) return;
		
		const track = e.currentTarget as HTMLElement;
		const rect = track.getBoundingClientRect();
		const clickY = e.clientY - rect.top;
		const percentage = clickY / rect.height;
		
		const maxScroll = scrollContainer.scrollHeight - scrollContainer.clientHeight;
		scrollContainer.scrollTop = percentage * maxScroll;
	}

	function handleMouseMove(e: MouseEvent) {
		mouseX = e.clientX;
	}

	// Search functionality
	function extractTextFromQuery(query: string): string {
		// Remove advanced search syntax (format:, year:, etc.) to get pure text
		return query
			.replace(/\b(format|year|author|tag|language|contentType|isbn|publisher|pages|size|added|uploaddate):[^\s]+/gi, '')
			.replace(/["\-]/g, '')
			.trim();
	}

	function findAndHighlightMatches() {
		if (!contentContainer || !searchTerm) {
			searchMatches = [];
			return;
		}

		// Clear previous highlights
		clearHighlights();

		const searchText = extractTextFromQuery(searchTerm).toLowerCase();
		if (!searchText) {
			searchMatches = [];
			return;
		}

		const matches: Array<{index: number, element: HTMLElement}> = [];
		let matchIndex = 0;

		// Function to search and highlight in text nodes
		const searchInNode = (node: Node) => {
			if (node.nodeType === Node.TEXT_NODE) {
				const text = node.textContent || '';
				const lowerText = text.toLowerCase();
				let startIndex = 0;

				while (true) {
					const index = lowerText.indexOf(searchText, startIndex);
					if (index === -1) break;

					// Create a mark element for this match
					const range = document.createRange();
					range.setStart(node, index);
					range.setEnd(node, index + searchText.length);

					const mark = document.createElement('mark');
					mark.className = 'search-highlight';
					mark.setAttribute('data-match-index', matchIndex.toString());
					
					try {
						range.surroundContents(mark);
						matches.push({ index: matchIndex, element: mark });
						matchIndex++;
						
						// Move to the next potential match
						node = mark.nextSibling || node;
						startIndex = 0;
					} catch (e) {
						// If surroundContents fails (e.g., range spans multiple elements), skip
						startIndex = index + searchText.length;
					}
				}
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				// Skip script and style elements
				const element = node as HTMLElement;
				if (element.tagName !== 'SCRIPT' && element.tagName !== 'STYLE' && 
					!element.classList.contains('search-highlight')) {
					// Recursively search child nodes
					const children = Array.from(node.childNodes);
					children.forEach(child => searchInNode(child));
				}
			}
		};

		searchInNode(contentContainer);
		searchMatches = matches;
		currentMatchIndex = 0;

		// Highlight the first match
		if (matches.length > 0) {
			updateCurrentMatch();
		}
	}

	function clearHighlights() {
		if (!contentContainer) return;

		const highlights = contentContainer.querySelectorAll('.search-highlight');
		highlights.forEach(mark => {
			const parent = mark.parentNode;
			if (parent) {
				// Replace mark with its text content
				const textNode = document.createTextNode(mark.textContent || '');
				parent.replaceChild(textNode, mark);
				// Normalize to merge adjacent text nodes
				parent.normalize();
			}
		});
	}

	function updateCurrentMatch() {
		if (searchMatches.length === 0) return;

		// Remove 'current' class from all matches
		searchMatches.forEach(match => {
			match.element.classList.remove('current');
		});

		// Add 'current' class to current match
		if (searchMatches[currentMatchIndex]) {
			searchMatches[currentMatchIndex].element.classList.add('current');
		}
	}

	function scrollToMatch(index: number) {
		if (index < 0 || index >= searchMatches.length) return;

		currentMatchIndex = index;
		updateCurrentMatch();

		const match = searchMatches[index];
		if (match && match.element) {
			match.element.scrollIntoView({ 
				behavior: 'smooth', 
				block: 'center' 
			});
		}
	}

	function nextMatch() {
		if (searchMatches.length === 0) return;
		const nextIndex = (currentMatchIndex + 1) % searchMatches.length;
		scrollToMatch(nextIndex);
	}

	function previousMatch() {
		if (searchMatches.length === 0) return;
		const prevIndex = currentMatchIndex === 0 ? searchMatches.length - 1 : currentMatchIndex - 1;
		scrollToMatch(prevIndex);
	}

	function clearSearch() {
		searchTerm = undefined;
		clearHighlights();
		searchMatches = [];
		currentMatchIndex = 0;
		
		// Remove search parameter from URL
		const url = new URL(window.location.href);
		url.searchParams.delete('search');
		window.history.replaceState({}, '', url.toString());
	}

	let fontSize = $derived(settingsStore.settings.fontSize);
	let fontFamily = $derived(settingsStore.settings.fontFamily);
	let lineHeight = $derived(settingsStore.settings.lineHeight);
	let theme = $derived(settingsStore.settings.theme);
</script>

<div class="h-screen overflow-hidden bg-background flex flex-col">
	<!-- Header -->
	<header class="border-b bg-card z-10 flex-shrink-0">
		<div class="max-w-5xl mx-auto px-4 py-4">
			<div class="flex items-center justify-between gap-4">
				<Button variant="outline" size="sm" onclick={() => goto('/')}>
					← Library
				</Button>
				
				<div class="flex-1 flex items-center justify-center gap-3 min-w-0">
					<h1 class="text-lg font-semibold truncate">{book.title}</h1>
					{#if book.author}
						<span class="text-muted-foreground">•</span>
						<p class="text-sm text-muted-foreground truncate">{book.author}</p>
					{/if}
				</div>

				<div class="flex items-center gap-2">
					<Button variant="outline" size="sm" onclick={() => (showTOC = !showTOC)}>
						Chapters
					</Button>
					<Button variant="outline" size="sm" onclick={() => (settingsStore.showSettings = !settingsStore.showSettings)}>
						Settings
					</Button>
				</div>
			</div>
		</div>
	</header>

	<!-- Search Toolbar -->
	{#if searchTerm}
		<div class="border-b bg-card z-10 flex-shrink-0">
			<div class="max-w-5xl mx-auto px-4 py-3">
				<div class="flex items-center justify-between gap-4">
					<div class="flex items-center gap-3">
						<svg class="w-5 h-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
						</svg>
						<span class="text-sm font-medium">
							Searching for: <span class="text-primary">{extractTextFromQuery(searchTerm)}</span>
						</span>
						<span class="text-sm text-muted-foreground">
							{searchMatches.length} {searchMatches.length === 1 ? 'match' : 'matches'}
							{#if searchMatches.length > 0}
								<span class="ml-1">({currentMatchIndex + 1}/{searchMatches.length})</span>
							{/if}
						</span>
					</div>
					<div class="flex items-center gap-2">
						<Button 
							variant="outline" 
							size="sm" 
							onclick={previousMatch} 
							disabled={searchMatches.length === 0}
						>
							↑ Previous
						</Button>
						<Button 
							variant="outline" 
							size="sm" 
							onclick={nextMatch} 
							disabled={searchMatches.length === 0}
						>
							↓ Next
						</Button>
						<Button 
							variant="outline" 
							size="sm" 
							onclick={clearSearch}
						>
							✕ Clear
						</Button>
					</div>
				</div>
			</div>
		</div>
	{/if}

	<!-- Scroll Position Restore Notification -->
	{#if showRestoreNotification}
		<div class="fixed top-20 left-1/2 transform -translate-x-1/2 z-50 bg-primary text-primary-foreground px-4 py-2 rounded-lg shadow-lg transition-all duration-300">
			<div class="flex items-center gap-2">
				<svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
					<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
				</svg>
				<span class="text-sm font-medium">Resuming from where you left off</span>
			</div>
		</div>
	{/if}

	<div class="flex flex-1 overflow-hidden relative">
		<!-- Backdrop for overlay panels -->
		{#if showTOC || settingsStore.showSettings}
			<div 
				class="fixed inset-0 bg-black/50 z-20 transition-opacity duration-300"
				onclick={() => {
					showTOC = false;
					settingsStore.showSettings = false;
				}}
				onkeydown={(e) => {
					if (e.key === 'Escape') {
						showTOC = false;
						settingsStore.showSettings = false;
					}
				}}
				role="button"
				tabindex="0"
				aria-label="Close panel"
			></div>
		{/if}

		<!-- Table of Contents - Overlay Panel -->
		{#if showTOC}
			<aside class="fixed left-0 top-16 bottom-0 w-80 border-r shadow-2xl overflow-y-auto toc-scroll z-30 transform transition-transform duration-300 relative" style="background-color: hsl(var(--card));" bind:this={tocContainer}>
				<div class="p-6">
					<div class="flex items-center justify-between mb-6">
						<h2 class="text-xl font-semibold">Chapters</h2>
						<Button variant="outline" size="sm" onclick={() => (showTOC = false)}>
							Close
						</Button>
					</div>
					<nav class="space-y-1">
						{#each book.chapters as chapter, index}
							{@const headings = extractHeadings(chapter.content)}
							{@const isExpanded = expandedChapters.has(index)}
							{@const isCurrent = index === currentChapterIndex}
							
							<div>
								<div class="flex items-start gap-1">
									{#if headings.length > 0}
										<button
											onclick={(e) => {
												e.stopPropagation();
												toggleChapter(index);
											}}
											class="mt-2 text-xs hover:text-primary transition-colors"
											aria-label={isExpanded ? 'Collapse' : 'Expand'}
										>
											{isExpanded ? '▼' : '▶'}
										</button>
									{:else}
										<div class="w-4"></div>
									{/if}
									<button
										onclick={() => goToChapter(index)}
										class="flex-1 text-left px-3 py-2 rounded-lg text-sm transition-colors {isCurrent
											? 'bg-primary text-primary-foreground'
											: 'hover:bg-muted'}"
									>
										<div class="font-medium truncate">{chapter.title}</div>
									</button>
								</div>
								
								{#if isExpanded && headings.length > 0 && isCurrent}
									<div class="ml-5 mt-1 space-y-1">
										{#each headings as heading}
											<button
												onclick={() => scrollToHeading(heading.id)}
												class="w-full text-left px-3 py-1.5 rounded text-xs hover:bg-muted transition-colors"
												style="padding-left: {(heading.level - 1) * 0.75 + 0.75}rem"
											>
												{heading.text}
											</button>
										{/each}
									</div>
								{/if}
							</div>
						{/each}
					</nav>
				</div>
				
				<!-- Custom draggable scrollbar -->
				<div class="toc-custom-scrollbar">
					<div class="toc-scrollbar-track" onclick={handleTocTrackClick}>
						<div 
							class="toc-scrollbar-thumb {isDraggingToc ? 'dragging' : ''}"
							style="top: {tocScrollProgress}%; height: {Math.max(20, (tocContainer?.clientHeight || 0) / (tocContainer?.scrollHeight || 1) * 100)}%"
							onmousedown={handleTocScrollbarMouseDown}
						></div>
					</div>
				</div>
			</aside>
		{/if}

		<!-- Main Content -->
		<main class="flex-1 overflow-y-auto reader-scroll" bind:this={scrollContainer} onmousemove={handleMouseMove}>
			<div class="w-full px-6 py-8 pb-24">
				<!-- Chapter Title -->
				<div class="max-w-4xl mx-auto mb-6">
					<Card class="p-6">
						<h2 class="text-2xl font-bold mb-2">{currentChapter.title}</h2>
						<p class="text-sm text-muted-foreground">
							Chapter {currentChapterIndex + 1} of {book.chapters.length}
						</p>
						{#if savingProgress}
							<p class="text-xs text-muted-foreground mt-2">Saving progress...</p>
						{/if}
					</Card>
				</div>

				<!-- Chapter Content -->
				<div class="w-full">
					<Card class="p-8">
						<div
							bind:this={contentContainer}
							class="prose-reading
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
				</div>
			</div>
		</main>

		<!-- Settings Panel - Overlay -->
		{#if settingsStore.showSettings}
			<aside class="fixed right-0 top-16 bottom-0 w-80 border-l shadow-2xl overflow-y-auto z-30 transform transition-transform duration-300" style="background-color: hsl(var(--card));">
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
			</aside>
		{/if}
	</div>

	<!-- Scrollable Progress Indicator -->
	<div class="scroll-progress-container">
		<div class="scroll-progress-track" onclick={handleProgressTrackClick}>
			<div 
				class="scroll-progress-thumb {isDraggingProgress ? 'dragging' : ''}"
				style="top: {scrollProgress}%; height: {Math.max(20, (scrollContainer?.clientHeight || 0) / (scrollContainer?.scrollHeight || 1) * 100)}%"
				onmousedown={handleProgressScrollbarMouseDown}
			></div>
			{#each headingPositions as heading}
				<div 
					class="scroll-progress-heading" 
					style="top: {heading.position}%"
					onclick={() => scrollToHeading(heading.id)}
					title={heading.text}
				></div>
			{/each}
		</div>
		<div class="scroll-progress-tooltip">
			{Math.round(scrollProgress)}%
		</div>
	</div>

	<!-- Side Navigation Buttons -->
	{#if currentChapterIndex > 0}
		<button
			onclick={previousChapter}
			class="fixed left-4 top-1/2 -translate-y-1/2 z-20 bg-card/60 backdrop-blur-md hover:bg-card/90 border rounded-full p-4 transition-all duration-300 {isMouseInLeftZone ? 'opacity-100 scale-110' : 'opacity-30 hover:opacity-100'}"
			aria-label="Previous Chapter"
		>
			<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"/>
			</svg>
		</button>
	{/if}

	{#if currentChapterIndex < book.chapters.length - 1}
		<button
			onclick={nextChapter}
			class="fixed right-4 top-1/2 -translate-y-1/2 z-20 bg-card/60 backdrop-blur-md hover:bg-card/90 border rounded-full p-4 transition-all duration-300 {isMouseInRightZone ? 'opacity-100 scale-110' : 'opacity-30 hover:opacity-100'}"
			aria-label="Next Chapter"
		>
			<svg class="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
			</svg>
		</button>
	{/if}

	<!-- Navigation - Fixed to Bottom -->
	<div class="fixed bottom-0 left-0 right-0 bg-card/80 backdrop-blur-md border-t z-10">
		<div class="max-w-3xl mx-auto px-6 py-4">
			<div class="flex justify-between items-center">
				<Button
					variant={currentChapterIndex === 0 ? 'outline' : 'default'}
					onclick={previousChapter}
					disabled={currentChapterIndex === 0}
					class="min-w-[100px]"
				>
					← Previous
				</Button>

				<span class="text-sm text-muted-foreground font-medium">
					{currentChapterIndex + 1} / {book.chapters.length}
				</span>

				<Button
					variant={currentChapterIndex === book.chapters.length - 1 ? 'outline' : 'default'}
					onclick={nextChapter}
					disabled={currentChapterIndex === book.chapters.length - 1}
					class="min-w-[100px]"
				>
					Next →
				</Button>
			</div>
		</div>
	</div>

</div>

<style>
	/* Search highlight styling */
	:global(.search-highlight) {
		background-color: #fef08a; /* yellow-200 */
		padding: 2px 4px;
		border-radius: 3px;
		transition: background-color 0.2s ease;
	}

	:global(.search-highlight.current) {
		background-color: #fb923c; /* orange-400 */
		font-weight: 600;
		box-shadow: 0 0 0 2px rgba(251, 146, 60, 0.3);
	}

	:global(.dark .search-highlight) {
		background-color: #713f12; /* yellow-900 */
		color: #fef9c3; /* yellow-100 */
	}

	:global(.dark .search-highlight.current) {
		background-color: #ea580c; /* orange-600 */
		color: #fff;
		box-shadow: 0 0 0 2px rgba(234, 88, 12, 0.3);
	}
</style>
