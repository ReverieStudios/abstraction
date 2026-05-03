<script lang="ts">
	import { database } from '$lib/database';
	import type { Docs } from '$lib/database';
	import RichViewer from '$lib/ui/RichViewer.svelte';
	import { storage } from '$lib/firebase';
	import { getFields } from '$lib/database/types/Relationships';
	import { readable } from 'svelte/store';

	export let relationship: Docs.Relationship | null = null;
	export let assignedUserIDs: string[] = [];
	export let getPartnerName: (userID: string) => string = (id) => id;
	export let namesLoading: boolean = false;

	const safeRelationshipTypes = database.relationshipTypes ?? readable([]);

	const getRelationshipType = (types: Docs.RelationshipType[]) => {
		const typeId = relationship?.data?.type;
		return (types ?? []).find((type) => type.id === typeId);
	};

	const getDisplayFields = (relationship: Docs.Relationship | null, type: Docs.RelationshipType | undefined) => {
		if (!relationship || !type) return [];
		return getFields(relationship, type, false).filter((f) => f.text);
	};
</script>

{#if relationship}
	<div class="items-center hover-bg-primary-light p2">
		<span class="h3 flex items-center g1 bold relationship-name">
			{#if relationship?.data?.image}
				{#await storage.getDownloadURL(relationship.data.image) then url}
					<div class="image" style="background-image:url({url})" />
				{/await}
			{/if}
			{relationship.data.name}
		</span>
		{#each getDisplayFields(relationship, getRelationshipType($safeRelationshipTypes)) as { label, text, type }}
			<div>
				{#if label}<h4>{label}</h4>{/if}
				<div class="pl2">
					{#if type === 'markdown'}
						<RichViewer value={text} />
					{:else}
						{text}
					{/if}
				</div>
			</div>
		{/each}
		{#if assignedUserIDs.length > 0}
			<div class="partners mt1">
				<span class="">Assigned:</span>
				<div class="flex flex-wrap g1 mt1">
					{#if namesLoading}
						<span class="partner-chip bg-secondary muted">Loading…</span>
					{:else}
					{#each [...assignedUserIDs].sort((a, b) => getPartnerName(a).localeCompare(getPartnerName(b))) as userID}
						<span class="partner-chip bold bg-secondary">{getPartnerName(userID)}</span>
						{/each}
					{/if}
				</div>
			</div>
		{/if}
	</div>
{/if}

<style>
	.image {
		background-position: center center;
		background-size: 70%;
		background-repeat: no-repeat;
		height: 50px;
		width: 50px;
		border-radius: 50%;
		border: 1px solid #ccc;
	}
	.partner-chip {
		padding: 0.2rem 0.6rem;
		border-radius: 12px;
	}
	@media print {
		.partner-chip {
			color: #000 !important;
		}
		.relationship-name {
			color: #000 !important;
		}
	}
</style>
