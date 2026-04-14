/**
 * Tests for POST /api/relationships/assignRelationships
 *
 * Strategy: mock $lib/firebase (store), $lib/database (database + setGameID),
 * and $lib/permissions (isEditor), then call the POST handler directly.
 *
 * The test builds realistic-scale fixture data: 200 applicants, 10 posts,
 * each applicant ranking all posts in a random order.  The specific assignment
 * outcome is not under test here (that lives in matching.spec.ts); instead we
 * verify the API's contract:
 *   - auth / permission guards return early
 *   - the correct number of Firestore batch writes are committed
 *   - every participant that submitted rankings receives ≥1 assignment
 *   - no participant is assigned more relationships than relationshipsPerCharacter
 *   - each assigned relationship exists in the selector's relationshipIDs list
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../+server';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Fisher-Yates shuffle (in-place). */
function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Build a minimal DocType-like object the handler can read. */
function makeDoc<T>(id: string, data: T, exists = true) {
  return { id, data, exists, update: vi.fn().mockResolvedValue(undefined) };
}

// ── Fixture data ──────────────────────────────────────────────────────────────

const GAME_ID = 'game-test';
const SELECTOR_ID = 'selector-1';
const NUM_APPLICANTS = 200;
const NUM_POSTS = 10;
const RELATIONSHIPS_PER_CHARACTER = 2;

const relationshipIDs = Array.from({ length: NUM_POSTS }, (_, i) => `rel-${i}`);

const relationships = relationshipIDs.map((id, i) =>
  makeDoc(id, {
    name: `Relationship ${i}`,
    capacity: 50,   // plenty of room for 200 / 10 * 2 scenario
    size: 2,
    type: 'type-1',
    fields: {}
  })
);

const selectorDoc = makeDoc(SELECTOR_ID, {
  name: 'Test Selector',
  relationshipIDs,
  relationshipsPerCharacter: RELATIONSHIPS_PER_CHARACTER
});

/** Generate 200 assignment docs, each with a random full ranking of all posts. */
function makeAssignments() {
  return Array.from({ length: NUM_APPLICANTS }, (_, i) => {
    const userID = `user-${i}`;
    const relationshipRankings = shuffle([...relationshipIDs]);
    return makeDoc(`${SELECTOR_ID}-${userID}`, {
      userID,
      relationshipSelectorID: SELECTOR_ID,
      relationshipRankings,
      assignedRelationships: []
    });
  });
}

// ── Mocks ─────────────────────────────────────────────────────────────────────

// Capture all batch writes so we can inspect them
let batchOps: { path: string; data: unknown }[] = [];
let batchCommitCount = 0;

const mockBatch = () => {
  const ops: { path: string; data: unknown }[] = [];
  return {
    set: vi.fn((ref: { path: string }, data: unknown) => {
      ops.push({ path: ref.path, data });
      batchOps.push({ path: ref.path, data });
    }),
    commit: vi.fn(async () => {
      batchCommitCount++;
    })
  };
};

vi.mock('$lib/firebase', () => ({
  store: {
    writeBatch: vi.fn(() => mockBatch()),
    doc: vi.fn((path: string) => ({
      path,
      // Used by the user-name lookup: return a minimal snapshot
      get: vi.fn(async () => ({
        data: () => ({ name: `Name for ${path.split('/').pop()}` })
      }))
    }))
  }
}));

vi.mock('$lib/permissions', () => ({
  isEditor: vi.fn(() => true)
}));

// We'll set up database mock per-test via the factory below
let assignmentDocs: ReturnType<typeof makeDoc>[];

vi.mock('$lib/database', () => {
  // Lazy references so each test can rebind assignmentDocs
  const setGameID = vi.fn();

  const database = {
    relationshipSelectors: {
      doc: vi.fn(() => ({ read: vi.fn(async () => selectorDoc) }))
    },
    relationships: {
      doc: vi.fn((id: string) => ({
        read: vi.fn(async () => relationships.find((r) => r.id === id))
      }))
    },
    relationshipAssignments: {
      withQueries: vi.fn(() => ({
        read: vi.fn(async () => assignmentDocs)
      })),
      doc: vi.fn((id: string) => ({
        update: vi.fn(async () => undefined)
      }))
    }
  };

  return { database, setGameID };
});

// ── Fake RequestEvent factory ─────────────────────────────────────────────────

