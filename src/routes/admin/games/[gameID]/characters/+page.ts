
/** @type {import('./$types').PageLoad} */
export async function load({ parent }) {
    const { game, gameID, user} = await parent();
    return {
        gameID: gameID,
        game: game,
        user: user
    }
};
