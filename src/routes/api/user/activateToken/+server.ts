import { database } from '$lib/database';
import { getAccountType } from '$lib/database/types/User';
import { isSingleUse, isUnlimited, Token } from '$lib/database/types/Token';
import type { User } from '$lib/database/types/User';
import { json, type RequestHandler } from '@sveltejs/kit';
import jwt from 'jsonwebtoken';
import { get, setWith } from 'lodash-es';
import { store } from '$lib/firebase';
import { loadUserData } from '$lib/token';

const decodeToken = (token: string): Token | null => {
	if (!token) {
		return null;
	}
	try {
        const privateKey = import.meta.env.VITE_JWT_KEY as string;
        return jwt.verify(token, privateKey, { algorithms: ['HS256'] }) as Token;
	} catch (ex) {
		return null;
	}
};

const getUnusedDbToken = async (tokenID: string, userID: string): Promise<Token> => {
	const token = await database.tokens.doc(tokenID)?.read();
	if (!token.exists) {
		throw new Error('Token does not exist');
	}
	if (isSingleUse(token.data)) {
		if (token.data.usedBy) {
			throw new Error('Token fully claimed');
		}
		await token.update({ usedBy: userID });
	} else if (isUnlimited(token.data)) {
		if (token.data.usedBy[userID]) {
			throw new Error('Token already claimed by user');
		}
		await token.update({ usedBy: { [userID]: Date.now() } });
	} else {
		throw new Error('Unknown token type');
	}
	return token.data;
};

const loadToken = (tokenID: string, userID: string): Promise<Token | null> => {
	if (tokenID.length === 20) {
		return getUnusedDbToken(tokenID, userID);
	}
	return Promise.resolve(decodeToken(tokenID));
};

export const POST: RequestHandler = async (event) => {
	const payload = await event.request.json();
	const token = payload?.token ?? '';
	const { uid } = event.locals.decodedToken;
	if (!uid) {
		return json({ unauthorized: true }, { status: 401 });
	}

	const decoded: Token | null = await loadToken(token, uid).catch((ex) => null);
	if (!decoded) {
		return json({ noclaims: true });
	}
	if (!decoded?.flags && !decoded?.roles) {
		return json({ noclaims: true, decoded });
	}

	const user = await database.users.doc(uid)?.read();
	const updatedRoles: User.Roles = user.data.roles ?? {};
	const updatedFlags: Record<string, string[]> = user.data.flags ?? {};

	const setIfUpgrade = (key: string, newValue: number) => {
		if (newValue != null) {
			const current = get(updatedRoles, key, 0);
			if (current < newValue) {
				setWith(updatedRoles, key, newValue, Object);
				return json(true);
			}
		}
		return json(false);
	};

	const updates = [];
	if (decoded.roles) {
		if (setIfUpgrade('system', decoded.roles.system)) {
			updates.push(`System role changed to ${getAccountType(decoded.roles.system)}`);
		}
		if (decoded.roles.games) {
			Object.entries(decoded.roles.games).forEach(([gameID, value]) => {
				if (setIfUpgrade(`games.${gameID}`, value)) {
					updates.push(`${gameID} role changed to ${getAccountType(value)}`);
				}
			});
		}
	}
	if (decoded.flags) {
		const flagDocs = await Promise.all(
			Object.keys(decoded.flags).map((gameID) =>
				store
					.getDoc(store.doc(`games/${gameID}/data/flags`))
					.then((flagDoc) => [gameID, flagDoc.data()])
			)
		);
		const flagsByGame = Object.fromEntries(flagDocs);

		Object.entries(decoded.flags).forEach(([gameID, flags]) => {
			const current = updatedFlags[gameID] ?? [];
			flags.forEach((flag) => {
				if (!current.includes(flag) && flagsByGame?.[gameID]?.[flag]) {
					current.push(flag);
					updates.push(`Flag enabled for ${gameID}: ${flagsByGame?.[gameID]?.[flag]?.name}`);
				}
			});
			updatedFlags[gameID] = current;
		});
	}

	if (updates.length > 0) {
		await user.update({ roles: updatedRoles, flags: updatedFlags });
	}

    const authToken = event.cookies.get('token') ?? '';

    let { userToken } = await loadUserData(authToken);
    event.cookies.set('user', userToken, { path: '/', httpOnly: true, sameSite: 'lax', secure: true });

	return json(
		{
			updates,
			user: {
				uid: user.id,
				...user.data
			}
		}
	);
};
