import { json, type RequestHandler } from '@sveltejs/kit';
import { store } from '$lib/firebase';

/**
 * GET /api/characters/names?gameID=...&userIDs[]=...&userIDs[]=...
 *
 * Returns the character name for each requested userID in the given game.
 * Any authenticated user may call this endpoint; it returns only character
 * names (no other character data), so it is safe for players to use.
 *
 * Response: { names: Record<userID, string> }
 *   - If a user has no character, their entry is omitted.
 *   - If a character has no name set, returns "Unnamed Character".
 */
export const GET: RequestHandler = async (event) => {
	if (!event.locals.decodedToken) {
		return json({ success: false, message: 'Not authenticated' }, { status: 401 });
	}

	const { searchParams } = event.url;
	const gameID = searchParams.get('gameID') ?? '';
	const userIDs = searchParams.getAll('userIDs[]');

	if (!gameID) {
		return json({ success: false, message: 'Missing gameID' }, { status: 400 });
	}
	if (userIDs.length === 0) {
		return json({ names: {} });
	}

	try {
		const results = await Promise.all(
			userIDs.map(async (userID) => {
				const charDoc = await store.doc(`games/${gameID}/characters/${userID}`).get();
				if (!charDoc.exists) return [userID, null] as const;
				const data = charDoc.data() as { name?: string } | undefined;
				return [userID, data?.name || 'Unnamed Character'] as const;
			})
		);

		const names: Record<string, string> = {};
		for (const [userID, name] of results) {
			if (name !== null) names[userID] = name;
		}

		return json({ names });
	} catch (err) {
		console.error('characters/names error:', err);
		return json({ success: false, message: (err as Error).message ?? String(err) }, { status: 500 });
	}
};
