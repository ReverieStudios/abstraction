import { describe, it, expect, vi, beforeEach } from 'vitest';
import { validatePasswordChange, submitPasswordChange } from './changePassword';
import type { PasswordChangeAuth } from './changePassword';

describe('validatePasswordChange', () => {
	it('returns no errors for valid input', () => {
		const errors = validatePasswordChange({
			currentPassword: 'hunter2',
			newPassword: 'newPass1',
			confirmPassword: 'newPass1'
		});
		expect(errors).toEqual({});
	});

	it('requires currentPassword', () => {
		const errors = validatePasswordChange({
			currentPassword: '',
			newPassword: 'newPass1',
			confirmPassword: 'newPass1'
		});
		expect(errors.currentPassword).toBeTruthy();
	});

	it('requires newPassword', () => {
		const errors = validatePasswordChange({
			currentPassword: 'hunter2',
			newPassword: '',
			confirmPassword: ''
		});
		expect(errors.newPassword).toBeTruthy();
	});

	it('requires newPassword to be at least 8 characters', () => {
		const errors = validatePasswordChange({
			currentPassword: 'hunter2',
			newPassword: 'abc',
			confirmPassword: 'abc'
		});
		expect(errors.newPassword).toBeTruthy();
	});

	it('accepts a password that is exactly 8 characters', () => {
		const errors = validatePasswordChange({
			currentPassword: 'hunter2',
			newPassword: 'abcdefgh',
			confirmPassword: 'abcdefgh'
		});
		expect(errors.newPassword).toBeUndefined();
	});

	it('requires confirmPassword to match newPassword', () => {
		const errors = validatePasswordChange({
			currentPassword: 'hunter2',
			newPassword: 'newPass1',
			confirmPassword: 'different'
		});
		expect(errors.confirmPassword).toBeTruthy();
	});

	it('does not report confirmPassword mismatch when newPassword is empty', () => {
		const errors = validatePasswordChange({
			currentPassword: 'hunter2',
			newPassword: '',
			confirmPassword: 'something'
		});
		expect(errors.confirmPassword).toBeUndefined();
	});

	it('returns multiple errors at once', () => {
		const errors = validatePasswordChange({
			currentPassword: '',
			newPassword: '',
			confirmPassword: ''
		});
		expect(Object.keys(errors).length).toBeGreaterThanOrEqual(2);
	});
});

describe('submitPasswordChange', () => {
	let mockAuth: PasswordChangeAuth;

	beforeEach(() => {
		mockAuth = { changePassword: vi.fn().mockResolvedValue(undefined) };
	});

	it('calls auth.changePassword with the correct passwords', async () => {
		await submitPasswordChange(mockAuth, {
			currentPassword: 'hunter2',
			newPassword: 'newPass1',
			confirmPassword: 'newPass1'
		});
		expect(mockAuth.changePassword).toHaveBeenCalledOnce();
		expect(mockAuth.changePassword).toHaveBeenCalledWith('hunter2', 'newPass1');
	});

	it('propagates errors thrown by auth.changePassword', async () => {
		const error = new Error('auth/wrong-password');
		(mockAuth.changePassword as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

		await expect(
			submitPasswordChange(mockAuth, {
				currentPassword: 'wrongPassword',
				newPassword: 'newPass1',
				confirmPassword: 'newPass1'
			})
		).rejects.toThrow('auth/wrong-password');
	});

	it('does not swallow a successful resolution', async () => {
		const result = await submitPasswordChange(mockAuth, {
			currentPassword: 'hunter2',
			newPassword: 'newPass1',
			confirmPassword: 'newPass1'
		});
		expect(result).toBeUndefined(); // Promise<void>
	});
});
