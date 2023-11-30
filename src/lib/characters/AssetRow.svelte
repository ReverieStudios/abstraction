<script lang="ts" context="module">
	import { database } from '$lib/database';
	import type { Docs } from '$lib/database';

	const assetTypes = database.assetTypes;

	const maybeShowMore = (node: HTMLElement, asset: Docs.Asset) => {
		const checkSize = () => {
			const wrapper = node.closest('[data-showing]') as HTMLElement;
			if (!asset.data.summary) {
				wrapper.dataset.showing = 'all';
				return;
			}

			wrapper.dataset.showing = '';
			const { scrollHeight, offsetHeight } = node;
			const diff = scrollHeight - offsetHeight;
			if (diff <= 0) {
				return;
			} else if (diff < 100) {
				wrapper.dataset.showing = 'all';
			} else {
				wrapper.dataset.showing = 'more';
			}
		};

		const resizeObserver = new ResizeObserver(checkSize);
		resizeObserver.observe(node);

		checkSize();

		return {
			destroy: () => {
				resizeObserver.disconnect();
			}
		};
	};
</script>

<script lang="ts">
	import { slide } from 'svelte/transition';
	import LockIcon from './LockIcon.svelte';
	import RichViewer from '$lib/ui/RichViewer.svelte';
	import IconButton from '$lib/ui/IconButton.svelte';
	import { derived } from 'svelte/store';
	import Inspect from './Inspect.svelte';
	import FavoriteIcon from './FavoriteIcon.svelte';
	import { Lock, isPurchased } from '$lib/database/types/Lock';
	import { storage } from '$lib/firebase';
	import FlagCheck from './FlagCheck.svelte';
	import type { User } from '$lib/database/types/User';
	import Button from '$lib/ui/Button.svelte';
	import Tooltip from '$lib/ui/Tooltip.svelte';
	import { getFields } from '$lib/database/types/Assets';

	export let gameID: string;
	export let userID: string;
	export let user: User;
	export let asset: Docs.Asset;
	export let isChosen: boolean = false;

	export let choose: () => void = null;
	export let unchoose: () => void = null;

	const assetLock = database.locks.doc(asset.id);
	$: requirements = $assetLock?.data?.requirements;
	$: limitations = $assetLock?.data?.limitations;

	const lockStatus = derived(assetLock, (lock) => {
		const limit = lock?.data?.claimLimit ?? 0;
		const claims = lock?.data?.claims ?? [];
		const queue = lock?.data?.claimsQueue ?? [];

		if (!limit) {
			return Lock.Status.None;
		} else if (queue.includes(userID)) {
			return Lock.Status.PlayerQueued;
		} else if (claims.some((lock) => lock.purchaser === userID)) {
			return Lock.Status.PlayerClaimed;
		} else if (claims.length >= limit && claims.every((lock) => isPurchased(lock))) {
			return Lock.Status.Unavailable;
		} else if (claims.length < limit) {
			return Lock.Status.PlayerCanClaim;
		} else {
			return Lock.Status.PlayerCanQueue;
		}
	});

	let inspecting = false;

	const assetType = derived(assetTypes, (types) => {
		const typeId = asset.data?.type;
		return (types ?? []).find((type) => type.id === typeId);
	});

	const fields = derived(assetType, (type) => {
		if (!type) {
			return [];
		}
		return getFields(asset, type, false);
	});

	const fieldsAfterChosen = derived(fields, (allFields) =>
		allFields.filter((f) => f.showAfterChosen)
	);
</script>

<div class="flex items-start hover-bg-primary-light p2 show-some" out:slide data-showing>
	<Inspect bind:open={inspecting} {asset} assetType={$assetType} />
	{#if !isChosen}
		<span class="flex-auto flex flex-column">
			<span class="h3 flex items-center g1">
				<LockIcon {lockStatus} {asset} />
				{#if asset.data.image}
					{#await storage.getDownloadURL(asset.data.image) then url}
						<div class="image" style="background-image:url({url})" />
					{/await}
				{/if}
				{asset.data.name}
				<FlagCheck {gameID} {user} {requirements} {limitations} />

				<div class="ml-auto flex items-center g1">
					<Tooltip rich text="Mark '{asset.data.name}' as a favorite">
						<FavoriteIcon assetID={asset.id} {gameID} />
					</Tooltip>
					<Tooltip rich text="Add '{asset.data.name}'">
						<IconButton icon="chevron_right" on:click={choose} />
					</Tooltip>
				</div>
			</span>
			<div class="fields" use:maybeShowMore={asset}>
				{#each $fields as { label, text, type }}
					<div>
						{#if label}<h4 class="h3">{label}</h4>{/if}
						<div class="px2">
							{#if type === 'markdown'}
								<RichViewer value={text} />
							{:else}
								<p>{text}</p>
							{/if}
						</div>
					</div>
				{/each}
			</div>
		</span>
		<div class="show-more-btn">
			<Button color="secondary" on:click={() => (inspecting = true)}>Show More</Button>
		</div>
	{:else}
		<button type="button" on:click={unchoose} class="text-button flex flex-column">
			<div class="h3 flex items-center">
				<LockIcon {lockStatus} {asset} />
				{asset.data.name}
			</div>
			{#if $fieldsAfterChosen.length > 0}
				<div class="fields" use:maybeShowMore={asset}>
					{#each $fieldsAfterChosen as { label, text, type }}
						<div>
							{#if label}<h4 class="h3">{label}</h4>{/if}
							<div class="px2">
								{#if type === 'markdown'}
									<RichViewer value={text} />
								{:else}
									<p>{text}</p>
								{/if}
							</div>
						</div>
					{/each}
				</div>
			{/if}
		</button>
	{/if}
</div>

<style>
	.show-some .fields {
		max-height: 10em;
		overflow: hidden;
	}
	.show-some:global([data-showing='all']) .fields {
		max-height: none;
	}
	.show-some:global([data-showing='more']) .fields {
		max-height: 10em;
	}
	.show-more-btn {
		display: none;
	}
	.show-more-btn > :global(button) {
		display: block !important;
		width: 40% !important;
		margin: 0 auto !important;
	}
	.show-some:global([data-showing='more']) .show-more-btn {
		display: block;
		position: absolute;
		bottom: 0em;
		left: 1em;
		right: 1em;
		background: linear-gradient(transparent, var(--background-color) 50%);
		padding-bottom: 0.5em;
	}
	.text-button {
		border: 0;
		text-align: left;
		width: 100%;
		background: none;
		padding-left: 0;
		font-weight: bold;
		cursor: pointer;
	}
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
