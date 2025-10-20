<script lang="ts">
	import '../../app.css';
	import favicon from '$lib/assets/favicon.svg';
	import UserCard from '$lib/components/UserCard.svelte';
	
	let { children, data } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<header class="border-b bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/60 sticky top-0 z-40">
    <div class="max-w-7xl mx-auto px-6 py-4">
        <div class="flex items-center justify-between">
            <!-- App Title -->
            <div class="flex items-center gap-8">
                <div>
                    <h1 class="text-2xl font-bold text-foreground">PageDrift</h1>
                    <p class="text-xs text-muted-foreground">Shared book library</p>
                </div>
                
                <!-- Navigation Links -->
                <nav class="flex items-center gap-6">
                    <a href="/" class="text-sm font-medium text-foreground hover:text-primary transition-colors">
                        Library
                    </a>
                    <a href="/search" class="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                        Search
                    </a>
                    {#if data.user.role === 'admin' || data.user.canUpload}
                        <a href="/upload" class="text-sm font-medium text-muted-foreground hover:text-primary transition-colors">
                            Upload
                        </a>
                    {/if}
                </nav>
            </div>
        </div>
    </div>
</header>

{@render children?.()}

<!-- Floating User Card - Available on all pages -->
<UserCard user={data.user} />

