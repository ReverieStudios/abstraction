<script lang="ts">
  import { fly } from 'svelte/transition';
  import type { Readable } from 'svelte/store';
  import { derived } from 'svelte/store';
  import { database } from '$lib/database';
  import type { Docs } from '$lib/database';
  import Button, { Label } from '@smui/button';
  import { keyBy } from 'lodash-es';
  import type { Dictionary } from 'lodash';

  export let chosenItems: Readable<string[]>; // Array of selected asset IDs
  export let nodesById: Record<string, any>;    // Map of all nodes by ID
  const assetsById: Readable<Dictionary<Docs.Asset>> = derived(database.assets, ($assets) => keyBy($assets ?? [], 'id'));
	const selectorsById: Readable<Dictionary<Docs.RelationshipSelector>> = derived(database.relationshipSelectors, ($sels) => keyBy($sels ?? [], 'id'));
  const assetTypesById: Readable<Dictionary<Docs.AssetType>> = derived(database.assetTypes, ($types) => keyBy($types ?? [], 'id'));

  let open = false;

  function scrollToAsset(assetID: string) {
    const el = document.getElementById(`asset-${assetID}`) ?? document.getElementById(`chooser-${assetID}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('highlight');
      setTimeout(() => el.classList.remove('highlight'), 1200);
    }
  }

  function getTypeName(itemID: string): string {
    console.log('getTypeName called with itemID=', itemID, 'assetsById=', $assetsById, 'selectorsById=', $selectorsById, 'assetTypesById=', $assetTypesById);
    if ($assetsById[itemID])  {
      const typeId = $assetsById[itemID].data?.type;
      return $assetTypesById[typeId]?.data?.name ?? 'Asset';
    } else if ($selectorsById[itemID]) {
      return 'Relationships';
    } else {
      return '';
    }
  }

  function getItemName(itemID: string): string {
    const asset = $assetsById[itemID];
    if (asset) {
      return asset.data?.name ?? itemID;
    }
    const selector = $selectorsById[itemID];
    if (selector) {
      return selector.data?.name ?? itemID;
    }
    return itemID;
  }

</script>

<style>
  .cart-item {
    cursor: pointer;
    transition: background 0.2s;
  }
  .cart-item:hover {
    background: var(--color-hover, #eee);
  }
  /* Highlight effect for AssetRow */
  .highlight {
    box-shadow: 0 0 0 4px var(--color-primary, #2196f3);
    transition: box-shadow 0.2s;
  }

  .cart-sidebar {
    position: fixed;
    top: 0;
    right: 0;
    width: 320px;
    height: 100vh;
    z-index: 1000;
    padding: 1.5rem 1rem 1rem 1rem;
    display: flex;
    flex-direction: column;
    transition: transform 0.2s;
  }
  .cart-toggle {
    position: fixed;
    bottom: 2rem;
    right: 2rem;
    z-index: 1100;
    background: var(--color-primary, #333);
    color: var(--color-on-primary, #fff);
    border-radius: 50%;
    width: 56px;
    height: 56px;
    border: none;
    font-size: 2rem;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
  }
  .cart-list {
    flex: 1 1 auto;
    overflow-y: auto;
    margin-top: 1rem;
  }
  .cart-item {
    padding: 0.5rem 0.5rem;
    font-size: 1.1rem;
  }
  .cart-close {
    position: absolute;
    top: 1.25rem;
    right: 1.25rem;
    background: none;
    border: none;
    font-size: 1.5rem;
    color: inherit;
    cursor: pointer;
  }
</style>

<button class="cart-toggle" on:click={() => open = !open} aria-label="Show cart">
  <span style="margin: auto;">🛒</span>
</button>

{#if open}
  <aside class="cart-sidebar bg-secondary text-primary" transition:fly="{{ x: 400, duration: 200 }}">
    <button class="cart-close" on:click={() => open = false} aria-label="Close cart">✕</button>
    <h2 class="h3">Selected Items</h2>
    <div class="cart-list">
      {#if $chosenItems.length === 0}
        <div class="text-primary">No items selected.</div>
      {:else}
        {#each $chosenItems as id, i}
          <Button
            type="button"
            class="cart-item mb1 mt1 h4 flex flex-auto"
            on:click={() => scrollToAsset(id)}
          >
            <Label style="text-align: left;">
              {i + 1}. {getTypeName(id)} - {getItemName(id)}
            </Label>
          </Button>
        {/each}
      {/if}
    </div>
  </aside>
{/if}