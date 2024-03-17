import { json, type RequestHandler } from '@sveltejs/kit';
import { loadUserData } from 'lib/token';

export const POST: RequestHandler = async ({request, cookies}) => {
	const payload = await request.json();
	const token: string = payload.token || ''; 
	let { userToken, userData } = await loadUserData(token);
	cookies.set('token', token, {path: '/', httpOnly: true, sameSite: 'lax'});
	cookies.set('user', userToken, {path: '/', httpOnly: true, sameSite: 'lax'});

	return json({user: userData});

};
