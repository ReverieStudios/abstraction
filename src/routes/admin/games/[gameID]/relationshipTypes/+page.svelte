<script lang="ts">
	import { database } from '$lib/database';
	import type { Docs, Updaters } from '$lib/database';
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
	import type { RelationshipType } from '$lib/database/types/RelationshipTypes';
	import type { Game } from '$lib/database/types/Game';
	import Checkbox from '$lib/form/Checkbox.svelte';

	const game: Game = $page.data.game;
	export let relationshipTypes = database.relationshipTypes;

	$: editingType = $page.url.searchParams.get('relationshipType');
	$: editing = $relationshipTypes?.find((doc) => doc.id === editingType);

	const deselect = () => {
		goto('?');
	};

	const fieldTypes = [
		{ text: 'Plaintext', value: 'plain' },
		{ text: 'Richtext', value: 'markdown' },
	];

	const updateType = async (value: RelationshipType) => {
		const updatedFields = new Set((value.fields || []).map((f) => f.title));
		const removedFields = (editing?.data.fields ?? []).filter((f) => !updatedFields.has(f.title));
		const removedFieldNames = removedFields
				.map((f) => f.title);

		const transaction = store.writeBatch();
		if (removedFields.length > 0 && database?.relationships) {
			const relationshipsOfType = await database.relationships
				.withQueries({ field: 'type', op: '==', value: editing?.id })
				.read();

			const getUpdate = (rel: Docs.Relationship) => {
				const update: Updaters.Relationship = {
					fields: omit(rel.data.fields, removedFieldNames)
				};
				return update;
			};

			relationshipsOfType
				.filter((relationship: Docs.Relationship) => {
					return (
						removedFieldNames.some((fieldName) => relationship?.data?.fields?.[fieldName] != null)
					);
				})
				.forEach((relationship: Docs.Relationship) => {
					relationship.update(getUpdate(relationship), transaction);
				});
		}

		editing?.update(value, transaction);
		return await transaction.commit();
	};

	const getOtherTypes = (editing: Docs.RelationshipType | undefined) => {
		const otherTypes = $relationshipTypes?.filter((type) => type.id !== editing?.id);
		return otherTypes?.map((type) => ({ text: type.data.name, value: type.id }));
	};
</script>

<svelte:head>
	<title>Editing: {game?.name ?? 'Game'} Relationship Types</title>
</svelte:head>

<Modal
	title="Editing {editing?.data?.name ?? 'Relationship Type'}"
	open={editing}
	on:close={deselect}
	let:closeModal
>
	<Form initialValues={editing?.data} onSubmit={updateType} afterSubmit={closeModal}>
		<div class="flex flex-column g2">
			<TextField class="flex-auto" label="Name" name="name" />
			<TextField class="flex-auto" label="Description" name="description" />
			<Checkbox label="Show description after selection" name="showDescriptionAfterSelection" />
			<Select items={getOtherTypes(editing)} name="parentTypeID" label="Subtype Of" />
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
				<Checkbox label="Show field after selection" name="{namePrefix}showAfterSelection" />
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
	<h1>Edit Relationship Types</h1>

	<Wrapper class="divided">
		{#each $relationshipTypes ?? [] as relationshipType (relationshipType?.id)}
			<Item href="?relationshipType={relationshipType?.id}" text={relationshipType?.data.name}>
				<ConfirmButton slot="actions" on:confirm={() => relationshipType?.remove()} />
			</Item>
		{/each}
	</Wrapper>
	<div class="mt2 mx3">
		<CreateButton
			parent={relationshipTypes}
			id={() => null}
			data={(n) => ({
				name: n,
				fields: []
			})}
		/>
	</div>
</div>
