import { json, type RequestHandler } from '@sveltejs/kit';
import admin from 'firebase-admin';
import { isOwner } from '$lib/permissions';

export const POST: RequestHandler = async ({ locals, request }) => {
    // 1. Check that the requesting user is an owner
    const callerRoles = locals.user?.roles;
    if (!callerRoles || !isOwner(callerRoles)) {
        return json({ success: false, error: 'Not authorized' }, { status: 403 });
    }

    // 2. Parse the payload
    const { uid: targetUid, role } = await request.json();
    console.log('Granting role', role, 'to user', targetUid);
    if (!targetUid) {
        return json({ success: false, error: 'Missing target user UID' }, { status: 400 });
    }

    try {
        // 3. Get current custom claims
        const userRecord = await admin.auth().getUser(targetUid);
        const claims = { ...userRecord.customClaims };

        // 4. Set or remove the custom claim
        if (role) {
            claims.role = role;
        } else {
            delete claims.role;
        }
        await admin.auth().setCustomUserClaims(targetUid, claims);

        return json({ success: true });
    } catch (err: unknown) {
        return json({ success: false, error: err instanceof Error ? err.message : String(err) },
        { status: 500 });
    }
};