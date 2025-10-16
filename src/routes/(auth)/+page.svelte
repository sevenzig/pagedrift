<script lang="ts">
	import Library from '$lib/components/Library.svelte';
	import type { PageData } from './$types';
	
	let { data }: { data: PageData } = $props();
</script>

<Library books={data.books} user={data.user} />

