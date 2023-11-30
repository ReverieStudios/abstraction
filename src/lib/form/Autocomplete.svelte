<script lang="ts">
	import { getFieldContext } from './getFormContext';
	import Autocomplete from '$lib/ui/Autocomplete.svelte';

	export let name: string;
	export let items = [];
	export let defaultValue = null;

	const {
		updateValidateField,
		field: { value, formError }
	} = getFieldContext(name);

	$: current = $value ?? defaultValue;

	const onChange = (e: CustomEvent<{ value: any }>) => {
		console.log('change', e);
		const {
			detail: { value }
		} = e;
		if (current !== value) {
			updateValidateField(name, value);
		}
	};
</script>

<Autocomplete {items} value={current} on:change={onChange} {...$$restProps} />
