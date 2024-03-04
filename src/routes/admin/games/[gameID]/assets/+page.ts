
/** @type {import('./$types').PageLoad} */
export async function load({ parent }) {
    const { game, gameID} = await parent();
    return {
        gameID: gameID,
        game: game
    }
};
