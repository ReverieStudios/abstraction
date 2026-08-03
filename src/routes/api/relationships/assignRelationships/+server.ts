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
		const allAssignments: Docs.RelationshipAssignment[] = await database.relationshipAssignments
			?.withQueries({ field: 'relationshipSelectorID', op: '==', value: relationshipSelectorID })
			.read() ?? [];

		// Split into already-assigned participants and new ones needing matching
		const alreadyAssigned = allAssignments.filter(
			(a) =>
				Array.isArray(a.data.assignedRelationships) &&
				a.data.assignedRelationships.length > 0
		);
		const newAssignments = allAssignments.filter(
			(a) =>
				Array.isArray(a.data.relationshipRankings) &&
				a.data.relationshipRankings.length > 0 &&
				(!Array.isArray(a.data.assignedRelationships) || a.data.assignedRelationships.length === 0)
		);

		// No one has submitted rankings at all
		const anyWithRankings = allAssignments.some(
			(a) => Array.isArray(a.data.relationshipRankings) && a.data.relationshipRankings.length > 0
		);
		if (!anyWithRankings) {
			return json({ success: false, message: 'No participants have submitted rankings yet' });
		}

		// Everyone who submitted rankings is already assigned
		if (newAssignments.length === 0) {
			return json({ success: true, assignments: 0, message: 'All participants are already assigned' });
		}

		// ── 4. Build existing roster map from already-assigned docs ────────────
		// existingRostersByRelID: relID -> set of userIDs already in that relationship
		const existingRostersByRelID = new Map<string, string[]>();
		for (const assignment of alreadyAssigned) {
			for (const ar of assignment.data.assignedRelationships ?? []) {
				if (!existingRostersByRelID.has(ar.relationshipID)) {
					existingRostersByRelID.set(ar.relationshipID, []);
				}
				const roster = existingRostersByRelID.get(ar.relationshipID)!;
				if (!roster.includes(assignment.data.userID)) {
					roster.push(assignment.data.userID);
				}
			}
		}

		// ── 5. Build existingCandidates for fillTuples ─────────────────────────
		// For each already-assigned user, collect posts they ranked but were NOT assigned to.
		const existingCandidates: { applicant: string; post: string; rank: number }[] = [];
		for (const assignment of alreadyAssigned) {
			const assignedRelIDs = new Set(
				(assignment.data.assignedRelationships ?? []).map((ar) => ar.relationshipID)
			);
			const rankings: string[] = assignment.data.relationshipRankings ?? [];
			rankings.forEach((relID, index) => {
				if (relationshipIDs.includes(relID) && !assignedRelIDs.has(relID)) {
					existingCandidates.push({ applicant: assignment.data.userID, post: relID, rank: index + 1 });
				}
			});
		}

		// ── 6. Build and run the matcher (new participants only) ────────────────
		const matcher = new CapacitatedRankMaximalMatcher();

		const shuffledNewAssignments = [...newAssignments].sort(() => Math.random() - 0.5);
		const shuffledRelationships = [...relationships].sort(() => Math.random() - 0.5);

		// Add applicant nodes for new participants only
		for (const assignment of shuffledNewAssignments) {
			matcher.addNode(assignment.data.userID, false, relationshipsPerCharacter);
		}

		// Add post nodes with capacity reduced by existing assignments
		const tupleSizes = new Map<string, number>();
		const addedPostIDs = new Set<string>();
		for (const rel of shuffledRelationships) {
			const existingCount = existingRostersByRelID.get(rel.id)?.length ?? 0;
			const baseCapacity = rel.data.capacity > 0 ? rel.data.capacity : allAssignments.length;
			const remainingCapacity = Math.max(0, baseCapacity - existingCount);
			const size = rel.data.size ?? 2;
			tupleSizes.set(rel.id, size);
			// Only add as a post node if slots remain — but still track tuple size
			if (remainingCapacity > 0) {
				matcher.addNode(rel.id, true, remainingCapacity);
				addedPostIDs.add(rel.id);
			}
		}

		// Add ranked edges from new participants (only to posts that have remaining slots)
		for (const assignment of shuffledNewAssignments) {
			const userID = assignment.data.userID;
			const rankings: string[] = assignment.data.relationshipRankings ?? [];
			rankings.forEach((relID, index) => {
				if (addedPostIDs.has(relID)) {
					matcher.addEdge(userID, relID, index + 1);
				}
			});
		}

		const maxRank = Math.max(...shuffledNewAssignments.map((a) => a.data.relationshipRankings?.length ?? 0), 1);

		const matching = matcher.solve(maxRank);
		// newRosters: Map<relID, newRoundUserIDs[]> — new-round additions only
		const newRosters = matcher.fillTuples(matching, tupleSizes, existingCandidates);

		// Matched new participants by relationship (excludes fill-only additions).
		const matchedNewByRelID = new Map<string, string[]>();
		for (const { applicant, post } of matching) {
			if (!matchedNewByRelID.has(post)) matchedNewByRelID.set(post, []);
			matchedNewByRelID.get(post)!.push(applicant);
		}

		// ── 7. Write results to Firestore via batched writes ────────────────────
		// Preserve existing tuple memberships exactly as stored, keyed by rel/user.
		const existingTupleByRelUser = new Map<string, Map<string, string[]>>();
		const existingTuplesByRelID = new Map<string, string[][]>();
		for (const assignment of alreadyAssigned) {
			for (const ar of assignment.data.assignedRelationships ?? []) {
				if (!existingTupleByRelUser.has(ar.relationshipID)) {
					existingTupleByRelUser.set(ar.relationshipID, new Map());
				}
				if (!existingTuplesByRelID.has(ar.relationshipID)) {
					existingTuplesByRelID.set(ar.relationshipID, []);
				}
				const byUser = existingTupleByRelUser.get(ar.relationshipID)!;
				const tuple = Array.isArray(ar.assignedUserIDs) && ar.assignedUserIDs.length > 0
					? ar.assignedUserIDs
					: [assignment.data.userID];
				const tuples = existingTuplesByRelID.get(ar.relationshipID)!;
				const tupleKey = [...tuple].sort().join('|');
				if (!tuples.some((t) => [...t].sort().join('|') === tupleKey)) {
					tuples.push(tuple);
				}
				for (const uid of tuple) {
					byUser.set(uid, tuple);
				}
			}
		}

		// If a relationship already has incomplete tuples, rebalance that relationship
		// with new-round additions so incomplete groups can be completed.
		// Fill is capped to exactly the deficit so we do not create a new orphan tuple.
		const rebalancedTuplesByRelID = new Map<string, string[][]>();
		const effectiveNewRostersByRelID = new Map<string, string[]>();
		for (const [relID, tuples] of existingTuplesByRelID) {
			const size = tupleSizes.get(relID) ?? 2;
			const hasIncomplete = tuples.some((t) => t.length < size);
			if (!hasIncomplete) continue;

			const seen = new Set<string>();
			const existingFlat: string[] = [];
			for (const tuple of tuples) {
				for (const uid of tuple) {
					if (!seen.has(uid)) {
						seen.add(uid);
						existingFlat.push(uid);
					}
				}
			}

			const existingSet = new Set(existingFlat);
			const matchedNew = matchedNewByRelID.get(relID) ?? [];
			const matchedNewSet = new Set(matchedNew);

			const baseCombined = [
				...existingFlat,
				...matchedNew.filter((uid) => !existingSet.has(uid))
			];

			const remainder = baseCombined.length % size;
			const neededFill = remainder === 0 ? 0 : size - remainder;

			const fillCandidates = (newRosters.get(relID) ?? []).filter(
				(uid) => !existingSet.has(uid) && !matchedNewSet.has(uid)
			);
			const cappedFill = fillCandidates.slice(0, neededFill);

			const combined = [...baseCombined, ...cappedFill];
			const rebalanced: string[][] = [];
			for (let i = 0; i < combined.length; i += size) {
				rebalanced.push(combined.slice(i, i + size));
			}
			rebalancedTuplesByRelID.set(relID, rebalanced);

			effectiveNewRostersByRelID.set(
				relID,
				combined.filter((uid) => !existingSet.has(uid))
			);
		}

		// For relationships without incomplete existing tuples, keep matcher output as-is.
		for (const [relID, roster] of newRosters) {
			if (!effectiveNewRostersByRelID.has(relID)) {
				effectiveNewRostersByRelID.set(relID, roster);
			}
		}

		// Build tuples only for new-round additions. Existing tuples are not re-sliced.
		const newTuplesByRelID = new Map<string, string[][]>();
		for (const [relID, roster] of effectiveNewRostersByRelID) {
			const size = tupleSizes.get(relID) ?? 2;
			const tuples: string[][] = [];
			for (let i = 0; i < roster.length; i += size) {
				tuples.push(roster.slice(i, i + size));
			}
			newTuplesByRelID.set(relID, tuples);
		}

		/** Returns the tuple for this user in this relationship, preferring preserved existing tuples. */
		const getUserTuple = (relID: string, userID: string): string[] => {
			const rebalancedTuples = rebalancedTuplesByRelID.get(relID);
			if (rebalancedTuples) {
				return rebalancedTuples.find((t) => t.includes(userID)) ?? [userID];
			}

			const existingTuple = existingTupleByRelUser.get(relID)?.get(userID);
			if (existingTuple) return existingTuple;

			const newTuples = newTuplesByRelID.get(relID) ?? [];
			return newTuples.find((t) => t.includes(userID)) ?? [userID];
		};

		// Determine which relIDs gained new members this run
		const changedRelIDs = new Set<string>(
			[...effectiveNewRostersByRelID.entries()]
				.filter(([, users]) => users.length > 0)
				.map(([relID]) => relID)
		);

		// Build per-user assignment list for new participants from combined rosters
		const newUserAssignments = new Map<string, string[]>();
		for (const [relID, userIDs] of effectiveNewRostersByRelID) {
			for (const userID of userIDs) {
				// Only track new-round users (not existing fill candidates pulled in)
				if (newAssignments.some((a) => a.data.userID === userID)) {
					if (!newUserAssignments.has(userID)) newUserAssignments.set(userID, []);
					newUserAssignments.get(userID)!.push(relID);
				}
			}
		}

		type WriteOp = {
			path: string;
			data: { assignedRelationships: { relationshipID: string; assignedUserIDs: string[]; shared: boolean }[] };
		};
		const ops: WriteOp[] = [];

		// Write docs for new participants
		for (const assignment of newAssignments) {
			const userID = assignment.data.userID;
			const assignedRelIDs = newUserAssignments.get(userID) ?? [];
			const assignedRelationships = assignedRelIDs.map((relID) => ({
				relationshipID: relID,
				assignedUserIDs: getUserTuple(relID, userID),
				shared: false
			}));
			const key = relationshipAssignmentKey(relationshipSelectorID, userID);
			ops.push({ path: `games/${gameID}/relationshipAssignments/${key}`, data: { assignedRelationships } });
		}

		// Patch existing participants' docs for any relationship that gained new members
		for (const assignment of alreadyAssigned) {
			const touchedRels = (assignment.data.assignedRelationships ?? []).filter((ar) =>
				changedRelIDs.has(ar.relationshipID)
			);
			if (touchedRels.length === 0) continue;

			// Rebuild assignedRelationships: update assignedUserIDs for changed rels, keep others intact
			const updatedAssignedRelationships = (assignment.data.assignedRelationships ?? []).map((ar) => {
				if (changedRelIDs.has(ar.relationshipID)) {
					return { ...ar, assignedUserIDs: getUserTuple(ar.relationshipID, assignment.data.userID) };
				}
				return ar;
			});
			const key = relationshipAssignmentKey(relationshipSelectorID, assignment.data.userID);
			ops.push({
				path: `games/${gameID}/relationshipAssignments/${key}`,
				data: { assignedRelationships: updatedAssignedRelationships }
			});
		}

		// Also patch any existing user who was pulled in as a fill candidate this run
		// (they appear in newRosters but are not in newAssignments)
		const newParticipantIDs = new Set(newAssignments.map((a) => a.data.userID));
		const fillFromExisting = new Map<string, string[]>(); // userID -> relIDs they were fill-added to
		for (const [relID, userIDs] of effectiveNewRostersByRelID) {
			for (const userID of userIDs) {
				if (!newParticipantIDs.has(userID)) {
					// This is an existing user pulled in as a fill candidate
					if (!fillFromExisting.has(userID)) fillFromExisting.set(userID, []);
					fillFromExisting.get(userID)!.push(relID);
				}
			}
		}
		for (const [userID, addedRelIDs] of fillFromExisting) {
			const existingDoc = alreadyAssigned.find((a) => a.data.userID === userID);
			if (!existingDoc) continue; // shouldn't happen
			const existingRels = existingDoc.data.assignedRelationships ?? [];
			// Merge: update changed rels + append newly fill-added rels
			const updatedMap = new Map(existingRels.map((ar) => [ar.relationshipID, ar]));
			for (const relID of addedRelIDs) {
				updatedMap.set(relID, {
					relationshipID: relID,
					assignedUserIDs: getUserTuple(relID, userID),
					shared: false
				});
			}
			// Also update assignedUserIDs for any previously assigned rel that changed
			for (const [relID, ar] of updatedMap) {
				if (changedRelIDs.has(relID)) {
					updatedMap.set(relID, { ...ar, assignedUserIDs: getUserTuple(relID, userID) });
				}
			}
			const key = relationshipAssignmentKey(relationshipSelectorID, userID);
			ops.push({
				path: `games/${gameID}/relationshipAssignments/${key}`,
				data: { assignedRelationships: [...updatedMap.values()] }
			});
		}

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

		return json({ success: true, assignments: newAssignments.length });
	} catch (err: any) {
		console.error('assignRelationships error:', err);
		return json({ success: false, message: (err as Error).message ?? String(err) });
	}
};
