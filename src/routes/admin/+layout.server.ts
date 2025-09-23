import { redirect } from '@sveltejs/kit';
import { database } from '$lib/database';
import { anyAdminRoles, getHighestRole, roleToClaim } from '$lib/permissions';
import admin from 'firebase-admin';
import { auth } from '$lib/firebase';

/** @type {import('./$types').LayoutServerLoad} */
export async function load({ locals }) {
    if (!locals?.user?.uid) {
        redirect(302, '/home');
    }
    const user = await database.users.doc(locals.user.uid)?.read();
    if (!anyAdminRoles(user?.data?.roles)) {
        redirect(302, '/home');
    }

    // Check if user is Owner
    if (anyAdminRoles(user?.data?.roles)) {
        // Get current custom claims
        const highestRole = roleToClaim(getHighestRole(user?.data?.roles));
        const userRecord = await admin.auth().getUser(locals.user.uid);
        if (userRecord.customClaims?.role !== highestRole) {
            // Set the custom claim
            await admin.auth().setCustomUserClaims(locals.user.uid, {
                ...userRecord.customClaims,
                role: highestRole,
            });
            // Force token refresh on client
            if (auth.currentUser) {
                await auth.currentUser.getIdToken(true);
                window.location.reload();
            }
        }
    }

    return {};
};