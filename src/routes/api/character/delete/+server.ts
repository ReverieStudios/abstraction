import { json, type RequestHandler } from '@sveltejs/kit';
import { database, setGameID } from '$lib/database';
import { _releaseLocks } from '../../checkout/releaseLocks/+server';
import { isEditor } from '$lib/permissions';
import type { Docs } from '$lib/database/types';

export const POST: RequestHandler = async (event) => {
	const payload = await event.request.json();
	const gameID: string = payload.gameID || '';
	if (!event.locals.decodedToken || !gameID) {
		// missing params or not logged in
		return json({ success: false });
	}
	let { uid } = event.locals.decodedToken;
	if (payload.userID) {
		if (isEditor(event.locals.user.roles, gameID)) {
			uid = payload.userID;
		} else {
			return json({ success: false });
		}
	}

	try {
		setGameID(gameID);

		const released = await _releaseLocks(uid, [], true);
		if (!released) {
			return json({ success: false });
		}

		await _deleteRelationshipAssignments(uid);

		await database.characters?.doc(uid)?.remove();

		return json({ success: true });
	} catch (err: any) {
		return json({ success: false, ex: (err as Error).stack });
	}
};

/**
 * Clean up all RelationshipAssignment data associated with a deleted user:
 *
 * 1. Delete the user's own assignment doc (their rankings + any assignment
 *    the algorithm wrote to them).
 * 2. For every *other* participant's doc that lists this user inside
 *    `assignedRelationships[].assignedUserIDs`, strip the uid out so the
 *    roster stays consistent.
 *
 * Note: Firestore cannot query inside nested arrays, so we read all docs for
 * the affected selectors and filter in memory.  Character deletes are
 * infrequent so this is acceptable.
 */
export const _deleteRelationshipAssignments = async (uid: string): Promise<void> => {
	// Fetch the user's own assignment docs
	const ownDocs: Docs.RelationshipAssignment[] =
		await database.relationshipAssignments
			?.withQueries({ field: 'userID', op: '==', value: uid })
			.read() ?? [];

	const ops: Promise<unknown>[] = [];

	// Delete the user's own assignment docs and collect the selectorIDs they belonged to
	const affectedSelectorIDs = new Set<string>();
	for (const doc of ownDocs) {
		affectedSelectorIDs.add(doc.data.relationshipSelectorID);
		ops.push(database.relationshipAssignments!.doc(doc.id)!.remove());
	}

	// For each affected selector, scan peer docs for references to this uid in assignedUserIDs
	for (const selectorID of affectedSelectorIDs) {
		const peerDocs: Docs.RelationshipAssignment[] =
			await database.relationshipAssignments
				?.withQueries({ field: 'relationshipSelectorID', op: '==', value: selectorID })
				.read() ?? [];

		for (const doc of peerDocs) {
			// Skip the user's own docs (already being deleted above)
			if (doc.data.userID === uid) continue;

			const hasRef = doc.data.assignedRelationships?.some((ar) =>
				ar.assignedUserIDs.includes(uid)
			);
			if (!hasRef) continue;

			const updated = doc.data.assignedRelationships.map((ar) => ({
				...ar,
				assignedUserIDs: ar.assignedUserIDs.filter((id) => id !== uid)
			}));
			ops.push(
				database.relationshipAssignments!.doc(doc.id)!.update({ assignedRelationships: updated })
			);
		}
	}

	await Promise.all(ops);
};
