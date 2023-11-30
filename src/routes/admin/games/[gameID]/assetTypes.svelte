<script context="module" lang="ts">
	import type { Load } from '@sveltejs/kit';
	import { database } from '$lib/database';
	import type { Docs, Updaters } from '$lib/database';

	export const load: Load = ({ stuff }) => {
		return {
			props: {
				game: stuff.game
			}
		};
	};
</script>

<script lang="ts">
	import { store } from '$lib/firebase';
	import Form from '$lib/form/Form.svelte';
	import Modal from '$lib/ui/Modal.svelte';
	import Button from '$lib/ui/Button.svelte';
	import IconButton from '$lib/ui/IconButton.svelte';
	import TextField from '$lib/form/TextField.svelte';
	import Select from '$lib/form/Select.svelte';
	import List from '$lib/form/SimpleList.svelte';
	import CreateButton from '$lib/CreateButton.svelte';
	import ConfirmButton from '$lib/ConfirmButton.svelte';
	import { Wrapper, Item } from '$lib/boxLinks';
	import { omit } from 'lodash-es';

	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { AssetType } from '$lib/database/types/AssetTypes';
	import type { Game } from '$lib/database/types/Game';
	import Checkbox from '$lib/form/Checkbox.svelte';

	export let game: Game;
	export let assetTypes = database.assetTypes;

	$: editingType = $page.url.searchParams.get('assetType');
	$: editing = $assetTypes.find((doc) => doc.id === editingType);

	const deselect = () => {
		goto('?');
	};

	const fieldTypes = [
		{ text: 'Plaintext', value: 'plain' },
		{ text: 'Richtext', value: 'markdown' },
		{ text: 'Character Name', value: 'character_name' }
	];

	const updateType = async (value: AssetType) => {
		const updatedFields = new Set((value.fields || []).map((f) => f.title));
		const removedFields = (editing.data.fields ?? []).filter((f) => !updatedFields.has(f.title));
		const removedCharName = removedFields.find((f) => f.type === 'character_name');
		const removedFieldNames = removedFields
			.filter((f) => f.type !== 'character_name')
			.map((f) => f.title);

		const transaction = store.writeBatch();
		if (removedFields.length > 0) {
			const assetsOfType = await database.assets
				.withQueries({ field: 'type', op: '==', value: editing.id })
				.read();

			const getUpdate = (asset: Docs.Asset) => {
				const update: Updaters.Asset = {
					fields: omit(asset.data.fields, removedFieldNames)
				};
				if (removedCharName) {
					update.enforceName = store.fieldValues.delete();
				}
				console.log(asset.id, update);
				return update;
			};

			assetsOfType
				.filter((asset) => {
					return (
						(removedCharName && asset.data.enforceName != null) ||
						removedFieldNames.some((fieldName) => asset?.data?.fields?.[fieldName] != null)
					);
				})
				.forEach((asset) => {
					asset.update(getUpdate(asset), transaction);
				});
		}

		editing.update(value, transaction);
		return await transaction.commit();
	};

	const getOtherAssetTypes = (editing: Docs.AssetType) => {
		const otherTypes = $assetTypes.filter((type) => type.id !== editing.id);
		return otherTypes.map((type) => ({ text: type.data.name, value: type.id }));
	};
</script>

<svelte:head>
	<title>Editing: {game?.name ?? 'Game'} Asset Types</title>
</svelte:head>

<Modal
	title="Editing {editing?.data?.name ?? 'Asset Type'}"
	open={editing}
	on:close={deselect}
	let:closeModal
>
	<Form initialValues={editing.data} onSubmit={updateType} afterSubmit={closeModal}>
		<div class="flex flex-column g2">
			<TextField class="flex-auto" label="Name" name="name" />
			<TextField class="flex-auto" label="Description" name="description" />
			<Checkbox label="Show description after purchase" name="showDescriptionAfterPurchase" />
			<Checkbox label="Hide from final character sheet" name="hideOnCharacterSheet" />
			<Select items={getOtherAssetTypes(editing)} name="parentTypeID" label="Subtype Of" />
		</div>
		<h4>Fields for type:</h4>
		<List
			name="fields"
			itemTemplate={{ title: '', type: 'plain' }}
			let:remove
			let:move
			let:namePrefix
			let:fieldName
		>
			<div class="flex ml1 mt1 g1">
				<TextField class="flex-auto" label="Field Name" name="{namePrefix}title" />
				<Select items={fieldTypes} name="{namePrefix}type" />
				<Checkbox label="Show field after purchase" name="{namePrefix}showAfterPurchase" />
				<IconButton
					type="button"
					icon="arrow_upward"
					disabled={move.up.disabled}
					on:click={move.up.handler}
				/>
				<IconButton
					type="button"
					icon="arrow_downward"
					disabled={move.down.disabled}
					on:click={move.down.handler}
				/>
				<ConfirmButton on:confirm={remove} />
			</div>
		</List>
		<Button class="mt-5 w-full" type="submit">Save</Button>
	</Form>
</Modal>

<div class="content">
	<h1>Edit Asset Types</h1>

	<Wrapper class="divided">
		{#each $assetTypes as assetType (assetType.id)}
			<Item href="?assetType={assetType.id}" text={assetType.data.name}>
				<ConfirmButton slot="actions" on:confirm={() => assetType.remove()} />
			</Item>
		{/each}
	</Wrapper>
	<div class="mt2 mx3">
		<CreateButton
			parent={assetTypes}
			id={() => null}
			data={(n) => ({
				name: n,
				fields: []
			})}
		/>
	</div>
</div>
