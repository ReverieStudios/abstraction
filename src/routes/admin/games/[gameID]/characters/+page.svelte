<script lang="ts">
	import { Wrapper, Item } from '$lib/boxLinks';
	import { database } from '$lib/database/Database';
	import type { Game } from '$lib/database/types/Game';
	import Modal from '$lib/ui/Modal.svelte';
	import AssetSection from '$lib/characters/AssetSection.svelte';
	import type { User } from '$lib/database/types/User';
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import ConfirmButton from '$lib/ConfirmButton.svelte';
	import { getNotify } from '$lib/ui/Notifications.svelte';

	let characters = database.characters;
	const charactersLoaded = characters.hasLoaded;
	const game: Game = $page.data.game;
	const gameID: string = $page.data.gameID;
	const user: User = $page.data.user;

	$: characterID = $page.url.searchParams.get('character');

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
	const getUserName = (userID: string) => {
		return fetch('/api/character/getUser', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json;charset=utf-8'
			},
			body: JSON.stringify({ gameID, userID })
		})
			.then((res) => res.json())
			.then((body) => {
				if (body.success) {
					return body.name;
				} else {
					return 'Unknown';
				}
			})
			.catch(() => {
				return 'Unknown';
			});
	};
</script>

<svelte:head>
	<title>{game?.name ?? 'Game'} Characters</title>
</svelte:head>

<Modal open={characterID} on:close={() => goto('?')}>
	{#if $charactersLoaded}
		<h2>{$characters.find((c) => c.id === characterID)?.data?.name ?? 'No Name'}</h2>

		<div class="rounded bg-primary mb2">
			<div class="flex flex-column g1">
				<AssetSection
					{gameID}
					{user}
					userID={user.uid}
					assetIDs={$characters.find((c) => c.id === characterID)?.data?.assets ?? []}
				/>
			</div>
		</div>
	{/if}
</Modal>

<div class="content">
	<h1>Characters</h1>

	<Wrapper class="mb2" items={$characters} let:item={character}>
		<div class="flex bg-primary hover-bg-primary-light items-center pr2">
			<a href="?character={character.id}" class="block p2 flex-auto">
				<h4 class="bold h3 my1">
					{character.data.name ?? character.id}
					{#await getUserName(character.id) then name}
						- {name}
					{/await}
				</h4>
			</a>
			<ConfirmButton on:confirm={() => deleteCharacter(character.id)} />
		</div>
	</Wrapper>
</div>
