<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/stores';
	import Reader from '$lib/components/Reader.svelte';
	import { booksStore } from '$lib/stores/books.svelte';
	import { readerStore } from '$lib/stores/reader.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';

	let bookId = $derived($page.params.bookId);

	onMount(async () => {
		await Promise.all([booksStore.init(), readerStore.init(), settingsStore.init()]);
	});
</script>

<Reader {bookId} />
