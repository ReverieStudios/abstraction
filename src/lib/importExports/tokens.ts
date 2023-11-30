import { utils } from 'xlsx';
import { formatDate, setColumnWidths } from './helpers';
import type { Docs, KeyMaps } from '$lib/database/types';
import { keyBy } from 'lodash-es';
import { isUnlimited } from '$lib/database/types/Token';

const formatUsedBy = (users: KeyMaps.User, usedBy: Docs.Token['data']['usedBy']) => {
	if (!usedBy) {
		return '';
	}
	if (typeof usedBy === 'string') {
		return users[usedBy]?.data?.name ?? 'Unknown';
	}
	return Object.keys(usedBy)
		.map((user) => users[user] ?? 'Unknown')
		.join(', ');
};

const tokenType = (token: Docs.Token) => {
	const data = token.data;
	if (isUnlimited(data)) {
		return 'Unlimited Use';
	}
	return 'Single Use';
};

export const exportToSheet = (
	tokens: Docs.Token[],
	users: Docs.User[],
	descriptions: Map<string, string>
) => {
	const usersById = keyBy(users, 'id');
	const worksheet = utils.aoa_to_sheet([]);

	const rows = [
		['Token', 'Created By', 'Created On', 'Used By', 'Description', 'Type'],
		...(tokens || []).map((token) => [
			token.id,
			usersById[token.data.createdBy]?.data?.name ?? 'Unknown',
			formatDate(token.data.createdOn),
			formatUsedBy(usersById, token.data.usedBy),
			descriptions.get(token.id) ?? '',
			tokenType(token)
		])
	];

	utils.sheet_add_aoa(worksheet, rows, { origin: `A1` });

	setColumnWidths(rows, worksheet);

	return { worksheet, label: `Tokens` };
};
