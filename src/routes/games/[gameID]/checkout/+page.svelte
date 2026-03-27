<script lang="ts">
	import Decider from '$lib/characters/Decider.svelte';
	import { derived, type Readable } from 'svelte/store';
	import { getNotify } from '$lib/ui/Notifications.svelte';
	import type {LockLimited, LockPrereqs, LockResult } from '../../../api/checkout/secureLock/+server';
	import { onMount } from 'svelte';
	import { isPlayer } from '$lib/permissions';
	import { page } from '$app/stores';
	import { database } from '$lib/database';

	const gameName: string = $page.data.gameName;
	const gameID: string = $page.data.gameID;
	const userID: string = $page.data.userID;
	const user = database.users.doc(userID);

	const sendNotification = getNotify();

	const character = database.characters?.doc(userID);

	const chosenAssets: Readable<string[]> = derived(character, ($character) => {
		return $character?.data?.assets ?? [];
	});

	const refreshLocks = async () => {
		await fetch('/api/checkout/refreshLocks', {
			method: 'POST',
			body: JSON.stringify({ gameID })
		});
	};
	onMount(() => {
		let timer = setInterval(refreshLocks, 1000 * 60 * 2);
		return () => {
			clearInterval(timer);
		};
	});

	const secureLock = (assetID: string, depth: number): Promise<boolean> =>
		fetch('/api/checkout/secureLock', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json;charset=utf-8'
			},
			body: JSON.stringify({ assetID, gameID, depth })
		})
			.then((res) => res.json())
			.then((body: LockResult) => {
				if (body === true) {
					return true;
				}

				const isLimited = (body: LockResult): body is LockLimited =>
					(body as LockLimited)?.limited === true;
				const isPrereq = (body: LockResult): body is LockPrereqs =>
					(body as LockPrereqs)?.missingRequiredFlags != null;

				if (isLimited(body)) {
					sendNotification({ text: 'This item is no longer available.' });
				} else if (isPrereq(body)) {
					sendNotification({ text: 'You do not have the required flags to purchase this item.' });
				} else {
					sendNotification({ text: 'Unable to purchase this item.' });
				}

				return false;
			});

	const releaseLocks = (assetIDs: string[]): Promise<boolean> =>
		fetch('/api/checkout/releaseLocks', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json;charset=utf-8'
			},
			body: JSON.stringify({ assetIDs, gameID })
		})
			.then((res) => res.json())
			.then((body) => body.success);

	const finalize = (): Promise<boolean> =>
		fetch('/api/checkout/finalize', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json;charset=utf-8'
			},
			body: JSON.stringify({ gameID })
		})
			.then((res) => res.json())
			.then((body) => {
				if (!body.success) {
					// TODO return extra details to explain why
					sendNotification({ text: 'Unable to purchase this item.' });
				}
				return body.success;
			});
	const updateRankings = (relationshipSelectorID: string, rankedIDs: string[]): Promise<boolean> =>
		fetch('/api/relationships/updateRankings', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json;charset=utf-8'
			},
			body: JSON.stringify({ relationshipSelectorID, rankedIDs, gameID })
		})
			.then((res) => res.json())
			.then((body) => {
				if (body?.message) {
					sendNotification({ text: `Unable to update rankings: ${body.message}`});
					return false;
				} {
					return body;
				}
			});
</script>

<Decider
	{gameName}
	{gameID}
	{userID}
	user={$user?.data}
	chosenItems={chosenAssets}
	{secureLock}
	{releaseLocks}
	{finalize}
	{updateRankings}
/>
