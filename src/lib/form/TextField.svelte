<script lang="ts">
	import TextField from '$lib/ui/TextField.svelte';
	import { getFieldContext } from './getFormContext';

	export let name: string;
	export let type = 'text';
	export let defaultValue = null;

	const {
		updateValidateField,
		field: { value, formError }
	} = getFieldContext(name, '');

	$: current = $value ?? defaultValue;
	$: error = $formError;

	const onChange = (e) => {
		const {
			target: { value }
		} = e;

		let parsedValue = value;
		if (type === 'number') {
			parsedValue = parseFloat(value);
		}

		if (current !== value) {
			updateValidateField(name, parsedValue);
		}
	};
</script>

<TextField
	{name}
	{type}
	{error}
	value={current}
	on:input={onChange}
	on:change={onChange}
	{...$$restProps}
/>
