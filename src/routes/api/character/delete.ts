import type { RequestHandler } from '@sveltejs/kit';
import { database, setGameID } from '$lib/database';
import { releaseLocks } from '../checkout/releaseLocks';
import { isEditor } from '$lib/permissions';

export const post: RequestHandler = async (event) => {
	const payload = await event.request.json();
	const gameID: string = payload.gameID || '';
	if (!event.locals.decodedToken || !gameID) {
		// missing params or not logged in
		return { body: { success: false } };
	}
	let { uid } = event.locals.decodedToken;
	if (payload.userID) {
		if (isEditor(event.locals.user.roles, gameID)) {
			uid = payload.userID;
		} else {
			return { body: { success: false } };
		}
	}

	try {
		setGameID(gameID);

		const released = await releaseLocks(uid, [], true);
		if (!released) {
			return { body: { success: false } };
		}

		await database.characters.doc(uid).remove();

		return {
			body: { success: true }
		};
	} catch (err: any) {
		return { body: { success: false, ex: (err as Error).stack } };
	}
};
