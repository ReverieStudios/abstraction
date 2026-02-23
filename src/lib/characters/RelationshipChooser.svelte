<script context="module">
  import DragDropTouch from 'svelte-drag-drop-touch'
</script>
<script lang="ts">
  import { database } from '$lib/database';
  import type { Docs } from '$lib/database';
  import RelationshipRow from './RelationshipRow.svelte';
  import { derived, type Readable } from 'svelte/store';
  import { keyBy } from 'lodash-es';
  import { createEventDispatcher } from 'svelte';
  import { flip } from 'svelte/animate';
  import { MoveIcon, SortableItem} from 'svelte-sortable-items';

  export let gameID: string | null = null;
  export let userID: string | null = null;
  export let user: any = null;
  export let relationshipSelectorID: string;

  const relationships = database.relationships;
  const relationshipSelectors = database.relationshipSelectors;

  const relationshipsById: Readable<Record<string, Docs.Relationship>> = derived(relationships, ($rels) => {
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

<h2 class="mb1">{selector?.data?.name ?? 'Relationships'}</h2>
<div class="relationship-chooser mb2">
  {#if !selector}
    <div class="muted">No relationship selector found.</div>
  {:else}
    <div class="chooser-grid">
      <div class="list p2 rounded bg-surface h3">
        <h4>Choices</h4>
        <ul>
          {#each rankedIds as id, i (id)}
          <div animate:flip>
            <SortableItem
                propItemNumber={i}
                bind:propData={rankedIds}
                bind:propHoveredItemNumber={numberHoveredItem}
            >
                <div class:classHovered={numberHoveredItem === i} on:click={() => onClickItem(id)}>
                    <MoveIcon propSize={12} />
                    {$relationshipsById?.[id]?.data?.name ?? id}
			</div>
            </SortableItem>
          </div>
          {/each}
        </ul>
      </div>

      <div class="preview">
        {#if rankedIds.length === 0}
          <div class="muted">No relationships available</div>
        {:else}
          <div class="rows rounded bg-surface h3 p2">
            {#each rankedIds as id (id)}
              <div class:hidden={id !== selectedId} class:selected={id === selectedId}>
                <RelationshipRow
                  {gameID}
                  {user}
                  {userID}
                  relationship={$relationshipsById?.[id]}
                  isChosen={false}
                />
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>
  {/if}
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
    background-color: lightblue;
    color: white;
  }
</style>
