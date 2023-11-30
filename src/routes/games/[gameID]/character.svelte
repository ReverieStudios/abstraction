<script lang="ts" context="module">
	import type { Load } from '@sveltejs/kit';

	export const load: Load = async ({ session, stuff }) => {
		return {
			props: { user: session.user, gameID: stuff.gameID }
		};
	};
</script>

<script lang="ts">
	import { page } from '$app/stores';
	import { database } from '$lib/database';
	import type { Updaters } from '$lib/database';
	import Form from '$lib/form/Form.svelte';
	import TextField from '$lib/form/TextField.svelte';
	import Button from '$lib/form/Button.svelte';
	import { getNotify } from '$lib/ui/Notifications.svelte';
	import type { User } from '$lib/database/types/User';
	import IconButton from '$lib/ui/IconButton.svelte';
	import { derived } from 'svelte/store';
	import { keyBy } from 'lodash-es';
	import PurchasedAssetRow from '$lib/characters/PurchasedAssetRow.svelte';

	export let user: User = null;

	const sendNotification = getNotify();
	const { gameID } = $page.params;
	const character = database.characters.doc(user.uid);

	const characterAssets = derived([character, database.assets], ([$character, $assets]) => {
		if (!$character || !$assets) {
			return [];
		}
		const assetsByID = keyBy($assets, 'id');
		const characterAssets = $character?.data?.assets ?? [];
		return characterAssets.map((id) => assetsByID[id]).filter(Boolean);
	});

	const hasLoaded = character.hasLoaded;

	const updateName = (values: Updaters.Character) => {
		fetch('/api/character/updateName', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json;charset=utf-8'
			},
			body: JSON.stringify({ name: values.name, gameID })
		})
			.then((res) => res.json())
			.then((body) => {
				if (body.success) {
					sendNotification({ text: 'Name updated' });
				} else {
					sendNotification({ text: 'Unable to update name' });
				}
			})
			.catch(() => {
				sendNotification({ text: 'Something went wrong' });
			});
	};
</script>

<h2 class="print-only">{$character?.data?.name}</h2>
{#if $character?.data?.nameLocked}
	<h2 class="print-none">{$character?.data?.name}</h2>
{:else if $hasLoaded}
	<Form
		class="print-none mt2 mb2 flex g2 items-center"
		initialValues={$character?.data}
		onSubmit={updateName}
	>
		<TextField name="name" class="flex-auto" />
		<Button>Update Name</Button>
		<IconButton type="button" icon="print" on:click={() => window.print()} />
	</Form>
{/if}

<div class="rounded bg-primary mb2 flex flex-column g1 divided">
	{#each $characterAssets as asset}
		<PurchasedAssetRow {asset} />
	{/each}
</div>

<style>
	@media screen {
		.print-only {
			display: none;
		}
	}
	@media print {
		:global(.print-none, header, footer, .breadcrumbs, .mdc-drawer, .mdc-snackbar) {
			display: none !important;
		}
		:global(.app-content) {
			margin-left: 0 !important;
		}
		:global(.bg-primary) {
			--primary: transparent;
			--primary-dark: transparent;
			--primary-light: transparent;
			--on-primary: #000;
		}
		:global(html, body) {
			background: transparent !important;
			color: #000 !important;
		}
		.rounded {
			font-size: 14px;
		}
		.rounded :global(.actions) {
			display: none;
		}
		:global(.main-content) {
			overflow: visible !important;
		}
		:global(#svelte, .drawer-container, .app-content) {
			height: auto !important;
			overflow: visible !important;
		}
		:global(html) {
			font-size: 12px;
		}
	}
</style>
