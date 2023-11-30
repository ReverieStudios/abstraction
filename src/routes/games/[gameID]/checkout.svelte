<script lang="ts" context="module">
	import { database } from '$lib/database';
	import type { Load } from '@sveltejs/kit';

	export const load: Load = async ({ session, stuff }) => {
		const user = await database.users.doc(session.user.uid).read();
		if (!isPlayer(user?.data?.roles, stuff.gameID)) {
			return { redirect: '/home', status: 302 };
		}
		return {
			props: { userID: session.user.uid, gameID: stuff.gameID, gameName: stuff.game.name }
		};
	};
</script>

<script lang="ts">
	import Decider from '$lib/characters/Decider.svelte';
	import { derived } from 'svelte/store';
	import { getNotify } from '$lib/ui/Notifications.svelte';
	import type { LockLimited, LockPrereqs, LockResult } from 'src/routes/api/checkout/secureLock';
	import { onMount } from 'svelte';
	import { isPlayer } from '$lib/permissions';

	export let gameName: string = null;
	export let gameID: string = null;
	export let userID: string = null;
	const user = database.users.doc(userID);

	const sendNotification = getNotify();

	const character = database.characters.doc(userID);

	const chosenAssets = derived(character, ($character) => {
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
</script>

<Decider
	{gameName}
	{gameID}
	{userID}
	user={$user?.data}
	{chosenAssets}
	{secureLock}
	{releaseLocks}
	{finalize}
/>
