import { json, type RequestHandler } from '@sveltejs/kit';
import { database, setGameID } from '$lib/database';
import { isEditor } from '$lib/permissions';
import type { Docs } from '$lib/database/types';

/**
 * POST /api/relationships/share
 *
 * Sets the `shared` flag on AssignedRelationship entries for a given
 * RelationshipSelector. When `relationshipID` is provided, only entries
 * matching that relationship are updated; otherwise all entries are updated.
 *
 * Body: { gameID: string, relationshipSelectorID: string, shared: boolean, relationshipID?: string }
 *
 * Returns: { success: true, updated: number } | { success: false, message: string }
 */
export const POST: RequestHandler = async (event) => {
	const payload = await event.request.json();
	const gameID: string = payload.gameID || '';
	const relationshipSelectorID: string = payload.relationshipSelectorID || '';
	const shared: boolean | undefined = payload.shared;
	const relationshipID: string | undefined = payload.relationshipID || undefined;

	if (!event.locals.decodedToken) {
		return json({ success: false, message: 'Not authenticated' });
	}
	if (!gameID || !relationshipSelectorID) {
		return json({ success: false, message: 'Missing gameID or relationshipSelectorID' });
	}
	if (shared === undefined || shared === null) {
		return json({ success: false, message: 'Missing shared value' });
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

		const assignmentsWithData = allAssignments.filter(
			(a) => Array.isArray(a.data.assignedRelationships) && a.data.assignedRelationships.length > 0
		);

		let updated = 0;

		await Promise.all(
			assignmentsWithData.map(async (assignment) => {
				const existing = assignment.data.assignedRelationships;
				let changed = false;

				const next = existing.map((rel) => {
					if (relationshipID && rel.relationshipID !== relationshipID) return rel;
					if (rel.shared === shared) return rel;
					changed = true;
					return { ...rel, shared };
				});

				if (!changed) return;

				await database.relationshipAssignments?.doc(assignment.id)?.update({ assignedRelationships: next });
				updated++;
			})
		);

		return json({ success: true, updated });
	} catch (err: any) {
		console.error('share error:', err);
		return json({ success: false, message: (err as Error).message ?? String(err) });
	}
};
