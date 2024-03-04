<script lang="ts">
	import Decider from '$lib/characters/Decider.svelte';
	import { writable } from 'svelte/store';
	import type { Writable } from 'svelte/store';
	import { database } from '$lib/database';
	import { page } from '$app/stores';

	const gameName: string = $page.data.gameName;
	const gameID: string = $page.data.gameID;
	const userID: string = $page.data.userID;
	const user = database.users.doc(userID);

	const chosenAssets: Writable<string[]> = writable([]);
	const secureLock = (assetID: string) => {
		chosenAssets.update((ids) => [...ids, assetID]);
		return Promise.resolve(true);
	};
	const releaseLocks = (assetIDs: string[]) => {
		const removeSet = new Set(assetIDs);
		chosenAssets.update((ids) => ids.filter((id) => !removeSet.has(id)));
		return Promise.resolve(true);
	};
</script>

<Decider
	{gameName}
	{gameID}
	{userID}
	user={$user?.data}
	{chosenAssets}
	{secureLock}
	{releaseLocks}
/>
