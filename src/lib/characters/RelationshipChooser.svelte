<script lang="ts">
	import { database } from '$lib/database';
	import type { Docs } from '$lib/database';
	import RelationshipRow from './RelationshipRow.svelte';
	import { derived, type Readable } from 'svelte/store';
	import { keyBy } from 'lodash-es';
	import { createEventDispatcher } from 'svelte';
	import { flip } from 'svelte/animate';
	import { MoveIcon, SortableItem} from 'svelte-sortable-items';
	import Tooltip from 'lib/ui/Tooltip.svelte';
	import IconButton from 'lib/ui/IconButton.svelte';

	export let gameID: string | null = null;
	export let userID: string | null = null;
	export let user: any = null;
	export let relationshipSelectorID: string;    
	export let choose: ((assetID: string) => void) | null = null;
	export let unchoose: (() => void) | null = null;
    export let isChosen: boolean = false;
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
		console.log('RelationshipChooser: relationships updated', $rels);
		return keyBy($rels ?? [], 'id');
	});

	let selector: Docs.RelationshipSelector | null = null;
	$: selector = $relationshipSelectors?.find((s: any) => s.id === relationshipSelectorID) ?? null;
	let numberHoveredItem: number;

	$: console.log('RelationshipChooser: selectorID=', relationshipSelectorID, 'loadedSelector=', selector?.id, 'relationshipIDs=', selector?.data?.relationshipIDs?.length ?? 0);

	// ranking state (array of relationship IDs)
	let rankedIds: string[] = [];
	// guard so we only initialize rankedIds when the selector first appears or changes
	let _selectorInitializedId: string | null = null;
	$: if (selector && selector.id !== _selectorInitializedId) {
		console.log('RelationshipChooser: initializing rankedIds for selector', selector.id, 'with relationships', selector.data?.relationshipIDs);
		// initialize ranked order from selector; clone to avoid mutating source
		rankedIds = Array.isArray(selector.data?.relationshipIDs) ? [...selector.data.relationshipIDs] : [];
		// ensure selected remains valid
		if (!selectedId || !rankedIds.includes(selectedId)) {
			selectedId = rankedIds[0] ?? null;
		}
		_selectorInitializedId = selector.id;
	}

	let selectedId: string | null = null;

	const dispatch = createEventDispatcher();

	function onClickItem(id: string) {
		console.log('RelationshipChooser: selected relationship', id);
		selectedId = id;
		dispatch('select', { id });
	}
</script>

<svelte:head>
	<!-- touch drag polyfill for mobile drag-and-drop support -->
	<script src="https://unpkg.com/svelte-drag-drop-touch@0.1.9/dist/svelte-drag-drop-touch.bundled.js"></script>
</svelte:head>

<div class="p1" id={"relationship-" + selector?.id}>
    <div class="flex items-center justify-between g1">
        <h2 class="mb1">{selector?.data?.name ?? 'Relationships'}</h2>
        {#if !isChosen}
            <Tooltip rich text="Add '{selector?.data?.name }'">
                <IconButton icon="add_shopping_cart" on:click={() => selectedId && choose ? choose(selectedId) : null} />
            </Tooltip>
        {:else}
            <Tooltip rich text="Remove '{selector?.data?.name }'">
                <IconButton icon="remove_shopping_cart" on:click={unchoose} />
            </Tooltip>
        {/if}
    </div>
    <div class="relationship-chooser mb2">
        {#if !selector}
            <div class="muted">No relationship selector found.</div>
        {:else}
            <div class="chooser-grid">
				<div class="bg-surface">
					<div class="p2 rounded bg-secondary h3">
						<h4>Rank Your Choices Here</h4>
							{#each rankedIds as id, i (id)}
							<div animate:flip>
								<SortableItem
									propItemNumber={i}
									bind:propData={rankedIds}
									bind:propHoveredItemNumber={numberHoveredItem}
								>
									<div class="sortable-row" class:classHovered={numberHoveredItem === i} on:click={() => onClickItem(id)}>
										<MoveIcon propSize={12} />
										{$relationshipsById?.[id]?.data?.name ?? id}
									</div>
								</SortableItem>
							</div>
							{/each}

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
</div>
<style>
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
