import { database } from '$lib/database';
import { auth } from '$lib/firebase';
import { json, type RequestHandler } from '@sveltejs/kit';
import cookie from 'cookie';
import jwt from 'jsonwebtoken';

const loadUserData = async (token: string): Promise<{ userToken: string; userData: Object }> => {
	const decoded = await auth.decodeToken(token);
	if (decoded && decoded.uid) {
		const { uid, email, name = email } = decoded;
		const user = await database.users.doc(decoded.uid)?.read();
		let userData = null;
		if (!user.exists) {
			userData = { name, email, roles: { system: 0, games: {} }, flags: {} };
			await user.save(userData);
		} else {
			userData = user.data;
		}

		userData.uid = uid;

		const privateKey = (import.meta.env.VITE_JWT_KEY ??
			'471207445716c8fbc32d3ad0c39aab60a762bdb7') as string; // ensure some basic key to avoid error
		return {
			userToken: jwt.sign(userData, privateKey),
			userData
		};
	}
	return { userToken: '', userData: {} };
};

export const POST: RequestHandler = async ({request, cookies}) => {
	const payload = await request.json();
	const token: string = payload.token || ''; 
	let { userToken, userData } = await loadUserData(token);
	cookies.set('token', token, {path: '/', httpOnly: true, sameSite: 'lax'});
	cookies.set('user', userToken, {path: '/', httpOnly: true, sameSite: 'lax'});

	return json({user: userData});

};
