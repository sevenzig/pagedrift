<script lang="ts">
    import type { PageData } from './$types';
    import Button from '$lib/components/ui/Button.svelte';
    import Card from '$lib/components/ui/Card.svelte';
    import SearchSyntaxModal from '$lib/components/SearchSyntaxModal.svelte';
    import { goto } from '$app/navigation';
    import { hasAdvancedSyntax, describeFilters } from '$lib/utils/search-parser';

    let { data }: { data: PageData } = $props();

    let q = $state(data.q || '');
    let scope = $state<'metadata' | 'fulltext' | 'both'>((data as any).scope || 'both');
    let showSyntaxModal = $state(false);
    let searchInput: HTMLInputElement | undefined;

    function updateQuery() {
        const params = new URLSearchParams();
        if (q) params.set('q', q);
        if (scope) params.set('scope', scope);
        window.location.search = params.toString();
    }
    
    function highlightText(text: string): string {
        if (!text) return '';
        return text.replace(/<em>/g, '<mark class="bg-yellow-200">').replace(/<\/em>/g, '</mark>');
    }

    function safeHtml(html: string): string {
        if (!html) return '';
        try {
            // Basic HTML sanitization - in production, use a proper sanitization library
            return html
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
                .replace(/on\w+="[^"]*"/gi, '')
                // Strip internal anchor links but preserve their text content
                .replace(/<a\s+href="#[^"]*">([^<]*)<\/a>/gi, '$1');
        } catch (error) {
            console.error('HTML sanitization error:', error);
            return html.replace(/<[^>]*>/g, ''); // Strip all HTML tags as fallback
        }
    }

    function renderHighlightedText(text: string | undefined | null): string {
        if (!text) return '';
        try {
            return safeHtml(highlightText(text));
        } catch (error) {
            console.error('Text highlighting error:', error);
            return text;
        }
    }

    function getFormattedOrDefault(formatted: any, fallback: any, field: string): string {
        try {
            return formatted?.[field] || fallback || '';
        } catch (error) {
            return fallback || '';
        }
    }

    function navigateToBook(bookId: string, chapterId?: string, searchQuery?: string) {
        const params = new URLSearchParams();
        if (chapterId) params.set('chapter', chapterId);
        if (searchQuery) params.set('search', searchQuery);
        
        if (params.toString()) {
            goto(`/reader/${bookId}?${params.toString()}`);
        } else {
            goto(`/reader/${bookId}`);
        }
    }

    function formatDate(dateString: string): string {
        try {
            return new Date(dateString).toLocaleDateString();
        } catch {
            return dateString;
        }
    }

    function useExample(example: string) {
        q = example;
        updateQuery();
    }

    function useExampleFromModal(example: string) {
        q = example;
        showSyntaxModal = false;
        // Focus search input and trigger search
        setTimeout(() => {
            searchInput?.focus();
            updateQuery();
        }, 100);
    }
</script>

