import type { RequestHandler } from '@sveltejs/kit';
import { store } from '$lib/firebase';
import { database, setGameID } from '$lib/database';
import { couldOrIsLocked, finalize } from './_common';

export const post: RequestHandler = async (event) => {
	const payload = await event.request.json();
	const gameID: string = payload.gameID || '';
	if (!event.locals.decodedToken || !gameID) {
		return { body: { success: false } };
	}
	const uid = event.locals.decodedToken.uid;

	setGameID(gameID);
	const wasFinalized = await store
		.runTransaction<boolean>(async (transaction) => {
			const character = await database.characters.doc(uid).read(transaction);

			if (!character.exists) {
				console.log('no exists');
				return false;
			}
			const assetIDs = character.data.assets;
			const locks = await Promise.all(
				assetIDs.map((id) => database.locks.doc(id).read(transaction))
			);

			const anyQueued = locks.some((lock) => lock.data.claimsQueue.includes(uid));
			if (anyQueued) {
				console.log('queued');
				return false;
			}

			const hasAllLocks = locks.every((lock) => couldOrIsLocked(lock, uid));
			if (!hasAllLocks) {
				const missingLocks = locks.filter((lock) => !couldOrIsLocked(lock, uid));
				console.log('not has all', missingLocks);
				return false;
			}

			for (const lock of locks) {
				const update = finalize(lock, uid);
				const newLock = { ...lock.data, ...update };
				await lock.save(newLock, transaction);
			}

			const assets = await Promise.all(assetIDs.map((id) => database.assets.doc(id).read()));
			const assetWithName = assets.find((asset) => asset.data.enforceName);
			await character.update(
				{
					name: assetWithName?.data?.enforceName ?? 'My Character',
					nameLocked: assetWithName != null,
					purchased: true
				},
				transaction
			);

			return true;
		})
		.catch((ex) => {
			console.error(ex);
			return false;
		});

	return {
		body: { success: wasFinalized }
	};
};
