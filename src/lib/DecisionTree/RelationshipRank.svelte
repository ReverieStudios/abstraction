<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import Button from '$lib/form/Button.svelte';

  export let relationshipOptions: { id: string; label?: string }[] = [];
  export let nodeID: string;

  const dispatch = createEventDispatcher();

  // local ordering state
  let items = relationshipOptions.map((o) => ({ ...o }));

  $: if (relationshipOptions) {
    items = relationshipOptions.map((o) => ({ ...o }));
  }

  const move = (index: number, dir: number) => {
    const i = index;
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const tmp = items[i];
    items[i] = items[j];
    items[j] = tmp;
    items = items.slice();
  };

  const save = () => {
    const rankings = items.map((it, idx) => ({ relationshipID: it.id, rank: idx + 1 }));
    dispatch('save', { nodeID, rankings });
  };
</script>

<div class="p-3">
  {#if items.length === 0}
    <div>No relationship options configured for this node.</div>
  {:else}
    <ul>
      {#each items as item, i}
        <li class="flex items-center g2 my1">
          <div class="flex-auto">{i + 1}. {item.label ?? item.id}</div>
          <div class="flex g1">
            <Button type="button" on:click={() => move(i, -1)}>↑</Button>
            <Button type="button" on:click={() => move(i, 1)}>↓</Button>
          </div>
        </li>
      {/each}
    </ul>
    <div class="mt2">
      <Button type="button" on:click={save}>Save Ranking</Button>
    </div>
  {/if}
</div>

<style>
  .g1 { gap: 0.25rem }
  .g2 { gap: 0.5rem }
  .my1 { margin: 0.25rem 0 }
  .mt2 { margin-top: 0.5rem }
</style>
