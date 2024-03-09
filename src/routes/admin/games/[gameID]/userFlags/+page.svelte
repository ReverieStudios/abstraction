<script lang="ts" context="module">
	import type { Load } from '@sveltejs/kit';
	export const load: Load = ({ stuff }) => {
		return {
			props: {
				game: stuff.game
			}
		};
	};
</script>

<script lang="ts">
	import { User } from '$lib/database/types/User';
	import Modal from '$lib/ui/Modal.svelte';
	import { Wrapper } from '$lib/boxLinks';
	import CheckBoxGroup from '$lib/form/CheckBoxGroup.svelte';
	import Checkbox from '$lib/ui/Checkbox.svelte';
	import IconButton from '$lib/ui/IconButton.svelte';
	import CopyBox from '$lib/ui/CopyBox.svelte';
	import Button from '$lib/ui/Button.svelte';
	import Form from '$lib/form/Form.svelte';
	import { database } from '$lib/database';

	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import type { Docs } from '$lib/database/types';
	import type { Game } from '$lib/database/types/Game';

	export let game: Game;
	const { gameID } = $page.params;
	$: flagId = $page.url.searchParams.get('flag');

	const users = database.users;
	const flags = database.flags;

	$: selectedFlag = $flags.find((flag) => flag.id === flagId);
	$: flagLinks = $flags.map((flag) => {
		return { href: `?flag=${flag.id}`, text: `${flag.data.name}` };
	});
	$: flagOptions = $flags.map((flag) => ({ label: flag.data.name, value: flag.id }));

	const userHasFlag = (user: Docs.User, flag: Docs.Flag) => {
		return (user.data?.flags?.[gameID] || []).includes(flag.id);
	};

	const updateUserFlag = (user: Docs.User, flag: Docs.Flag) => () => {
		const currentFlags = user.data?.flags?.[gameID] || [];
		const newFlags = currentFlags.includes(flag.id)
			? currentFlags.filter((id) => id !== flag.id)
			: [...currentFlags, flag.id];

		user.update({ flags: { [gameID]: newFlags } });
	};

	let tokenGeneration = false;
	let generatedToken = '';
	const generateToken = (values: Object) =>
		fetch('/api/user/getToken', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json;charset=utf-8'
			},
			body: JSON.stringify({ token: values })
		})
			.then((res) => res.json())
			.then((response) => {
				if (response.encoded) {
					generatedToken = response.encoded;
				}
			});
</script>

<svelte:head>
	<title>Editing {game?.name || 'Game'} Flags</title>
</svelte:head>

<Modal open={selectedFlag} on:close={() => goto('?')}>
	<h2 class="text-primary-400 uppercase font-medium flex justify-between">
		{selectedFlag.data.name}
	</h2>
	{#each $users as user (user.id)}
		<div class="flex flex-row">
			<Checkbox
				on:change={updateUserFlag(user, selectedFlag)}
				label={user.data.name || user.id}
				checked={userHasFlag(user, selectedFlag)}
			/>
		</div>
	{/each}
</Modal>

<Modal open={tokenGeneration} on:close={() => (tokenGeneration = false)} let:closeModal>
	<h2 class="text-primary-400 uppercase font-medium flex justify-between">
		Generate Permission Token
	</h2>
	<Form
		onSubmit={generateToken}
		initialValues={{
			roles: { games: { [gameID]: User.AccountType.Reader } },
			flags: { [gameID]: [] }
		}}
	>
		<CheckBoxGroup label="Flags" items={flagOptions} name="flags.{gameID}" />
		<Button class="fill mb2" type="submit">Create Token</Button>
	</Form>

	<CopyBox content={generatedToken} />
	<Button class="fill" type="button" on:click={closeModal}>Close</Button>
</Modal>

<div class="content">
	<h1 class="flex justify-between">
		{game?.name || 'Game'} Flags
		<IconButton icon="key" on:click={() => (tokenGeneration = true)} />
	</h1>
	<hr />
	<Wrapper items={flagLinks} />
</div>
