import { json, type RequestHandler } from '@sveltejs/kit';
import { auth } from '$lib/firebase';
import { isEditor } from '$lib/permissions';

export const POST: RequestHandler = async (event) => {
	const payload = await event.request.json();
	const userID: string = payload.userID || '';
	if (!event.locals.decodedToken || !userID) {
		// missing params or not logged in
		return json({ success: false });
	}
	if (!isEditor(event.locals.user.roles)) {
		return json({ success: false });
	}

	try {
		const user = await auth.getUser(userID);

		return json({ success: true, user });
	} catch (err: any) {
		return json({ success: false, ex: (err as Error).stack });
	}
};
