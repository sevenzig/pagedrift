<script lang="ts">
	import { goto, invalidateAll } from '$app/navigation';
	import Button from '$lib/components/ui/Button.svelte';
	import Card from '$lib/components/ui/Card.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
	let editingUser = $state<string | null>(null);
	let editForm = $state<any>({});

	function startEdit(user: any) {
		editingUser = user.id;
		editForm = {
			role: user.role,
			canUpload: user.canUpload,
			canDelete: user.canDelete
		};
	}

	function cancelEdit() {
		editingUser = null;
		editForm = {};
	}

	async function savePermissions(userId: string) {
		try {
			const response = await fetch(`/api/admin/users/${userId}/permissions`, {
				method: 'PUT',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(editForm)
			});

			if (!response.ok) {
				const data = await response.json();
				alert(data.error || 'Failed to update permissions');
				return;
			}

			editingUser = null;
			editForm = {};
			await invalidateAll();
		} catch (error) {
			alert('Network error. Please try again.');
		}
	}

	function formatDate(date: Date | string): string {
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<div class="min-h-screen bg-background">
	<header class="border-b bg-card">
		<div class="max-w-7xl mx-auto px-6 py-6">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-3xl font-bold">User Management</h1>
					<p class="text-sm text-muted-foreground mt-1">
						Manage user permissions and roles
					</p>
				</div>
				<Button variant="outline" onclick={() => goto('/')}>
					← Back to Library
				</Button>
			</div>
		</div>
	</header>

	<main class="max-w-7xl mx-auto px-6 py-8">
		<div class="space-y-4">
			{#each data.users as user}
				<Card class="p-6">
					<div class="flex items-start justify-between">
						<div class="flex-1">
							<div class="flex items-center gap-3 mb-2">
								<h3 class="text-lg font-semibold">{user.email}</h3>
								{#if user.role === 'admin'}
									<span class="px-2 py-1 bg-primary text-primary-foreground text-xs rounded">
										Admin
									</span>
								{/if}
							</div>
							<p class="text-sm text-muted-foreground mb-4">
								Joined: {formatDate(user.createdAt)}
							</p>

							{#if editingUser === user.id}
								<div class="space-y-4 max-w-md">
									<div>
										<label for="role-{user.id}" class="text-sm font-medium block mb-2">Role</label>
										<select
											id="role-{user.id}"
											bind:value={editForm.role}
											class="w-full px-3 py-2 border rounded-lg"
										>
											<option value="admin">Admin</option>
											<option value="user">User</option>
											<option value="guest">Guest</option>
										</select>
									</div>

									<div class="space-y-2">
										<label class="flex items-center gap-2">
											<input
												id="canUpload-{user.id}"
												type="checkbox"
												bind:checked={editForm.canUpload}
												class="rounded"
											/>
											<span class="text-sm">Can upload books</span>
										</label>

										<label class="flex items-center gap-2">
											<input
												id="canDelete-{user.id}"
												type="checkbox"
												bind:checked={editForm.canDelete}
												class="rounded"
											/>
											<span class="text-sm">Can delete books</span>
										</label>
									</div>

									<div class="flex gap-2">
										<Button onclick={() => savePermissions(user.id)} size="sm">
											Save
										</Button>
										<Button variant="outline" onclick={cancelEdit} size="sm">
											Cancel
										</Button>
									</div>
								</div>
							{:else}
								<div class="space-y-1 text-sm">
									<p>
										<span class="text-muted-foreground">Upload permission:</span>
										{user.canUpload ? '✓ Yes' : '✗ No'}
									</p>
									<p>
										<span class="text-muted-foreground">Delete permission:</span>
										{user.canDelete ? '✓ Yes' : '✗ No'}
									</p>
								</div>
							{/if}
						</div>

						{#if editingUser !== user.id && user.id !== data.user.id}
							<Button variant="outline" size="sm" onclick={() => startEdit(user)}>
								Edit Permissions
							</Button>
						{/if}
					</div>
				</Card>
			{/each}
		</div>
	</main>
</div>

