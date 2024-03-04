/** @type { PageLoad } from "./$types"; */
export async function load({ parent, params }) {
    const { user, game } = await parent();
    return {
        user: user,
        gameID: params.gameID,
    };
}