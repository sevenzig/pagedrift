<script lang="ts">
	import { cn } from '$lib/utils/cn';

	interface Props {
		variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
		size?: 'sm' | 'md' | 'lg';
		class?: string;
		onclick?: () => void;
		disabled?: boolean;
		children?: any;
	}

	let {
		variant = 'default',
		size = 'md',
		class: className,
		onclick,
		disabled = false,
		children
	}: Props = $props();

	const variantClasses = {
		default: 'bg-primary text-primary-foreground hover:bg-primary/90',
		secondary: 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
		outline: 'border border-input bg-background hover:bg-accent hover:text-accent-foreground',
		ghost: 'hover:bg-accent hover:text-accent-foreground',
		destructive: 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
	};

	const sizeClasses = {
		sm: 'h-9 px-3 text-sm',
		md: 'h-10 px-4 py-2',
		lg: 'h-11 px-8 text-lg'
	};
</script>

<button
	{onclick}
	{disabled}
	class={cn(
		'inline-flex items-center justify-center rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
		variantClasses[variant],
		sizeClasses[size],
		className
	)}
>
	{@render children?.()}
</button>
