<script context="module" lang="ts">
	import type { Load } from '@sveltejs/kit';
	export const load: Load = async ({ stuff, session, fetch }) => {
		return {
			props: {
				gameID: stuff.gameID,
				game: stuff.game,
				channels: await fetch('/api/discord/getChannels', {
					method: 'POST',
					body: JSON.stringify({
						gameID: stuff.gameID,
						serverID: stuff.game.discordID
					})
				}).then((r) => r.json()),
				members: await fetch('/api/discord/getMembers', {
					method: 'POST',
					body: JSON.stringify({
						gameID: stuff.gameID,
						serverID: stuff.game.discordID
					})
				}).then((r) => r.json())
			}
		};
	};
</script>

<script lang="ts">
	import type { Game } from '$lib/database/types/Game';
	import Select from '$lib/ui/Select.svelte';
	import { keyBy } from 'lodash-es';
	import TextField from '$lib/ui/TextField.svelte';
	import Button from '$lib/ui/Button.svelte';

	export let game: Game = null;
	export let gameID: string = null;
	export let channels: unknown[] = [];
	export let members: unknown[] = [];

	let selectedChannel: string = null;
	let message = '';

	const membersByID = keyBy(members, 'user.id');

	const replaceMentions = (message) =>
		message.replaceAll(/<@!?(\d+)>/g, (match, id) => {
			const member: any = membersByID[id];
			if (!member) return match;
			return `@${member.user.username}`;
		});
	const insertMentions = (message: string) =>
		members.reduce((message: string, member: any) => {
			const nameOnly = new RegExp(`@${member.user.username}`, 'g');
			const nameWithDiscrimOnly = new RegExp(
				`@${member.user.username}#${member.user.discriminator}`,
				'g'
			);
			const mention = `<@${member.user.id}>`;
			// @ts-ignore
			return message.replaceAll(nameOnly, mention).replaceAll(nameWithDiscrimOnly, mention);
		}, message);

	const forSelect = ({ id, name }) => ({
		text: name,
		value: id
	});

	const getMessages = (channel) =>
		fetch('/api/discord/getMessages', {
			method: 'POST',
			body: JSON.stringify({
				gameID: gameID,
				channelID: channel
			})
		}).then((r) => r.json());

	const postMessage = (channelID, message) => {
		const messageWithMentions = insertMentions(message);
		fetch('/api/discord/postMessage', {
			method: 'POST',
			body: JSON.stringify({
				gameID: gameID,
				channelID,
				message: messageWithMentions
			})
		})
			.then((r) => r.json())
			.then(() => {
				selectedChannel = selectedChannel;
				message = '';
			});
	};
</script>

<svelte:head>
	<title>Shitposting in {game?.name}</title>
</svelte:head>

<div class="content">
	<h1>
		{game?.name} Discord
	</h1>
</div>

<Select label="Channel" items={channels.map(forSelect)} bind:value={selectedChannel} />

{#if selectedChannel}
	{#await getMessages(selectedChannel)}
		Loading
	{:then messages}
		{#each messages as message}
			<div class="my1">{message.author.username} - {replaceMentions(message.content)}</div>
		{/each}
		<TextField label="Message" bind:value={message} />
		<Button on:click={() => postMessage(selectedChannel, message)}>Post</Button>
	{/await}
{/if}
