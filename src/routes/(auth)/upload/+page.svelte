<script lang="ts">
    import UploadZone from '$lib/components/UploadZone.svelte';
    import UploadStaging from '$lib/components/UploadStaging.svelte';
    import { uploadQueue } from '$lib/stores/upload-queue.svelte';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();
    const hasFiles = $derived(uploadQueue.total > 0);
    const canUpload = data.user?.role === 'admin' || data.user?.canUpload;
</script>

<div class="max-w-full mx-auto px-6 py-8 space-y-6">
    {#if canUpload}
        {#if !hasFiles}
            <div class="max-w-3xl mx-auto">
                <h1 class="text-2xl font-semibold mb-6">Upload books</h1>
                <UploadZone />
            </div>
        {:else}
            <UploadStaging />
        {/if}
    {:else}
        <div class="max-w-3xl mx-auto text-center py-12">
            <div class="text-6xl mb-4">🔒</div>
            <h1 class="text-2xl font-semibold mb-4">Upload Permission Required</h1>
            <p class="text-muted-foreground mb-6">
                You don't have permission to upload books. Please contact an administrator to request upload access.
            </p>
            <a href="/" class="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                ← Back to Library
            </a>
        </div>
    {/if}
</div>


