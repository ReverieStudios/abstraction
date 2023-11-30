export class AssetIsLimitedError extends Error {}
export class AssetFailsRequirementsError extends Error {
	public missingRequiredFlags: string[];
	public extraLimitedFlags: string[];
	constructor(missingRequiredFlags: string[], extraLimitedFlags: string[]) {
		super('User is ineligible');
		this.missingRequiredFlags = missingRequiredFlags;
		this.extraLimitedFlags = extraLimitedFlags;
	}
}
