import type { RequestHandler } from '@sveltejs/kit';
import { auth, generateID } from '$lib/firebase';
import { isEditor } from '$lib/permissions';

export const post: RequestHandler = async (event) => {
	const payload = await event.request.json();
	const userID: string = payload.userID || '';
	if (!event.locals.decodedToken || !userID) {
		// missing params or not logged in
		return { body: { success: false } };
	}

	const isUser = userID === event.locals.decodedToken.uid;
	const isSiteEditor = isEditor(event.locals.user.roles);

	if (!(isUser || isSiteEditor)) {
		return { body: { success: false } };
	}

	try {
		const user = await auth.getUser(userID);

		if (user.providerData.some((provider) => provider.providerId !== 'password')) {
			return { body: { success: false } };
		}

		const newPassword = generateID();

		await auth.updateUser(userID, {
			password: newPassword
		});

		return {
			body: { success: true, newPassword }
		};
	} catch (err: any) {
		return { body: { success: false, ex: (err as Error).stack } };
	}
};
