import { json, type RequestHandler } from '@sveltejs/kit';
import { store } from '$lib/firebase';
import { database, setGameID, setUserID } from '$lib/database';

interface Payload {
	assetID?: string;
	gameID?: string;
	isFavorite: boolean;
}

export const POST: RequestHandler = async (event) => {
	const payload: Payload = await event.request.json();
	const { assetID, gameID, isFavorite } = payload;

	if (!event.locals.decodedToken || !assetID || !gameID) {
		return json({ success: false });
	}
	const uid = event.locals.decodedToken.uid;

	setGameID(gameID);
	setUserID(uid);

	database.favorites?.update({ [assetID]: isFavorite });
	database.favoriteCounts?.update({
		[assetID]: isFavorite ? store.fieldValues.increment(1) : store.fieldValues.increment(-1)
	});

	return json({ success: true });
};
