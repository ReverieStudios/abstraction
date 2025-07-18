import { json, type RequestHandler } from '@sveltejs/kit';
import { database, setGameID } from '$lib/database';
import { isEditor } from '$lib/permissions';

export const POST: RequestHandler = async (event) => {
	const payload = await event.request.json();
	const userID: string = payload.userID || '';
	const gameID: string = payload.gameID || '';
	if (!event.locals.decodedToken || !userID) {
		// missing params or not logged in
		return json({ success: false });
	}
	const { uid } = event.locals.decodedToken;
	if (!isEditor(event.locals.user.roles, gameID)) {
		return json({ success: false });
	}

	try {
		setGameID(gameID);

		const user = await database.users.doc(userID)?.read();

		return json({ success: true, name: user?.data?.name ?? 'Unknown user' });
	} catch (err: any) {
		return json({ success: false, ex: (err as Error).stack });
	}
};
