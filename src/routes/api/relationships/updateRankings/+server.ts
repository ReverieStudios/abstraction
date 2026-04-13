import { json, type RequestHandler } from '@sveltejs/kit';
import { store } from '$lib/firebase';
import { database, setGameID } from '$lib/database';
import type { Docs } from '$lib/database/types';
import { relationshipAssignmentKey } from '../_common';

export interface UpdateRankingsError {
    message: string;
}

export type UpdateRankingsResult = boolean | UpdateRankingsError;

export const POST: RequestHandler = async (event) => {
    const payload = await event.request.json();
    const relationshipSelectorID: string = payload.relationshipSelectorID || '';
    const gameID: string = payload.gameID || '';
    const rankings: string[] = payload.rankedIDs || [];
    console.log("Received update rankings request with payload", payload);
    if (!event.locals.decodedToken || !relationshipSelectorID || !gameID) {
        // missing params or not logged in
        return json({ success: false });
    }
    
    const { uid } = event.locals.decodedToken;
    try {
        setGameID(gameID);

        const result: UpdateRankingsResult = await store
            .runTransaction<UpdateRankingsResult>(async (transaction) => {
                const assignmentKey = relationshipAssignmentKey(relationshipSelectorID, uid);
                const relationshipAssignment: Docs.RelationshipAssignment = await database.relationshipAssignments?.doc(assignmentKey)?.read(transaction);
                const relationshipSelector = await database.relationshipSelectors?.doc(relationshipSelectorID)?.read(transaction);
                if (!relationshipSelector.exists) {
                    return { message: "Relationship selector not found" };
                }

                if (relationshipAssignment?.data?.assignedRelationships) {
                    return { message: "Relationships have already been assigned" };
                }
                console.log("Relationship selector data is", relationshipSelector.data?.relationshipIDs, "and rankings are", rankings);
                if (!rankings.every( id => relationshipSelector.data?.relationshipIDs.includes(id)) 
                || rankings.length !== relationshipSelector.data?.relationshipIDs.length) {
                    return { message: "Rankings do not match relationship selector" };
                }

                await database.relationshipAssignments?.doc(assignmentKey)?.update(
                    { relationshipRankings: rankings, userID: uid, relationshipSelectorID }, transaction
                );
                
                return true;
            }).catch((ex) => {
                console.error(ex);
                return { message: `An error occurred while updating rankings: ${ex.message || ex}` };
            });

        return json(result);
    } catch (err: any) {
        return json({ success: false, ex: (err as Error).stack });
    }
};