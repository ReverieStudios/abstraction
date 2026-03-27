interface AssignedRelationship {
    assignedUserIDs: string[];
    relationshipID: string;
}

export interface RelationshipAssignment {
    userID: string;
    relationshipSelectorID: string;
    relationshipRankings: string[];

    assignedRelationships: AssignedRelationship[];
}