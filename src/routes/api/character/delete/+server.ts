import { json, type RequestHandler } from '@sveltejs/kit';
import { database, setGameID } from '$lib/database';
import { _releaseLocks } from '../../checkout/releaseLocks/+server';
import { isEditor } from '$lib/permissions';

export const POST: RequestHandler = async (event) => {
	const payload = await event.request.json();
	const gameID: string = payload.gameID || '';
	if (!event.locals.decodedToken || !gameID) {
		// missing params or not logged in
		return json({ success: false });
	}
	let { uid } = event.locals.decodedToken;
	if (payload.userID) {
		if (isEditor(event.locals.user.roles, gameID)) {
			uid = payload.userID;
		} else {
			return json({ success: false });
		}
	}

	try {
		setGameID(gameID);

		const released = await _releaseLocks(uid, [], true);
		if (!released) {
			return json({ success: false });
		}

		await database.characters?.doc(uid)?.remove();

		return json({ success: true });
	} catch (err: any) {
		return json({ success: false, ex: (err as Error).stack });
	}
};
