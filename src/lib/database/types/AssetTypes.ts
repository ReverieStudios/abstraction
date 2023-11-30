enum AssetTypeFieldType {
	Plain = 'plain',
	Rich = 'markdown',
	CharacterName = 'character_name'
}

interface AssetTypeField {
	title: string;
	type: AssetTypeFieldType;
	showAfterPurchase: boolean;
}

export interface AssetType {
	name: string;
	description: string;
	showDescriptionAfterPurchase: boolean;
	hideOnCharacterSheet: boolean;
	parentTypeID?: string;
	fields: AssetTypeField[];
}
