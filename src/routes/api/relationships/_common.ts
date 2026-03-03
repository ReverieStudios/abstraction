import type { Docs, Updaters } from '$lib/database/types';

export const relationshipAssignmentKey = (relationshipSelectorID: string, userID: string): string => {
    return `${relationshipSelectorID}-${userID}`;
}
