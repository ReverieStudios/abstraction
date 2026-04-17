/**
 * Tests for POST /api/character/delete
 *
 * Covers:
 *   - auth / permission guards
 *   - _releaseLocks failure aborts delete
 *   - happy path: character doc is removed
 *   - relationship assignment cleanup via _deleteRelationshipAssignments:
 *       - user's own assignment doc is deleted
 *       - uid is stripped from peer docs' assignedUserIDs
 *       - docs with no reference to uid are untouched
 *       - multiple selectors are all cleaned up
 *       - user with no assignment docs: no errors
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST, _deleteRelationshipAssignments } from '../+server';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDoc<T>(id: string, data: T, exists = true) {
  return {
    id,
    data,
    exists,
    remove: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined)
  };
}

function makeEvent(body: object, overrides: { decodedToken?: unknown; user?: unknown } = {}) {
  return {
    request: { json: vi.fn(async () => body) },
    locals: {
      decodedToken: 'decodedToken' in overrides ? overrides.decodedToken : { uid: 'user-abc' },
      user: overrides.user ?? { roles: { system: 4 } }
    }
  } as any;
}

// ── Fixture data ──────────────────────────────────────────────────────────────

const GAME_ID = 'game-1';
const UID = 'user-abc';
const SELECTOR_ID = 'sel-1';

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Captured doc mock refs, replaced per-test
let mockCharacterDoc: ReturnType<typeof makeDoc>;
let ownAssignmentDocs: ReturnType<typeof makeDoc>[];
let peerAssignmentDocs: ReturnType<typeof makeDoc>[];
// Mock for the doc() call used in cleanup writes
let mockAssignmentDocForId: (id: string) => { remove: ReturnType<typeof vi.fn>; update: ReturnType<typeof vi.fn> };

vi.mock('$lib/firebase', () => ({
  store: {
    runTransaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb('__tx__')),
    doc: vi.fn((path: string) => ({ path })),
    writeBatch: vi.fn(() => ({
      set: vi.fn(),
      commit: vi.fn(async () => {})
    }))
  }
}));

vi.mock('$lib/permissions', () => ({
  isEditor: vi.fn().mockReturnValue(true)
}));

vi.mock('../../../checkout/releaseLocks/+server', () => ({
  _releaseLocks: vi.fn().mockResolvedValue(true)
}));

vi.mock('$lib/database', () => {
  const setGameID = vi.fn();

  // Each withQueries().read() call is intercepted; we use the query field value
  // to distinguish "userID == uid" from "relationshipSelectorID == X"
  const database = {
    characters: {
      doc: vi.fn(() => mockCharacterDoc)
    },
    relationshipAssignments: {
      withQueries: vi.fn((query: { field: string; op: string; value: string }) => ({
        read: vi.fn(async () => {
          if (query.field === 'userID') return ownAssignmentDocs;
          if (query.field === 'relationshipSelectorID') return peerAssignmentDocs;
          return [];
        })
      })),
      doc: vi.fn((id: string) => mockAssignmentDocForId(id))
    }
  };

  return { database, setGameID };
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/character/delete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCharacterDoc = makeDoc(UID, { user: UID, assets: [], name: 'Test', purchased: true });
    ownAssignmentDocs = [];
    peerAssignmentDocs = [];
    mockAssignmentDocForId = (id) => makeDoc(id, {});
  });

  // ── Auth / param guards ───────────────────────────────────────────────────

  it('returns { success: false } when not authenticated', async () => {
    const res = await POST(makeEvent({ gameID: GAME_ID }, { decodedToken: null }));
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('returns { success: false } when gameID is missing', async () => {
    const res = await POST(makeEvent({}));
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('returns { success: false } when a non-editor tries to delete another user', async () => {
    const { isEditor } = await import('$lib/permissions');
    vi.mocked(isEditor).mockReturnValueOnce(false);
    const res = await POST(makeEvent({ gameID: GAME_ID, userID: 'other-user' }));
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it('returns { success: false } when _releaseLocks fails', async () => {
    const { _releaseLocks } = await import('../../../checkout/releaseLocks/+server');
    vi.mocked(_releaseLocks).mockResolvedValueOnce(false);
    const res = await POST(makeEvent({ gameID: GAME_ID }));
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  // ── Happy path ─────────────────────────────────────────────────────────────

  it('returns { success: true } and removes the character doc', async () => {
    const res = await POST(makeEvent({ gameID: GAME_ID }));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockCharacterDoc.remove).toHaveBeenCalledOnce();
  });

  it('uses the provided userID (admin deleting another user)', async () => {
    const { database } = await import('$lib/database');
    await POST(makeEvent({ gameID: GAME_ID, userID: 'other-user' }));
    expect(vi.mocked(database.characters!.doc)).toHaveBeenCalledWith('other-user');
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe('_deleteRelationshipAssignments', () => {
  // Per-test doc factories so remove/update spies are fresh
  let ownDoc: ReturnType<typeof makeDoc>;
  let peerDocWithRef: ReturnType<typeof makeDoc>;
  let peerDocWithoutRef: ReturnType<typeof makeDoc>;
  let docByIdMap: Map<string, ReturnType<typeof makeDoc>>;

  beforeEach(async () => {
    vi.clearAllMocks();

    // User's own assignment doc
    ownDoc = makeDoc(`${SELECTOR_ID}-${UID}`, {
      userID: UID,
      relationshipSelectorID: SELECTOR_ID,
      relationshipRankings: ['rel-1', 'rel-2'],
      assignedRelationships: [{ relationshipID: 'rel-1', assignedUserIDs: [UID, 'user-xyz'] }]
    });

    // Peer doc that has UID in assignedUserIDs
    peerDocWithRef = makeDoc(`${SELECTOR_ID}-user-xyz`, {
      userID: 'user-xyz',
      relationshipSelectorID: SELECTOR_ID,
      relationshipRankings: ['rel-1', 'rel-2'],
      assignedRelationships: [{ relationshipID: 'rel-1', assignedUserIDs: [UID, 'user-xyz'] }]
    });

    // Peer doc that does NOT reference UID
    peerDocWithoutRef = makeDoc(`${SELECTOR_ID}-user-zzz`, {
      userID: 'user-zzz',
      relationshipSelectorID: SELECTOR_ID,
      relationshipRankings: ['rel-2', 'rel-1'],
      assignedRelationships: [{ relationshipID: 'rel-2', assignedUserIDs: ['user-zzz', 'user-qrs'] }]
    });

    ownAssignmentDocs = [ownDoc];
    // Selector query returns all three docs (the helper filters them)
    peerAssignmentDocs = [ownDoc, peerDocWithRef, peerDocWithoutRef];

    // Map doc IDs to fresh spy objects used in doc() calls
    docByIdMap = new Map([
      [ownDoc.id, makeDoc(ownDoc.id, {})],
      [peerDocWithRef.id, makeDoc(peerDocWithRef.id, {})],
      [peerDocWithoutRef.id, makeDoc(peerDocWithoutRef.id, {})]
    ]);
    mockAssignmentDocForId = (id) => docByIdMap.get(id) ?? makeDoc(id, {});

    const { database } = await import('$lib/database');
    vi.mocked(database.relationshipAssignments!.doc).mockImplementation(
      (id: string) => mockAssignmentDocForId(id) as any
    );
  });

  it("deletes the user's own assignment doc", async () => {
    await _deleteRelationshipAssignments(UID);
    const ownRef = docByIdMap.get(ownDoc.id)!;
    expect(ownRef.remove).toHaveBeenCalledOnce();
  });

  it('strips the uid from assignedUserIDs in peer docs that reference it', async () => {
    await _deleteRelationshipAssignments(UID);
    const peerRef = docByIdMap.get(peerDocWithRef.id)!;
    expect(peerRef.update).toHaveBeenCalledOnce();
    const [updateArg] = peerRef.update.mock.calls[0];
    // uid should be gone; user-xyz should remain
    expect(updateArg.assignedRelationships[0].assignedUserIDs).not.toContain(UID);
    expect(updateArg.assignedRelationships[0].assignedUserIDs).toContain('user-xyz');
  });

  it('does not touch peer docs that do not reference the uid', async () => {
    await _deleteRelationshipAssignments(UID);
    const unrelatedRef = docByIdMap.get(peerDocWithoutRef.id)!;
    expect(unrelatedRef.update).not.toHaveBeenCalled();
    expect(unrelatedRef.remove).not.toHaveBeenCalled();
  });

  it('handles a user with no assignment docs without throwing', async () => {
    ownAssignmentDocs = [];
    await expect(_deleteRelationshipAssignments(UID)).resolves.toBeUndefined();
  });

  it('handles multiple selectors, cleaning up each one', async () => {
    const SELECTOR_2 = 'sel-2';
    const ownDoc2 = makeDoc(`${SELECTOR_2}-${UID}`, {
      userID: UID,
      relationshipSelectorID: SELECTOR_2,
      relationshipRankings: ['rel-3'],
      assignedRelationships: []
    });
    ownAssignmentDocs = [ownDoc, ownDoc2];

    // withQueries mock: return docs based on field queried
    const { database } = await import('$lib/database');
    vi.mocked(database.relationshipAssignments!.withQueries).mockImplementation(
      (query: { field: string; op: string; value: string }) => ({
        read: vi.fn(async () => {
          if (query.field === 'userID') return [ownDoc, ownDoc2];
          // For each selector, return just the own doc (no peers with refs)
          return [query.value === SELECTOR_ID ? ownDoc : ownDoc2];
        })
      }) as any
    );

    docByIdMap.set(ownDoc2.id, makeDoc(ownDoc2.id, {}));
    vi.mocked(database.relationshipAssignments!.doc).mockImplementation(
      (id: string) => docByIdMap.get(id) as any ?? makeDoc(id, {})
    );

    await _deleteRelationshipAssignments(UID);

    expect(docByIdMap.get(ownDoc.id)!.remove).toHaveBeenCalledOnce();
    expect(docByIdMap.get(ownDoc2.id)!.remove).toHaveBeenCalledOnce();
  });
});
