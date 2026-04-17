<script lang="ts" context="module">
	import { database } from '$lib/database';
	import type { Docs } from '$lib/database';

	const assetTypes = database.assetTypes;
</script>

<script lang="ts">
	import { slide } from 'svelte/transition';
	import LockIcon from './LockIcon.svelte';
	import RichViewer from '$lib/ui/RichViewer.svelte';
	import IconButton from 'lib/ui/IconButton.svelte';
	import { derived, type Readable } from 'svelte/store';
	import FavoriteIcon from './FavoriteIcon.svelte';
	import { Lock, isPurchased } from '$lib/database/types/Lock';
	import { storage } from '$lib/firebase';
	import FlagCheck from './FlagCheck.svelte';
	import type { User } from '$lib/database/types/User';
	import Tooltip from '$lib/ui/Tooltip.svelte';
	import { getFields } from '$lib/database/types/Assets';
	import Accordion, { Panel, Header, Content } from '@smui-extra/accordion';
	import SmuiIconButton, { Icon } from '@smui/icon-button';
	import { afterUpdate, tick } from 'svelte';

	export let gameID: string | null;
	export let userID: string | null;
	export let user: User | null;
	export let asset: Docs.Asset | null;
	export let isChosen: boolean = false;

	export let choose: (() => void) | null = null;
	export let unchoose: (() => void) | null = null;

	const assetLock = database.locks?.doc(asset?.id ?? "");
	$: requirements = $assetLock?.data?.requirements;
	$: limitations = $assetLock?.data?.limitations;

	const lockStatus: Readable<Lock.Status> = derived(assetLock, (lock) => {
		const limit = lock?.data?.claimLimit ?? 0;
		const claims = lock?.data?.claims ?? [];
		const queue = lock?.data?.claimsQueue ?? [];
		if (!limit) {
			return Lock.Status.None;
		} else if (claims.some((lock: Lock.Claim) => lock.purchaser === userID)) {
			return Lock.Status.PlayerClaimed;
		} else if (claims.length >= limit && claims.every((lock: Lock.Claim) => isPurchased(lock))) {
			return Lock.Status.Unavailable;
		} else if (queue.includes(userID)) {
			return Lock.Status.PlayerQueued;
		}  else if (claims.length < limit) {
			return Lock.Status.PlayerCanClaim;
		} else {
			return Lock.Status.PlayerCanQueue;
		}
	});

	let inspecting = false;

	const assetType: Readable<Docs.AssetType | null> = derived(assetTypes, (types) => {
		const typeId = asset?.data?.type;
		return (types ?? []).find((type: Docs.AssetType) => type.id === typeId);
	});

	const fields = derived(assetType, (type) => {
		if (!type) {
			return [];
		}
		return getFields(asset, type, false);
	})

	const summmaryField: Readable<{label: string; text: string; type: string; showAfterChosen: boolean} | null> = derived(assetType, (type) => {
		if (!type) {
			return null;
		}
		return asset?.data.summary ? getFields(asset, type, false)[0] : null;
	});

	const extraFields = derived(assetType, (type) => {
		if (!type) {
			return [];
		}
		const sliceAmount = asset?.data.summary ? 1 : 0;

		return getFields(asset, type, false).slice(sliceAmount);
	});

	const fieldsAfterChosen = derived(fields, (allFields) =>
		allFields.filter((f) => f.showAfterChosen)
	);

	let fieldsPanelOpen = false;

	let extraPanelsOpen = $extraFields.length > 0 ? Array($extraFields.length).fill(true) : [];

	let chosenPanelsOpen = $fieldsAfterChosen.length > 0 ? Array($fieldsAfterChosen.length).fill(false): [];

	let rowEl: HTMLElement;
	let pendingScroll = false;

  	async function scrollToSelf() {
		pendingScroll = true;
  	};

	afterUpdate(async () => {
        if (pendingScroll && rowEl) {
            await tick();
            await new Promise(requestAnimationFrame);
            rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
            rowEl.classList.add('highlight');
            setTimeout(() => rowEl.classList.remove('highlight'), 1200);
            console.log('scrolled to', rowEl.id);
            pendingScroll = false;
        }
    });

	$: if (rowEl) {
		console.log('rowEl assigned:', rowEl?.id);
	}
</script>

