<script lang="ts">
	import { goto } from '$app/navigation';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';

	let email = $state('');
	let password = $state('');
	let confirmPassword = $state('');
	let error = $state('');
	let loading = $state(false);

	async function handleRegister() {
		error = '';

		// Validation
		if (password.length < 8) {
			error = 'Password must be at least 8 characters';
			return;
		}

		if (password !== confirmPassword) {
			error = 'Passwords do not match';
			return;
		}

		loading = true;

		try {
			const response = await fetch('/api/auth/register', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email, password })
			});

			const data = await response.json();

			if (!response.ok) {
				error = data.error || 'Registration failed';
				loading = false;
				return;
			}

			// Redirect to home after successful registration
			goto('/');
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
				<h1 class="text-3xl font-bold mb-2">Create Account</h1>
				<p class="text-muted-foreground">Join the shared book library</p>
			</div>

			<form onsubmit={(e) => { e.preventDefault(); handleRegister(); }}>
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
						<p class="text-xs text-muted-foreground mt-1">
							Must be at least 8 characters
						</p>
					</div>

					<div>
						<label for="confirmPassword" class="block text-sm font-medium mb-2">
							Confirm Password
						</label>
						<input
							id="confirmPassword"
							type="password"
							bind:value={confirmPassword}
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
						{loading ? 'Creating account...' : 'Create Account'}
					</Button>
				</div>
			</form>

			<div class="mt-6 text-center text-sm">
				<span class="text-muted-foreground">Already have an account?</span>
				<a href="/login" class="text-primary font-medium hover:underline ml-1">
					Sign in
				</a>
			</div>
		</div>
	</Card>
</div>


