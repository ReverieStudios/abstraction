<script lang="ts">
	import { database } from '$lib/database';
	import type { Docs } from '$lib/database';
	import RelationshipRow from './RelationshipRow.svelte';
	import { derived, type Readable } from 'svelte/store';
	import { Lock, isPurchased } from '$lib/database/types/Lock';
	import { keyBy } from 'lodash-es';
	import { createEventDispatcher, tick } from 'svelte';
	import { slide } from 'svelte/transition';
	import { flip } from 'svelte/animate';
	import { MoveIcon, SortableItem} from 'svelte-sortable-items';
	import Tooltip from 'lib/ui/Tooltip.svelte';
	import IconButton from 'lib/ui/IconButton.svelte';
	import LockIcon from './LockIcon.svelte';
	import FlagCheck from './FlagCheck.svelte';
	import Modal from '$lib/ui/Modal.svelte';
	import Button from '$lib/ui/Button.svelte';

	export let gameID: string | null = null;
	export let userID: string | null = null;
	export let user: any = null;
	export let relationshipSelectorID: string;    
	export let choose: ((assetID: string) => void) | null = null;
	export let unchoose: (() => void) | null = null;
	export let updateRankings: ((relationshipSelectorID: string, rankedIDs: string[]) => Promise<boolean>) | null = null;
	export let existingRanks: string[] | null = null;
	// allow disabling drag-and-drop (render static list) when false
	export let allowSort: boolean = true;
    export let isChosen: boolean = false;
	export let enableHelp: boolean = true;
	
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

	const relationships = database.relationships;
	const relationshipSelectors = database.relationshipSelectors;

	const relationshipsById: Readable<Record<string, Docs.Relationship>> = derived(relationships, ($rels) => {
		return keyBy($rels ?? [], 'id');
	});

	const handleChoose = async(relationshipSelectorID: string, rankedRelationships: string[]) => {
		if (relationshipSelectorID && choose) {
			await choose(relationshipSelectorID);
		}
		if (relationshipSelectorID && rankedRelationships && updateRankings) {
			await updateRankings(relationshipSelectorID, rankedRelationships);
		}
	};

	let selector: Docs.RelationshipSelector | null = null;
	$: selector = $relationshipSelectors?.find((s: any) => s.id === relationshipSelectorID) ?? null;

	// derive the lock for this selector from the locks collection to avoid
	// calling `doc()` with an invalid/reserved id (which can throw).
	const assetLock = derived([relationshipSelectors, database.locks], ([$relationshipSelectors, $locks]) => {
		const sel = $relationshipSelectors?.find((s: any) => s.id === relationshipSelectorID) ?? null;
		if (!sel) return null;
		return ($locks ?? []).find((l: any) => l.id === sel.id) ?? null;
	});

	// requirements/limitations derived from the selected lock (may be null)
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

	let numberHoveredItem: number;

	// track whether the user has interacted with the list (so server results don't overwrite)
	let userHasTouched = false;
	let applyingServerRanks = false;
	// key to force remount of the sortable list so third-party libs rebind correctly
	let listKey = 0;

	async function applyRanks(ranks: string[]) {
		console.log('RelationshipChooser.applyRanks:', relationshipSelectorID, 'ranks=', ranks);
		applyingServerRanks = true;
		// mutate in-place so SortableItem keeps the same array reference
		rankedIds.splice(0, rankedIds.length, ...ranks);
		// allow DOM + sortable internals to rebind
		await tick();
		// bump key to force remount of SortableItem list so internal state resets
		listKey += 1;
		applyingServerRanks = false;
		console.log('RelationshipChooser.applyRanks: applied for', relationshipSelectorID, 'rankedIds=', rankedIds);
	}

	let rankedIds: string[] = [];
	// guard so we only initialize rankedIds when the selector first appears or changes
	let _selectorInitializedId: string | null = null;
	// initialize from parent-provided `existingRanks` when available; fall back to selector data
	$: if (selector && selector.id !== _selectorInitializedId) {
	(async () => {
		const seed = Array.isArray(existingRanks) && existingRanks.length > 0
		? existingRanks
		: (Array.isArray(selector.data?.relationshipIDs) ? selector.data.relationshipIDs : []);

		await applyRanks(seed); // waits for tick() inside applyRanks
		// now ranks are actually in `rankedIds`
		if (!selectedId || !rankedIds.includes(selectedId)) {
		selectedId = rankedIds[0] ?? null;
		}
		_selectorInitializedId = selector.id;
	})();
	}

