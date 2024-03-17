import { redirect } from '@sveltejs/kit';
import { database, setGameID } from '$lib/database';
import { isEditor } from '$lib/permissions';

/** @type {import('./$types').LayoutServerLoad} */
export async function load({ params, locals }) {
    setGameID(params.gameID);
    
    const user = await database.users.doc(locals.user.uid)?.read();

    if (!isEditor(user.data.roles, params.gameID)) {
        redirect(302, '/home');
    }
    const game = await database.game?.read();

    return {
        gameID: params.gameID,
        game: game.data
    };
}