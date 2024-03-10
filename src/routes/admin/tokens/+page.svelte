<script lang="ts">
	import ConfirmButton from '$lib/ConfirmButton.svelte';
	import { Wrapper, Item } from '$lib/boxLinks';
	import { database, type Docs } from '$lib/database';
	import Modal from '$lib/ui/Modal.svelte';
	import Form from '$lib/form/Form.svelte';
	import UIButton from '$lib/ui/Button.svelte';
	import Button from '$lib/form/Button.svelte';
	import CopyBox from '$lib/ui/CopyBox.svelte';
	import CheckBoxGroup from '$lib/form/CheckBoxGroup.svelte';
	import UISelect from '$lib/ui/Select.svelte';
	import Select from '$lib/form/Select.svelte';
	import { User, getAccountType } from '$lib/database/types/User';
	import RadioGroup from '$lib/form/RadioGroup.svelte';
	import TextField from '$lib/form/TextField.svelte';
	import { isSingleUse, isUnlimited, Token } from '$lib/database/types/Token';
	import { derived } from 'svelte/store';
	import Icon from '$lib/ui/Icon.svelte';
	import Tooltip from '$lib/ui/Tooltip.svelte';
	import { exportToSheet } from '$lib/importExports/tokens';
	import { makeFile } from '$lib/importExports/helpers';
	import { page } from '$app/stores';


	const userID: string = $page.data.userID;
	const { games, gameFlags, tokens, users } = database;

	const roleOptions = [
		{ text: 'No change', value: User.AccountType.None },
		{ text: 'Reader', value: User.AccountType.Reader },
		{ text: 'Player', value: User.AccountType.Player },
		{ text: 'Editor', value: User.AccountType.Editor },
		{ text: 'Owner', value: User.AccountType.Owner }
	];

	enum StatusOptions {
		All,
		UnusedOnly,
		UsedOnly
	}

	const statusOptions = [
		{ text: 'All', value: StatusOptions.All },
		{ text: 'Unused Only', value: StatusOptions.UnusedOnly },
		{ text: 'Used Only', value: StatusOptions.UsedOnly }
	];

	const usersById = derived(users, ($users) =>
		Object.fromEntries($users.map((user) => [user.id, user.data.name ?? user.data.email]))
	);

	const gamesById = derived(games, ($games) =>
		Object.fromEntries($games.map((game) => [game.id, game.data.name]))
	);
	const gameOptions = derived(games, ($games) =>
		$games.map((game) => ({ text: game.data.name, value: game.id }))
	);

	const generationType = [
		{ label: 'Unlimited Use', value: Token.GenerationType.Unlimited },
		{ label: 'Single Use', value: Token.GenerationType.SingleUse }
	];

	$: flagsByGame = $games.map((game) => gameFlags(game.id));
	type FlagWithGameID = { flag: Docs.Flag; gameID: string };
	$: flags = derived([games, ...flagsByGame], ([$games, ...$gameFlags]) => {
		const allFlags: FlagWithGameID[] = [];
		for (let i = 0; i < $games.length; i++) {
			const gameID = $games[i].id;
			const flags = $gameFlags[i] ?? [];
			allFlags.push(...flags.map((flag) => ({ flag, gameID })));
		}
		return allFlags;
	});
	$: flagItems = derived(flags, ($flags) =>
		$flags.map(({ flag, gameID }) => ({ label: flag.data.name, value: flag.id, gameID }))
	);
	$: flagOptions = derived([gamesById, flags], ([$gamesById, $flags]) =>
		$flags
			.map(({ flag, gameID }) => ({
				text: `${flag.data.name} (${$gamesById[gameID]})`,
				value: flag.id
			}))
			.sort((a, b) => a.text.localeCompare(b.text))
	);
	$: flagsById = derived(flags, ($flags) =>
		Object.fromEntries($flags.map(({ flag }) => [flag.id, flag.data.name]))
	);

	const stringifyToken = (
		token: Token,
		gamesByID: Record<string, string>,
		flagsByID: Record<string, string>
	) => {
		return [
			token.roles?.system != null ? `System Role: ${getAccountType(token.roles.system)}` : null,
			...Object.entries(token?.roles?.games ?? {}).map(
				([gameID, role]) => `${gamesByID[gameID]} Role: ${getAccountType(role)}`
			),
			...Object.entries(token?.flags ?? {}).map(
				([gameID, flags]) =>
					`${gamesByID[gameID]} Flags: ${flags.map((flag) => flagsByID[flag]).join(', ')}`
			)
		].filter(Boolean);
	};

	interface FormData {
		numTokens: number;
		token: Partial<Token>;
	}

	let gameID = null;

	let creating = null;
	const createToken = (values: FormData) =>
		fetch('/api/user/getTokens', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json;charset=utf-8'
			},
			body: JSON.stringify({
				...values,
				token: { ...values.token, createdOn: Date.now(), createdBy: userID }
			})
		})
			.then((res) => res.json())
			.then((response) => response.encoded);

	const checkForm = (values: FormData) => {
		const errors: Record<string, string> = {};
		const type = values['token.type'] ?? values.token?.type;
		if (type == null) {
			errors['token.type'] = 'Token type must be set';
		} else if (
			type === Token.GenerationType.SingleUse &&
			(!values.numTokens || values.numTokens <= 0)
		) {
			errors.numTokens = 'Number of tokens must be set';
		}
		return errors;
	};

	let filterGame: string = '';
	let filterStatus: StatusOptions = StatusOptions.All;
	let filterFlag: string = '';

	const tokenTypeIcon = (token: Token) => {
		if (isSingleUse(token)) {
			return token.usedBy ? 'lock' : 'lock_open';
		}
		if (isUnlimited(token)) {
			return 'lock_clock';
		}
		return '???';
	};

	const tokenUsedBy = (token: Token, usersById: Record<string, string>) => {
		if (isSingleUse(token)) {
			return token.usedBy ? `Token used by ${usersById?.[token.usedBy]}` : 'Token not yet used';
		}
		if (isUnlimited(token)) {
			const usedBy = Object.keys(token.usedBy).map((userID) => usersById[userID]);
			return usedBy.length === 0 ? 'Token not yet used' : `Token used by ${usedBy.join(', ')}`;
		}

		return '???';
	};
	const tokenUsed = (token: Token) => {
		if (isSingleUse(token)) {
			return token.usedBy != null;
		}
		return false;
	};

	$: filteredTokens = $tokens.filter((token) => {
		if (filterGame && !(token.data?.roles?.[filterGame] || token.data?.flags?.[filterGame])) {
			return false;
		}
		if (filterStatus === StatusOptions.UnusedOnly && tokenUsed(token.data)) {
			return false;
		}
		if (filterStatus === StatusOptions.UsedOnly && !tokenUsed(token.data)) {
			return false;
		}
		if (
			filterFlag &&
			Object.entries(token.data.flags).every(([, flags]) => !flags.includes(filterFlag))
		) {
			return false;
		}
		return true;
	});

	const exportFiltered = () => {
		const descriptions = new Map(
			filteredTokens.map((token) => [
				token.id,
				stringifyToken(token.data, $gamesById, $flagsById).join('\n')
			])
		);
		const worksheet = exportToSheet(filteredTokens, $users, descriptions);

		makeFile(`tokens-${new Date().toISOString()}`, [worksheet]);
	};
