<script lang="ts">
	import { cn } from '$lib/utils/cn';

	interface Props {
		variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'accent' | 'success';
		size?: 'sm' | 'md' | 'lg';
		class?: string;
		onclick?: (e: MouseEvent) => void;
		disabled?: boolean;
		type?: 'button' | 'submit' | 'reset';
		children?: any;
	}

	let {
		variant = 'default',
		size = 'md',
		class: className,
		onclick,
		disabled = false,
		type = 'button',
		children
	}: Props = $props();

	// Enhanced variant classes with PageDrift colors and animations
	const variantClasses = {
		default: 'btn-primary',
		secondary: 'btn-secondary', 
		outline: 'btn-outline',
		ghost: 'btn-ghost',
		destructive: 'btn-destructive',
		accent: 'btn-accent',
		success: 'btn-success'
	};

	const sizeClasses = {
		sm: 'h-9 px-3 text-sm',
		md: 'h-10 px-4 py-2',
		lg: 'h-11 px-8 text-lg'
	};

	// Enhanced click handler with animation feedback
	function handleClick(e: MouseEvent) {
		if (disabled) return;
		
		// Add a subtle scale animation on click
		const button = e.currentTarget as HTMLButtonElement;
		button.style.transform = 'scale(0.98)';
		setTimeout(() => {
			button.style.transform = '';
		}, 100);
		
		onclick?.(e);
	}
</script>

<button
	onclick={handleClick}
	{disabled}
	{type}
	class={cn(
		'btn-enhanced inline-flex items-center justify-center rounded-md font-medium transition-all duration-200 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
		variantClasses[variant],
		sizeClasses[size],
		className
	)}
>
	{@render children?.()}
</button>
