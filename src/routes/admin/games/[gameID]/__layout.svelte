<script context="module">
	import { database, setGameID } from '$lib/database';
	import { isEditor } from '$lib/permissions';

	export async function load({ params, session }) {
		setGameID(params.gameID);

		if (!isEditor(session?.user?.roles, params.gameID)) {
			return { redirect: '/home', status: 302 };
		}
		const game = await database.game.read();

		return {
			stuff: {
				gameID: params.gameID,
				game: game.data
			}
		};
	}
</script>

<script lang="ts">
	const assets = database.assets;
	assets.subscribe(() => {});

	const assetTypes = database.assetTypes;
	assetTypes.subscribe(() => {});
</script>

<slot />
