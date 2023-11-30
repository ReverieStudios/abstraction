<script lang="ts" context="module">
	import type { Load } from '@sveltejs/kit';

	export const load: Load = async ({ session, stuff }) => {
		return {
			props: { userID: session.user.uid, gameID: stuff.gameID, gameName: stuff.game.name }
		};
	};
</script>

<script lang="ts">
	import Decider from '$lib/characters/Decider.svelte';
	import { writable } from 'svelte/store';
	import type { Writable } from 'svelte/store';
	import { database } from '$lib/database';

	export let gameName: string = null;
	export let gameID: string = null;
	export let userID: string = null;
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