</script>

<svelte:head>
	<title>Admin: Tokens</title>
</svelte:head>

<div class="content">
	<h1>Tokens</h1>

	<Modal open={creating} on:close={() => (creating = false)} let:closeModal>
		<Form
			class="flex flex-column g2"
			onSubmit={createToken}
			afterSubmit={closeModal}
			validate={checkForm}
		>
			<RadioGroup label="Generation:" name="token.type" items={generationType}>
				<svelte:fragment slot="extra" let:id let:checked>
					{#if id === Token.GenerationType.SingleUse}
						<TextField
							class="ml3"
							name="numTokens"
							min="1"
							label="How many tokens?"
							type="number"
							disabled={!checked}
						/>
					{/if}
				</svelte:fragment>
			</RadioGroup>

			<Select label="System Role" items={roleOptions} name="token.roles.system" class="mx3 my2" />

			<UISelect label="Game" items={$gameOptions} class="mx3" bind:value={gameID} />
			{#if gameID}
				<Select
					label="Game Role"
					items={roleOptions}
					name="token.roles.games.{gameID}"
					class="mx3"
				/>
				<CheckBoxGroup
					label="Flags"
					items={$flagItems.filter((opt) => opt.gameID === gameID)}
					name="token.flags.{gameID}"
				/>
			{/if}

			<Button type="submit">Save</Button>
		</Form>
	</Modal>

	<div class="flex g2 mb2">
		<UISelect
			bind:value={filterGame}
			nullOption
			class="flex-auto"
			label="Game"
			items={$gameOptions}
		/>
		<UISelect bind:value={filterStatus} class="flex-auto" label="Status" items={statusOptions} />
		<UISelect
			bind:value={filterFlag}
			nullOption
			class="flex-auto"
			label="Flags"
			items={$flagOptions}
		/>
		<UIButton on:click={exportFiltered}><Icon icon="file_download" /></UIButton>
	</div>

	<Wrapper items={filteredTokens} let:item>
		<Item>
			{@const isUsed = tokenUsed(item.data)}
			{@const isUsedBy = tokenUsedBy(item.data, $usersById)}
			{@const typeIcon = tokenTypeIcon(item.data)}

			<h4 class="bold h3 my1 flex g2">
				<Tooltip rich text={isUsedBy}>
					<Icon class={isUsed ? 'token-used' : 'token-unused'}>{typeIcon}</Icon>
				</Tooltip>
				{item.id}
			</h4>

			{#each stringifyToken(item.data, $gamesById, $flagsById) as unlock}
				<div>
					{unlock}
				</div>
			{/each}

			<svelte:fragment slot="actions">
				<CopyBox iconOnly content={item.id} />
				<ConfirmButton on:confirm={() => item.remove()} />
			</svelte:fragment>
		</Item>
	</Wrapper>
	<div class="mt2 mx3">
		<UIButton class="fill" on:click={() => (creating = true)}>Create New</UIButton>
	</div>
</div>

<style>
	:global(.token-unused) {
		color: var(--success);
		cursor: help;
	}
	:global(.token-used) {
		color: var(--error);
		cursor: help;
	}
</style>
