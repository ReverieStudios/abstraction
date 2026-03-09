<script lang="ts">
    import type { Docs } from '$lib/database';
    import RelationshipChooser from './RelationshipChooser.svelte';
    import RelationshipRow from './RelationshipRow.svelte';
    import { database } from '$lib/database';
    import { derived } from 'svelte/store';
    import { keyBy } from 'lodash-es';

    export let selector: Docs.RelationshipSelector;
    export let assignment: Docs.RelationshipAssignment | null = null;

    const relationships = database.relationships;
    const relationshipsById = derived(relationships, ($rels) => keyBy($rels ?? [], 'id'));
</script>

<div class="items-center hover-bg-primary-light p2">
    <span class="h3 flex items-center g1">
        {selector.data.name}
    </span>
    {#if selector.data.summary}
        <div class="h4">{selector.data.summary}</div>
    {/if}
    {#if !assignment || !assignment.data?.assignedRelationships || assignment.data?.assignedRelationships.length === 0}
        <!-- No assigned relationships: show chooser but disable sorting/moving -->
        <div class="pl2">
            <RelationshipChooser relationshipSelectorID={selector.id} allowSort={false} />
        </div>
    {:else}
        <!-- Assigned relationships: show the RelationshipRow(s) and assigned user IDs -->
        {#each assignment.data.assignedRelationships as rel}
            <div class="pl2">
                <h4>{rel.relationshipID}</h4>
                <div class="pl2">
                    <RelationshipRow relationship={$relationshipsById?.[rel.relationshipID]} />
                    <div class="muted">Assigned users: {rel.assignedUserIDs?.length ? rel.assignedUserIDs.join(', ') : 'None'}</div>
                </div>
            </div>
        {/each}
    {/if}
</div>