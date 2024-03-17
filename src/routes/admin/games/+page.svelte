<script lang="ts">
	import ConfirmButton from '$lib/ConfirmButton.svelte';
	import CreateButton from '$lib/CreateButton.svelte';
	import { goto } from '$app/navigation';
	import { Wrapper, Item } from '$lib/boxLinks';
	import { database } from '$lib/database';
	import { page } from '$app/stores';
	import { User } from '$lib/database/types/User';

	const userID: string = $page.data.userID;
	const { games, users } = database;

	const user = users.doc(userID);
	$: visibleGames = $games.filter((game) => {
		return (
			game?.data?.public ||
			($user?.data?.roles?.system  ?? 0) >= User.AccountType.Editor ||
			($user?.data?.roles?.games?.[game.id] ?? 0) >= User.AccountType.Editor
		);
	});
</script>

<svelte:head>
	<title>Games</title>
</svelte:head>

<div class="content">
	<h1>Games</h1>

	<Wrapper items={visibleGames} let:item>
		<Item href="/admin/games/{item.id}/">
			<h4 class="bold h3 my1">
				{item.data.name}
			</h4>
			{#if item.data.summary}
				<p class="my1">
					{item.data.summary}
				</p>
			{/if}

			<ConfirmButton slot="actions" on:confirm={() => item.remove()} />
		</Item>
	</Wrapper>
	<div class="mt2 mx3">
		<CreateButton
			parent={games}
			id={(t) => t}
			on:create={(e) => goto(`/admin/games/${e.detail}/edit`)}
		/>
	</div>
</div>
