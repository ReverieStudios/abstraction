import { json, type RequestHandler } from '@sveltejs/kit';
import { store } from '$lib/firebase';
import { database, setGameID } from '$lib/database';
import type { Docs } from '$lib/database/types';
import { relationshipAssignmentKey } from '../_common';
import { relationship } from 'lib/characters/RelationshipRow.svelte';

export interface RelationshipRankings {
    relationshipSelectorID: string;
    rankedRelationshipIDs: string[];
}

export type GetRankingsResult = RelationshipRankings | boolean;

export const GET: RequestHandler = async (event) => {
    const relationshipSelectorID: string = event.url.searchParams.get('relationshipSelectorID') || '';
    const gameID: string = event.url.searchParams.get('gameID') || '';
    if (!event.locals.decodedToken || !relationshipSelectorID || !gameID) {
        // missing params or not logged in
        return json({ success: false });
    }

    const { uid } = event.locals.decodedToken;
    try {
        setGameID(gameID);
        const result: GetRankingsResult = await store
        .runTransaction<GetRankingsResult>(async (transaction) => {
            const assignmentKey = relationshipAssignmentKey(relationshipSelectorID, uid);
            const relationshipAssignment: Docs.RelationshipAssignment = await database.relationshipAssignments?.doc(assignmentKey)?.read(transaction);
            if (!relationshipAssignment.exists) {
                return { relationshipSelectorID: relationshipSelectorID, rankedRelationshipIDs: [] };
            } else {
                return { relationshipSelectorID: relationshipSelectorID, rankedRelationshipIDs: relationshipAssignment.data?.relationshipRankings ?? [] };
            }
        }).catch((ex) => {
            console.error(ex);
            return { success: false, message: `An error occurred while fetching rankings: ${ex.message || ex}` };
        });
        
        return json(result);
    } catch (error) {
        console.error(error);
        return json({ success: false });
    }
};