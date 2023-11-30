import type { RequestHandler } from '@sveltejs/kit';
import { store } from '$lib/firebase';
import { database, setGameID } from '$lib/database';
import { addLock } from './_common';
import { AssetFailsRequirementsError, AssetIsLimitedError } from './_errors';

export interface LockLimited {
	limited: true;
}
export interface LockPrereqs {
	missingRequiredFlags: string[];
	extraLimitedFlags: string[];
}
export type LockResult = boolean | LockLimited | LockPrereqs;

export const post: RequestHandler = async (event) => {
	const payload = await event.request.json();
	const assetID: string = payload.assetID || '';
	const gameID: string = payload.gameID || '';
	const depth: number = payload.depth ?? -1;
	if (!event.locals.decodedToken || !assetID || !gameID) {
		// missing params or not logged in
		return { body: { success: false } };
	}
	const { uid } = event.locals.decodedToken;
	const flags = event.locals.user?.flags?.[gameID] ?? [];

	try {
		setGameID(gameID);

		const lockResult: LockResult = await store
			.runTransaction<LockResult>(async (transaction) => {
				const lock = await database.locks.doc(assetID).read(transaction);
				if (!lock) {
					// unknown asset
					return false;
				}
				const character = await database.characters.doc(uid).read(transaction);
				console.log({ depth, assets: (character?.data?.assets ?? []).length });
				if (depth > -1 && (character?.data?.assets ?? []).length > depth) {
					return false;
				}

				const update = addLock(lock, uid, flags);
				await lock.update(update, transaction);

				await database.characters
					.doc(uid)
					.update({ assets: [...(character?.data?.assets ?? []), assetID] }, transaction);

				return true;
			})
			.catch((ex) => {
				if (ex instanceof AssetIsLimitedError) {
					return { limited: true };
				} else if (ex instanceof AssetFailsRequirementsError) {
					return {
						missingRequiredFlags: ex.missingRequiredFlags,
						extraLimitedFlags: ex.extraLimitedFlags
					};
				}
				console.error(ex);
				return false;
			});

		return {
			body: lockResult as any
		};
	} catch (err: any) {
		return { body: { success: false, ex: (err as Error).stack } };
	}
};
