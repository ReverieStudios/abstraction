<script>
	import Checkbox from '@smui/checkbox';
	import FormField from '@smui/form-field';

	export let label = null;
	export let checked;
</script>

<FormField>
	<Checkbox bind:checked on:change {...$$restProps} />
	<svelte:fragment slot="label">{label}</svelte:fragment>
</FormField>
