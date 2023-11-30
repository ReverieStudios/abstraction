<script>
	import Paper from '@smui/paper';

	export let name;
	export let label;
</script>

<Paper variant="unelevated" class="py1 mt1 {$$props.class || ''}">
	<fieldset {name} class="border-none flex flex-column">
		{#if label}
			<label class="text-center h2 mb2 block" for={name}>{label}</label>
		{/if}
		<slot />
	</fieldset>
</Paper>
