import { isStartNode } from '$lib/database/types/Decision';
import { utils } from 'xlsx';
import { setColumnWidths } from './helpers';
import type { Exporter } from './types';

const sheetName = 'Decision Tree';

export const isSheet = (name: string) => name === sheetName;

export const exportToSheet: Exporter = ({ decisionTree }) => {
	// const rows = decisionTree.map((node) => ({
	// 	id: node.id,
	// 	name: node.data.name,
	// 	childType: node.data.childType,
	// 	children: node.data.children
	// }));

	// const worksheet = XLSX.utils.json_to_sheet(rows);

	// setColumnWidths(rows, worksheet);

	// return [{ worksheet, label: sheetName }];
	return [];
};

export const importFromSheet = ({ decisionTree }, sheetData, sheetName) => {};
