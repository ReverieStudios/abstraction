import { isEditor } from '$lib/permissions';
import  { json, type RequestHandler } from '@sveltejs/kit';
import { postMessage } from '$lib/api/discord';

interface Payload {
	channelID: string;
	message: string;
	gameID: string;
}

export const POST: RequestHandler = async (event) => {
	const payload: Payload = await event.request.json();

	const { gameID, channelID, message } = payload;

	const user = event.locals.user;
	// only run if a game editor triggered this
	if (user?.roles && isEditor(user.roles, gameID)) {
		return json(await postMessage(channelID, message));
	}

	return json({});
};