function arraysEqual(a: string[] | null | undefined, b: string[] | null | undefined) {
    if (a === b) return true;
    if (!a || !b) return false;
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
    return true;
}

// If parent-provided rankings arrive after initialization, update the local ordering.
// `existingRanks === null` indicates loading; only apply when parent has provided an array.
$: if (
	selector &&
	selector.id === _selectorInitializedId &&
	Array.isArray(existingRanks) &&
	existingRanks.length > 0 &&
	!arraysEqual(rankedIds, existingRanks) &&
	!userHasTouched
) {
	// apply server rankings only if user hasn't already interacted
	applyRanks(existingRanks);
	if (!selectedId || !rankedIds.includes(selectedId)) {
		selectedId = rankedIds[0] ?? null;
	}
}
	let selectedId: string | null = null;
	let showHelp = false;
	let closeModal: () => void;
	const dispatch = createEventDispatcher();
	function onClickItem(id: string) {
		selectedId = id;
		dispatch('select', { id });
	}
</script>

<svelte:head>
	<!-- touch drag polyfill for mobile drag-and-drop support -->
	<script src="https://unpkg.com/svelte-drag-drop-touch@0.1.9/dist/svelte-drag-drop-touch.bundled.js"></script>
</svelte:head>

<div class="p1" id={"chooser-" + selector?.id}>
    <div class="flex items-center g1">
		<LockIcon {lockStatus} asset={selector} />
        <h2 class="mb1">{selector?.data?.name ?? 'Relationships'}</h2>
		{#if !isChosen && allowSort}<FlagCheck {gameID} {user} {requirements} {limitations} />{/if}
		{#if subselection.depth > 1 && subselection.loopDepth === 0 && subselection.total > 1}
			<div class="h4">
				{subselection.name} ({subselection.total} Choice{subselection.total > 1 ? 's' : ''})
				<br/>
				<span class="muted">Choice {subselection.on}</span>
			</div>
		{/if}
		<div class="ml-auto flex items-center g1">
		{#if allowSort}
			{#if !isChosen}
				<Tooltip rich text="Continue with '{selector?.data?.name }'">
					<IconButton icon="arrow_forward" on:click={() => handleChoose(relationshipSelectorID, rankedIds)} />
				</Tooltip>
			{:else}
				<Tooltip rich text="Go back — remove '{selector?.data?.name }'">
					<IconButton icon="arrow_back" on:click={unchoose} />
				</Tooltip>
			{/if}
		{/if}
		</div>
    </div>
	{#if !isChosen}
		<div class="relationship-chooser mb2" out:slide|global data-showing>
			{#if !selector}
				<div class="muted">No relationship selector found.</div>
			{:else}
				<div class="chooser-grid">
					<div class="bg-surface">
						<div class="flex items-center justify-between g1">
							{#if allowSort}
								<h3>Rank Your Choices Here</h3>
							{:else}
								<h3>Your Rankings</h3>
							{/if}
							{#if enableHelp}
								<IconButton icon="help_outline" on:click={() => (showHelp = true)} />
							{/if}
						</div>
						<div class="p2 rounded bg-secondary h3">
									{#key listKey}
									{#if allowSort}
										{#each rankedIds as id, i (id)}
										<div animate:flip>
											<SortableItem
												propItemNumber={i}
												bind:propData={rankedIds}
												bind:propHoveredItemNumber={numberHoveredItem}
											>
												<div class="sortable-row"
					 							on:pointerdown={() => (userHasTouched = true)}
					 							on:touchstart={() => (userHasTouched = true)}
					 							class:classHovered={numberHoveredItem === i}
					 							on:click={() => onClickItem(id)}>
												<MoveIcon propSize={12} />
												{$relationshipsById?.[id]?.data?.name ?? id}
											</div>
											</SortableItem>
										</div>
										{/each}
									{:else}
										{#each rankedIds as id, i (id)}
											<div animate:flip>
												<div class="sortable-row" on:click={() => onClickItem(id)}>
													<MoveIcon propSize={12} />
													{$relationshipsById?.[id]?.data?.name ?? id}
												</div>
											</div>
										{/each}
									{/if}
									{/key}

						</div>
						<div class="p2">You will get {selector?.data?.relationshipsPerCharacter} relationship{selector?.data?.relationshipsPerCharacter > 1 ? 's' : ''} from this group.</div>
					</div>

					<div class="preview">
						{#if rankedIds.length === 0}
							<div class="muted">No relationships available</div>
						{:else}
							<div class="rows rounded bg-secondary-light h3 p2">
								{#each rankedIds as id (id)}
									<div class:hidden={id !== selectedId} class:selected={id === selectedId}>
										<RelationshipRow
											{gameID}
											{user}
											{userID}
											relationship={$relationshipsById?.[id]}
										/>
									</div>
								{/each}
							</div>
						{/if}
					</div>
				</div>
			{/if}
		</div>
	{/if}
</div>

<Modal title="About Rankings" open={showHelp} on:close={() => (showHelp = false)} let:closeModal={closeModal}>
	<div class="help-body">
		<p>You can rank your preferred relationships by dragging them
			up and down, with your most preferred choice at the top.</p>
		<p>After everyone has made their choices, the character creator will
			assign relationships based on these rankings, doing its best to 
			ensure that you get the relationships you want most 
			while also balancing the needs of other participants.</p>
		<p>When you've finished your character, but before relationships are assigned,
			your character sheet will show you your rankings. After relationships are assigned,
			the character sheet will update with which relationship(s) you got, and who you've
			been matched with!
		</p>
	</div>
	<svelte:fragment slot="actions">
		<Button type="button" on:click={closeModal}>Close</Button>
	</svelte:fragment>
</Modal>

<style>
	.help-body {
		max-height: 60vh;
		overflow-y: auto;
		padding: 0 0.5rem;
	}
	.chooser-grid { display: grid; grid-template-columns: 320px 1fr; gap: 1rem; }
	.list { border-right: 1px solid var(--surface-2); padding-right: 0.5rem; }
	ul { list-style: none; padding: 0; margin: 0; }
	li { padding: 0.5rem; border-radius: 6px; cursor: grab; }
	li.selected { background: color-mix(in srgb, var(--primary) 10%, transparent); }
	li:active { cursor: grabbing; }
	.preview { padding-left: 0.5rem; }
	.muted { color: var(--muted); padding: 0.5rem; }
	.hidden { display: none; }
	.classHovered {
		background-color: var(--primary-light);
		color: var(--on-primary);
	}

	/* Improve touch dragging: prevent page scroll while interacting with sortable items */
	.sortable-row {
		-webkit-user-select: none;
		-moz-user-select: none;
		user-select: none;
		-webkit-touch-callout: none;
		touch-action: none;
		cursor: grab;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0.5rem;
		border-radius: 6px;
	}
	.sortable-row:active { cursor: grabbing; }

	@media (max-width: 720px) {
		.chooser-grid {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
		}
		.list {
			border-right: none;
			padding-right: 0;
		}
		.preview {
			padding-left: 0;
			margin-top: 0.5rem;
		}
	}
</style>
