<script lang="ts">
	import Radio from '$lib/form/Radio.svelte';
	import Fieldset from '$lib/ui/Fieldset.svelte';
	import { getFieldContext } from './getFormContext';

	interface RadioItem {
		label: string;
		value: any;
	}

	export let name: string;
	export let items: RadioItem[] = [];
	export let label: string;

	const {
		field: { value: groupValue, formError }
	} = getFieldContext(name);
</script>

<Fieldset name="radio-group-{name}" {label} class="radiogroup {$$props.class}">
	{#if $formError}
		<span class="text-error">{$formError}</span>
	{/if}
	{#each items as item (item.value)}
		<div class="flex">
			<Radio {name} {...item} />
			<slot name="extra" id={item.value} checked={item.value === $groupValue} />
		</div>
	{/each}
</Fieldset>

<style>
	:global(.radiogroup .mdc-form-field label) {
		display: block;
		font-size: 1.3em;
		cursor: pointer;
		padding: 10px 0;
	}
</style>
