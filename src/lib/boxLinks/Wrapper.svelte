<script lang="ts">
	type T = $$Generic;
	import Item from './Item.svelte';

	export let items: T[] = [null]; // if not provided, just renders with one slot
</script>

<div class="flex flex-column items-stretch mx2 divided wrapper {$$props.class || ''}">
	{#each items as item}
		<slot {item}>
			<Item {...item} />
		</slot>
	{/each}
</div>

<style>
	:global(.wrapper > :first-child) {
		border-radius: 4px 4px 0 0;
	}
	:global(.wrapper > :last-child) {
		border-radius: 0 0 4px 4px;
	}
</style>
