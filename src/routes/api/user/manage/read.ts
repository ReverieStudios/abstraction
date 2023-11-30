import type { RequestHandler } from '@sveltejs/kit';
import { auth } from '$lib/firebase';
import { isEditor } from '$lib/permissions';

export const post: RequestHandler = async (event) => {
	const payload = await event.request.json();
	const userID: string = payload.userID || '';
	if (!event.locals.decodedToken || !userID) {
		// missing params or not logged in
		return { body: { success: false } };
	}
	if (!isEditor(event.locals.user.roles)) {
		return { body: { success: false } };
	}

	try {
		const user = await auth.getUser(userID);

		return {
			body: { success: true, user }
		};
	} catch (err: any) {
		return { body: { success: false, ex: (err as Error).stack } };
	}
};
