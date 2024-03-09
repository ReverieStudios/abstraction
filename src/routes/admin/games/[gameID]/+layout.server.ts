import { database, setGameID } from '$lib/database';
import { isEditor } from '$lib/permissions';

/** @type {import('./$types').LayoutServerLoad} */
export async function load({ params, locals }) {
    setGameID(params.gameID);

    if (!isEditor(locals.user?.roles, params.gameID)) {
        return { redirect: '/home', status: 302 };
    }
    const game = await database.game?.read();

    return {
        gameID: params.gameID,
        game: game.data
    };
}