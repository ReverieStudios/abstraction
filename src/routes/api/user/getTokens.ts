import { database } from '$lib/database';
import { Token } from '$lib/database/types/Token';
import { isOwner } from '$lib/permissions';
import type { RequestHandler } from '@sveltejs/kit';

interface Payload {
	numTokens: number;
	token: Token;
}

const saveUnlimitedToken = (token: Token.UnlimitedToken) => database.tokens.addDoc(token);
const saveSingleUseToken = (token: Token.SingleUseToken) => database.tokens.addDoc(token);

export const post: RequestHandler = async (event) => {
	const payload = (await event.request.json()) as Payload;

	const user = event.locals.user;
	// TODO allow game owners to generate game-only tokens
	if (user?.roles && isOwner(user.roles)) {
		const { numTokens, token } = payload;
		if (token.createdBy !== user.uid) {
			return { body: { weird: true, token, user } };
		}
		let encoded: string[] = [];
		if (token.type === Token.GenerationType.Unlimited) {
			encoded = await Promise.all([
				saveUnlimitedToken({ ...token, type: Token.GenerationType.Unlimited, usedBy: {} })
			]);
		} else if (token.type === Token.GenerationType.SingleUse) {
			encoded = await Promise.all(
				Array.from({ length: payload.numTokens }, () =>
					saveSingleUseToken({ ...token, type: Token.GenerationType.SingleUse })
				)
			);
		}

		return {
			body: { encoded }
		};
	}

	return {
		body: {
			weirder: true
		}
	};
};
