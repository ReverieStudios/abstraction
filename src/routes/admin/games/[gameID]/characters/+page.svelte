<script lang="ts">
	import { Wrapper } from '$lib/boxLinks';
	import { database } from '$lib/database/Database';
	import type { Docs } from '$lib/database';
	import type { Game } from '$lib/database/types/Game';
	import Modal from '$lib/ui/Modal.svelte';
	import type { User } from '$lib/database/types/User';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import ConfirmButton from '$lib/ConfirmButton.svelte';
	import { getNotify } from '$lib/ui/Notifications.svelte';
	import { keyBy } from 'lodash-es';
	import PurchasedAssetRow from '$lib/characters/PurchasedAssetRow.svelte';
	import PurchasedRelationshipSelectorRow from '$lib/characters/PurchasedRelationshipSelectorRow.svelte';
	import { derived, readable } from 'svelte/store';
	import type { Readable } from 'svelte/store';
	import SearchInput from '$lib/ui/SearchInput.svelte';
	
	let characters = database.characters;
	const assetsByID: Readable<Record<string, Docs.Asset>> = derived([database.assets ?? readable([])], ([$assets]) => {
		if (!$assets) {
			return {};
		}
		return keyBy($assets, 'id');
	});
	const charactersLoaded = characters?.hasLoaded;
	const game: Game = $page.data.game;
	const gameID: string = $page.data.gameID;
	const user: User = $page.data.user;

	$: characterID = $page.url.searchParams.get('character');

	// Derived stores scoped to the currently-viewed character
	$: viewedCharacter = $characters?.find((c) => c.id === characterID) ?? null;

	const relationshipSelectorsByID: Readable<Record<string, Docs.RelationshipSelector>> = derived(
		database.relationshipSelectors ?? readable([]),
		($selectors) => keyBy($selectors ?? [], 'id')
	);

	$: characterRelationshipSelectors = viewedCharacter
		? (viewedCharacter.data?.assets ?? [])
				.map((id: string) => ($relationshipSelectorsByID ?? {})[id])
				.filter(Boolean)
		: [];

	const allRelationshipAssignments = database.relationshipAssignments ?? readable([]);
	$: relationshipAssignmentsByID = keyBy(
		($allRelationshipAssignments ?? []).filter((a: Docs.RelationshipAssignment) => a.data.userID === characterID),
		(a: Docs.RelationshipAssignment) => a.data.relationshipSelectorID
	);

	const usersById = derived(
		database.users ?? readable([]),
		($users) => keyBy($users ?? [], 'id')
	);

	let characterSearch = '';
	$: filteredCharacters = characterSearch.trim()
		? ($characters ?? []).filter((c) => {
				const q = characterSearch.toLowerCase();
				const u = $usersById[c.id]?.data;
				return (
					c.data.name?.toLowerCase().includes(q) ||
					u?.name?.toLowerCase().includes(q) ||
					u?.email?.toLowerCase().includes(q)
				);
			})
		: ($characters ?? []);

	const sendNotification = getNotify();
	const deleteCharacter = (userID: string) => {
		fetch('/api/character/delete', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json;charset=utf-8'
			},
			body: JSON.stringify({ gameID, userID })
		})
			.then((res) => res.json())
			.then((body) => {
				if (body.success) {
					sendNotification({ text: 'Character deleted' });
				} else {
					sendNotification({ text: 'Unable to delete character' });
				}
			})
			.catch(() => {
				sendNotification({ text: 'Something went wrong' });
			});
	};
	const getUserLabel = (userID: string) => {
		const u = $usersById[userID]?.data;
		if (!u) return '';
		return u.name ? `${u.name} (${u.email ?? ''})` : (u.email ?? '');
	};
</script>

<svelte:head>
	<title>{game?.name ?? 'Game'} Characters</title>
</svelte:head>

<Modal open={characterID} on:close={() => goto('?')}>
	{#if $charactersLoaded}
		<h2>{viewedCharacter?.data?.name ?? 'No Name'}</h2>

		<div class="rounded bg-primary mb2 flex flex-column g1 divided">
			{#each viewedCharacter?.data?.assets ?? [] as asset}
				{#if $assetsByID[asset]}
					<PurchasedAssetRow asset={$assetsByID[asset]} />
				{/if}
			{/each}
		</div>

		{#if characterRelationshipSelectors.length > 0}
			<div class="rounded bg-primary mb2 flex flex-column g1 divided">
				{#each characterRelationshipSelectors as selector}
					<PurchasedRelationshipSelectorRow
						{selector}
						assignment={relationshipAssignmentsByID[selector.id] ?? null}
						existingRanks={relationshipAssignmentsByID[selector.id]?.data?.relationshipRankings ?? null}
						enableHelp={false}
						{gameID}
						currentUserID={characterID ?? ''}
					/>
				{/each}
			</div>
		{/if}
	{/if}
</Modal>

<div class="content">
	<h1>Characters</h1>

	<SearchInput bind:query={characterSearch} placeholder="Search by character name, player name or email…" />
	<Wrapper class="mb2" items={filteredCharacters} let:item={character}>
		<div class="flex bg-primary hover-bg-primary-light items-center pr2">
			<a href="?character={character.id}" class="block p2 flex-auto">
				<h4 class="bold h3 my1">
					{character.data.name ?? character.id}
					{#if getUserLabel(character.id)}
						- {getUserLabel(character.id)}
					{/if}
				</h4>
			</a>
			<ConfirmButton on:confirm={() => deleteCharacter(character.id)} />
		</div>
	</Wrapper>
</div>
