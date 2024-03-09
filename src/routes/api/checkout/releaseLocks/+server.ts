// Use https://developer.mozilla.org/en-US/docs/Web/API/Beacon_API to release claims onUnload

import { json, type RequestHandler } from '@sveltejs/kit';
import { store } from '$lib/firebase';
import { database, setGameID } from '$lib/database';
import { clearLock } from '../_common';

export const _releaseLocks = async (uid: string, assetIDs: string[], releaseAll: boolean) => {
	return await store
		.runTransaction<boolean>(async (transaction) => {
			const character = await database.characters?.doc(uid)?.read(transaction);

			if (!character.exists) {
				return false;
			}

			const releaseIDs = releaseAll ? character.data.assets : assetIDs;
			const releaseSet = new Set(releaseIDs);

			if (!character.data.assets.slice(-releaseSet.size).every((id) => releaseSet.has(id))) {
				// something weird is going on and the released IDs are not at the end of the lock array
				return false;
			}

			const locks = await Promise.all(
				releaseIDs.map((id) => database.locks?.doc(id)?.read(transaction))
			);

			for (let lock of locks) {
				if (!lock.exists) {
					// unknown asset
					continue;
				}

				const update = clearLock(lock, uid);
				await lock.update(update, transaction);
			}

			await character.update(
				{
					assets: character.data.assets.slice(0, character.data.assets.length - releaseIDs.length)
				},
				transaction
			);

			return true;
		})
		.catch((ex) => {
			console.error(ex);
			return false;
		});
};

export const POST: RequestHandler = async (event) => {
	const payload = await event.request.json();
	const assetIDs: string[] = payload.assetIDs || [];
	const releaseAll: boolean = payload.releaseAll || false;
	const gameID: string = payload.gameID || '';
	if (!event.locals.decodedToken || !gameID) {
		// missing params or not logged in
		return json({ success: false });
	}
	if (assetIDs.length === 0 && !releaseAll) {
		// nothing to do
		return json({ success: true });
	}

	const { uid } = event.locals.decodedToken;

	setGameID(gameID);

	const locksReleased = await _releaseLocks(uid, assetIDs, releaseAll);

	return json({ success: locksReleased });
};
