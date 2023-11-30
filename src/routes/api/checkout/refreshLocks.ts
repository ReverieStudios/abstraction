import type { RequestHandler } from '@sveltejs/kit';
import { store } from '$lib/firebase';
import { database, setGameID } from '$lib/database';
import { refreshLock } from './_common';

export const post: RequestHandler = async (event) => {
	const payload = await event.request.json();
	const gameID: string = payload.gameID || '';
	if (!event.locals.decodedToken || !gameID) {
		// missing params or not logged in
		return { body: { success: false } };
	}

	const { uid } = event.locals.decodedToken;

	try {
		setGameID(gameID);

		const result: boolean = await store
			.runTransaction<boolean>(async (transaction) => {
				const character = await database.characters.doc(uid).read(transaction);

				if (!character.exists) {
					return false;
				}
				const assetIDs = character.data.assets;
				const locks = await Promise.all(
					assetIDs.map((id) => database.locks.doc(id).read(transaction))
				);

				for (const lock of locks) {
					const update = refreshLock(lock, uid);
					if (update) {
						const newLock = { ...lock.data, ...update };
						await lock.save(newLock, transaction);
					}
				}

				return true;
			})
			.catch((ex) => {
				console.error(ex);
				return false;
			});

		return {
			body: { success: result }
		};
	} catch (err: any) {
		return { body: { success: false, ex: (err as Error).stack } };
	}
};
