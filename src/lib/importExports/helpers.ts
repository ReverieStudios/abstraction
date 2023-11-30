import { utils, writeFile as xlsxWrite, type WorkSheet } from 'xlsx';

export const setColumnWidths = (rows: string[][], worksheet: Object) => {
	const maxWidths = rows.reduce((acc, row) => {
		for (let i = 0; i < row.length; i++) {
			acc[i] = Math.max((row[i] || '').length, acc[i] || 0, 10);
		}
		return acc;
	}, [] as number[]);
	worksheet['!cols'] = maxWidths.map((wch) => ({ wch }));
};

export const formatDate = (date: number) => new Date(date).toISOString();

interface Worksheet {
	worksheet: WorkSheet;
	label: string;
}

export const makeFile = (fileName: string, sheets: Worksheet[]) => {
	const workbook = utils.book_new();
	sheets.forEach(({ worksheet, label }) => {
		utils.book_append_sheet(workbook, worksheet, label);
	});
	xlsxWrite(workbook, `${fileName}.xlsx`);
};
