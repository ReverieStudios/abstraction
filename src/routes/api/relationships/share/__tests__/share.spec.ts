/**
 * Tests for POST /api/relationships/share
 *
 * Strategy: mock $lib/database and $lib/permissions, then call the POST
 * handler directly.
 *
 * Contract under test:
 *   - auth / permission guards return early with descriptive errors
 *   - missing `shared` value returns an error
 *   - selector-level share (no relationshipID): all AssignedRelationship entries updated
 *   - relationship-level share (with relationshipID): only matching entries updated
 *   - un-share: shared: false propagates correctly
 *   - already-matching entries are skipped (update() not called unnecessarily)
 *   - returns updated: 0 when nothing has assignedRelationships
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../+server';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeAssignedRelationship(
  relationshipID: string,
  shared: boolean,
  assignedUserIDs: string[] = ['u1', 'u2']
) {
  return { relationshipID, assignedUserIDs, shared };
}

function makeDoc<T>(id: string, data: T, exists = true) {
  return { id, data, exists, update: vi.fn().mockResolvedValue(undefined) };
}

// ── Fixture data ──────────────────────────────────────────────────────────────

const GAME_ID = 'game-share-test';
const SELECTOR_ID = 'selector-share';

// 3 docs with assignments, 2 without
function makeAssignmentDocs() {
  return [
    makeDoc(`${SELECTOR_ID}-user-1`, {
      userID: 'user-1',
      relationshipSelectorID: SELECTOR_ID,
      relationshipRankings: ['rel-a', 'rel-b'],
      assignedRelationships: [
        makeAssignedRelationship('rel-a', false),
        makeAssignedRelationship('rel-b', false)
      ]
    }),
    makeDoc(`${SELECTOR_ID}-user-2`, {
      userID: 'user-2',
      relationshipSelectorID: SELECTOR_ID,
      relationshipRankings: ['rel-b', 'rel-a'],
      assignedRelationships: [
        makeAssignedRelationship('rel-a', false),
        makeAssignedRelationship('rel-b', false)
      ]
    }),
    makeDoc(`${SELECTOR_ID}-user-3`, {
      userID: 'user-3',
      relationshipSelectorID: SELECTOR_ID,
      relationshipRankings: ['rel-a'],
      assignedRelationships: [
        makeAssignedRelationship('rel-a', false)
      ]
    }),
    // No assigned relationships — should not be touched
    makeDoc(`${SELECTOR_ID}-user-4`, {
      userID: 'user-4',
      relationshipSelectorID: SELECTOR_ID,
      relationshipRankings: ['rel-a', 'rel-b'],
      assignedRelationships: []
    }),
    // Already shared for rel-a — used in skip test
    makeDoc(`${SELECTOR_ID}-user-5`, {
      userID: 'user-5',
      relationshipSelectorID: SELECTOR_ID,
      relationshipRankings: ['rel-a'],
      assignedRelationships: [
        makeAssignedRelationship('rel-a', true)
      ]
    })
  ];
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

let assignmentDocs: ReturnType<typeof makeDoc>[];

vi.mock('$lib/permissions', () => ({
  isEditor: vi.fn().mockReturnValue(true)
}));

vi.mock('$lib/database', () => {
  const setGameID = vi.fn();
  const database = {
    relationshipAssignments: {
      withQueries: vi.fn(() => ({
        read: vi.fn(async () => assignmentDocs)
      })),
      doc: vi.fn((id: string) => assignmentDocs.find((d) => d.id === id) ?? {
        update: vi.fn().mockResolvedValue(undefined)
      })
    }
  };
  return { database, setGameID };
});

// ── Fake RequestEvent factory ─────────────────────────────────────────────────

function makeEvent(body: object, overrides: { decodedToken?: unknown; user?: unknown } = {}) {
  return {
    request: { json: vi.fn(async () => body) },
    locals: {
      decodedToken: 'decodedToken' in overrides ? overrides.decodedToken : { uid: 'admin-uid' },
      user: overrides.user ?? { roles: { system: 4 } }
    }
  } as any;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/relationships/share', () => {
  beforeEach(async () => {
    assignmentDocs = makeAssignmentDocs();
    vi.clearAllMocks();
    vi.mocked((await import('$lib/permissions')).isEditor).mockReturnValue(true);
  });

  // ── Auth / permission guards ────────────────────────────────────────────────

  it('returns error when not authenticated', async () => {
    const res = await POST(makeEvent(
      { gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID, shared: true },
      { decodedToken: null }
    ));
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/not authenticated/i);
  });

  it('returns error when gameID is missing', async () => {
    const res = await POST(makeEvent({ relationshipSelectorID: SELECTOR_ID, shared: true }));
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/missing/i);
  });

  it('returns error when relationshipSelectorID is missing', async () => {
    const res = await POST(makeEvent({ gameID: GAME_ID, shared: true }));
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/missing/i);
  });

  it('returns error when shared is missing', async () => {
    const res = await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID }));
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/missing shared/i);
  });

  it('returns error when not an editor', async () => {
    const { isEditor } = await import('$lib/permissions');
    vi.mocked(isEditor).mockReturnValueOnce(false);
    const res = await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID, shared: true }));
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/permission/i);
  });

  // ── Selector-level sharing ─────────────────────────────────────────────────

  it('selector-level share: updates all docs that have assignedRelationships', async () => {
    const res = await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID, shared: true }));
    const body = await res.json();
    expect(body.success).toBe(true);
    // 3 docs have assignedRelationships (user-1, user-2, user-3); user-4 is empty; user-5 is already shared
    // user-5's rel-a is already shared: true — no change needed, so update() not called
    // user-1, user-2, user-3 all need updating
    expect(body.updated).toBe(3);
  });

  it('selector-level share: sets shared: true on all entries', async () => {
    await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID, shared: true }));

    for (const doc of assignmentDocs.filter((d) => d.data.assignedRelationships.length > 0)) {
      if (doc.update.mock.calls.length === 0) continue; // already-matching docs are skipped
      const written = doc.update.mock.calls[0][0] as { assignedRelationships: { shared: boolean }[] };
      for (const ar of written.assignedRelationships) {
        expect(ar.shared).toBe(true);
      }
    }
  });

  it('selector-level un-share: sets shared: false on all entries', async () => {
    // First share everything
    assignmentDocs = makeAssignmentDocs().map((d) => ({
      ...d,
      data: {
        ...d.data,
        assignedRelationships: d.data.assignedRelationships.map((r: any) => ({ ...r, shared: true }))
      }
    }));

    const res = await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID, shared: false }));
    const body = await res.json();
    expect(body.success).toBe(true);

    for (const doc of assignmentDocs.filter((d) => d.update.mock.calls.length > 0)) {
      const written = doc.update.mock.calls[0][0] as { assignedRelationships: { shared: boolean }[] };
      for (const ar of written.assignedRelationships) {
        expect(ar.shared).toBe(false);
      }
    }
  });

  it('returns updated: 0 when no docs have assignedRelationships', async () => {
    assignmentDocs = [
      makeDoc(`${SELECTOR_ID}-empty`, {
        userID: 'empty-user',
        relationshipSelectorID: SELECTOR_ID,
        relationshipRankings: [],
        assignedRelationships: []
      })
    ];
    const res = await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID, shared: true }));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.updated).toBe(0);
  });

  // ── Relationship-level sharing ─────────────────────────────────────────────

  it('relationship-level share: only updates entries matching the given relationshipID', async () => {
    const res = await POST(makeEvent({
      gameID: GAME_ID,
      relationshipSelectorID: SELECTOR_ID,
      shared: true,
      relationshipID: 'rel-a'
    }));
    const body = await res.json();
    expect(body.success).toBe(true);
    // user-1, user-2, user-3 all have rel-a with shared: false — need updating
    // user-5 has rel-a with shared: true — already matches, skipped
    expect(body.updated).toBe(3);
  });

  it('relationship-level share: does not touch entries for other relationships', async () => {
    await POST(makeEvent({
      gameID: GAME_ID,
      relationshipSelectorID: SELECTOR_ID,
      shared: true,
      relationshipID: 'rel-a'
    }));

    // user-1 has rel-a and rel-b; only rel-a should change
    const user1Doc = assignmentDocs.find((d) => d.data.userID === 'user-1')!;
    expect(user1Doc.update).toHaveBeenCalledOnce();
    const written = user1Doc.update.mock.calls[0][0] as {
      assignedRelationships: { relationshipID: string; shared: boolean }[]
    };
    const relA = written.assignedRelationships.find((r) => r.relationshipID === 'rel-a')!;
    const relB = written.assignedRelationships.find((r) => r.relationshipID === 'rel-b')!;
    expect(relA.shared).toBe(true);
    expect(relB.shared).toBe(false); // unchanged
  });

  // ── Skip unchanged docs ────────────────────────────────────────────────────

  it('does not call update() on docs where all entries already match', async () => {
    // user-5 has rel-a already shared; sharing it again should be a no-op for that doc
    const res = await POST(makeEvent({
      gameID: GAME_ID,
      relationshipSelectorID: SELECTOR_ID,
      shared: true,
      relationshipID: 'rel-a'
    }));
    const user5Doc = assignmentDocs.find((d) => d.data.userID === 'user-5')!;
    expect(user5Doc.update).not.toHaveBeenCalled();
  });
});
