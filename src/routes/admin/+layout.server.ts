import { redirect } from '@sveltejs/kit';
import { database } from '$lib/database';
import { anyAdminRoles } from '$lib/permissions';

/** @type {import('./$types').LayoutServerLoad} */
export async function load({ locals }) {
    if (!locals?.user?.uid) {
        redirect(302, '/home');
    }
    const user = await database.users.doc(locals.user.uid)?.read();
    if (!anyAdminRoles(user?.data?.roles)) {
        redirect(302, '/home');
    }
    return {};
};