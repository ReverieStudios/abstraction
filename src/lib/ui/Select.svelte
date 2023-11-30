<script lang="ts">
	import Select, { Option } from '@smui/select';
	import { createEventDispatcher } from 'svelte';

	export let nullOption = false;
	export let items = [];
	export let value = null;
	export let error = null;

	const stringify = (value: any) => {
		if (typeof value === 'string') {
			return value;
		}
		return JSON.stringify(value);
	};

	$: formattedItems = [...(nullOption ? [{ text: '', value: '' }] : []), ...items].map((i) => {
		if (typeof i === 'string') {
			return { text: i, value: i, rawValue: i };
		} else if (typeof i?.value !== 'string') {
			return { text: i.text, value: stringify(i.value), rawValue: i.value };
		}
		return { ...i, rawValue: i.value };
	});
	$: formattedValue = stringify(value);

	const handleChange = (e: CustomEvent<{ index: number; value: any }>) => {
		const index = e.detail.index;
		value = formattedItems[index]?.rawValue;
		dispatch('change', { index, value });
	};

	const dispatch = createEventDispatcher();
</script>

<span class="hook {$$props.class || ''}">
	<Select
		on:SMUISelect:change={handleChange}
		value={formattedValue}
		invalid={error}
		variant="filled"
		{...$$restProps}
		class="col-12"
	>
		{#each formattedItems as { text, value } (value)}
			<Option {value}>{text}</Option>
		{/each}
		<svelte:fragment slot="helperText">
			{#if error}
				<span class="text-error">{error}</span>
			{/if}
		</svelte:fragment>
	</Select>
</span>

<style>
	:global(.hook .mdc-select:not(.mdc-select--disabled).mdc-select--focused .mdc-floating-label) {
		color: var(--text-on-primary);
	}
	:global(.hook .mdc-select-helper-text:empty) {
		height: 0;
	}
</style>
