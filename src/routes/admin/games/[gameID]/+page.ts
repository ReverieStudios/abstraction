
/** @type {import('./$types').PageLoad} */
export async function load({ parent }) {
    const { user, game, gameID} = await parent();
    return {
        user: user,
        gameID: gameID,
        game: game
    }
};
