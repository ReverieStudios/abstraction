<script lang="ts">
	import { page } from "$app/stores";
	import { database } from "lib/database";
	import { setContext } from 'svelte';
	import { readable } from 'svelte/store';

	const userID: string = $page.data.userID;

	database.characters?.subscribe(() => {});

	const character = userID
		? (database.characters?.doc(userID) ?? readable(null))
		: readable(null);
	character?.subscribe(() => {});

	setContext('character', character);
</script>

<slot />
