import { number } from 'yup';

export interface User {
	uid?: string;
	name: string;
	email: string;
	discordID: string;
	roles: User.Roles;
	flags: {
		[gameID: string]: string[];
	};
	forms: {
		[formID: string]: number;
	};
}
export namespace User {
	export enum AccountType {
		None,
		Reader,
		Player,
		Editor,
		Owner
	}

	export interface Roles {
		system?: AccountType;
		games?: {
			[gameID: string]: AccountType;
		};
	}
}

export const getAccountType = (type: User.AccountType) => {
	if (type >= User.AccountType.Owner) {
		return 'Owner';
	}
	switch (type) {
		case User.AccountType.Reader:
			return 'Reader';
		case User.AccountType.Player:
			return 'Player';
		case User.AccountType.Editor:
			return 'Editor';
		default:
			return 'None';
	}
};
