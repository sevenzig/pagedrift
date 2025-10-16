<script lang="ts">
	import { cn } from '$lib/utils/cn';

	interface Props {
		class?: string;
		children?: any;
		onclick?: (e: MouseEvent) => void;
	}

	let { class: className, children, onclick }: Props = $props();
</script>

<div
	onclick={onclick}
	class={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)}
>
	{@render children?.()}
</div>
