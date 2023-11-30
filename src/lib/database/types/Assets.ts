import type { Docs } from '.';

export interface Asset {
	name: string;
	summary: string;
	image?: string;
	type: string;
	subtype?: string;
	enforceName?: string;
	fields: Asset.AssetFields;
}
export namespace Asset {
	export interface AssetFields {
		[field: string]: string;
	}
}

export const getFields = (asset: Docs.Asset, type: Docs.AssetType, summaryLabel = true) => {
	if (!asset || !type) {
		return [];
	}

	const summary = asset.data.summary
		? [
				{
					label: summaryLabel ? 'Summary' : '',
					text: asset.data.summary,
					type: 'markdown',
					showAfterChosen: !!type.data.showDescriptionAfterPurchase
				}
		  ]
		: [];

	const extra = (type.data?.fields ?? [])
		.map((field) => ({
			label: field.title,
			text: asset.data?.fields?.[field.title],
			type: field.type,
			showAfterChosen: field.showAfterPurchase
		}))
		.filter((f) => f.text);

	return [...summary, ...extra];
};
