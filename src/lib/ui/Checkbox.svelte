<script lang="ts">
	import Checkbox from '@smui/checkbox';
	import FormField from '@smui/form-field';

	export let label: string | null = null;
	export let checked: boolean;
</script>

<FormField>
	<Checkbox bind:checked on:change {...$$restProps} />
	<svelte:fragment slot="label">{label}</svelte:fragment>
</FormField>
