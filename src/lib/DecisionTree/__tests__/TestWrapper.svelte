<script lang="ts">
  import { setContext } from 'svelte';
  import { key } from 'svelte-forms-lib';
  import RelationshipRank from '../RelationshipRank.svelte';

  // provide minimal form context expected by Button.svelte
  setContext(key, { handleChange: () => {} });

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();

  export let relationshipOptions;
  export let nodeID;
</script>

<RelationshipRank {relationshipOptions} {nodeID} on:save={(e) => dispatch('save', e.detail)} />
