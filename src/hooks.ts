import type { GetSession, Handle, RequestEvent } from '@sveltejs/kit';
import type { User } from '$lib/database/types/User';

import jwt from 'jsonwebtoken';
import cookie from 'cookie';
import { auth } from '$lib/firebase';

const decodeUserToken = (userToken: string): User => {
	if (!userToken || userToken === 'null') {
		return null;
	}
	try {
		const privateKey = import.meta.env.VITE_JWT_KEY as string;
		return jwt.verify(userToken, privateKey) as User;
	} catch (ex) {
		return null;
	}
};

export const getSession: GetSession = (event: RequestEvent) => {
	const decodedToken = event.locals?.decodedToken;
	const user = event.locals?.user;
	return { user, decodedToken };
};

export const handle: Handle = async ({ event, resolve }) => {
	const cookieHeaders = event.request.headers.get('cookie') || '';
	const cookies = cookie.parse(cookieHeaders);
	const decodedToken = await auth.decodeToken(cookies.token);
	const user = decodeUserToken(cookies.user);
	// TODO validate that user.uid === decodedToken.uid

	event.locals = { decodedToken, user };

	return resolve(event);
};
