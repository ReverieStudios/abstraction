<script lang="ts">
	import Button from '$lib/ui/Button.svelte';
	import CreateButton from '$lib/CreateButton.svelte';
	import ConfirmButton from '$lib/ConfirmButton.svelte';
	import Modal from '$lib/ui/Modal.svelte';
	import Form from '$lib/form/Form.svelte';
	import TextField from '$lib/form/TextField.svelte';
	import RichEditor from '$lib/form/RichEditor.svelte';
	import { Wrapper, Item } from '$lib/boxLinks';
	import { groupBy } from 'lodash-es';
	import { database } from '$lib/database';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { Docs, Updaters } from '$lib/database/types';
	import type { Game } from '$lib/database/types/Game';
	import ImageSelector from '$lib/form/ImageSelector.svelte';
	import type { FieldValue, WithFieldValue } from 'firebase/firestore';
	import HeirarchicalCheckBoxGroup from 'lib/form/HeirarchicalCheckBoxGroup.svelte';
	import ChildCondition from 'lib/DecisionTree/ChildCondition.svelte';

	const game: Game = $page.data.game;
	const gameID: string = $page.data.gameID;

	const relationships = database.relationships;
	const relationshipTypes = database.relationshipTypes;
	const relationshipSelectors = database.relationshipSelectors;

    let relationshipGroups: { id: string; label?: string; items: { label: string; value: string }[] }[] | null = null;

	$: relationshipsByType = groupBy($relationships, 'data.type') as Record<string, Docs.Relationship[]>;
    $: relationshipGroups = buildRelationshipGroups($relationships ?? [], $relationshipTypes ?? []);

    const buildRelationshipGroups = (relationships: Docs.Relationship[], relationshipTypes: Docs.RelationshipType[]) => {
        const groups = (relationshipTypes ?? []).map((type) => ({
            id: type.id,
            label: type.data?.name,
            items: (relationshipsByType[type.id] ?? [])
                .map((r) => ({ label: r.data?.name ?? r.id, value: r.id }))
                .sort((a, b) => a.label.localeCompare(b.label))
        }));
        return groups;
    }

    const deselect = () => {
		goto('?');
	};

	interface Editing {
		relationshipSelector?: Docs.RelationshipSelector;
	}

	$: editingType = $page.url.searchParams.get('relationshipSelector');
    $: editing = $relationshipSelectors?.find((doc) => doc.id === editingType);

	const notifyRelationshipSelectorChange = (
		relationshipSelectorID: string | undefined,
		relationshipSelectorName: FieldValue | WithFieldValue<string | undefined>
	) => {
		if (!game.discordID) {
			return Promise.resolve();
		}
		return fetch('/api/assets/notifyChange', {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json;charset=utf-8'
			},
			body: JSON.stringify({
				gameID,
				assetID: relationshipSelectorID,
				serverID: game.discordID,
				message: `${relationshipSelectorName} has been updated.`
			})
		});
	};

	const updateRelationshipSelector = (
		values: { relationshipSelector: Updaters.RelationshipSelector; },
		modified: Record<string, boolean>
	) => {
		return Promise.all([
			modified.relationshipSelector && editing?.update(values.relationshipSelector),
			notifyRelationshipSelectorChange(editing?.id, values.relationshipSelector?.name)
		]);
	};

	const removeRelationshipSelector = (rel: Docs.RelationshipSelector) => {
		return Promise.all([rel.remove()]);
	};

	let closeModal;
</script>

<svelte:head>
	<title>Editing: {game.name} Relationship Selectors</title>
</svelte:head>

<div class="content">
	<h1>{game.name} Relationship Selectors</h1>

	<Modal open={editing} on:close={deselect} let:closeModal>
		<h2>Editing: {editing?.data.name}</h2>

		<Form
			class="flex flex-column g2"
			initialValues={{ relationshipSelector: editing?.data }}
			multiformd
			onSubmit={updateRelationshipSelector}
			afterSubmit={closeModal}
		>
			<div class="flex g2 flex-wrap">
				<TextField class="flex-auto" label="Name" name="relationshipSelector.name" />
				<ImageSelector name="relationshipSelector.image" slot="over" />
			</div>
			<RichEditor label="Summary" name="relationshipSelector.summary" />


            <HeirarchicalCheckBoxGroup
                all
                label="Relationships:"
                name="relationshipSelector.relationshipIDs"
                groups={relationshipGroups}
            >
                <ChildCondition 
                let:id
                let:checked
                slot="extra" name="childConditions.{id}" {checked} />
            </HeirarchicalCheckBoxGroup>

			<TextField
				label="Number of relationships per characater"
				helperText="defaults to 1, but can be set higher for group relationships"
				type="number"
				name="relationshipSelector.relationshipsPerCharacter"
			/>

			<Button class="mt1 fill" type="submit">Save</Button>
		</Form>
	</Modal>


	<hr />
	<Wrapper class="divided">
        {#each $relationshipSelectors ?? [] as relationshipSelector (relationshipSelector?.id)}
            <Item href="?relationshipSelector={relationshipSelector.id}" text={relationshipSelector?.data.name}>
                <div slot="actions" class="flex g1">
                    <ConfirmButton on:confirm={() => removeRelationshipSelector(relationshipSelector)} />
                </div>
            </Item>
        {/each}
        <div class="mt2 mx3">
            <CreateButton
                parent={relationshipSelectors}
                id={() => null}
                data={(id) => ({ name: id, relationshipIDs: [], relationshipsPerCharacter: 1 })}
            />
        </div>
    </Wrapper>
</div>
