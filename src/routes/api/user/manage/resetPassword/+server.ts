import { json, type RequestHandler } from '@sveltejs/kit';
import { auth } from '$lib/firebase';
import { randomBytes } from 'crypto';
import { isEditor } from '$lib/permissions';

export const POST: RequestHandler = async (event) => {
	const payload = await event.request.json();
	const userID: string = payload.userID || '';
	if (!event.locals.decodedToken || !userID) {
		// missing params or not logged in
		return json({ success: false });
	}

	const isUser = userID === event.locals.decodedToken.uid;
	const isSiteEditor = isEditor(event.locals.user.roles);

	if (!(isUser || isSiteEditor)) {
		return json({ success: false });
	}

	try {
		const user = await auth.getUser(userID);

		if (user.providerData.some((provider) => provider.providerId !== 'password')) {
			return json({ success: false });
		}

        const newPassword = randomBytes(24).toString('base64url');

		await auth.updateUser(userID, {
			password: newPassword
		});

		return json({ success: true, newPassword });
	} catch (err: any) {
		return json({ success: false, ex: (err as Error).stack });
	}
};
