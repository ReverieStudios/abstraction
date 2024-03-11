import type { LayoutServerLoad } from './$types';
import { redirect } from '@sveltejs/kit';

export const load: LayoutServerLoad = ({ url, locals }) => {
    const { decodedToken, user } = locals;
	if (url.pathname === '/') {
		if (user) {
			redirect(302, '/home');
		}
	} else if (!user) {
		redirect(302, '/');
	}
	return { user: user, decodedToken: decodedToken };
};