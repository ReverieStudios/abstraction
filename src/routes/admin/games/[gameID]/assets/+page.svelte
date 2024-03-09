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
	import { groupBy, join } from 'lodash-es';
	import { database } from '$lib/database';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { Docs, Updaters } from '$lib/database/types';
	import type { Game } from '$lib/database/types/Game';
	import ImageSelector from '$lib/form/ImageSelector.svelte';
	import CopyBox from '$lib/ui/CopyBox.svelte';
	import FavoriteList from '$lib/FavoriteList.svelte';

	const game: Game = $page.data.game;
	const gameID: string = $page.data.gameID;

	const assets = database.assets;
	const assetTypes = database.assetTypes;
	const flags = database.flags;
	const favoriteCounts = database.favoriteCounts;

	$: assetsByType = groupBy($assets, 'data.type') as Record<string, Docs.Asset[]>;
	$: subTypes = groupBy($assetTypes, 'data.parentTypeID');
	$: favoriteCountById = $favoriteCounts?.data ?? {};

	const getSubAssets = (parentID: string, typeID: string) =>
		$assets.filter((asset) => asset.data.type === typeID && asset.data.subtype === parentID);

	$: flagsForCheckboxes = $flags.map((flag) => ({ label: flag.data.name, value: flag.id }));

	interface Editing {
		asset?: Docs.Asset;
		type?: Docs.AssetType;
		hasExtraFields?: boolean;
	}

	let editing: Editing = null;
	$: typeId = $page.url.searchParams.get('type');
	$: subtypeId = $page.url.searchParams.get('subtype');
	$: assetsOfType = typeId ? assetsByType[typeId] ?? [] : [];

	$: assetId = $page.url.searchParams.get('asset');
	$: favoriteId = $page.url.searchParams.get('favorite');

	const getUrl = (typeId?: string, subtypeId?: string, assetId?: string, favoriteId?: string) => {
		const parts = [
			typeId ? `type=${typeId}` : null,
			subtypeId ? `subtype=${subtypeId}` : null,
			assetId ? `asset=${assetId}` : null,
			favoriteId ? `favorite=${favoriteId}` : null
		].filter(Boolean);

		return `?${parts.join('&')}`;
	};

	$: {
		editing = null;
		if (assetId) {
			const asset: Docs.Asset = $assets.find((asset) => asset.id === assetId);
			if (asset) {
				const type = $assetTypes.find((type) => type.id === asset.data.type);
				if (type) {
					const hasExtraFields = (type.data.fields ?? []).length > 0;

					editing = {
						asset,
						type,
						hasExtraFields
					};
				}
			}
		}
	}

	$: assetLock = editing?.asset ? database.locks.doc(editing.asset.id) : null;
	$: lock = $assetLock;

	const notifyAssetChange = (assetID, assetName) => {
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
				assetID,
				serverID: game.discordID,
				message: `${assetName} has been updated.`
			})
		});
	};

	const updateAsset = (
		values: { asset: Updaters.Asset; lock: Updaters.Lock },
		modified: Record<string, boolean>
	) => {
		return Promise.all([
			modified.asset && editing.asset.update(values.asset),
			modified.lock && lock.update(values.lock),
			notifyAssetChange(editing.asset.id, values.asset.name)
		]);
	};

	const removeAsset = (asset: Docs.Asset) => {
		return Promise.all([asset.remove(), database.locks.doc(asset.id).remove()]);
	};

	const getParentAssets = (typeID: string) =>
		(assetsByType[typeID] ?? []).map((asset) => ({ text: asset.data.name, value: asset.id }));

	let emails: { email: string; name: string }[] = null;
	const fetchEmailList = (assetID: string) => {
		fetch('/api/character/usersWithAsset', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json;charset=utf-8'
			},
			body: JSON.stringify({ gameID, assetID })
		})
			.then((res) => res.json())
			.then((body) => {
				emails = body.emailNames;
			});
	};
</script>

<svelte:head>
	<title>Editing: {game.name} Assets</title>
</svelte:head>

