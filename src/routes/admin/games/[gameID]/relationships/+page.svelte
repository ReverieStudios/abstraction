<script lang="ts">
	import Button from '$lib/ui/Button.svelte';
	import IconButton from '$lib/ui/IconButton.svelte';
	import Icon from '$lib/ui/Icon.svelte';
	import CreateButton from '$lib/CreateButton.svelte';
	import ConfirmButton from '$lib/ConfirmButton.svelte';
	import Modal from '$lib/ui/Modal.svelte';
	import Form from '$lib/form/Form.svelte';
	import CheckBoxGroup from '$lib/form/CheckBoxGroup.svelte';
	import TextField from '$lib/form/TextField.svelte';
	import Select from '$lib/form/Select.svelte';
	import RichEditor from '$lib/form/RichEditor.svelte';
	import { Wrapper, Item } from '$lib/boxLinks';
	import { slide } from 'svelte/transition';
	import { groupBy } from 'lodash-es';
	import { database } from '$lib/database';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { Docs, Updaters } from '$lib/database/types';
	import type { Game } from '$lib/database/types/Game';
	import ImageSelector from '$lib/form/ImageSelector.svelte';
	import CopyBox from '$lib/ui/CopyBox.svelte';
	import FavoriteList from '$lib/FavoriteList.svelte';
	import type { FieldValue, WithFieldValue } from 'firebase/firestore';

	const game: Game = $page.data.game;
	const gameID: string = $page.data.gameID;

	const relationships = database.relationships;
	const relationshipTypes = database.relationshipTypes;
	const flags = database.flags;
	const favoriteCounts = database.favoriteCounts;

	$: relationshipsByType = groupBy($relationships, 'data.type') as Record<string, Docs.Relationship[]>;
	$: subTypes = groupBy($relationshipTypes, 'data.parentTypeID');
	$: favoriteCountById = $favoriteCounts?.data ?? {};

	const getSubRelationships = (parentID: string, typeID: string) =>
		$relationships?.filter((rel) => rel.data.type === typeID && rel.data.subtype === parentID);

	$: flagsForCheckboxes = $flags?.map((flag) => ({ label: flag.data.name, value: flag.id }));

	interface Editing {
		relationship?: Docs.Relationship;
		type?: Docs.RelationshipType;
		hasExtraFields?: boolean;
	}

	let editing: Editing | null = null;
	$: typeId = $page.url.searchParams.get('type');
	$: subtypeId = $page.url.searchParams.get('subtype');
	$: relationshipsOfType = typeId ? relationshipsByType[typeId] ?? [] : [];

	$: relationshipId = $page.url.searchParams.get('relationship');
	$: favoriteId = $page.url.searchParams.get('favorite');

	const getUrl = (
        typeId?: string | null,
        subtypeId?: string | null,
        relationshipId?: string | null,
        favoriteId?: string
    ) => {
		const parts = [
			typeId ? `type=${typeId}` : null,
			subtypeId ? `subtype=${subtypeId}` : null,
			relationshipId ? `relationship=${relationshipId}` : null,
			favoriteId ? `favorite=${favoriteId}` : null
		].filter(Boolean);

		return `?${parts.join('&')}`;
	};

	$: {
		editing = null;
		if (relationshipId) {
			const relationship: Docs.Relationship | undefined = $relationships?.find((r) => r.id === relationshipId);
			if (relationship) {
				const type = $relationshipTypes?.find((t) => t.id === relationship.data.type);
				if (type) {
					const hasExtraFields = (type.data.fields ?? []).length > 0;

					editing = {
						relationship: relationship,
						type,
						hasExtraFields
					};
				}
			}
		}
	}

	const notifyRelationshipChange = (
		relationshipID: string | undefined,
		relationshipName: FieldValue | WithFieldValue<string | undefined>
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
				assetID: relationshipID,
				serverID: game.discordID,
				message: `${relationshipName} has been updated.`
			})
		});
	};

	const updateRelationship = (
		values: { relationship: Updaters.Relationship; },
		modified: Record<string, boolean>
	) => {
		return Promise.all([
			modified.relationship && editing?.relationship?.update(values.relationship),
			notifyRelationshipChange(editing?.relationship?.id, values.relationship?.name)
		]);
	};

	const removeRelationship = (rel: Docs.Relationship) => {
		return Promise.all([rel.remove()]);
	};

	const getParentRelationships = (typeID: string) =>
		(relationshipsByType[typeID] ?? []).map((rel) => ({ text: rel.data.name, value: rel.id }));

	let emails: { email: string; name: string }[] | null = null;
	const fetchEmailList = (relationshipID: string) => {
		fetch('/api/character/usersWithAsset', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json;charset=utf-8'
			},
			body: JSON.stringify({ gameID, assetID: relationshipID })
		})
			.then((res) => res.json())
			.then((body) => {
				emails = body.emailNames;
			});
	};

	let closeModal;
</script>

<svelte:head>
	<title>Editing: {game.name} Relationships</title>
</svelte:head>

