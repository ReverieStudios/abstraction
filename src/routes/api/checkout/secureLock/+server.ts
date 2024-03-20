import { json, type RequestHandler } from '@sveltejs/kit';
import { store } from '$lib/firebase';
import { database, setGameID } from '$lib/database';
import { addLock } from '../_common';
import { AssetFailsRequirementsError, AssetIsLimitedError } from '../_errors';

export interface LockLimited {
	limited: true;
}
export interface LockPrereqs {
	missingRequiredFlags: string[];
	extraLimitedFlags: string[];
}
export type LockResult = boolean | LockLimited | LockPrereqs;

export const POST: RequestHandler = async (event) => {
	const payload = await event.request.json();
	const assetID: string = payload.assetID || '';
	const gameID: string = payload.gameID || '';
	const depth: number = payload.depth ?? -1;
	if (!event.locals.decodedToken || !assetID || !gameID) {
		// missing params or not logged in
		return json({ success: false });
	}
	const { uid } = event.locals.decodedToken;
	const flags = event.locals.user?.flags?.[gameID] ?? [];

	try {
		setGameID(gameID);

		const lockResult: LockResult = await store
			.runTransaction<LockResult>(async (transaction) => {
				const lock = await database.locks?.doc(assetID)?.read(transaction);
				if (!lock) {
					// unknown asset
					return json(false);
				}
				const character = await database.characters?.doc(uid)?.read(transaction);
				if (depth > -1 && (character?.data?.assets ?? []).length > depth) {
					return json(false);
				}

				const update = addLock(lock, uid, flags);
				await lock.update(update, transaction);

				await database.characters?.doc(uid)?.update(
					{ assets: [...(character?.data?.assets ?? []), assetID] }, transaction
				);
				return json(true);
			})
			.catch((ex) => {
				if (ex instanceof AssetIsLimitedError) {
					return json({ limited: true });
				} else if (ex instanceof AssetFailsRequirementsError) {
					return json({
						missingRequiredFlags: ex.missingRequiredFlags,
						extraLimitedFlags: ex.extraLimitedFlags
					});
				}
				console.error(ex);
				return json(false);
			});

		return lockResult;
	} catch (err: any) {
		return json({ success: false, ex: (err as Error).stack });
	}
};
