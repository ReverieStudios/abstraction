<script lang="ts" context="module">
	import { database } from '$lib/database';
	import type { Docs } from '$lib/database';

	const assetTypes = database.assetTypes;
</script>

<script lang="ts">
	import { slide } from 'svelte/transition';
	import RichViewer from '$lib/ui/RichViewer.svelte';
	import { derived } from 'svelte/store';
	import { storage } from '$lib/firebase';

	export let asset: Docs.Asset;

	const assetType = derived(assetTypes, (types) => {
		const typeId = asset.data?.type;
		return (types ?? []).find((type) => type.id === typeId);
	});

	const getFields = (asset: Docs.Asset, type: Docs.AssetType) => {
		if (!asset || !type) {
			return [];
		}

		return (type.data?.fields ?? [])
			.map((field) => ({
				label: field.title,
				text: asset.data?.fields?.[field.title],
				type: field.type
			}))
			.filter((f) => f.text);
	};
</script>

{#if $assetType?.data?.hideOnCharacterSheet !== true}
	<div class="items-center hover-bg-primary-light p2" out:slide>
		<span class="h3 flex items-center g1">
			{#if asset.data.image}
				{#await storage.getDownloadURL(asset.data.image) then url}
					<div class="image" style="background-image:url({url})" />
				{/await}
			{/if}
			{$assetType?.data?.name} - {asset.data.name}
		</span>
		{#if asset.data.summary}
			<div class="h4"><RichViewer value={asset.data.summary} /></div>
		{/if}
		{#each getFields(asset, $assetType) as { label, text, type }}
			<div>
				<h4>{label}</h4>
				<div class="pl2">
					{#if type === 'markdown'}
						<RichViewer value={text} />
					{:else}
						{text}
					{/if}
				</div>
			</div>
		{/each}
	</div>
{/if}

<style>
	.image {
		background-position: center center;
		background-size: 70%;
		background-repeat: no-repeat;
		height: 50px;
		width: 50px;
		border-radius: 50%;
		border: 1px solid #ccc;
	}
</style>