<div class="flex items-start p2" out:slide|global data-showing bind:this={rowEl} id={"asset-" + asset?.id}>
	{#if !isChosen}
		<span class="flex-auto flex flex-column" id={"asset-" + asset?.id}>
			<span class="h3 flex flex-wrap items-center g1">
				<LockIcon {lockStatus} {asset} />
				{#if asset?.data?.image}
					{#await storage.getDownloadURL(asset.data.image) then url}
						<div class="image" style="background-image:url({url})" />
					{/await}
				{/if}
				<span class="asset-name">{asset?.data?.name}</span>
				<FlagCheck {gameID} {user} {requirements} {limitations} />

				<div class="ml-auto flex items-center g1 flex-none">
					<Tooltip rich text="Mark '{asset?.data?.name}' as a favorite">
						<FavoriteIcon assetID={asset?.id ?? null} {gameID}  on:favorited={scrollToSelf} />
					</Tooltip>
					<Tooltip rich text="Add '{asset?.data?.name}'">
						<IconButton icon="add_shopping_cart" on:click={choose} />
					</Tooltip>
				</div>
			</span>
			<div class="fields">
				{#if $summmaryField}
					<div>
						{#if $summmaryField.label}<h4 class="h3">{$summmaryField.label}</h4>{/if}
						<div class="px2">
							{#if $summmaryField.type === 'markdown'}
								<RichViewer value={$summmaryField.text} />
							{:else}
								<p>{$summmaryField.text}</p>
							{/if}
						</div>
					</div>					
				{/if}
				{#if $extraFields.length > 0}
					<div class="accordion-container">
						<Accordion>
							{#if $extraFields.length == 1}
								{#each $extraFields as { label, text, type }, i}
									<Panel bind:open={fieldsPanelOpen} color="secondary">
										<Header>
											{#if label}{label}{/if}
											<SmuiIconButton slot="icon" toggle pressed={extraPanelsOpen[i]}>
												<Icon class="material-icons" on>expand_less</Icon>
												<Icon class="material-icons">expand_more</Icon>
											</SmuiIconButton>
										</Header>
										<Content>
											<div>
												{#if type === 'markdown'}
													<RichViewer value={text} />
												{:else}
													<p>{text}</p>
												{/if}
											</div>
										</Content>
									</Panel>
								{/each}
							{:else}
							<Panel bind:open={fieldsPanelOpen} color="secondary">
								<Header>
									Details
									<SmuiIconButton slot="icon" toggle pressed={fieldsPanelOpen}>
										<Icon class="material-icons" on>expand_less</Icon>
										<Icon class="material-icons">expand_more</Icon>
									</SmuiIconButton>
								</Header>
								<Content>
									<Accordion multiple>
										{#each $extraFields as { label, text, type }, i}
											<Panel bind:open={extraPanelsOpen[i]} color="secondary">
												<Header>
													{#if label}<h4 class="h3">{label}</h4>{/if}
													<SmuiIconButton slot="icon" toggle pressed={extraPanelsOpen[i]}>
														<Icon class="material-icons" on>expand_less</Icon>
														<Icon class="material-icons">expand_more</Icon>
													</SmuiIconButton>
												</Header>
												<Content>
													<div>
														{#if type === 'markdown'}
															<RichViewer value={text} />
														{:else}
															<p>{text}</p>
														{/if}
													</div>
												</Content>
											</Panel>
										{/each}
									</Accordion>
								</Content>
							</Panel>
							{/if}
						</Accordion>
					</div>
				{/if}
			</div>
		</span>
	{:else}
		<div class="flex-auto flex flex-column" id={"asset-" + asset?.id}>
			<div class="h3 flex items-center">
				<LockIcon {lockStatus} {asset} />
				{asset?.data?.name}
				<div class="ml-auto flex items-center g1">
					<Tooltip rich text="Remove '{asset?.data?.name}'">
						<IconButton icon="remove_shopping_cart" on:click={unchoose} />
					</Tooltip>
				</div>
			</div>
			{#if $fieldsAfterChosen.length > 0}
				<div class="fields">
					<div class="accordion-container">
						<Accordion multiple>
							{#each $fieldsAfterChosen as { label, text, type }, i}
								<Panel bind:open={chosenPanelsOpen[i]} color="surface">
									<Header>
										{#if label}{label}{:else}Summary{/if}
										<SmuiIconButton slot="icon" toggle pressed={chosenPanelsOpen[i]}>
											<Icon class="material-icons" on>expand_less</Icon>
											<Icon class="material-icons">expand_more</Icon>
										</SmuiIconButton>
									</Header>
									<Content>
										<div class="px2">
											{#if type === 'markdown'}
												<RichViewer value={text} />
											{:else}
												<p>{text}</p>
											{/if}
										</div>
									</Content>
								</Panel>
							{/each}
						</Accordion>
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	@media (max-width: 52em) {
		h4 {
			margin-top: 2px;
			margin-bottom: 2px;
		}

		.accordion-container :global(.smui-paper__content),
		.accordion-container :global(.smui-paper) {
			padding-top: 2px !important;
			padding-bottom: 2px !important;
			padding-left: 8px !important;
			padding-right: 8px !important;
		}
		.accordion-container :global(.smui-accordion__header__title) {
			padding-left: 8px !important;
			padding-right: 8px !important;
		}
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
	:global(.highlight) {
		background: color-mix(in srgb, var(--primary) 20%, transparent) !important;
		box-shadow: 0 2px 12px 0 color-mix(in srgb, var(--primary) 30%, transparent) !important;
		border-radius: 12px;
		z-index: 10;
		position: relative;
		transition: box-shadow 0.4s, background 0.4s;
	}
</style>
