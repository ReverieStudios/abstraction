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

		const assignedCount = (a: Docs.RelationshipAssignment): number =>
			Array.isArray(a.data.assignedRelationships) ? a.data.assignedRelationships.length : 0;

		// Participants who have submitted rankings and still need more assignments.
		const assignmentsNeedingMatch = allAssignments.filter(
			(a) =>
				Array.isArray(a.data.relationshipRankings) &&
				a.data.relationshipRankings.length > 0 &&
				assignedCount(a) < relationshipsPerCharacter
		);

		// Participants with at least one existing assignment (used for existing rosters/tuples).
		const participantsWithAssignments = allAssignments.filter((a) => assignedCount(a) > 0);

		// No one has submitted rankings at all
		const anyWithRankings = allAssignments.some(
			(a) => Array.isArray(a.data.relationshipRankings) && a.data.relationshipRankings.length > 0
		);
		if (!anyWithRankings) {
			return json({ success: false, message: 'No participants have submitted rankings yet' });
		}

		// Everyone who submitted rankings is already assigned
		if (assignmentsNeedingMatch.length === 0) {
			return json({ success: true, assignments: 0, message: 'All participants are already fully assigned' });
		}

		const matchingParticipantIDs = new Set(assignmentsNeedingMatch.map((a) => a.data.userID));

		// ── 4. Build existing roster map from already-assigned docs ────────────
		// existingRostersByRelID: relID -> set of userIDs already in that relationship
		const existingRostersByRelID = new Map<string, string[]>();
		for (const assignment of participantsWithAssignments) {
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
		for (const assignment of participantsWithAssignments) {
			if (matchingParticipantIDs.has(assignment.data.userID)) continue;
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

		// ── 6. Build and run the matcher (participants who still need assignments) ────────────────
		const matcher = new CapacitatedRankMaximalMatcher();

		const shuffledAssignmentsNeedingMatch = [...assignmentsNeedingMatch].sort(() => Math.random() - 0.5);
		const shuffledRelationships = [...relationships].sort(() => Math.random() - 0.5);

		// Add applicant nodes with per-user remaining capacity.
		for (const assignment of shuffledAssignmentsNeedingMatch) {
			const remainingCapacity = Math.max(0, relationshipsPerCharacter - assignedCount(assignment));
			if (remainingCapacity > 0) {
				matcher.addNode(assignment.data.userID, false, remainingCapacity);
			}
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

		// Add ranked edges from participants needing assignments (skip already-assigned relIDs).
		for (const assignment of shuffledAssignmentsNeedingMatch) {
			const userID = assignment.data.userID;
			const rankings: string[] = assignment.data.relationshipRankings ?? [];
			const existingRelIDs = new Set(
				(assignment.data.assignedRelationships ?? []).map((ar) => ar.relationshipID)
			);
			rankings.forEach((relID, index) => {
				if (addedPostIDs.has(relID) && !existingRelIDs.has(relID)) {
					matcher.addEdge(userID, relID, index + 1);
				}
			});
		}

		const maxRank = Math.max(
			...shuffledAssignmentsNeedingMatch.map((a) => a.data.relationshipRankings?.length ?? 0),
			1
		);

		const matching = matcher.solve(maxRank);
		// newRosters: Map<relID, newRoundUserIDs[]> — new-round additions only
		const newRosters = matcher.fillTuples(matching, tupleSizes, existingCandidates);

		// Matched new participants by relationship (excludes fill-only additions).
		const matchedNewByRelID = new Map<string, string[]>();
		for (const { applicant, post } of matching) {
			if (!matchedNewByRelID.has(post)) matchedNewByRelID.set(post, []);
			matchedNewByRelID.get(post)!.push(applicant);
		}

		// Fill-only additions by relationship (present in fillTuples output but not in matching output).
		const fillOnlyByRelID = new Map<string, string[]>();
		for (const [relID, roster] of newRosters) {
			const matched = new Set(matchedNewByRelID.get(relID) ?? []);
			fillOnlyByRelID.set(
				relID,
				roster.filter((uid) => !matched.has(uid))
			);
		}

		// ── 7. Write results to Firestore via batched writes ────────────────────
		const existingTuplesByRelID = new Map<string, string[][]>();
		const existingMembersByRelID = new Map<string, Set<string>>();
		const existingTupleByRelUser = new Map<string, Map<string, string[]>>();
		const existingTupleKeysByRelID = new Map<string, Set<string>>();
		for (const assignment of participantsWithAssignments) {
			for (const ar of assignment.data.assignedRelationships ?? []) {
				if (!existingTuplesByRelID.has(ar.relationshipID)) {
					existingTuplesByRelID.set(ar.relationshipID, []);
				}
				if (!existingMembersByRelID.has(ar.relationshipID)) {
					existingMembersByRelID.set(ar.relationshipID, new Set());
				}
				if (!existingTupleByRelUser.has(ar.relationshipID)) {
					existingTupleByRelUser.set(ar.relationshipID, new Map());
				}
				if (!existingTupleKeysByRelID.has(ar.relationshipID)) {
					existingTupleKeysByRelID.set(ar.relationshipID, new Set());
				}

				const byUser = existingTupleByRelUser.get(ar.relationshipID)!;
				const members = existingMembersByRelID.get(ar.relationshipID)!;
				const tupleKeys = existingTupleKeysByRelID.get(ar.relationshipID)!;
				const tuple = Array.isArray(ar.assignedUserIDs) && ar.assignedUserIDs.length > 0
					? ar.assignedUserIDs
					: [assignment.data.userID];
				const tuples = existingTuplesByRelID.get(ar.relationshipID)!;
				const tupleKey = [...tuple].sort().join('|');
				if (!tupleKeys.has(tupleKey)) {
					tuples.push(tuple);
					tupleKeys.add(tupleKey);
				}
				for (const uid of tuple) {
					members.add(uid);
					byUser.set(uid, tuple);
				}
			}
		}

		// Build deterministic final tuples per relationship:
		// 1) Keep existing complete tuples intact
		// 2) Repair existing incomplete tuples first
		// 3) Form new tuples from remaining matched users, then fill-only candidates
		const finalTuplesByRelID = new Map<string, string[][]>();
		for (const rel of relationships) {
			const relID = rel.id;
			const size = tupleSizes.get(relID) ?? 2;

			const existingTuples = existingTuplesByRelID.get(relID) ?? [];
			const existingMembers = new Set(existingMembersByRelID.get(relID) ?? []);

			const completeExisting = existingTuples.filter((t) => t.length >= size).map((t) => [...t]);
			const incompleteExisting = existingTuples.filter((t) => t.length < size).map((t) => [...t]);

			const matchedQueue = (matchedNewByRelID.get(relID) ?? []).filter((uid) => !existingMembers.has(uid));
			const matchedSet = new Set(matchedQueue);
			const fillQueue = (fillOnlyByRelID.get(relID) ?? []).filter(
				(uid) => !existingMembers.has(uid) && !matchedSet.has(uid)
			);

			const finalTuples: string[][] = [...completeExisting];

			for (const tuple of incompleteExisting) {
				while (tuple.length < size && matchedQueue.length > 0) tuple.push(matchedQueue.shift()!);
				while (tuple.length < size && fillQueue.length > 0) tuple.push(fillQueue.shift()!);
				finalTuples.push(tuple);
			}

			while (matchedQueue.length > 0) {
				const tuple: string[] = [];
				while (tuple.length < size && matchedQueue.length > 0) tuple.push(matchedQueue.shift()!);
				while (tuple.length < size && fillQueue.length > 0) tuple.push(fillQueue.shift()!);
				finalTuples.push(tuple);
			}

			finalTuplesByRelID.set(relID, finalTuples);
		}

		const finalTupleByRelUser = new Map<string, Map<string, string[]>>();
		const finalMembersByRelID = new Map<string, Set<string>>();
		for (const [relID, tuples] of finalTuplesByRelID) {
			if (!finalTupleByRelUser.has(relID)) finalTupleByRelUser.set(relID, new Map());
			if (!finalMembersByRelID.has(relID)) finalMembersByRelID.set(relID, new Set());
			const byUser = finalTupleByRelUser.get(relID)!;
			const members = finalMembersByRelID.get(relID)!;
			for (const tuple of tuples) {
				for (const uid of tuple) {
					members.add(uid);
					byUser.set(uid, tuple);
				}
			}
		}

		const getUserTuple = (relID: string, userID: string): string[] => {
			return finalTupleByRelUser.get(relID)?.get(userID) ?? [userID];
		};

		const effectiveNewRostersByRelID = new Map<string, string[]>();
		for (const rel of relationships) {
			const relID = rel.id;
			const existingMembers = existingMembersByRelID.get(relID) ?? new Set<string>();
			const finalMembers = finalMembersByRelID.get(relID) ?? new Set<string>();
			effectiveNewRostersByRelID.set(
				relID,
				[...finalMembers].filter((uid) => !existingMembers.has(uid))
			);
		}

		// Determine which relIDs gained new members this run
		const changedRelIDs = new Set<string>(
			[...effectiveNewRostersByRelID.entries()]
				.filter(([, users]) => users.length > 0)
				.map(([relID]) => relID)
		);

		// Build per-user assignment list for participants needing assignments.
		const newUserAssignments = new Map<string, string[]>();
		for (const [relID, userIDs] of effectiveNewRostersByRelID) {
			for (const userID of userIDs) {
				// Only track users this run was trying to (partially) assign.
				if (matchingParticipantIDs.has(userID)) {
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

		// Write docs for participants who were matched this run, preserving existing relationships.
		for (const assignment of assignmentsNeedingMatch) {
			const userID = assignment.data.userID;
			const assignedRelIDs = newUserAssignments.get(userID) ?? [];
			const existingRels = assignment.data.assignedRelationships ?? [];
			const updatedMap = new Map(existingRels.map((ar) => [ar.relationshipID, ar]));

			for (const relID of assignedRelIDs) {
				const prev = updatedMap.get(relID);
				updatedMap.set(relID, {
					relationshipID: relID,
					assignedUserIDs: getUserTuple(relID, userID),
					shared: prev?.shared ?? false
				});
			}

			for (const [relID, ar] of updatedMap) {
				if (changedRelIDs.has(relID)) {
					updatedMap.set(relID, { ...ar, assignedUserIDs: getUserTuple(relID, userID) });
				}
			}

			const assignedRelationships = [...updatedMap.values()];
			const key = relationshipAssignmentKey(relationshipSelectorID, userID);
			ops.push({ path: `games/${gameID}/relationshipAssignments/${key}`, data: { assignedRelationships } });
		}

		// Patch existing participants' docs for any relationship that gained new members
		for (const assignment of participantsWithAssignments) {
			if (matchingParticipantIDs.has(assignment.data.userID)) continue;
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
		// (they appear in newRosters but are not in this run's match target set)
		const newParticipantIDs = new Set(assignmentsNeedingMatch.map((a) => a.data.userID));
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
			const existingDoc = participantsWithAssignments.find((a) => a.data.userID === userID);
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

		return json({ success: true, assignments: assignmentsNeedingMatch.length });
	} catch (err: any) {
		console.error('assignRelationships error:', err);
		return json({ success: false, message: (err as Error).message ?? String(err) });
	}
};
