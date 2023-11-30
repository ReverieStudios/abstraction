<script lang="ts">
	import IconButton from '$lib/ui/IconButton.svelte';

	import TextField from '$lib/form/TextField.svelte';
	import { getFieldContext } from '../form/getFormContext';

	export let name: string;
	export let checked: boolean;

	const {
		updateValidateField,
		field: { value }
	} = getFieldContext(name);

	const setEmpty = () => updateValidateField(name, '');
	const unset = () => updateValidateField(name, undefined);
</script>

{#if checked}
	<div class="flex">
		{#if $value == null}
			<IconButton class="ml2 pointer" on:click={setEmpty} icon="filter_list" />
		{:else}
			<IconButton class="ml2 pointer" on:click={unset} icon="sort" />
			<TextField {name} />
		{/if}
	</div>
{/if}
