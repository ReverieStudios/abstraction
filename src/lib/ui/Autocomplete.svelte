<script lang="ts">
	import Autocomplete from '@smui-extra/autocomplete';
	import { createEventDispatcher } from 'svelte';

	export let label: string = null;
	export let items: any[] = [];
	export let value = null;

	let bound = value;

	const dispatch = createEventDispatcher();

	$: dispatch('change', { value: bound });
</script>

<Autocomplete
	class="autocomplete-hook col-12"
	combobox
	options={items}
	textfield$variant="filled"
	bind:value={bound}
	{label}
/>

<style>
	:global(.autocomplete-hook .mdc-text-field) {
		width: 100%;
	}
</style>
