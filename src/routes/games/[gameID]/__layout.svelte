<script context="module" lang="ts">
	import { database, setGameID } from '$lib/database';
	import { isReader } from '$lib/permissions';
	import type { Load } from '@sveltejs/kit';

	export const load: Load = async ({ params, session, stuff }) => {
		setGameID(params.gameID);
		const game = await database.game.read();

		const gameIsPublic = game?.data?.public;
		const hasReadPermission = isReader(session?.user?.roles, params.gameID);

		if (!gameIsPublic && !hasReadPermission) {
			return { redirect: '/home', status: 302 };
		}

		return {
			stuff: {
				gameID: params.gameID,
				game: game.data
			},
			props: {
				userID: stuff.user.uid
			}
		};
	};
</script>

<script lang="ts">
	export let userID: string;

	const character = database.characters.doc(userID);
	character.subscribe(() => {});
</script>

<slot />
