import { json, type RequestHandler } from '@sveltejs/kit';
import { store } from '$lib/firebase';
import { database, setGameID } from '$lib/database';
import { isEditor } from '$lib/permissions';
import { CapacitatedRankMaximalMatcher } from '$lib/matching/matching';
import { relationshipAssignmentKey } from '../_common';
import type { Docs } from '$lib/database/types';

/**
 * POST /api/relationships/assignRelationships
 *
 * Runs the capacitated rank-maximal matching algorithm over all participants
 * for a given RelationshipSelector, then writes the resulting assignments back
 * to Firestore.
 *
 * Body: { gameID: string, relationshipSelectorID: string }
 *
 * Returns: { success: true, assignments: number } | { success: false, message: string }
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

		// ── 1. Load the selector ────────────────────────────────────────────────
		const selector = await database.relationshipSelectors?.doc(relationshipSelectorID)?.read();
		if (!selector?.exists) {
			return json({ success: false, message: 'RelationshipSelector not found' });
		}
		const selectorData = selector.data;
		const relationshipIDs: string[] = selectorData.relationshipIDs ?? [];
		const relationshipsPerCharacter: number = selectorData.relationshipsPerCharacter ?? 1;

		// ── 2. Load the relationships (posts) ───────────────────────────────────
		const relationshipDocs = await Promise.all(
			relationshipIDs.map((id) => database.relationships?.doc(id)?.read())
		);
		const relationships = (relationshipDocs as (Docs.Relationship | undefined)[]).filter(
			(r): r is Docs.Relationship => !!r?.exists
		);

		// ── 3. Load all existing assignments for this selector ─────────────────
		//      We only look at assignments that have rankings but no assignedRelationships yet.
		const allAssignments: Docs.RelationshipAssignment[] = await database.relationshipAssignments
			?.withQueries({ field: 'relationshipSelectorID', op: '==', value: relationshipSelectorID })
			.read() ?? [];

		const assignments = allAssignments.filter(
			(a) =>
				Array.isArray(a.data.relationshipRankings) &&
				a.data.relationshipRankings.length > 0
		);

		if (assignments.length === 0) {
			return json({ success: false, message: 'No participants have submitted rankings yet' });
		}

		// ── 4. Build and run the matcher ────────────────────────────────────────
		const matcher = new CapacitatedRankMaximalMatcher();

		// Shuffle applicants and relationships before adding to eliminate any
		// ordering bias in the algorithm (e.g. first-listed users always winning).
		const shuffledAssignments = [...assignments].sort(() => Math.random() - 0.5);
		const shuffledRelationships = [...relationships].sort(() => Math.random() - 0.5);

		// Add applicant nodes (one per participant)
		for (const assignment of shuffledAssignments) {
			const userID = assignment.data.userID;
			matcher.addNode(userID, false, relationshipsPerCharacter);
		}

		// Add post nodes (one per relationship) and edges
		const tupleSizes = new Map<string, number>();
		for (const rel of shuffledRelationships) {
			const capacity = rel.data.capacity > 0 ? rel.data.capacity : assignments.length;
			const size = rel.data.size ?? 2;
			matcher.addNode(rel.id, true, capacity);
			tupleSizes.set(rel.id, size);
		}

		// Add ranked edges: rank 1 = most preferred
		for (const assignment of shuffledAssignments) {
			const userID = assignment.data.userID;
			const rankings: string[] = assignment.data.relationshipRankings ?? [];
			rankings.forEach((relID, index) => {
				if (relationshipIDs.includes(relID)) {
					matcher.addEdge(userID, relID, index + 1);
				}
			});
		}

		// Determine max rank from rankings length
		const maxRank = Math.max(...shuffledAssignments.map((a) => a.data.relationshipRankings?.length ?? 0), 1);

		const matching = matcher.solve(maxRank);
		const rosters = matcher.fillTuples(matching, tupleSizes);

		// ── 5. Write results to Firestore via batched writes ────────────────────
		//      rosters is the authoritative source: Map<relID, userID[]>.
		//      Invert it to get per-user assignments, then write one doc per user.

		// Build per-user assignment list from rosters (includes fillTuples additions)
		const userAssignments = new Map<string, string[]>();
		for (const [relID, userIDs] of rosters) {
			for (const userID of userIDs) {
				if (!userAssignments.has(userID)) userAssignments.set(userID, []);
				userAssignments.get(userID)!.push(relID);
			}
		}

		// Every participant who submitted rankings gets a doc written (even if unmatched)
		type WriteOp = { path: string; data: { assignedRelationships: { relationshipID: string; assignedUserIDs: string[] }[] } };
		const ops: WriteOp[] = assignments.map((assignment) => {
			const userID = assignment.data.userID;
			const assignedRelIDs = userAssignments.get(userID) ?? [];
			const assignedRelationships = assignedRelIDs.map((relID) => ({
				relationshipID: relID,
				assignedUserIDs: rosters.get(relID) ?? []
			}));
			const key = relationshipAssignmentKey(relationshipSelectorID, userID);
			return { path: `games/${gameID}/relationshipAssignments/${key}`, data: { assignedRelationships } };
		});

		// Commit in chunks of 500 (Firestore batch limit)
		const BATCH_SIZE = 500;
		for (let i = 0; i < ops.length; i += BATCH_SIZE) {
			const batch = store.writeBatch();
			for (const op of ops.slice(i, i + BATCH_SIZE)) {
				const ref = store.doc(op.path);
				batch.set(ref, op.data, { merge: true });
			}
			await batch.commit();
		}

		return json({ success: true, assignments: ops.length });
	} catch (err: any) {
		console.error('assignRelationships error:', err);
		return json({ success: false, message: (err as Error).message ?? String(err) });
	}
};
