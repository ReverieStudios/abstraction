<script lang="ts">
    import type { Docs } from '$lib/database';
    import RelationshipChooser from './RelationshipChooser.svelte';
    import RelationshipRow from './RelationshipRow.svelte';
    import { database } from '$lib/database';
    import { derived, readable, writable } from 'svelte/store';
    import { keyBy } from 'lodash-es';
	import type { Readable } from 'svelte/motion';
    import { getNotify } from '$lib/ui/Notifications.svelte';

    export let selector: Docs.RelationshipSelector;
    export let assignment: Docs.RelationshipAssignment | null = null;
    export let existingRanks: string[] | null = null;
    export let enableHelp: boolean = true;
    export let gameID: string;
    export let currentUserID: string;

    const sendNotification = getNotify();

    const relationships = database.relationships;
    const relationshipsById: Readable<Record<string, Docs.Relationship>> = derived(relationships ?? readable([]), ($rels) => keyBy($rels ?? [], 'id'));

    // Character names keyed by userID, fetched from the API
    const characterNames = writable<Record<string, string>>({});
    let namesLoading = false;

    // Re-fetch whenever the set of assigned userIDs changes
    $: assignedUserIDs = assignment?.data?.assignedRelationships?.flatMap((r) => r.assignedUserIDs) ?? [];
    $: if (gameID && assignedUserIDs.length > 0) {
        fetchCharacterNames(gameID, assignedUserIDs);
    }

    async function fetchCharacterNames(game: string, userIDs: string[]) {
        namesLoading = true;
        const params = new URLSearchParams({ gameID: game });
        for (const id of userIDs) params.append('userIDs[]', id);
        try {
            const res = await fetch(`/api/characters/names?${params}`);
            const body = await res.json();
            if (body.names) characterNames.set(body.names);
        } catch (ex) {
            sendNotification({ text: 'Unable to load relationship characters' });
            console.log('load relationships failed', ex);
        } finally {
            namesLoading = false;
        }
    }

    const getPartnerName = (userID: string): string => {
        const name = $characterNames[userID];
        if (!name) return userID;
        return userID === currentUserID ? `${name} (You)` : name;
    };
</script>

<div>
    {#if !assignment || !assignment.data?.assignedRelationships || assignment.data?.assignedRelationships.length === 0}
        <!-- No assigned relationships: show chooser but disable sorting/moving -->
        <div class="hover-bg-primary-light p2">
            <RelationshipChooser relationshipSelectorID={selector.id} allowSort={false} enableHelp={enableHelp} {existingRanks}/>
        </div>
    {:else}
        <!-- Assigned relationships -->
        <h3 class="h2 p2 mb0">{selector.data?.name}</h3>
        <div class="divided">
        {#each assignment.data.assignedRelationships as rel}
            {@const relationship = $relationshipsById?.[rel.relationshipID]}
            <div class="hover-bg-primary-light p2">
                <RelationshipRow gameID={null} userID={null} user={null} {relationship} />
                {#if rel.assignedUserIDs?.length}
                    <div class="partners mt1">
                        <span class="muted">Assigned:</span>
                        <div class="flex flex-wrap g1 mt1">
                            {#if namesLoading}
                                <span class="partner-chip bg-secondary muted">Loading…</span>
                            {:else}
                                {#each [...rel.assignedUserIDs].sort((a, b) => getPartnerName(a).localeCompare(getPartnerName(b))) as userID}
                                    <span class="partner-chip bg-secondary">{getPartnerName(userID)}</span>
                                {/each}
                            {/if}
                        </div>
                    </div>
                {/if}
            </div>
        {/each}
        </div>
    {/if}
</div>

<style>
    .partner-chip {
        padding: 0.2rem 0.6rem;
        border-radius: 12px;
        font-weight: 600;
    }
</style>