import type { Docs } from '$lib/database';

export interface ExportData {
	assets: Docs.Asset[];
	assetTypes: Docs.AssetType[];
	decisionTree: Docs.Decision[];
}

export type Exporter = (data: ExportData) => { worksheet: any; label: string }[];
