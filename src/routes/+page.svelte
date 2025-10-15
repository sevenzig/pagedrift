<script lang="ts">
	import { onMount } from 'svelte';
	import Library from '$lib/components/Library.svelte';
	import { booksStore } from '$lib/stores/books.svelte';
	import { readerStore } from '$lib/stores/reader.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';

	onMount(async () => {
		await Promise.all([booksStore.init(), readerStore.init(), settingsStore.init()]);
	});
</script>

<Library />
