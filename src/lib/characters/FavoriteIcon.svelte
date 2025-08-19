<script lang="ts">
	import IconButton from '$lib/ui/IconButton.svelte';
	import { database } from '$lib/database';
	import { createEventDispatcher } from 'svelte';

	export let assetID: string;
	export let gameID: string;
	const dispatch = createEventDispatcher();
	const favorites = database.favorites;
	$: favorited = $favorites?.data?.[assetID] ?? false;

	const toggleFavorite = async (favorited: boolean) => {
		const options = {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json;charset=utf-8'
			},
			body: JSON.stringify({ assetID, gameID, isFavorite: !favorited })
		};
		await fetch('/api/browse/favorite', options);
		if (!favorited) {
			console.log('favorited', assetID);
      		dispatch('favorited');
    	}
	};
</script>

<IconButton
	icon={favorited ? 'favorite' : 'favorite_border'}
	on:click={() => toggleFavorite(favorited)}
/>
