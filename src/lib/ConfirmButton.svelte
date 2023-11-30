<script>
	import IconButton from '$lib/ui/IconButton.svelte';
	import { createEventDispatcher } from 'svelte';
	import { clickOutside } from '$lib/actions/clickOutside';

	export let icon = 'delete';
	export let disabled = false;

	let showingConfirm = false;

	const dispatch = createEventDispatcher();

	const showConfirm = () => (showingConfirm = true);
	const hideConfirm = () => (showingConfirm = false);
	const doConfirm = () => {
		hideConfirm();
		dispatch('confirm');
	};
</script>

<span class="confirm-wrapper" class:confirm={showingConfirm}>
	{#if showingConfirm}
		<span use:clickOutside on:outclick={() => (showingConfirm = false)}>
			<IconButton type="button" on:click={doConfirm} icon="check" />
			<IconButton type="button" on:click={hideConfirm} icon="clear" />
		</span>
	{:else}
		<IconButton type="button" {disabled} on:click={showConfirm} {icon} />
	{/if}
</span>

<style>
	.confirm-wrapper {
		align-self: center;
		margin-right: 1.25em;
		display: flex;
		flex-direction: row;
	}
	.confirm {
		background: var(--mdc-theme-error);
		border-radius: 0.5em;
		padding: 0.25em;
		color: #fff;
	}
</style>
