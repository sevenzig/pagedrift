<script lang="ts">
	import { goto } from '$app/navigation';
	import Button from './ui/Button.svelte';

	interface Props {
		book: {
			id: string;
			title: string;
			author?: string | null;
			progress: number;
		};
		onClose: () => void;
	}

	let { book, onClose }: Props = $props();

	async function resumeReading() {
		// Navigate to reader with existing progress
		await goto(`/reader/${book.id}`);
		onClose();
	}

	async function startFromBeginning() {
		// Clear progress and start from beginning
		try {
			await fetch(`/api/books/${book.id}/progress`, {
				method: 'DELETE'
			});
		} catch (error) {
			console.error('Failed to clear progress:', error);
		}
		
		// Navigate to reader with restart parameter
		await goto(`/reader/${book.id}?restart=true`);
		onClose();
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		}
	}
</script>

<!-- Backdrop -->
<div 
	class="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
	onclick={onClose}
	onkeydown={handleKeydown}
	role="button"
	tabindex="0"
	aria-label="Close modal"
>
	<!-- Modal Content -->
	<div 
		class="w-full max-w-lg p-8 rounded-lg border bg-card/95 backdrop-blur-xl text-card-foreground shadow-2xl"
		onclick={(e) => e.stopPropagation()}
		onkeydown={(e) => e.stopPropagation()}
		role="dialog"
		tabindex="-1"
		aria-labelledby="modal-title"
		aria-describedby="modal-description"
	>
		<div class="text-center">
			<h2 id="modal-title" class="text-2xl font-semibold mb-2">{book.title}</h2>
			{#if book.author}
				<p class="text-muted-foreground mb-6">by {book.author}</p>
			{/if}
			
			<div class="mb-8">
				<div class="flex items-center justify-center gap-2 mb-3">
					<span class="text-base font-medium">Reading Progress:</span>
					<span class="text-base font-semibold text-primary">{Math.round(book.progress)}%</span>
				</div>
				<div class="w-full bg-muted rounded-full h-3">
					<div 
						class="bg-gradient-to-r from-primary to-primary/80 h-3 rounded-full transition-all duration-300"
						style="width: {book.progress}%"
					></div>
				</div>
			</div>

			<p id="modal-description" class="text-base text-muted-foreground mb-8 leading-relaxed">
				You have reading progress saved for this book. Would you like to continue where you left off or start from the beginning?
			</p>

			<div class="flex flex-col gap-3">
				<div class="flex gap-3">
					<Button 
						variant="outline" 
						class="flex-1 h-11"
						onclick={startFromBeginning}
					>
						Start from Beginning
					</Button>
					<Button 
						class="flex-1 h-11"
						onclick={resumeReading}
					>
						Resume Reading
					</Button>
				</div>
				<Button 
					variant="outline" 
					class="w-full h-10"
					onclick={onClose}
				>
					Cancel
				</Button>
			</div>
		</div>
	</div>
</div>

<style>
	/* Ensure modal is above everything */
	:global(.modal-backdrop) {
		z-index: 50;
	}
</style>
