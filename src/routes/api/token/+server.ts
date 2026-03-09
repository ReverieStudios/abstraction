import { json, type RequestHandler } from '@sveltejs/kit';
import { loadUserData } from 'lib/token';

export const POST: RequestHandler = async ({ request, cookies, url }) => {
    const origin = request.headers.get('origin');
    if (!origin || origin !== url.origin) {
        return json({ unauthorized: true }, { status: 403 });
    }
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
        return json({ badRequest: true }, { status: 400 });
    }

    const payload = await request.json();
    const token: string = payload.token || '';
    const cookieBase = { path: '/', httpOnly: true, sameSite: 'lax' as const, secure: true };

    // If client posts an empty token explicitly, clear any server cookies.
    if (!token) {
        cookies.set('token', '', { ...cookieBase, maxAge: 0 });
        cookies.set('user', '', { ...cookieBase, sameSite: 'strict', maxAge: 0 });
        return json({ user: null });
    }

    const { userToken, userData } = await loadUserData(token);

    // Only persist valid, verifiable tokens. If token verification failed,
    // clear any auth cookies on the server and return an error so the client
    // can react (sign out / prompt for re-login).
    if (!userToken) {
        cookies.set('token', '', { ...cookieBase, maxAge: 0 });
        cookies.set('user', '', { ...cookieBase, sameSite: 'strict', maxAge: 0 });
        return json({ error: 'invalid_token' }, { status: 401 });
    }

    cookies.set('token', token, cookieBase);
    cookies.set('user', userToken, { ...cookieBase, sameSite: 'strict' });

    return json({ user: userData });
};
