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

    const { userToken, userData } = await loadUserData(token);

    const cookieBase = { path: '/', httpOnly: true, sameSite: 'lax' as const, secure: true };
    cookies.set('token', token, cookieBase);
    cookies.set('user', userToken, { ...cookieBase, sameSite: 'strict' });

    return json({ user: userData });
};
