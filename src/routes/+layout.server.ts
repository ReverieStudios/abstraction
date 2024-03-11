import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: LayoutServerLoad = ({ url, locals }) => {
    const { decodedToken, user } = locals;
	console.log("+layout.server.ts load called", { decodedToken, user});
	if (url.pathname === '/') {
		console.log("pathway is /");
		if (user) {
			console.log("redirecting to /home");
			redirect(302, '/home');
		}
	} else if (!user) {
		console.log("redirecting to /");
		redirect(302, '/');
	}
	return { user: user, decodedToken: decodedToken };
};