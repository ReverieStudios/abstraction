import { json, type RequestHandler } from '@sveltejs/kit';
import { database, setGameID } from '$lib/database';
import { isEditor } from '$lib/permissions';

export const POST: RequestHandler = async (event) => {
	const payload = await event.request.json();
	const assetID: string = payload.assetID || '';
	const gameID: string = payload.gameID || '';
	if (!event.locals.decodedToken || !assetID) {
		// missing params or not logged in
		return json({ success: false });
	}

	if (!isEditor(event.locals.user.roles, gameID)) {
		return json({ success: false });
	}

	try {
		setGameID(gameID);

		const lock = await database.locks?.doc(assetID)?.read();
		if (!lock.exists || !lock.data.claims || lock.data.claims.length === 0) {
			return json({ emailNames: [] });
		}

		const userIDs = lock.data.claims.map((claim) => claim.purchaser);
		const users = await Promise.all(userIDs.map((userID) => database.users.doc(userID)?.read()));
		const emailNames = users.map((user) => ({
			email: user.data.email,
			name: user.data.name
		}));

		return json({ emailNames });
	} catch (err: any) {
		return json({ success: false, ex: (err as Error).stack });
	}
};