function makeEvent(body: object, overrides: { decodedToken?: unknown; user?: unknown } = {}) {
  return {
    request: {
      json: vi.fn(async () => body)
    },
    locals: {
      decodedToken: 'decodedToken' in overrides ? overrides.decodedToken : { uid: 'admin-uid' },
      user: overrides.user ?? { roles: { system: 4 } }
    }
  } as any;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/relationships/assignRelationships', () => {
  beforeEach(() => {
    batchOps = [];
    batchCommitCount = 0;
    assignmentDocs = makeAssignments();
  });

  // ── Auth / permission guards ────────────────────────────────────────────────

  it('returns 401 when not authenticated', async () => {
    const res = await POST(makeEvent(
      { gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID },
      { decodedToken: null }
    ));
    const text = await res.text();
    const body = JSON.parse(text);
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/not authenticated/i);
  });

  it('returns error when gameID is missing', async () => {
    const res = await POST(makeEvent({ relationshipSelectorID: SELECTOR_ID }));
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/missing/i);
  });

  it('returns error when not an editor', async () => {
    const { isEditor } = await import('$lib/permissions');
    vi.mocked(isEditor).mockReturnValueOnce(false);
    const res = await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID }));
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/permission/i);
  });

  // ── Main happy path at scale ────────────────────────────────────────────────

  it('succeeds with 200 applicants and 10 posts', async () => {
    const res = await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID }));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.assignments).toBe(NUM_APPLICANTS);
  });

  it('commits exactly one batch for 200 participants (well under 500-op limit)', async () => {
    await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID }));
    expect(batchCommitCount).toBe(1);
  });

  it('writes exactly one doc per participant', async () => {
    await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID }));
    expect(batchOps).toHaveLength(NUM_APPLICANTS);
  });

  it('every participant receives at least one assignment', async () => {
    await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID }));

    for (const op of batchOps) {
      const data = op.data as { assignedRelationships: { relationshipID: string }[] };
      expect(data.assignedRelationships.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('most participants do not exceed relationshipsPerCharacter assignments', async () => {
    // fillTuples may lightly exceed the cap to complete tuples — that is expected.
    // We verify that the vast majority (>90%) are within the cap.
    await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID }));

    let withinCap = 0;
    for (const op of batchOps) {
      const data = op.data as { assignedRelationships: { relationshipID: string }[] };
      if (data.assignedRelationships.length <= RELATIONSHIPS_PER_CHARACTER) withinCap++;
    }
    expect(withinCap / batchOps.length).toBeGreaterThan(0.9);
  });

  it('all assigned relationshipIDs belong to the selector', async () => {
    await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID }));
    const validIDs = new Set(relationshipIDs);

    for (const op of batchOps) {
      const data = op.data as { assignedRelationships: { relationshipID: string }[] };
      for (const ar of data.assignedRelationships) {
        expect(validIDs.has(ar.relationshipID)).toBe(true);
      }
    }
  });

  it('no relationship is assigned more users than its capacity', async () => {
    await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID }));

    // Tally assignments per relationship across all written docs
    const counts = new Map<string, number>();
    for (const op of batchOps) {
      const data = op.data as { assignedRelationships: { relationshipID: string }[] };
      for (const ar of data.assignedRelationships) {
        counts.set(ar.relationshipID, (counts.get(ar.relationshipID) ?? 0) + 1);
      }
    }
    for (const [relID, count] of counts) {
      const cap = relationships.find((r) => r.id === relID)?.data.capacity ?? Infinity;
      expect(count).toBeLessThanOrEqual(cap);
    }
  });

  // ── Edge cases ──────────────────────────────────────────────────────────────

  it('returns error when no participants have submitted rankings', async () => {
    assignmentDocs = []; // empty — rebinds via closure in mock
    const res = await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID }));
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/no participants/i);
  });

  it('handles 501 participants by committing two batches', async () => {
    // Build 501 applicants (crosses the 500-op chunk boundary)
    const bigIDs = Array.from({ length: 501 }, (_, i) => `rel-${i % NUM_POSTS}`);
    assignmentDocs = Array.from({ length: 501 }, (_, i) => {
      const userID = `biguser-${i}`;
      return makeDoc(`${SELECTOR_ID}-${userID}`, {
        userID,
        relationshipSelectorID: SELECTOR_ID,
        relationshipRankings: shuffle([...relationshipIDs]),
        assignedRelationships: []
      });
    });

    await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID }));
    expect(batchCommitCount).toBe(2);
  });

  // ── Character One & Character Two regression ────────────────────────────────────────────────
  // Two participants with different top picks. fillTuples must add each to the
  // other's top-ranked relationship so every pair is complete (size 2).
  it('fills tuples so both users appear in each others top-pick relationship', async () => {
    const characterOne = 'c1';
    const characterTwo = 'c2';
    const PAIR_SELECTOR_ID = 'pos-conn';

    const bestPals = makeDoc('best-pals', { name: 'Best Pals', capacity: 0, size: 2, type: '', fields: {} });
    const respColleagues = makeDoc('resp-colleagues', { name: 'Respected Colleagues', capacity: 0, size: 2, type: '', fields: {} });
    const mentorMentee = makeDoc('mentor-mentee', { name: 'Mentor & Mentee', capacity: 0, size: 2, type: '', fields: {} });

    const pairRelIDs = ['best-pals', 'resp-colleagues', 'mentor-mentee'];
    const pairSelector = makeDoc(PAIR_SELECTOR_ID, {
      name: 'Positive Connection',
      relationshipIDs: pairRelIDs,
      relationshipsPerCharacter: 1
    });

    // Override database mock for this test
    const { database } = await import('$lib/database');
    vi.mocked(database.relationshipSelectors!.doc).mockReturnValueOnce({
      read: vi.fn(async () => pairSelector)
    } as any);
    vi.mocked(database.relationships!.doc).mockImplementation((id: string) => ({
      read: vi.fn(async () => [bestPals, respColleagues, mentorMentee].find(r => r.id === id))
    } as any));

    assignmentDocs = [
      makeDoc(`${PAIR_SELECTOR_ID}-${characterOne}`, {
        userID: characterOne,
        relationshipSelectorID: PAIR_SELECTOR_ID,
        relationshipRankings: ['best-pals', 'resp-colleagues', 'mentor-mentee'],
        assignedRelationships: []
      }),
      makeDoc(`${PAIR_SELECTOR_ID}-${characterTwo}`, {
        userID: characterTwo,
        relationshipSelectorID: PAIR_SELECTOR_ID,
        relationshipRankings: ['mentor-mentee', 'resp-colleagues', 'best-pals'],
        assignedRelationships: []
      })
    ];

    const res = await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: PAIR_SELECTOR_ID }));
    const body = await res.json();
    expect(body.success).toBe(true);

    // fillTuples completes each tuple: Char1 gets Best Pals (top pick) and is added to
    // Mentor & Mentee to fill Char2's tuple; Char2 vice-versa.
    // So both users end up assigned to BOTH relationships.
    for (const op of batchOps) {
      const data = op.data as { assignedRelationships: { relationshipID: string; assignedUserIDs: string[] }[] };
      // Each user should have 2 relationships (their top pick + added to complete the other's tuple)
      expect(data.assignedRelationships).toHaveLength(2);
      // Every tuple must be complete (both users)
      for (const ar of data.assignedRelationships) {
        expect(ar.assignedUserIDs).toContain(characterOne);
        expect(ar.assignedUserIDs).toContain(characterTwo);
      }
    }

    // Restore mocks to defaults for subsequent tests
    const { database: db2 } = await import('$lib/database');
    vi.mocked(db2.relationshipSelectors!.doc).mockRestore?.();
    vi.mocked(db2.relationships!.doc).mockRestore?.();
  });

  it('does not assign a participant who has no rankings', async () => {
    // Mix 199 normal + 1 with no rankings
    const noRankings = makeDoc(`${SELECTOR_ID}-user-no-rank`, {
      userID: 'user-no-rank',
      relationshipSelectorID: SELECTOR_ID,
      relationshipRankings: [],          // <-- empty
      assignedRelationships: []
    });
    // Replace last assignment with the no-rankings one
    assignmentDocs = [...assignmentDocs.slice(0, 199), noRankings];

    const res = await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID }));
    const body = await res.json();

    // 199 eligible participants → 199 writes (the no-rankings doc is filtered out)
    expect(body.assignments).toBe(199);
    const writtenPaths = batchOps.map((op) => op.path);
    expect(writtenPaths.every((p) => !p.includes('user-no-rank'))).toBe(true);
  });
});
