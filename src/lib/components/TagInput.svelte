<script lang="ts">
	import { onMount } from 'svelte';

	interface Props {
		tags: string[];
		placeholder?: string;
		disabled?: boolean;
	}

	let { tags = $bindable([]), placeholder = 'Add tags...', disabled = false }: Props = $props();

	let inputValue = $state('');
	let suggestions = $state<Array<{ id: string; name: string; count: number }>>([]);
	let showSuggestions = $state(false);
	let selectedIndex = $state(-1);
	let inputElement: HTMLInputElement;
	let loading = $state(false);

	// Fetch existing tags for autocomplete
	async function fetchTags() {
		try {
			loading = true;
			const response = await fetch('/api/tags');
			if (response.ok) {
				const data = await response.json();
				suggestions = data.tags.map((tag: any) => ({
					id: tag.id,
					name: tag.name,
					count: tag._count?.books || 0
				}));
			}
		} catch (error) {
			console.error('Failed to fetch tags:', error);
		} finally {
			loading = false;
		}
	}

	onMount(() => {
		fetchTags();
	});

	// Filter suggestions based on input
	const filteredSuggestions = $derived(
		inputValue.trim().length > 0
			? suggestions.filter(
					(s) =>
						s.name.toLowerCase().includes(inputValue.toLowerCase()) &&
						!tags.includes(s.name)
				)
			: []
	);

	function addTag(tagName: string) {
		const trimmed = tagName.trim();
		if (trimmed && !tags.includes(trimmed)) {
			tags = [...tags, trimmed];
		}
		inputValue = '';
		showSuggestions = false;
		selectedIndex = -1;
	}

	function removeTag(tagName: string) {
		tags = tags.filter((t) => t !== tagName);
	}

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			if (selectedIndex >= 0 && filteredSuggestions[selectedIndex]) {
				addTag(filteredSuggestions[selectedIndex].name);
			} else if (inputValue.trim()) {
				addTag(inputValue);
			}
		} else if (e.key === 'ArrowDown') {
			e.preventDefault();
			selectedIndex = Math.min(selectedIndex + 1, filteredSuggestions.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			selectedIndex = Math.max(selectedIndex - 1, -1);
		} else if (e.key === 'Escape') {
			showSuggestions = false;
			selectedIndex = -1;
		} else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
			removeTag(tags[tags.length - 1]);
		}
	}

	function handleInput() {
		showSuggestions = inputValue.trim().length > 0;
		selectedIndex = -1;
	}

	function handleBlur() {
		// Delay to allow click on suggestions
		setTimeout(() => {
			showSuggestions = false;
			selectedIndex = -1;
		}, 200);
	}
</script>

<div class="tag-input-container">
	<div class="tag-input-wrapper">
		<div class="tags-display">
			{#each tags as tag}
				<span class="tag-chip">
					{tag}
					<button
						type="button"
						onclick={() => removeTag(tag)}
						{disabled}
						class="tag-remove"
						aria-label="Remove {tag}"
					>
						×
					</button>
				</span>
			{/each}
		</div>
		<input
			bind:this={inputElement}
			bind:value={inputValue}
			type="text"
			{placeholder}
			{disabled}
			onkeydown={handleKeyDown}
			oninput={handleInput}
			onblur={handleBlur}
			onfocus={() => (showSuggestions = inputValue.trim().length > 0)}
			class="tag-input"
		/>
	</div>

	{#if showSuggestions && filteredSuggestions.length > 0}
		<div class="suggestions-dropdown">
			{#each filteredSuggestions as suggestion, i}
				<button
					type="button"
					class="suggestion-item"
					class:selected={i === selectedIndex}
					onclick={() => addTag(suggestion.name)}
				>
					<span class="suggestion-name">{suggestion.name}</span>
					{#if suggestion.count > 0}
						<span class="suggestion-count">{suggestion.count}</span>
					{/if}
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	.tag-input-container {
		position: relative;
		width: 100%;
	}

	.tag-input-wrapper {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		padding: 0.5rem;
		border: 1px solid hsl(var(--border));
		border-radius: 0.375rem;
		background: hsl(var(--background));
		min-height: 2.5rem;
		align-items: center;
	}

	.tag-input-wrapper:focus-within {
		outline: 2px solid hsl(var(--ring));
		outline-offset: 2px;
	}

	.tags-display {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.tag-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.125rem 0.5rem;
		background: hsl(var(--primary));
		color: hsl(var(--primary-foreground));
		border-radius: 9999px;
		font-size: 0.875rem;
		font-weight: 500;
	}

	.tag-remove {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 1rem;
		height: 1rem;
		border: none;
		background: transparent;
		color: hsl(var(--primary-foreground));
		cursor: pointer;
		border-radius: 9999px;
		font-size: 1.25rem;
		line-height: 1;
		padding: 0;
		transition: background-color 0.2s;
	}

	.tag-remove:hover {
		background: rgba(0, 0, 0, 0.1);
	}

	.tag-remove:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.tag-input {
		flex: 1;
		min-width: 8rem;
		border: none;
		outline: none;
		background: transparent;
		padding: 0.25rem;
		font-size: 0.875rem;
	}

	.tag-input:disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.suggestions-dropdown {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		margin-top: 0.25rem;
		background: hsl(var(--background));
		border: 1px solid hsl(var(--border));
		border-radius: 0.375rem;
		box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
		max-height: 12rem;
		overflow-y: auto;
		z-index: 50;
	}

	.suggestion-item {
		width: 100%;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0.5rem 0.75rem;
		border: none;
		background: transparent;
		text-align: left;
		cursor: pointer;
		transition: background-color 0.2s;
	}

	.suggestion-item:hover,
	.suggestion-item.selected {
		background: hsl(var(--accent));
	}

	.suggestion-name {
		font-size: 0.875rem;
		color: hsl(var(--foreground));
	}

	.suggestion-count {
		font-size: 0.75rem;
		color: hsl(var(--muted-foreground));
		background: hsl(var(--muted));
		padding: 0.125rem 0.375rem;
		border-radius: 9999px;
	}
</style>

