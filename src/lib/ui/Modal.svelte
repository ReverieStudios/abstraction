<script>
	import { createEventDispatcher } from 'svelte';

	import Dialog, { Actions, Title, Content } from '@smui/dialog';

	const dispatch = createEventDispatcher();

	export let title = '';
	export let open;
	let dialog;

	const closeModal = () => dispatch('close');
</script>

{#if open}
	<Dialog
		aria-labelledby="fullscreen-title"
		aria-describedby="fullscreen-content"
		fullscreen
		bind:open
		on:SMUIDialog:closed={closeModal}
	>
		{#if title}
			<Title id="fullscreen-title"><span class="px3">{title}</span></Title>
		{/if}
		<Content id="fullscreen-content"
			><div bind:this={dialog} class="pt2"><slot {closeModal} /></div></Content
		>
		<Actions>
			<slot name="actions" />
		</Actions>
	</Dialog>
{/if}

<style>
	:global(#fullscreen-content) {
		min-height: 50vh;
	}
</style>
