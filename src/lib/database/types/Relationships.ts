import type { Docs } from '.';

export interface Relationship {
	label: string;
	summary?: string;
	details?: string;
	type: string; // relationship type id
	image?: string;
	fields: Relationship.RelationshipFields;
	size?: number; // tuple size (default 2)
	capacity?: number | 'unlimited';
}

export namespace Relationship {
	export interface RelationshipFields {
		[field: string]: string;
	}
}

export const getFields = (relationship: Docs.Relationship, type: Docs.RelationshipType, summaryLabel = true) => {
	if (!relationship || !type) {
		return [];
	}

	const summary = relationship.data.summary
		? [
			{
				label: summaryLabel ? 'Summary' : '',
				text: relationship.data.summary,
				type: 'markdown',
				showAfterChosen: !!type.data.showDescriptionAfterCreation
			}
		  ]
		: [];

	const extra = (type.data?.fields ?? [])
		.map((field) => ({
			label: field.title,
			text: relationship.data?.fields?.[field.title],
			type: field.type,
			showAfterChosen: field.showAfterCreation
		}))
		.filter((f) => f.text);

	return [...summary, ...extra];
};
