<script lang="ts" context="module">
	import type { Load } from '@sveltejs/kit';
	export const load: Load = ({ stuff }) => {
		return {
			props: {
				game: stuff.game
			}
		};
	};
</script>

<script lang="ts">
	import CreateButton from '$lib/CreateButton.svelte';
	import ConfirmButton from '$lib/ConfirmButton.svelte';
	import { Wrapper, Item } from '$lib/boxLinks';
	import { database } from '$lib/database/Database';
	import type { Game } from '$lib/database/types/Game';
	import IconButton from '$lib/ui/IconButton.svelte';
	import Form from '$lib/form/Form.svelte';
	import TextField from '$lib/form/TextField.svelte';

	let flags = database.flags;
	let game: Game;

	let editing: string = null;
</script>

<svelte:head>
	<title>Editing {game?.name ?? 'Game'}</title>
</svelte:head>

<div class="content">
	<h1>Edit Flags</h1>

	<Wrapper class="mb2">
		{#each $flags as flag}
			{#if editing === flag.id}
				<Item>
					<Form
						class="mt2 mb2 flex g2 items-center"
						initialValues={flag.data}
						onSubmit={(values) => flag.update(values)}
						afterSubmit={() => (editing = null)}
					>
						<TextField name="name" class="flex-auto" />
						<IconButton type="submit" icon="check" />
						<IconButton type="button" icon="clear" on:click={() => (editing = null)} />
					</Form>
				</Item>
			{:else}
				<Item text={flag.data.name}>
					<svelte:fragment slot="actions">
						<IconButton icon="edit" on:click={() => (editing = flag.id)} />
						<ConfirmButton on:confirm={() => flag.remove()} />
					</svelte:fragment>
				</Item>
			{/if}
		{/each}
	</Wrapper>
	<CreateButton parent={flags} />
</div>
