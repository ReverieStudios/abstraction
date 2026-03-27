<script lang="ts">
  import { database } from '$lib/database';
  import type { Docs } from '$lib/database';
  import { derived, type Readable } from 'svelte/store';
  import { keyBy } from 'lodash-es';
  import RelationshipChooser from './RelationshipChooser.svelte';

  export let gameID: string | null = null;
  export let userID: string | null = null;
  export let user: any = null;
  export let relationshipSelectorIDs: string[] = [];
  export let chosenID: string | null = null;
  export let choose: ((assetID: string) => void) | null = null;
  export let unchoose: (() => void) | null = null;
  export let updateRankings: ((relationshipSelectorID: string, rankedIDs: string[]) => Promise<boolean>) | null = null;
  export let subselection: {
    name: string;
    on: number;
    total: number;
    depth: number;
    loopDepth: number;
  } = { name: '', on: 1, total: 1, depth: 1, loopDepth: 1 };

  const relationshipSelectors = database.relationshipSelectors;
  const selectorsById: Readable<Record<string, Docs.RelationshipSelector>> = derived(
    relationshipSelectors,
    ($sels) => keyBy($sels ?? [], 'id')
  );

  // map selectorID -> rankings array fetched from server
  let existingRanksMap: Record<string, string[] | null> = {};

  async function fetchRankings(selectorID: string) {
    try {
      const url = `/api/relationships/getRankings?relationshipSelectorID=${encodeURIComponent(selectorID)}&gameID=${encodeURIComponent(gameID ?? '')}`;
      const res = await fetch(url);
      const body = await res.json();
      // API returns { relationshipSelectorID, rankedRelationshipIDs }
      if (body && Array.isArray(body.rankedRelationshipIDs)) {
        existingRanksMap = { ...existingRanksMap, [selectorID]: body.rankedRelationshipIDs };
      } else {
        existingRanksMap = { ...existingRanksMap, [selectorID]: [] };
      }
    } catch (err) {
      existingRanksMap = { ...existingRanksMap, [selectorID]: [] };
    }
  }

  // whenever the list of selectors changes, ensure we have an entry (and fetch missing ones)
  $: if (relationshipSelectorIDs && relationshipSelectorIDs.length) {
    for (const selID of relationshipSelectorIDs) {
      if (!existingRanksMap.hasOwnProperty(selID)) {
        // mark as null while loading to avoid duplicate fetches
        existingRanksMap = { ...existingRanksMap, [selID]: null };
        fetchRankings(selID);
      }
    }
  }
</script>

{#if subselection.depth > 1 && subselection.loopDepth === 0 && subselection.total > 1}
  {#if subselection.on === 1}
    <h2>{subselection.name} ({subselection.total} Choice{subselection.total > 1 ? 's' : ''})</h2>
  {/if}
  <h4>Choice {subselection.on}</h4>
{/if}

<div class="rounded bg-surface mb2">
  <div class="flex flex-column g1 divided">
    {#each relationshipSelectorIDs as selID (selID)}
      <RelationshipChooser
        {gameID}
        {user}
        {userID}
        relationshipSelectorID={selID}
        {choose}
        {unchoose}
        {updateRankings}
          isChosen = {chosenID === selID}
          existingRanks={existingRanksMap[selID] ?? null}
        {subselection}
      />
    {/each}
  </div>
</div>

<style>
  /* minimal styling to match AssetSection layout */
</style>
