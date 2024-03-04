import type { RequestHandler } from '@sveltejs/kit';
import { auth } from '$lib/firebase';
import cookie from 'cookie';
import { database } from '$lib/database';

export const POST: RequestHandler = async (event) => {
	const cookies = cookie.parse(event.request.headers.get('cookie') || '');
	try {
		const token = await auth.decodeToken(cookies.token);
		const user = await database.users.doc(token.uid).read();
		return { body: JSON.stringify({ token, user: user.data }) };
	} catch (ex) {
		return { body: `ERR: ${ex}` };
	}
};
