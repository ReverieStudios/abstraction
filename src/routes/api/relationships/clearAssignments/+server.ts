import { json, type RequestHandler } from '@sveltejs/kit';
import { database, setGameID } from '$lib/database';
import { isEditor } from '$lib/permissions';
import { relationshipAssignmentKey } from '../_common';
import type { Docs } from '$lib/database/types';

/**
 * POST /api/relationships/clearAssignments
 *
 * Clears all assignedRelationships for a given RelationshipSelector so that
 * the algorithm can be re-run.
 *
 * Body: { gameID: string, relationshipSelectorID: string }
 */
export const POST: RequestHandler = async (event) => {
	const payload = await event.request.json();
	const gameID: string = payload.gameID || '';
	const relationshipSelectorID: string = payload.relationshipSelectorID || '';

	if (!event.locals.decodedToken) {
		return json({ success: false, message: 'Not authenticated' });
	}
	if (!gameID || !relationshipSelectorID) {
		return json({ success: false, message: 'Missing gameID or relationshipSelectorID' });
	}
	if (!isEditor(event.locals.user.roles, gameID)) {
		return json({ success: false, message: 'Insufficient permissions' });
	}

	try {
		setGameID(gameID);

		const allAssignments: Docs.RelationshipAssignment[] =
			await database.relationshipAssignments
				?.withQueries({ field: 'relationshipSelectorID', op: '==', value: relationshipSelectorID })
				.read() ?? [];

		const assigned = allAssignments.filter(
			(a) => Array.isArray(a.data.assignedRelationships) && a.data.assignedRelationships.length > 0
		);

		await Promise.all(
			assigned.map((a) =>
				database.relationshipAssignments?.doc(a.id)?.update({ assignedRelationships: [] })
			)
		);

		return json({ success: true, cleared: assigned.length });
	} catch (err: any) {
		console.error('clearAssignments error:', err);
		return json({ success: false, message: (err as Error).message ?? String(err) });
	}
};
