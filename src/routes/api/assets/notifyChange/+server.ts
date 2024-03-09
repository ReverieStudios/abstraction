import { database, setGameID } from '$lib/database';
import { isEditor } from '$lib/permissions';
import { json, type RequestHandler } from '@sveltejs/kit';
import { sendDM } from '$lib/api/discord';

interface Payload {
	gameID: string;
	serverID: string;
	assetID: string;
	message?: string;
}

export const POST: RequestHandler = async (event) => {
	const payload: Payload = await event.request.json();

	const { gameID, serverID, assetID, message } = payload;

	const user = event.locals.user;
	// only run if a game editor triggered this
	if (user?.roles && isEditor(user.roles, gameID)) {
		const lock = await database.locks?.doc(assetID)?.read();
		if (lock.exists) {
			const purchasers = await Promise.all(
				lock.data.claims.map((claim) => database.users.doc(claim.purchaser)?.read())
			);
			const discordIDs = purchasers.map((user) => user.data.discordID).filter(Boolean);
			discordIDs.forEach((userID) => sendDM(serverID, userID, message));
		}
	}

	return json({});
};
