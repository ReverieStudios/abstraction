<script lang="ts" context="module">
	import { database } from '$lib/database';
	import { sortBy } from 'lodash-es';
	import { derived, writable } from 'svelte/store';
	import type { User } from './database/types/User';

	const { allFavorites, users } = database;
	const usersById = derived(users, ($users) => new Map($users.map((u) => [u.id, u.data])));
	const favoritesByAssetId = !allFavorites ? writable({}) : derived([allFavorites, usersById], ([$favorites, $usersById]) => {
		const byId = new Map();
		$favorites.forEach((fav) => {
			const user = $usersById.get(fav.id);
			if (user) {
				Object.entries(fav.data).forEach(([assetId, favorited]) => {
					if (favorited) {
						if (byId.has(assetId)) {
							byId.get(assetId).push(user);
						} else {
							byId.set(assetId, [user]);
						}
					}
				});
			}
		});
		return byId;
	});
</script>

<script lang="ts">
	export let assetId: string;

	$: favoritingUsers = sortBy(($favoritesByAssetId.get(assetId) ?? []) as User[], 'name');

	const identities = (user: User): string[] => {
		return [user.email, user.discordID].filter(Boolean);
	};
</script>

<ul>
	{#each favoritingUsers as user}
		<li>{user.name} ({identities(user).join(' / ')})</li>
	{/each}
</ul>
