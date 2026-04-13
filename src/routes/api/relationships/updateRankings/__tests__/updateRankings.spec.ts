/**
 * Tests for POST /api/relationships/updateRankings
 *
 * Strategy: mock $lib/firebase (store.runTransaction), $lib/database
 * (database + setGameID), then call the POST handler directly.
 *
 * Key contract:
 *   - auth guard: missing decodedToken → { success: false }
 *   - missing params guard: missing gameID or selectorID → { success: false }
 *   - selector not found → { message: "..." }
 *   - already assigned → { message: "..." }
 *   - rankings mismatch (unknown ID) → { message: "..." }
 *   - rankings mismatch (wrong length) → { message: "..." }
 *   - happy path: returns true AND writes userID + relationshipSelectorID + relationshipRankings
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../+server';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDoc<T>(id: string, data: T, exists = true) {
  return { id, data, exists, update: vi.fn().mockResolvedValue(undefined) };
}

function makeEvent(body: object, overrides: { decodedToken?: unknown } = {}) {
  return {
    request: { json: vi.fn(async () => body) },
    locals: {
      decodedToken: 'decodedToken' in overrides ? overrides.decodedToken : { uid: 'user-123' }
    }
  } as any;
}

// ── Fixture data ──────────────────────────────────────────────────────────────

const GAME_ID = 'game-test';
const SELECTOR_ID = 'selector-1';
const USER_ID = 'user-123';
const RELATIONSHIP_IDS = ['rel-a', 'rel-b', 'rel-c'];
const VALID_RANKINGS = ['rel-b', 'rel-a', 'rel-c']; // valid permutation

const selectorDoc = makeDoc(SELECTOR_ID, {
  name: 'Test Selector',
  relationshipIDs: RELATIONSHIP_IDS,
  relationshipsPerCharacter: 1
});

const selectorNotFound = { ...selectorDoc, exists: false };

// ── Mocks ─────────────────────────────────────────────────────────────────────

// The actual update mock — replaced per-test so we can spy on args
let mockUpdate: ReturnType<typeof vi.fn>;
// The assignment doc returned inside the transaction
let assignmentDocData: { assignedRelationships?: unknown } | null;

vi.mock('$lib/firebase', () => {
  return {
    store: {
      // Simulate runTransaction by immediately executing the callback with a
      // fake transaction handle.  The callback's awaited reads/writes all go
      // through the database mock below.
      runTransaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => {
        return cb('__tx__');
      })
    }
  };
});

vi.mock('$lib/database', () => {
  const setGameID = vi.fn();

  const database = {
    relationshipSelectors: {
      doc: vi.fn(() => ({
        read: vi.fn(async () => selectorDoc)
      }))
    },
    relationshipAssignments: {
      doc: vi.fn(() => ({
        read: vi.fn(async () => ({
          data: assignmentDocData,
          exists: assignmentDocData !== null
        })),
        update: vi.fn(async (...args: unknown[]) => mockUpdate(...args))
      }))
    }
  };

  return { database, setGameID };
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/relationships/updateRankings', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    mockUpdate = vi.fn().mockResolvedValue(undefined);
    // Default: assignment doc exists but has no assignments yet
    assignmentDocData = { assignedRelationships: null };

    // Reset selector to default (found, normal)
    const { database } = await import('$lib/database');
    vi.mocked(database.relationshipSelectors!.doc).mockReturnValue({
      read: vi.fn(async () => selectorDoc)
    } as any);
  });

  // ── Auth / param guards ────────────────────────────────────────────────────

  it('returns { success: false } when not authenticated', async () => {
    const res = await POST(makeEvent(
      { gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID, rankedIDs: VALID_RANKINGS },
      { decodedToken: null }
    ));
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('returns { success: false } when gameID is missing', async () => {
    const res = await POST(makeEvent({
      relationshipSelectorID: SELECTOR_ID,
      rankedIDs: VALID_RANKINGS
    }));
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('returns { success: false } when relationshipSelectorID is missing', async () => {
    const res = await POST(makeEvent({ gameID: GAME_ID, rankedIDs: VALID_RANKINGS }));
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  // ── Transaction error paths ────────────────────────────────────────────────

  it('returns a message when the selector does not exist', async () => {
    const { database } = await import('$lib/database');
    vi.mocked(database.relationshipSelectors!.doc).mockReturnValue({
      read: vi.fn(async () => selectorNotFound)
    } as any);

    const res = await POST(makeEvent({
      gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID, rankedIDs: VALID_RANKINGS
    }));
    const body = await res.json();
    expect(body.message).toMatch(/not found/i);
  });

  it('returns a message when relationships have already been assigned', async () => {
    assignmentDocData = {
      assignedRelationships: [{ relationshipID: 'rel-a', assignedUserIDs: [USER_ID] }]
    };

    const res = await POST(makeEvent({
      gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID, rankedIDs: VALID_RANKINGS
    }));
    const body = await res.json();
    expect(body.message).toMatch(/already been assigned/i);
  });

  it('returns a message when rankings contain an unknown relationship ID', async () => {
    const res = await POST(makeEvent({
      gameID: GAME_ID,
      relationshipSelectorID: SELECTOR_ID,
      rankedIDs: ['rel-a', 'rel-b', 'UNKNOWN']   // UNKNOWN is not in the selector
    }));
    const body = await res.json();
    expect(body.message).toMatch(/do not match/i);
  });

  it('returns a message when rankings length does not match the selector', async () => {
    const res = await POST(makeEvent({
      gameID: GAME_ID,
      relationshipSelectorID: SELECTOR_ID,
      rankedIDs: ['rel-a', 'rel-b']               // missing rel-c
    }));
    const body = await res.json();
    expect(body.message).toMatch(/do not match/i);
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('returns true on a valid submission', async () => {
    const res = await POST(makeEvent({
      gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID, rankedIDs: VALID_RANKINGS
    }));
    const body = await res.json();
    expect(body).toBe(true);
  });

  it('writes relationshipRankings, userID, and relationshipSelectorID together', async () => {
    await POST(makeEvent({
      gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID, rankedIDs: VALID_RANKINGS
    }));

    expect(mockUpdate).toHaveBeenCalledOnce();
    const [writtenData] = mockUpdate.mock.calls[0];
    expect(writtenData).toMatchObject({
      relationshipRankings: VALID_RANKINGS,
      userID: USER_ID,
      relationshipSelectorID: SELECTOR_ID
    });
  });

  it('does not write when the selector is not found', async () => {
    const { database } = await import('$lib/database');
    vi.mocked(database.relationshipSelectors!.doc).mockReturnValue({
      read: vi.fn(async () => selectorNotFound)
    } as any);

    await POST(makeEvent({
      gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID, rankedIDs: VALID_RANKINGS
    }));
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('does not write when relationships are already assigned', async () => {
    assignmentDocData = {
      assignedRelationships: [{ relationshipID: 'rel-a', assignedUserIDs: [USER_ID] }]
    };

    await POST(makeEvent({
      gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID, rankedIDs: VALID_RANKINGS
    }));
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it('passes the transaction handle through to update()', async () => {
    await POST(makeEvent({
      gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID, rankedIDs: VALID_RANKINGS
    }));

    expect(mockUpdate).toHaveBeenCalledOnce();
    // Second argument to update() should be the transaction token
    const [, txArg] = mockUpdate.mock.calls[0];
    expect(txArg).toBe('__tx__');
  });
});
