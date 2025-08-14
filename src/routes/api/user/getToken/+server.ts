import type { Token } from '$lib/database/types/Token';
import { isOwner } from '$lib/permissions';
import { json, type RequestHandler } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';

interface SimpleToken {
	roles: Token['roles'];
	flags: Token['flags'];
}

const encodeToken = (token: SimpleToken): string | null => {
	if (!token) {
		return null;
	}
	const privateKey = import.meta.env.VITE_JWT_KEY as string;
    return jwt.sign(token, privateKey, { algorithm: 'HS256' });
};

export const POST: RequestHandler = async (event) => {
	const payload = await event.request.json();

	const token: SimpleToken = payload?.token ?? {};

	const user = event.locals.user;
	// TODO allow game owners to generate game-only tokens
	if (user?.roles && isOwner(user.roles)) {
		const encoded = encodeToken(token);
		return json(encoded);
	}

	return json({});
};
