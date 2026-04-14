<script lang="ts">
	import { fly } from 'svelte/transition';
	import { page } from '$app/stores';

	function outfly(node: Element, params: Parameters<typeof fly>[1]) {
		const anim = fly(node, params);
		const duration = params?.duration ?? 300;
		// If the transition gets orphaned (never removed from DOM), hide it after it should have finished
		const timer = setTimeout(() => {
			(node as HTMLElement).style.display = 'none';
		}, duration + 100);
		return {
			...anim,
			destroy() {
				clearTimeout(timer);
			}
		};
	}
</script>

{#key $page.route.id}
	<div 
		in:fly|global={{ y: -50, duration: 250, delay: 300 }}
		out:outfly|global={{ y: -50, duration: 250 }}
		class="transition-page">
		<slot />
	</div>
{/key}

<style>
	.transition-page {
		display: block;
	}
</style>
