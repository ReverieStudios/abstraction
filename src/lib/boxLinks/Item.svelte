<script>
	import InfoIcon from '$lib/ui/InfoIcon.svelte';

	export let href = '';
	export let text = '';
	export let info = '';
</script>

<div class="flex bg-primary hover-bg-primary-light items-center pr2">
	{#if href}
		<a {href} class="block p2 flex-auto">
			<slot>
				<h4 class="bold h3 my1">{text}</h4>
			</slot>
		</a>
	{:else}
		<span class="block p2 flex-auto">
			<slot>
				<h4 class="bold h3 my1">{text}</h4>
			</slot>
		</span>
	{/if}
	{#if info}<InfoIcon text={info} />{/if}
	<slot name="actions" />
</div>
