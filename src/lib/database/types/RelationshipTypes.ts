enum RelationshipTypeFieldType {
	Plain = 'plain',
	Rich = 'markdown',
}

interface RelationshipTypeField {
	title: string;
	type: RelationshipTypeFieldType;
	showAfterCreation: boolean;
}

export interface RelationshipType {
	name: string;
	description: string;
	showDescriptionAfterCreation: boolean;
	hideOnCharacterSheet?: boolean;
	parentTypeID?: string;
	fields: RelationshipTypeField[];
    size?: number; 
    capacity?: number | 'unlimited'; 
}
