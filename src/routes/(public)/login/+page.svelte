<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';

	let email = $state('');
	let password = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleLogin() {
		error = '';
		loading = true;

		try {
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});

			const data = await response.json();

			if (!response.ok) {
				error = data.error || 'Login failed';
				loading = false;
				return;
			}

			// Redirect to original page or home
			const redirectTo = $page.url.searchParams.get('redirect') || '/';
			goto(redirectTo);
		} catch (err) {
			error = 'Network error. Please try again.';
			loading = false;
		}
	}
</script>

<div class="min-h-screen bg-background flex items-center justify-center p-6">
	<Card class="w-full max-w-md">
		<div class="p-8">
			<div class="text-center mb-8">
				<h1 class="text-3xl font-bold mb-2">Welcome Back</h1>
				<p class="text-muted-foreground">Sign in to your book library</p>
			</div>

			<form onsubmit={(e) => { e.preventDefault(); handleLogin(); }}>
				<div class="space-y-4">
					<div>
						<label for="email" class="block text-sm font-medium mb-2">
							Email
						</label>
						<input
							id="email"
							type="email"
							bind:value={email}
							required
							class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
							placeholder="you@example.com"
						/>
					</div>

					<div>
						<label for="password" class="block text-sm font-medium mb-2">
							Password
						</label>
						<input
							id="password"
							type="password"
							bind:value={password}
							required
							minlength="8"
							class="w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
							placeholder="••••••••"
						/>
					</div>

					{#if error}
						<div class="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-lg text-sm">
							{error}
						</div>
					{/if}

					<Button type="submit" class="w-full" disabled={loading}>
						{loading ? 'Signing in...' : 'Sign In'}
					</Button>
				</div>
			</form>

			<div class="mt-6 text-center text-sm">
				<span class="text-muted-foreground">Don't have an account?</span>
				<a href="/register" class="text-primary font-medium hover:underline ml-1">
					Register
				</a>
			</div>
		</div>
	</Card>
</div>


