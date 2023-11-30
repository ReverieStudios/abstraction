<script lang="ts">
	import { getFieldContext } from './getFormContext';
	import Checkbox from '$lib/ui/Checkbox.svelte';

	export let name: string;

	const {
		field: { value },
		updateValidateField
	} = getFieldContext(name);

	const updateForm = (e: CustomEvent) => {
		const { checked } = e.target as HTMLInputElement;
		updateValidateField(name, checked);
	};

	$: isChecked = $value;
</script>

<Checkbox {name} checked={isChecked} {...$$restProps} on:change={updateForm} />
