<script>
	import { getFieldContext } from './getFormContext';
	import Radio from '$lib/ui/Radio.svelte';

	export let name;
	export let value;

	const {
		field: { value: groupValue },
		updateValidateField
	} = getFieldContext(name);

	$: selected = $groupValue;

	const updateForm = () => {
		updateValidateField(name, value);
	};
</script>

<Radio groupValue={selected} {value} {...$$restProps} on:change={updateForm} />

<style>
	:global(.checkboxgroup .mdc-form-field label) {
		display: block;
		font-size: 1.3em;
		cursor: pointer;
		padding: 10px 0;
	}
</style>
