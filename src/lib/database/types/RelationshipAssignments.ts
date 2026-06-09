interface AssignedRelationship {
    assignedUserIDs: string[];
    relationshipID: string;
    shared: boolean;
}

export interface RelationshipAssignment {
    userID: string;
    relationshipSelectorID: string;
    relationshipRankings: string[];

    assignedRelationships: AssignedRelationship[];
}