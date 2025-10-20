<script lang="ts">
	import { goto } from '$app/navigation';
	import { onMount } from 'svelte';
	import Button from './ui/Button.svelte';
	import Card from './ui/Card.svelte';
	import { settingsStore } from '$lib/stores/settings.svelte';
	import type { AuthUser } from '$lib/server/auth';

	interface Props {
		user: AuthUser;
	}

	let { user }: Props = $props();
	let isOpen = $state(false);

	onMount(async () => {
		await settingsStore.init();
	});

	let theme = $derived(settingsStore.settings.theme);

	async function handleLogout() {
		try {
			await fetch('/api/auth/logout', { method: 'POST' });
			goto('/login');
		} catch (error) {
			console.error('Logout failed:', error);
		}
	}

	function toggleCard() {
		isOpen = !isOpen;
	}
</script>

<!-- Floating User Card -->
<div class="fixed bottom-6 right-6 z-50">
	<!-- Toggle Button -->
	<button
		onclick={toggleCard}
		class="w-12 h-12 rounded-full shadow-lg hover:shadow-xl transition-all duration-300 flex items-center justify-center group btn-enhanced"
		class:rotate-45={isOpen}
		style="background: var(--color-primary); color: var(--color-primary-foreground);"
	>
		{#if isOpen}
			<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
			</svg>
		{:else}
			<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
			</svg>
		{/if}
	</button>

	<!-- User Card -->
	{#if isOpen}
		<Card class="absolute bottom-16 right-0 w-80 p-4 shadow-xl border-2 bg-background/95 backdrop-blur-sm">
			<div class="space-y-4">
				<!-- User Info -->
				<div class="flex items-center gap-3 pb-3 border-b">
					<div class="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
						<svg class="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
						</svg>
					</div>
					<div class="flex-1 min-w-0">
						<p class="text-sm font-medium text-foreground truncate">{user.email}</p>
						{#if user.role === 'admin'}
							<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
								Admin
							</span>
						{/if}
					</div>
				</div>

				<!-- Theme Selector -->
				<div class="pb-3 border-b">
					<div class="text-sm font-medium mb-2 text-foreground">Theme</div>
					<div class="grid grid-cols-3 gap-2">
						<button
							onclick={() => settingsStore.setTheme('light')}
							class="flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all duration-200 relative"
							class:bg-primary={theme === 'light'}
							class:text-primary-foreground={theme === 'light'}
							class:border-primary={theme === 'light'}
							class:shadow-lg={theme === 'light'}
							class:scale-105={theme === 'light'}
							class:hover:bg-muted={theme !== 'light'}
							class:border-border={theme !== 'light'}
							class:opacity-60={theme !== 'light'}
							class:hover:opacity-100={theme !== 'light'}
						>
							{#if theme === 'light'}
								<div class="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-card" style="background-color: var(--color-success);"></div>
							{/if}
							<svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
							</svg>
							<span class="text-xs font-medium">Light</span>
						</button>
						<button
							onclick={() => settingsStore.setTheme('dark')}
							class="flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all duration-200 relative"
							class:bg-primary={theme === 'dark'}
							class:text-primary-foreground={theme === 'dark'}
							class:border-primary={theme === 'dark'}
							class:shadow-lg={theme === 'dark'}
							class:scale-105={theme === 'dark'}
							class:hover:bg-muted={theme !== 'dark'}
							class:border-border={theme !== 'dark'}
							class:opacity-60={theme !== 'dark'}
							class:hover:opacity-100={theme !== 'dark'}
						>
							{#if theme === 'dark'}
								<div class="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-card" style="background-color: var(--color-success);"></div>
							{/if}
							<svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
							</svg>
							<span class="text-xs font-medium">Dark</span>
						</button>
						<button
							onclick={() => settingsStore.setTheme('system')}
							class="flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all duration-200 relative"
							class:bg-primary={theme === 'system'}
							class:text-primary-foreground={theme === 'system'}
							class:border-primary={theme === 'system'}
							class:shadow-lg={theme === 'system'}
							class:scale-105={theme === 'system'}
							class:hover:bg-muted={theme !== 'system'}
							class:border-border={theme !== 'system'}
							class:opacity-60={theme !== 'system'}
							class:hover:opacity-100={theme !== 'system'}
						>
							{#if theme === 'system'}
								<div class="absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-card" style="background-color: var(--color-success);"></div>
							{/if}
							<svg class="w-6 h-6 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
							</svg>
							<span class="text-xs font-medium">System</span>
						</button>
					</div>
				</div>

				<!-- Action Buttons -->
				<div class="space-y-2">
					{#if user.role === 'admin'}
						<Button 
							variant="accent" 
							class="w-full justify-start" 
							onclick={() => { goto('/admin'); isOpen = false; }}
						>
							<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
							</svg>
							Manage Users
						</Button>
					{/if}
					
					{#if user.canUpload}
						<Button 
							variant="success" 
							class="w-full justify-start" 
							onclick={() => { goto('/upload'); isOpen = false; }}
						>
							<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
								<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
							</svg>
							Upload Book
						</Button>
					{/if}
					
					<Button 
						variant="destructive" 
						class="w-full justify-start" 
						onclick={handleLogout}
					>
						<svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
						</svg>
						Logout
					</Button>
				</div>
			</div>
		</Card>
	{/if}
</div>

<!-- Click outside to close -->
{#if isOpen}
	<div 
		class="fixed inset-0 z-40" 
		onclick={() => isOpen = false}
		role="button"
		tabindex="-1"
		onkeydown={(e) => e.key === 'Escape' && (isOpen = false)}
	></div>
{/if}
