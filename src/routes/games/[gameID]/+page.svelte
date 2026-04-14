<script lang="ts">
	import { page } from '$app/stores';
	import { Wrapper } from '$lib/boxLinks';
	import type { Game } from '$lib/database/types/Game';
	import { database } from '$lib/database';
	import { isPlayer } from '$lib/permissions';
	import { getContext } from 'svelte';
	import type { characterDoc as CharacterDocType } from '$lib/database/Database';

	const { gameID } = $page.params;
	const game: Game = $page.data.game;
	const userID: string = $page.data.userID;

	const user = database.users.doc(userID);
	const character = getContext<typeof CharacterDocType>('character');
	$: userIsPlayer = isPlayer($user?.data?.roles ?? {}, gameID);
	$: characterPurchased = userIsPlayer && ($character?.data?.purchased ?? false);

	$: links = [
		{ text: 'Browse Character Options', href: `/games/${gameID}/browse` },
		userIsPlayer && !characterPurchased
			? { text: 'Create My Character', href: `/games/${gameID}/checkout` }
			: null,
		userIsPlayer && characterPurchased
			? { text: 'View My Character', href: `/games/${gameID}/character` }
			: null
	].filter(Boolean);
</script>

<svelte:head>
	<title>{game?.name ?? gameID}</title>
</svelte:head>

<div class="content">
	<h1 class:mb1={game?.summary}>{game?.name ?? gameID}</h1>
	{#if game?.summary}
		<h2 class="h3 mt1">{game?.summary}</h2>
	{/if}

	<Wrapper items={links} />
</div>
