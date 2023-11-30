<script lang="ts">
	import { getFieldContext } from './getFormContext';
	import Select from '$lib/ui/Select.svelte';

	export let name: string;
	export let items = [];
	export let defaultValue = null;

	const {
		updateValidateField,
		field: { value, formError }
	} = getFieldContext(name);

	$: current = $value ?? defaultValue;
	$: error = $formError;

	const onChange = (e: CustomEvent<{ value: any }>) => {
		const {
			detail: { value }
		} = e;
		if (current !== value) {
			updateValidateField(name, value);
		}
	};
</script>

<Select {error} {name} {items} value={current} on:change={onChange} {...$$restProps} />
