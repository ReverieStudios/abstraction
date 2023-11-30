import type { Docs, Updaters } from '$lib/database';
import { isInCart, isPurchased } from '$lib/database/types/Lock';
import type { Lock } from '$lib/database/types/Lock';
import { AssetIsLimitedError, AssetFailsRequirementsError } from './_errors';

export const getUnlockTime = () => Date.now() + 10 * 60 * 1000;
export const getShortUnlockTime = () => Date.now() + 5 * 60 * 1000;

const getLock = (uid: string, shortLock?: boolean): Lock.Claim.InCart => ({
	purchaser: uid,
	unlocksAt: shortLock === true ? getShortUnlockTime() : getUnlockTime()
});
const getFinalLock = (uid: string): Lock.Claim.Purchased => ({
	purchaser: uid
});

const getClaimLimit = (lock: Docs.Lock) => {
	if (!lock?.data?.claimLimit) {
		return Infinity;
	}
	return lock.data.claimLimit;
};

const lockIsActive = (lock: Lock.Claim) => {
	if (isInCart(lock)) {
		return lock.unlocksAt >= Date.now();
	} else if (isPurchased(lock)) {
		return true;
	}
};

interface ClaimUpdate {
	claims: Lock.Claim[];
	claimsQueue: string[];
}

const onlyActiveClaims = (lock: Docs.Lock): ClaimUpdate => {
	return {
		claims: (lock?.data?.claims ?? []).filter(lockIsActive),
		claimsQueue: lock?.data?.claimsQueue ?? []
	};
};

const normalize = (claimLimit: number, update: ClaimUpdate): Updaters.Lock => {
	const { owners, claims } = update.claims.reduce(
		(acc, claim) => {
			if (!acc.owners.has(claim.purchaser)) {
				acc.claims.push(claim);
				acc.owners.add(claim.purchaser);
			}
			return acc;
		},
		{ claims: [] as Docs.Lock['data']['claims'], owners: new Set() as Set<String> }
	);
	const dedupedUpdate = {
		claims,
		claimsQueue: Array.from(new Set(update.claimsQueue)).filter((uid) => !owners.has(uid))
	};

	if (dedupedUpdate.claims.length > claimLimit) {
		return {
			claims: dedupedUpdate.claims.slice(0, claimLimit),
			claimsQueue: [
				...dedupedUpdate.claimsQueue,
				...dedupedUpdate.claims.slice(claimLimit).map((lock) => lock.purchaser)
			]
		};
	}
	if (dedupedUpdate.claims.length < claimLimit && dedupedUpdate.claimsQueue.length > 0) {
		const space = claimLimit - dedupedUpdate.claims.length;
		const next: Lock.Claim.InCart[] = dedupedUpdate.claimsQueue
			.slice(0, space)
			.map((id) => getLock(id, true));

		return {
			claims: [...dedupedUpdate.claims, ...next],
			claimsQueue: dedupedUpdate.claimsQueue.slice(space)
		};
	}

	return dedupedUpdate;
};

export const addLock = (lock: Docs.Lock, uid: string, userFlags: string[]): Updaters.Lock => {
	let update: ClaimUpdate = onlyActiveClaims(lock);
	const alreadyLocked = update.claims.find((lock) => lock.purchaser === uid);
	const alreadyInQueue = update.claimsQueue.some((lock) => lock === uid);
	const stillHope = update.claims.some((lock) => isInCart(lock));

	const hasRequirement =
		lock.data?.requirements?.length === 0 ||
		(lock.data?.requirements ?? []).some((reqFlag) => userFlags.includes(reqFlag));
	const ownedBarred = (lock.data?.limitations ?? []).filter((banFlag) =>
		userFlags.includes(banFlag)
	);
	const canBuy = hasRequirement && ownedBarred.length === 0;

	const claimLimit = getClaimLimit(lock);

	if (!canBuy) {
		throw new AssetFailsRequirementsError(lock.data?.requirements ?? [], ownedBarred);
	} else if (alreadyLocked) {
		if (isInCart(alreadyLocked)) {
			// refresh lock time
			alreadyLocked.unlocksAt = getUnlockTime();
		}
	} else if (update.claims.length < claimLimit) {
		update.claims = [...update.claims, getLock(uid)];
		update.claimsQueue = update.claimsQueue.filter((lock) => lock !== uid);
	} else if (!stillHope) {
		throw new AssetIsLimitedError();
	} else if (!alreadyInQueue) {
		update.claimsQueue = [...update.claimsQueue, uid];
	}

	return normalize(claimLimit, update);
};

export const couldOrIsLocked = (lock: Docs.Lock, uid: string): boolean => {
	const claimLimit = getClaimLimit(lock);
	const couldLock = lock.data.claims.length < claimLimit;

	return couldLock || lock.data.claims.some((claim) => claim.purchaser === uid);
};

export const clearLock = (lock: Docs.Lock, uid: string): Updaters.Lock => {
	let update: ClaimUpdate = onlyActiveClaims(lock);
	update.claims = update.claims.filter((lock) => lock.purchaser !== uid);
	update.claimsQueue = update.claimsQueue.filter((lock) => lock !== uid);

	return normalize(getClaimLimit(lock), update);
};

export const refreshLock = (lock: Docs.Lock, uid: string): Updaters.Lock => {
	let update: ClaimUpdate = onlyActiveClaims(lock);
	// if the purchaser has an active claim, refresh its timestamp
	if (update.claims.some((lock) => lock.purchaser === uid && !isPurchased(lock))) {
		update.claims = update.claims.map((lock) => {
			if (lock.purchaser === uid) {
				return getLock(uid);
			}
			return lock;
		});
	} else {
		// otherwise try to reclaim it (normalize will drop it to the queue if necessary)
		update.claims = [...update.claims, getLock(uid)];
	}

	return normalize(getClaimLimit(lock), update);
};

export const finalize = (lock: Docs.Lock, uid: string): Updaters.Lock => {
	let update: ClaimUpdate = onlyActiveClaims(lock);
	const claimLimit = getClaimLimit(lock);
	if (update.claims.some((claim) => claim.purchaser === uid)) {
		update.claims = update.claims.map((lock) => {
			if (lock.purchaser === uid) {
				return getFinalLock(uid);
			}
			return lock;
		});
	} else if (update.claims.length < claimLimit) {
		update.claims = [...update.claims, getFinalLock(uid)];
	}
	const allPurchased =
		update.claims.length === claimLimit && update.claims.every((claim) => isPurchased(claim));
	if (allPurchased) {
		// if all slots have been claimed, clear the queue
		update.claimsQueue = [];
	}

	return normalize(claimLimit, update);
};
