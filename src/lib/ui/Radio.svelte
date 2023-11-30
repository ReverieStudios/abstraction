<script>
	import Radio from '@smui/radio';
	import FormField from '@smui/form-field';

	export let groupValue;
	export let label = null;
</script>

<FormField>
	<Radio on:change group={groupValue} {...$$restProps} />
	<svelte:fragment slot="label">{label}</svelte:fragment>
</FormField>
