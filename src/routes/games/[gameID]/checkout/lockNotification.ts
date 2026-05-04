import type { LockLimited, LockPrereqs, LockResult } from '../../../api/checkout/secureLock/+server';

const isLimited = (body: LockResult): body is LockLimited =>
	(body as LockLimited)?.limited === true;

const isPrereq = (body: LockResult): body is LockPrereqs =>
	(body as LockPrereqs)?.missingRequiredFlags != null;

/**
 * Returns a user-facing notification message for a failed lock result,
 * or `null` if the lock succeeded (body === true).
 */
export function getLockNotificationText(body: LockResult, assetName: string): string | null {
	if (body === true) {
		return null;
	}
	const suffix = assetName ? `: ${assetName}` : '';
	if (isLimited(body)) {
		return `This item is no longer available${suffix}.`;
	} else if (isPrereq(body)) {
		return `You do not have the required flags to purchase this item${suffix}.`;
	} else {
		return `Unable to purchase this item${suffix}.`;
	}
}
