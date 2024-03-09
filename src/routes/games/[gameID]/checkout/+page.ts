import { database } from '$lib/database';
import { redirect } from '@sveltejs/kit';
import { isPlayer } from '$lib/permissions';

/** @type { PageLoad } from "./$types"; */
export async function load({ parent, params }) {
    const { userID, game } = await parent();

    const userFromDB = await database.users.doc(userID)?.read();
    if (!isPlayer(userFromDB?.data?.roles, params.gameID)) {
        return { redirect: '/home', status: 302 };
    }

    return {
        userID: userID,
         gameID: params.gameID,
         gameName: game.name
        };
}