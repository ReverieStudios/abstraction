import { User } from './database/types/User';

export const anyAdminRoles = (roles: User.Roles) => {
	if (roles) {
		if ((roles.system ?? 0) >= User.AccountType.Editor) {
			return true;
		}
		for (let type of Object.values(roles.games ?? {})) {
			if ((type ?? 0) >= User.AccountType.Editor) {
				return true;
			}
		}
	}
	return false;
};

const isRole = (roles: User.Roles, roleToCheck: User.AccountType, gameID?: string) => {
	const gameRole = (gameID && roles?.games?.[gameID]) || User.AccountType.None;
	const systemRole = roles?.system || User.AccountType.None;

	return [systemRole, gameRole].some((role) => role >= roleToCheck);
};

export const isOwner = (roles: User.Roles, gameID?: string) => {
	return isRole(roles, User.AccountType.Owner, gameID);
};
export const isEditor = (roles: User.Roles, gameID?: string) => {
	return isRole(roles, User.AccountType.Editor, gameID);
};
export const isPlayer = (roles: User.Roles, gameID?: string) => {
	return isRole(roles, User.AccountType.Player, gameID);
};
export const isReader = (roles: User.Roles, gameID?: string) => {
	return isRole(roles, User.AccountType.Reader, gameID);
};

export const getHighestRole = (roles: User.Roles): User.AccountType =>{
    if (!roles) return User.AccountType.None;
    const system = roles.system ?? User.AccountType.None;
    const gameRoles = Object.values(roles.games ?? {});
    const allRoles = [system, ...gameRoles];
    return Math.max(...allRoles);
}

export const roleToClaim = (role: User.AccountType): string | null => {
	switch (role) {
		case User.AccountType.Owner: return 'owner';
		case User.AccountType.Editor: return 'editor';
		case User.AccountType.Player: return 'player';
		case User.AccountType.Reader: return 'reader';
		default: return null;
	}
};