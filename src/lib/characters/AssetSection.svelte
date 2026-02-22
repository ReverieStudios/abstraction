<script lang="ts">
	import { database } from '$lib/database';
	import type { Docs } from '$lib/database';
	import type { User } from '$lib/database/types/User';
	import { keyBy } from 'lodash-es';
	import { derived, type Readable } from 'svelte/store';
	import AssetRow from './AssetRow.svelte';
	import type { Dictionary } from 'lodash';

	const assetsById: Readable<Dictionary<Docs.Asset>> = derived(database.assets, ($assets) => {
		return keyBy($assets, 'id');
	});


	export let gameID: string | null;
	export let userID: string | null;
	export let user: User | null;
	export let assetIDs: string[];
	export let chosenID: string | null = null;
	export let subselection: {
		name: string;
		on: number;
		total: number;
		depth: number;
		loopDepth: number;
	} = {
		name: '',
		on: 1,
		total: 1,
		depth: 1,
		loopDepth: 1
	};

	export let choose: ((assetID: string) => void) | null = null;
	export let unchoose: (() => void) | null = null;
	const favorites = database.favorites;

	const assets: Readable<Docs.Asset[]> = derived(
	[assetsById, favorites],
	([$assetsById, $favorites]) => {
		const assets = assetIDs.map((id) => $assetsById?.[id]).filter(Boolean);
		return assets.sort((a, b) => {
			const favA = $favorites?.data?.[a.id] ? -1 : 0;
			const favB = $favorites?.data?.[b.id] ? -1 : 0;
			if (favA !== favB) return favA - favB;
			const nameA = a.data?.name?.toLowerCase() ?? '';
			const nameB = b.data?.name?.toLowerCase() ?? '';
			return nameA.localeCompare(nameB);
		});
		}
	);

	const assetHeader: Readable<{ header: string; subheader: string }> = derived([assetsById, database.assetTypes], ([$assetsById, $assetTypes]) => {
		const typeID = $assetsById[assetIDs[0]]?.data?.type;
		const type = $assetTypes.find((t: Docs.AssetType) => t.id === typeID);
		if (type?.data?.name) {
			return {
				header: type.data.name,
				subheader: type.data.description
			};
		}
		return { header: '', subheader: '' };
	});
</script>

{#if subselection.depth > 1 && subselection.loopDepth === 0 && subselection.total > 1}
	{#if subselection.on === 1}
		<h2>{subselection.name} ({subselection.total} Choice{subselection.total > 1 ? 's' : ''})</h2>
	{/if}
	<h4>Choice {subselection.on}</h4>
{/if}

{#if (subselection.on === 1 || subselection.depth > 1) && $assetHeader}
	{#if $assetHeader.header}
		<h2 class="mb1">{$assetHeader.header}</h2>
	{/if}
	{#if $assetHeader.subheader}
		<div class="h4 mt1 mb2">{$assetHeader.subheader}</div>
	{/if}
{/if}
{#if subselection.depth === 1 && subselection.total > 1}
	<h4 class="ml2">
		Choice {subselection.on}
	</h4>
{/if}
<div class="rounded bg-surface mb2">
	<div class="flex flex-column g1 divided">
		{#each $assets as asset (asset.id)}
			{#if !chosenID || chosenID === asset.id}
				<AssetRow
					{gameID}
					{user}
					{userID}
					{asset}
					isChosen={chosenID === asset.id}
					choose={choose ? () => choose(asset.id) : null}
					{unchoose}
				/>
			{/if}
		{/each}
	</div>
</div>
