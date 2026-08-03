import { json, type RequestHandler } from '@sveltejs/kit';
import { database, setGameID } from '$lib/database';
import { isEditor } from '$lib/permissions';
import type { Docs } from '$lib/database/types';

const tupleKey = (userIDs: string[]): string => [...userIDs].sort().join('|');

/**
 * POST /api/relationships/deleteAssignedGroup
 *
 * Deletes exactly one assigned relationship group (tuple) for a given
 * relationshipSelector + relationship. Only the assignment entry matching
 * both relationshipID and assignedUserIDs tuple is removed.
 *
 * Body: {
 *   gameID: string,
 *   relationshipSelectorID: string,
 *   relationshipID: string,
 *   tupleUserIDs: string[]
 * }
 */
export const POST: RequestHandler = async (event) => {
	const payload = await event.request.json();
	const gameID: string = payload.gameID || '';
	const relationshipSelectorID: string = payload.relationshipSelectorID || '';
	const relationshipID: string = payload.relationshipID || '';
	const tupleUserIDs: string[] = Array.isArray(payload.tupleUserIDs) ? payload.tupleUserIDs : [];

	if (!event.locals.decodedToken) {
		return json({ success: false, message: 'Not authenticated' });
	}
	if (!gameID || !relationshipSelectorID || !relationshipID || tupleUserIDs.length === 0) {
		return json({ success: false, message: 'Missing gameID, relationshipSelectorID, relationshipID, or tupleUserIDs' });
	}
	if (!isEditor(event.locals.user.roles, gameID)) {
		return json({ success: false, message: 'Insufficient permissions' });
	}

	try {
		setGameID(gameID);
		const targetKey = tupleKey(tupleUserIDs);
		const tupleUserSet = new Set(tupleUserIDs);

		const allAssignments: Docs.RelationshipAssignment[] =
			await database.relationshipAssignments
				?.withQueries({ field: 'relationshipSelectorID', op: '==', value: relationshipSelectorID })
				.read() ?? [];

		const docsToUpdate = allAssignments.filter((assignment) => {
			if (!tupleUserSet.has(assignment.data.userID)) return false;
			const rels = assignment.data.assignedRelationships ?? [];
			return rels.some(
				(rel) => rel.relationshipID === relationshipID && tupleKey(rel.assignedUserIDs ?? []) === targetKey
			);
		});

		await Promise.all(
			docsToUpdate.map(async (assignment) => {
				const next = (assignment.data.assignedRelationships ?? []).filter(
					(rel) => !(rel.relationshipID === relationshipID && tupleKey(rel.assignedUserIDs ?? []) === targetKey)
				);
				await database.relationshipAssignments?.doc(assignment.id)?.update({ assignedRelationships: next });
			})
		);

		return json({ success: true, updated: docsToUpdate.length });
	} catch (err: any) {
		console.error('deleteAssignedGroup error:', err);
		return json({ success: false, message: (err as Error).message ?? String(err) });
	}
};
