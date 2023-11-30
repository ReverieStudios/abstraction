<script context="module" lang="ts">
	import type { Load } from '@sveltejs/kit';
	export const load: Load = ({ stuff, session }) => {
		return {
			props: {
				user: session.user,
				gameID: stuff.gameID,
				game: stuff.game
			}
		};
	};
</script>

<script lang="ts">
	import Icon from '$lib/ui/Icon.svelte';
	import { Wrapper } from '$lib/boxLinks';
	import type { Game } from '$lib/database/types/Game';
	import type { User } from '$lib/database/types/User';
	import { isOwner } from '$lib/permissions';

	export let user: User = null;
	export let game: Game = null;
	export let gameID: string = null;

	$: links = [
		{
			text: 'Assets',
			href: `/admin/games/${gameID}/assets`,
			info: 'Manage the options for players to select'
		},
		{
			text: 'Asset Types',
			href: `/admin/games/${gameID}/assetTypes`,
			info: 'Manage the categories for player options and define their fields'
		},
		{
			text: 'Characters',
			href: `/admin/games/${gameID}/characters`,
			info: 'View and manage the characters in the game'
		},
		{
			text: 'Decision Tree',
			href: `/admin/games/${gameID}/decisionTree`,
			info: 'Manage the decision paths the players have'
		},
		game.discordID &&
			isOwner(user?.roles, gameID) && {
				text: 'Discord As Bot',
				href: `/admin/games/${gameID}/postAsBot`,
				info: 'Post to Discord as ReverieBot'
			},
		isOwner(user?.roles, gameID) && {
			text: 'Flags',
			href: `/admin/games/${gameID}/flags`,
			info: 'Manage account flags that can be used to limit options to certain players'
		},
		isOwner(user?.roles, gameID) && {
			text: 'User Flags',
			href: `/admin/games/${gameID}/userFlags`,
			info: 'Manage what flags are on player accounts'
		},
		isOwner(user?.roles, gameID) && {
			text: 'Import / Export',
			href: `/admin/games/${gameID}/importExport`,
			info: 'Import or Export the data from this game.'
		}
	].filter(Boolean);
</script>

<svelte:head>
	<title>Editing {game?.name}</title>
</svelte:head>

<div class="content">
	<h1>
		{game?.name} <a href="/admin/games/{gameID}/edit"><Icon>edit</Icon></a>
	</h1>
	{#if game?.summary}
		<h2>{game?.summary}</h2>
	{/if}

	<Wrapper items={links} />
</div>
