import { json, type RequestHandler } from '@sveltejs/kit';
import { store } from '$lib/firebase';
import { database, setGameID } from '$lib/database';
import { couldOrIsLocked } from '../_common';

export const POST: RequestHandler = async (event) => {
	const payload = await event.request.json();
	const uid: string = payload.uid || '';
	const gameID: string = payload.gameID || '';
	if (!uid || !gameID) {
		return json({ success: false });
	}

	setGameID(gameID);
	const wasFinalized = await store
		.runTransaction<string>(async (transaction) => {
			const character = await database.characters.doc(uid).read(transaction);

			if (!character.exists) {
				console.log('no exists');
				return 'No such character';
			}
			const assetIDs = character.data.assets;
			const locks = await Promise.all(
				assetIDs.map((id) => database.locks.doc(id).read(transaction))
			);

			const anyQueued = locks.filter((lock) => lock.data.claimsQueue.includes(uid));
			if (anyQueued.length > 0) {
				console.log('queued');
				return `queued: ${anyQueued.map((l) => l.id).join(', ')}`;
			}

			const missingLocks = locks.filter((lock) => !couldOrIsLocked(lock, uid));
			if (missingLocks.length > 0) {
				console.log('not has all', missingLocks);
				return `missingLocks: ${missingLocks.map((l) => l.id).join(', ')}`;
			}

			return 'should be fine';
		})
		.catch((ex) => {
			console.error(ex);
			return false;
		});

	return json({ success: wasFinalized });
};