<div class="content">
	<h1>{game.name} Relationships</h1>

	<Modal open={emails} on:close={() => (emails = null)}>
		<h2>Emails</h2>
		<ul>
			{#each emails ?? [] as { email, name }}
				<li>{name} - {email}</li>
			{/each}
		</ul>
		<CopyBox content={emails?.map(({ email }) => email).join(';')} />
	</Modal>

	<Modal open={editing} on:close={() => goto(getUrl(typeId, subtypeId))} let:closeModal>
		<h2>Editing: {editing?.relationship?.data.name}</h2>

		<Form
			class="flex flex-column g2"
			initialValues={{ relationship: editing?.relationship?.data }}
			multiformd
			onSubmit={updateRelationship}
			afterSubmit={closeModal}
		>
			<div class="flex g2 flex-wrap">
				<TextField class="flex-auto" label="Name" name="relationship.name" />
				<ImageSelector name="relationship.image" slot="over" />
			</div>
			<RichEditor label="Summary" name="relationship.summary" />
			{#if editing?.type?.data.parentTypeID}
				<Select
					items={getParentRelationships(editing.type.data.parentTypeID)}
					name="relationship.subtype"
					label="Grouped In"
				/>
			{/if}

			{#each editing?.type?.data.fields ?? [] as field (field.title)}
				{#if field.type === 'markdown'}
					<RichEditor label={field.title} name="relationship.fields.{field.title}" />
				{:else if field.type === 'plain'}
					<TextField label={field.title} name="relationship.fields.{field.title}" />
				{:else}
					<TextField
						helperText="Unknown field type {field.type}"
						label={field.title}
						name="relationship.fields.{field.title}"
					/>
				{/if}
			{/each}

			<TextField
				label="Relationship Size"
				helperText="defaults to 2, but can be set higher for group relationships"
				type="number"
				name="relationship.size"
			/>

            <TextField
				label="Relationship Capacity"
				helperText="How many total players can have this relationship. (0 for unlimited, defaults to 0)"
				type="number"
				name="relationship.capacity"
			/>

			<Button class="mt1 fill" type="submit">Save</Button>
		</Form>
	</Modal>

	<Modal open={favoriteId} on:close={() => goto(getUrl(typeId, subtypeId))} let:closeModal>
		<h2>Favorites: {$relationships?.find((r) => r.id === favoriteId)?.data.name}</h2>

		<FavoriteList relationshipId={favoriteId} />

		<Button slot="actions" class="mt1 fill" type="button" on:click={closeModal}>Close</Button>
	</Modal>

	<hr />
	<Wrapper items={$relationshipTypes ?? []} let:item={type}>
		<Item>
			<a href={typeId !== type.id ? getUrl(type.id) : getUrl()} class="h3 fill block">
				{type.data.name} ({relationshipsByType?.[type.id]?.length ?? 0})
			</a>
			{#if typeId === type.id}
				<div class="divided pt2" transition:slide|global>
					{#each relationshipsOfType as rel (rel.id)}
						<div class="flex items-center justify-center hover-bg-primary-dark">
							<a href={getUrl(type.id, null, rel.id)} class="pl2 py1 flex-auto">
								<h4 class="bold h4 my1 text-black">{rel.data.name}</h4>
							</a>
							{#if favoriteCountById[rel.id] > 0}
								<a href={getUrl(typeId, null, null, rel.id)}>
									<Icon>favorite</Icon> ({favoriteCountById[rel.id]})
								</a>
							{/if}
							{#if subTypes[type.id]}
								{#if subtypeId !== rel.id}
									<IconButton icon="expand_more" href={getUrl(type.id, rel.id, null)} />
								{:else}
									<IconButton icon="expand_less" href={getUrl(type.id)} />
								{/if}
							{/if}
							<IconButton icon="email" on:click={() => fetchEmailList(rel.id)} />
							<ConfirmButton on:confirm={() => removeRelationship(rel)} />
						</div>
						{#if subtypeId === rel.id}
							<div class="px3 py2 bg-secondary divided">
								{#each subTypes[type.id] as subType}
									{@const subRelationships = getSubRelationships(rel.id, subType.id)}
									<div>
										<h3>{subType.data.name} ({subRelationships?.length})</h3>
										{#each subRelationships ?? [] as subRel}
											<div class="flex items-center justify-center hover-bg-primary-dark">
												<a href={getUrl(type.id, subtypeId, subRel.id)} class="pl2 py1 flex-auto">
													<h4 class="bold h4 my1 text-black">{subRel.data.name}</h4>
												</a>
												{#if favoriteCountById[subRel.id] > 0}
													<Icon>favorite</Icon> ({favoriteCountById[subRel.id]})
												{/if}
												<ConfirmButton on:confirm={() => removeRelationship(subRel)} />
											</div>
										{/each}
										<div class="pt2">
											<CreateButton
												buttonText="Create New {subType.data.name} in {rel.data.name}"
												color="accent"
												parent={relationships}
												id={() => null}
												data={(t) => ({
													type: subType.id,
													subtype: rel.id,
													name: t,
													summary: ''
												})}
												afterCreate={(id) => (id ? database?.relationships?.doc(id)?.update({ size: 2, capacity: 0 }) : Promise.resolve())}
											/>
										</div>
									</div>
								{/each}
							</div>
						{/if}
					{/each}
					<div class="pt2">
						<CreateButton
							buttonText="Create New {type.data.name}"
							color="accent"
							parent={relationships}
							id={() => null}
							data={(t) => ({ type: type.id, name: t, summary: '' })}
							afterCreate={(id) => (id ? database?.relationships?.doc(id)?.update({ size: 2, capacity: 0 }) : Promise.resolve())}
						/>
					</div>
				</div>
			{/if}
		</Item>
	</Wrapper>
</div>
