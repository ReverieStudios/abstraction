<script lang="ts">
	import { Wrapper, Item } from '$lib/boxLinks';
	import { database } from '$lib/database/';
	import { User } from '$lib/database/types/User';
	import { page } from '$app/stores';

	const userID: string = $page.data.userID;

	const { games, users } = database;

	const user = users.doc(userID);

	$: visibleGames = $games.filter((game) => {
		return (
			game?.data?.public ||
			($user?.data?.roles?.system ?? 0) >= User.AccountType.Reader ||
			($user?.data?.roles?.games?.[game.id] ?? 0) >= User.AccountType.Reader
		);
	});
</script>

<svelte:head>
	<title>Games</title>
</svelte:head>

<div class="content">
	<h1>Games</h1>

	<Wrapper items={visibleGames} let:item={game}>
		<Item href="/games/{game.id}/">
			<h4 class="bold h3 my1">
				{game.data.name}
			</h4>
			{#if game.data.summary}
				<p class="my1">
					{game.data.summary}
				</p>
			{/if}
		</Item>
	</Wrapper>
</div>
