import { describe, it, expect } from 'vitest';
import { getLockNotificationText } from '../lockNotification';
import type { LockLimited, LockPrereqs } from '../../../../api/checkout/secureLock/+server';

describe('getLockNotificationText', () => {
	it('returns null when the lock succeeded', () => {
		expect(getLockNotificationText(true, 'Sword of Truth')).toBeNull();
	});

	it('returns a limited message with the asset name', () => {
		const body: LockLimited = { limited: true };
		expect(getLockNotificationText(body, 'Sword of Truth')).toBe(
			'This item is no longer available: Sword of Truth.'
		);
	});

	it('returns a prereq message with the asset name', () => {
		const body: LockPrereqs = { missingRequiredFlags: ['knight'], extraLimitedFlags: [] };
		expect(getLockNotificationText(body, 'Shiny Armour')).toBe(
			'You do not have the required flags to purchase this item: Shiny Armour.'
		);
	});

	it('returns a generic failure message with the asset name', () => {
		expect(getLockNotificationText(false, 'Elixir')).toBe('Unable to purchase this item: Elixir.');
	});

	it('omits the asset name suffix when asset name is empty', () => {
		expect(getLockNotificationText(false, '')).toBe('Unable to purchase this item.');
	});

	it('omits the asset name suffix for limited when name is empty', () => {
		const body: LockLimited = { limited: true };
		expect(getLockNotificationText(body, '')).toBe('This item is no longer available.');
	});

	it('omits the asset name suffix for prereq when name is empty', () => {
		const body: LockPrereqs = { missingRequiredFlags: ['knight'], extraLimitedFlags: [] };
		expect(getLockNotificationText(body, '')).toBe(
			'You do not have the required flags to purchase this item.'
		);
	});
});
