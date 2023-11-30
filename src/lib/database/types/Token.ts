import type { User } from '$lib/database/types/User';

export type Token = Token.SingleUseToken | Token.UnlimitedToken;

export namespace Token {
	interface Token {
		roles?: User.Roles;
		flags?: Record<string, string[]>;
		createdOn: number;
		createdBy: string;
	}

	export interface SingleUseToken extends Token {
		type: Token.GenerationType.SingleUse;
		usedBy?: User['uid'];
	}
	export interface UnlimitedToken extends Token {
		type: Token.GenerationType.Unlimited;
		usedBy: Record<User['uid'], number>;
	}
	export enum GenerationType {
		Unlimited,
		SingleUse
	}
}

export const isSingleUse = (node: Token): node is Token.SingleUseToken =>
	node.type === Token.GenerationType.SingleUse;
export const isUnlimited = (node: Token): node is Token.UnlimitedToken =>
	node.type === Token.GenerationType.Unlimited;
