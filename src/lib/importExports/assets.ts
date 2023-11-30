import { utils } from 'xlsx';
import { groupBy } from 'lodash-es';
import { setColumnWidths } from './helpers';
import type { Exporter } from './types';

export const isSheet = (name: string) => name.startsWith('Assets: ');

export const exportToSheet: Exporter = ({ assets, assetTypes }) => {
	const assetsByType = groupBy(assets, 'type');

	return assetTypes.map((type) => {
		const typeAssets = assetsByType[type.id];

		const worksheet = utils.aoa_to_sheet([]);
		const fieldNames = ['Name', 'Summary', ...(type.data.fields || []).map((f) => f.title)];
		const fieldTypes = ['', '', ...(type.data.fields || []).map((f) => f.type)];

		const typeRows = [['Type:', type.id, type.data.name]];
		const assetRows = [
			['ID', ...(fieldNames || [])],
			['', ...(fieldTypes || [])],
			...(typeAssets || []).map((asset) => {
				return [asset.id, ...(fieldNames || []).map((key) => asset.data.fields[key])];
			})
		];
		const allRows = [...typeRows, ...assetRows];

		utils.sheet_add_aoa(worksheet, typeRows, { origin: 'A1' });
		utils.sheet_add_aoa(worksheet, assetRows, { origin: `A2` });

		setColumnWidths(allRows, worksheet);

		return { worksheet, label: `Assets: ${type.data.name}`.substring(0, 31) };
	});
};

export const importFromSheet = ({ assets, assetTypes }, rows) => {
	const [[, typeId, typeName], header, fieldTypes, ...data] = rows;
	console.log({ typeId, typeName, header, fieldTypes, data });
};
