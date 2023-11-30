import { isEditor } from '$lib/permissions';
import type { RequestHandler } from '@sveltejs/kit';
import { getChannels, getMessages } from '$lib/api/discord';

interface Payload {
	channelID: string;
	gameID: string;
}

export const post: RequestHandler = async (event) => {
	const payload: Payload = await event.request.json();

	const { gameID, channelID } = payload;

	const user = event.locals.user;
	// only run if a game editor triggered this
	if (user?.roles && isEditor(user.roles, gameID)) {
		return {
			body: await getMessages(channelID)
		};
	}

	return {
		body: {}
	};
};
