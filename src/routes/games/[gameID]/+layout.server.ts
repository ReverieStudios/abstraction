import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';
import { database, setGameID } from '$lib/database';
import { isReader } from '$lib/permissions';

export const load: LayoutServerLoad = async ({ url, locals, params }) => {
    setGameID(params.gameID);
    const game = await database.game?.read();
    const { user } = locals;
    const gameIsPublic = game?.data?.public;
    const hasReadPermission = isReader(user?.roles, params.gameID);

    if (!gameIsPublic && !hasReadPermission) {
        redirect(302, '/home');
    }

    return {
        gameID: params.gameID,
        game: game.data,
        userID: user.uid
    };
};