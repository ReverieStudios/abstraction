
/** @type {import('./$types').PageLoad} */
export async function load({ parent }) {
    const { game, gameID, user} = await parent();
    return {
        game: game,
    }
};
