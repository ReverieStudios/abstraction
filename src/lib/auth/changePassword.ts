export interface PasswordChangeValues {
	currentPassword: string;
	newPassword: string;
	confirmPassword: string;
}

export interface PasswordChangeAuth {
	changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
}

export function validatePasswordChange(values: PasswordChangeValues): Record<string, string> {
	const errors: Record<string, string> = {};

	if (!values.currentPassword) {
		errors.currentPassword = 'Current password is required';
	}
	if (!values.newPassword) {
		errors.newPassword = 'New password is required';
	} else if (values.newPassword.length < 8) {
			errors.newPassword = 'Password must be at least 8 characters';
	}
	if (values.newPassword && values.newPassword !== values.confirmPassword) {
		errors.confirmPassword = 'Passwords do not match';
	}

	return errors;
}

export async function submitPasswordChange(
	auth: PasswordChangeAuth,
	values: PasswordChangeValues
): Promise<void> {
	await auth.changePassword(values.currentPassword, values.newPassword);
}
