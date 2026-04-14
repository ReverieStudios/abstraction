/**
 * Tests for GET /api/characters/names
 *
 * Contract:
 *   - no auth → 401
 *   - missing gameID → 400
 *   - empty userIDs → { names: {} }
 *   - user with character → name returned
 *   - user with unnamed character (empty name) → "Unnamed Character"
 *   - user with no character doc → omitted from result
 *   - multiple users → all resolved in parallel
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../+server';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEvent(params: {
	gameID?: string;
	userIDs?: string[];
	decodedToken?: unknown;
}) {
	const { gameID, userIDs = [], decodedToken = { uid: 'requester-uid' } } = params;
	const searchParams = new URLSearchParams();
	if (gameID) searchParams.set('gameID', gameID);
	for (const id of userIDs) searchParams.append('userIDs[]', id);

	return {
		url: { searchParams },
		locals: { decodedToken }
	} as any;
}

// ── Mock store ────────────────────────────────────────────────────────────────

type CharacterData = { name?: string } | undefined;

// Map of `games/${gameID}/characters/${userID}` → data (undefined = not found)
let charDocs: Map<string, CharacterData>;

vi.mock('$lib/firebase', () => ({
	store: {
		doc: vi.fn((path: string) => ({
			get: vi.fn(async () => {
				const data = charDocs.get(path);
				return { exists: data !== undefined, data: () => data };
			})
		}))
	}
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/characters/names', () => {
	beforeEach(() => {
		charDocs = new Map();
	});

	it('returns 401 when not authenticated', async () => {
		const res = await GET(makeEvent({ gameID: 'game-1', userIDs: ['u1'], decodedToken: null }));
		expect(res.status).toBe(401);
		const body = await res.json();
		expect(body.success).toBe(false);
	});

	it('returns 400 when gameID is missing', async () => {
		const res = await GET(makeEvent({ userIDs: ['u1'] }));
		expect(res.status).toBe(400);
		const body = await res.json();
		expect(body.success).toBe(false);
	});

	it('returns empty names when no userIDs provided', async () => {
		const res = await GET(makeEvent({ gameID: 'game-1', userIDs: [] }));
		const body = await res.json();
		expect(body.names).toEqual({});
	});

	it('returns the character name for a user', async () => {
		charDocs.set('games/game-1/characters/user-a', { name: 'Aria Stormwind' });
		const res = await GET(makeEvent({ gameID: 'game-1', userIDs: ['user-a'] }));
		const body = await res.json();
		expect(body.names).toEqual({ 'user-a': 'Aria Stormwind' });
	});

	it('returns "Unnamed Character" when name field is empty string', async () => {
		charDocs.set('games/game-1/characters/user-b', { name: '' });
		const res = await GET(makeEvent({ gameID: 'game-1', userIDs: ['user-b'] }));
		const body = await res.json();
		expect(body.names['user-b']).toBe('Unnamed Character');
	});

	it('returns "Unnamed Character" when name field is absent', async () => {
		charDocs.set('games/game-1/characters/user-c', {});
		const res = await GET(makeEvent({ gameID: 'game-1', userIDs: ['user-c'] }));
		const body = await res.json();
		expect(body.names['user-c']).toBe('Unnamed Character');
	});

	it('omits users who have no character doc', async () => {
		charDocs.set('games/game-1/characters/user-a', { name: 'Aria' });
		// user-b has no doc
		const res = await GET(makeEvent({ gameID: 'game-1', userIDs: ['user-a', 'user-b'] }));
		const body = await res.json();
		expect(body.names).toEqual({ 'user-a': 'Aria' });
		expect('user-b' in body.names).toBe(false);
	});

	it('resolves multiple users correctly', async () => {
		charDocs.set('games/g/characters/u1', { name: 'Alpha' });
		charDocs.set('games/g/characters/u2', { name: 'Beta' });
		charDocs.set('games/g/characters/u3', { name: '' }); // unnamed
		// u4 has no doc — omitted
		const res = await GET(makeEvent({ gameID: 'g', userIDs: ['u1', 'u2', 'u3', 'u4'] }));
		const body = await res.json();
		expect(body.names).toEqual({
			u1: 'Alpha',
			u2: 'Beta',
			u3: 'Unnamed Character'
		});
		expect('u4' in body.names).toBe(false);
	});
});
