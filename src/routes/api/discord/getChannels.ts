import { isEditor } from '$lib/permissions';
import type { RequestHandler } from '@sveltejs/kit';
import { getChannels } from '$lib/api/discord';

interface Payload {
	serverID: string;
	gameID: string;
}

export const post: RequestHandler = async (event) => {
	const payload: Payload = await event.request.json();

	const { gameID, serverID } = payload;

	const user = event.locals.user;
	// only run if a game editor triggered this
	if (user?.roles && isEditor(user.roles, gameID)) {
		return {
			body: await getChannels(serverID)
		};
	}

	return {
		body: {}
	};
};