<svelte:head>
    <title>Search Library</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-b from-background to-muted/20">
    <!-- Hero Section with Search -->
    <div class="max-w-5xl mx-auto px-6 py-12">
        <div class="text-center mb-8">
            <h1 class="text-4xl font-bold mb-3 bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                Library Search
            </h1>
            <p class="text-muted-foreground text-lg">
                Search your collection using powerful filters and syntax
            </p>
        </div>

        <!-- Main Search Card -->
        <Card class="p-6 shadow-xl border-2">
            <!-- Search Input -->
            <div class="relative mb-4">
                <input
                    bind:this={searchInput}
                    type="text"
                    bind:value={q}
                    placeholder="Search your library..."
                    class="w-full px-6 py-4 text-lg border-2 border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-ring focus:border-ring transition-all bg-input text-foreground"
                    onkeydown={(e) => {
                        if (e.key === 'Enter') {
                            updateQuery();
                        }
                    }}
                />
                <div class="absolute right-3 top-1/2 -translate-y-1/2">
                    <svg class="w-6 h-6 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                    </svg>
                </div>
            </div>

            <!-- Search Options -->
            <div class="flex flex-wrap gap-3 items-center justify-between">
                <div class="flex gap-2">
                    <span class="text-sm font-medium text-muted-foreground self-center">Search in:</span>
                    <Button 
                        variant={scope === 'both' ? 'default' : 'outline'} 
                        size="sm"
                        onclick={() => (scope = 'both')}
                    >
                        Both
                    </Button>
                    <Button 
                        variant={scope === 'metadata' ? 'default' : 'outline'} 
                        size="sm"
                        onclick={() => (scope = 'metadata')}
                    >
                        Metadata
                    </Button>
                    <Button 
                        variant={scope === 'fulltext' ? 'default' : 'outline'} 
                        size="sm"
                        onclick={() => (scope = 'fulltext')}
                    >
                        Full Text
                    </Button>
                </div>
                
                <div class="flex gap-2">
                    <Button 
                        variant="outline" 
                        size="sm"
                        onclick={() => (showSyntaxModal = true)}
                    >
                        <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                        </svg>
                        Syntax Guide
                    </Button>
                    <Button onclick={updateQuery}>
                        <svg class="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                        </svg>
                        Search
                    </Button>
                </div>
            </div>

            <!-- Active Filters Display -->
            {#if data.results?.parsedQuery && hasAdvancedSyntax(q)}
                <div class="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                    <div class="flex items-start gap-2 text-sm">
                        <svg class="w-4 h-4 text-primary mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"/>
                        </svg>
                        <div class="flex-1">
                            <strong class="text-primary font-medium">Active filters:</strong>
                            <span class="text-foreground/80 ml-2">
                                {describeFilters(data.results.parsedQuery).join(' • ') || 'Text search only'}
                            </span>
                        </div>
                    </div>
                </div>
            {/if}
        </Card>

        <!-- Quick Tip -->
        {#if !data.results || (!data.results.metadata?.length && !data.results.fulltext?.length)}
            <div class="mt-6 text-center">
                <p class="text-sm text-muted-foreground">
                    <strong>Pro tip:</strong> Use filters like <code class="px-2 py-0.5 bg-muted rounded text-xs">format:epub</code>, 
                    <code class="px-2 py-0.5 bg-muted rounded text-xs">year:>2020</code>, or 
                    <code class="px-2 py-0.5 bg-muted rounded text-xs">tag:fiction</code> for advanced searches
                </p>
            </div>
        {/if}
    </div>

    <!-- Results Section -->
    <div class="max-w-7xl mx-auto px-6 pb-12">

        {#if data.error}
            <div class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                <p class="text-red-600 dark:text-red-400 text-center">{data.error}</p>
            </div>
        {/if}

        {#if data.results}
            <!-- Books Results -->
            {#if scope !== 'fulltext'}
                <section class="space-y-4 mb-8">
                    <div class="flex items-center gap-2">
                        <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                        </svg>
                        <h2 class="text-2xl font-bold">Books</h2>
                        {#if data.results.metadata?.length}
                            <span class="text-sm text-muted-foreground">({data.results.metadata.length} {data.results.metadata.length === 1 ? 'result' : 'results'})</span>
                        {/if}
                    </div>
                    
                    {#if data.results.metadata?.length}
                        <div class="grid gap-3">
                            {#each data.results.metadata as result}
                                <Card class="p-4 cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all" onclick={() => navigateToBook(result.id)}>
                                    <div class="flex gap-4">
                                        {#if result.coverImage}
                                            <img src={result.coverImage} alt={result.title} class="w-20 h-28 object-cover rounded shadow-sm" />
                                        {:else}
                                            <div class="w-20 h-28 bg-gradient-to-br from-muted to-muted/50 rounded shadow-sm flex items-center justify-center">
                                                <svg class="w-8 h-8 text-muted-foreground/50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                                                </svg>
                                            </div>
                                        {/if}
                                        <div class="flex-1 min-w-0">
                                            <h3 class="font-bold mb-1 text-lg leading-tight">{@html renderHighlightedText(getFormattedOrDefault(result._formatted, result.title, 'title'))}</h3>
                                            {#if result.author || result._formatted?.author}
                                                <p class="text-sm text-muted-foreground mb-3">by {@html renderHighlightedText(getFormattedOrDefault(result._formatted, result.author, 'author'))}</p>
                                            {/if}
                                            <div class="flex flex-wrap gap-2 text-xs">
                                                {#if result.format}
                                                    <span class="bg-primary/10 text-primary px-2.5 py-1 rounded-full font-medium">{result.format.toUpperCase()}</span>
                                                {/if}
                                                {#if result.uploadDate}
                                                    <span class="bg-muted text-muted-foreground px-2.5 py-1 rounded-full">Added {formatDate(result.uploadDate)}</span>
                                                {/if}
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            {/each}
                        </div>
                    {:else}
                        <div class="text-center py-12">
                            <svg class="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            <p class="text-muted-foreground">No books found matching your search</p>
                        </div>
                    {/if}
                </section>
            {/if}

            <!-- Full Text Results -->
            {#if scope !== 'metadata'}
                <section class="space-y-4">
                    <div class="flex items-center gap-2">
                        <svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                        </svg>
                        <h2 class="text-2xl font-bold">Full Text</h2>
                        {#if data.results.fulltext?.length}
                            <span class="text-sm text-muted-foreground">({data.results.fulltext.length} {data.results.fulltext.length === 1 ? 'result' : 'results'})</span>
                        {/if}
                    </div>
                    
                    {#if data.results.fulltext?.length}
                        <div class="grid gap-3">
                            {#each data.results.fulltext as result}
                                <Card class="p-4 cursor-pointer hover:shadow-lg hover:border-primary/50 transition-all" onclick={() => navigateToBook(result.bookId, result.id, q)}>
                                    <div class="space-y-2">
                                        <div class="flex items-start justify-between gap-4">
                                            <div class="flex-1 min-w-0">
                                                <h3 class="font-bold mb-1 leading-tight">{@html renderHighlightedText(getFormattedOrDefault(result._formatted, result.title, 'title'))}</h3>
                                                {#if result.bookTitle}
                                                    <p class="text-sm text-muted-foreground mb-2">from <span class="font-medium">{result.bookTitle}</span></p>
                                                {/if}
                                            </div>
                                            {#if result.order !== undefined}
                                                <span class="text-xs font-medium bg-primary/10 text-primary px-2.5 py-1 rounded-full whitespace-nowrap">Chapter {result.order + 1}</span>
                                            {/if}
                                        </div>
                                        <p class="text-sm text-foreground/70 line-clamp-3 leading-relaxed">{@html renderHighlightedText(getFormattedOrDefault(result._formatted, result.content, 'content'))}</p>
                                    </div>
                                </Card>
                            {/each}
                        </div>
                    {:else}
                        <div class="text-center py-12">
                            <svg class="w-16 h-16 mx-auto text-muted-foreground/50 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
                            </svg>
                            <p class="text-muted-foreground">No text content found matching your search</p>
                        </div>
                    {/if}
                </section>
            {/if}
        {/if}
    </div>
</div>

<!-- Syntax Reference Modal -->
<SearchSyntaxModal bind:isOpen={showSyntaxModal} onUseExample={useExampleFromModal} />
