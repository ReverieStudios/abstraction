export interface Lock {
	requirements: string[];
	limitations: string[];
	claimLimit: number;
	claims: Lock.Claim[];
	claimsQueue: string[];
}
export namespace Lock {
	export interface Claim {
		purchaser: string;
	}
	export namespace Claim {
		export interface InCart extends Claim {
			unlocksAt: number;
		}

		export interface Purchased extends Claim {}
	}
	export enum Status {
		None,
		PlayerQueued,
		PlayerClaimed,
		PlayerCanClaim,
		PlayerCanQueue,
		Unavailable
	}
}

export const isPurchased = (node: Lock.Claim): node is Lock.Claim.Purchased => {
	return (node as Lock.Claim.InCart).unlocksAt == null;
};
export const isInCart = (node: Lock.Claim): node is Lock.Claim.InCart => {
	return (node as Lock.Claim.InCart).unlocksAt != null;
};
