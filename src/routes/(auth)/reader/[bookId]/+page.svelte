<script lang="ts">
	import Reader from '$lib/components/Reader.svelte';
	import type { PageData } from './$types';
	
	let { data }: { data: PageData } = $props();
</script>

<Reader book={data.book} initialProgress={data.progress} />

