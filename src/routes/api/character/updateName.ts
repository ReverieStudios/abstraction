import type { RequestHandler } from '@sveltejs/kit';
import { database, setGameID } from '$lib/database';

export const post: RequestHandler = async (event) => {
	const payload = await event.request.json();
	const name: string = payload.name || '';
	const gameID: string = payload.gameID || '';
	if (!event.locals.decodedToken || !name) {
		// missing params or not logged in
		return { body: { success: false } };
	}
	const { uid } = event.locals.decodedToken;

	try {
		setGameID(gameID);

		const character = await database.characters.doc(uid).read();
		if (!character.exists) {
			return { body: { success: false } };
		}

		if (character?.data?.nameLocked) {
			return { body: { success: false } };
		}

		await character.update({ name });

		return {
			body: { success: true }
		};
	} catch (err: any) {
		return { body: { success: false, ex: (err as Error).stack } };
	}
};
