/** @type {import('./$types').PageLoad} */
export async function load({ parent }) {
    const { game } = await parent();
    return {
            game: game
        };
};