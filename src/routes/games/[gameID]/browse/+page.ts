/** @type { PageLoad } from "./$types"; */
export async function load({ parent, params }) {
    const { user, game } = await parent();
    return {
        userID: user.uid,
         gameID: params.gameID,
         gameName: game.name
        };
}