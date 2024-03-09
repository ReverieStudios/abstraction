/** @type { PageLoad } from "./$types"; */
export async function load({ parent }) {
    const { user, game } = await parent();
    return {user: user, game: game};
}