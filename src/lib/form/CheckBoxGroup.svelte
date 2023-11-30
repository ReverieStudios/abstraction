<script lang="ts">
	import { getFieldContext } from './getFormContext';
	import Checkbox from '$lib/ui/Checkbox.svelte';
	import Fieldset from '$lib/ui/Fieldset.svelte';

	export let name: string;
	export let items = [];
	export let label: string;
	export let all = false;

	const {
		field: { value },
		updateValidateField
	} = getFieldContext(name);

	let selected = [];
	$: {
		const formValue = $value;
		if (Array.isArray(formValue)) {
			selected = formValue;
		} else if (formValue != null) {
			selected = [formValue];
		}
	}
	$: selectedSet = new Set(selected);

	const updateForm = (value: string[]) => {
		updateValidateField(name, value);
	};

	const updateCell = (value: string) => () => {
		if (!selectedSet.has(value)) {
			updateForm([...selected, value]);
		} else {
			updateForm(selected.filter((v) => v !== value));
		}
	};

	$: {
		const itemValues = new Set(items.map((i) => i.value));
		const onlyValid = selected.filter((v) => itemValues.has(v));
		if (onlyValid.length !== selected.length) {
			updateForm(onlyValid);
		}
	}

	const selectAll = () => {
		if (selectedSet.size === items.length) {
			updateForm([]);
		} else {
			const allEnabled = items.filter((i) => !i.disabled).map((i) => i.value);
			updateForm(allEnabled);
		}
	};
</script>

<Fieldset name="checkbox-group-{name}" {label} class="checkboxgroup {$$props.class}">
	{#if all}
		<Checkbox
			checked={selectedSet.size === items.length}
			indeterminate={selectedSet.size > 0 && selectedSet.size < items.length}
			label="Select All"
			on:change={selectAll}
		/>
	{/if}
	{#each items as item (item.value)}
		{@const id = item.value}
		{@const checked = selectedSet.has(item.value)}
		<div class="flex">
			<Checkbox {checked} {...item} on:change={updateCell(item.value)} />
			<slot name="extra" {id} {checked} />
		</div>
	{/each}
</Fieldset>

<style>
	:global(.checkboxgroup .mdc-form-field label) {
		display: block;
		font-size: 1.3em;
		cursor: pointer;
		padding: 10px 0;
	}
</style>