<div class="content">
	<h1>{game.name} Assets</h1>

	<Modal open={emails} on:close={() => (emails = null)}>
		<h2>Emails</h2>
		<ul>
			{#each emails as { email, name }}
				<li>{name} - {email}</li>
			{/each}
		</ul>
		<CopyBox content={emails.map(({ email }) => email).join(';')} />
	</Modal>

	<Modal open={editing} on:close={() => goto(getUrl(typeId, subtypeId))} let:closeModal>
		<h2>Editing: {editing.asset?.data.name}</h2>

		<Form
			class="flex flex-column g2"
			initialValues={{ asset: editing.asset?.data, lock: lock?.data }}
			multiform
			onSubmit={updateAsset}
			afterSubmit={closeModal}
		>
			<div class="flex g2 flex-wrap">
				<TextField class="flex-auto" label="Name" name="asset.name" />
				<ImageSelector name="asset.image" slot="over" />
			</div>
			<RichEditor label="Summary" name="asset.summary" />
			{#if editing.type.data.parentTypeID}
				<Select
					items={getParentAssets(editing.type.data.parentTypeID)}
					name="asset.subtype"
					label="Grouped In"
				/>
			{/if}

			{#each editing.type.data.fields ?? [] as field (field.title)}
				{#if field.type === 'markdown'}
					<RichEditor label={field.title} name="asset.fields.{field.title}" />
				{:else if field.type === 'plain'}
					<TextField label={field.title} name="asset.fields.{field.title}" />
				{:else if field.type === 'character_name'}
					<TextField label={field.title} name="asset.enforceName" />
				{:else}
					<TextField
						helperText="Unknown field type {field.type}"
						label={field.title}
						name="asset.fields.{field.title}"
					/>
				{/if}
			{/each}

			<TextField
				label="Quantity limit"
				helperText="0 = unlimited"
				type="number"
				name="lock.claimLimit"
			/>

			<div class="flex">
				<CheckBoxGroup
					class="flex-auto border-right"
					label="Required"
					name="lock.requirements"
					items={flagsForCheckboxes}
				/>
				<CheckBoxGroup
					class="flex-auto"
					label="Forbidden"
					name="lock.limitations"
					items={flagsForCheckboxes}
				/>
			</div>

			<Button class="mt1 fill" type="submit">Save</Button>
		</Form>
	</Modal>

	<Modal open={favoriteId} on:close={() => goto(getUrl(typeId, subtypeId))} let:closeModal>
		<h2>Favorites: {$assets.find((asset) => asset.id === favoriteId).data.name}</h2>

		<FavoriteList assetId={favoriteId} />

		<Button slot="actions" class="mt1 fill" type="button" on:click={closeModal}>Close</Button>
	</Modal>

	<hr />
	<Wrapper items={$assetTypes} let:item={type}>
		<Item>
			<a href={typeId !== type.id ? getUrl(type.id) : getUrl()} class="h3 fill block">
				{type.data.name} ({assetsByType?.[type.id]?.length ?? 0})
			</a>
			{#if typeId === type.id}
				<div class="divided pt2" transition:slide|global>
					{#each assetsOfType as asset (asset.id)}
						<div class="flex items-center justify-center hover-bg-primary-dark">
							<a href={getUrl(type.id, null, asset.id)} class="pl2 py1 flex-auto">
								<h4 class="bold h4 my1 text-black">{asset.data.name}</h4>
							</a>
							{#if favoriteCountById[asset.id] > 0}
								<a href={getUrl(typeId, null, null, asset.id)}>
									<Icon>favorite</Icon> ({favoriteCountById[asset.id]})
								</a>
							{/if}
							{#if subTypes[type.id]}
								{#if subtypeId !== asset.id}
									<IconButton icon="expand_more" href={getUrl(type.id, asset.id, null)} />
								{:else}
									<IconButton icon="expand_less" href={getUrl(type.id)} />
								{/if}
							{/if}
							<IconButton icon="email" on:click={() => fetchEmailList(asset.id)} />
							<ConfirmButton on:confirm={() => removeAsset(asset)} />
						</div>
						{#if subtypeId === asset.id}
							<div class="px3 py2 bg-secondary divided">
								{#each subTypes[type.id] as subType}
									{@const subAssets = getSubAssets(asset.id, subType.id)}
									<div>
										<h3>{subType.data.name} ({subAssets.length})</h3>
										{#each subAssets as subAsset}
											<div class="flex items-center justify-center hover-bg-primary-dark">
												<a href={getUrl(type.id, subtypeId, subAsset.id)} class="pl2 py1 flex-auto">
													<h4 class="bold h4 my1 text-black">{subAsset.data.name}</h4>
												</a>
												{#if favoriteCountById[subAsset.id] > 0}
													<Icon>favorite</Icon> ({favoriteCountById[subAsset.id]})
												{/if}
												<ConfirmButton on:confirm={() => removeAsset(subAsset)} />
											</div>
										{/each}
										<div class="pt2">
											<CreateButton
												buttonText="Create New {subType.data.name} in {asset.data.name}"
												color="accent"
												parent={assets}
												id={() => null}
												data={(t) => ({
													type: subType.id,
													subtype: asset.id,
													name: t,
													summary: ''
												})}
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
							parent={assets}
							id={() => null}
							data={(t) => ({ type: type.id, name: t, summary: '' })}
						/>
					</div>
				</div>
			{/if}
		</Item>
	</Wrapper>
</div>
