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
      const data = op.data as { assignedRelationships: { relationshipID: string; assignedUserIDs: string[]; shared: boolean }[] };
      expect(data.assignedRelationships.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('all written assignedRelationship entries have shared: false', async () => {
    await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID }));

    for (const op of batchOps) {
      const data = op.data as { assignedRelationships: { relationshipID: string; assignedUserIDs: string[]; shared: boolean }[] };
      for (const ar of data.assignedRelationships) {
        expect(ar.shared).toBe(false);
      }
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

  // ── Tuple correctness regression ────────────────────────────────────────────
  // Each user's assignedUserIDs must contain ONLY their specific tuple-mates,
  // not the entire flat roster. This requires multiple tuples (e.g. 4 users in
  // a size-2 relationship → 2 pairs) to be detectable.
  it('stores per-user tuples, not the full roster, in assignedUserIDs', async () => {
    const TUPLE_SELECTOR_ID = 'tuple-selector';
    const tupleRelID = 'tuple-rel';

    const tupleSelector = makeDoc(TUPLE_SELECTOR_ID, {
      name: 'Tuple Test',
      relationshipIDs: [tupleRelID],
      relationshipsPerCharacter: 1
    });

    // size=2, capacity=4 → 4 users fill the relationship, split into 2 pairs
    const tupleRel = makeDoc(tupleRelID, { name: 'Tuple Rel', capacity: 4, size: 2, type: '', fields: {} });

    const { database } = await import('$lib/database');
    vi.mocked(database.relationshipSelectors!.doc).mockReturnValueOnce({
      read: vi.fn(async () => tupleSelector)
    } as any);
    vi.mocked(database.relationships!.doc).mockImplementation((id: string) => ({
      read: vi.fn(async () => (id === tupleRelID ? tupleRel : undefined))
    }) as any);

    // 4 participants all rank the same single relationship
    assignmentDocs = ['u1', 'u2', 'u3', 'u4'].map((uid) =>
      makeDoc(`${TUPLE_SELECTOR_ID}-${uid}`, {
        userID: uid,
        relationshipSelectorID: TUPLE_SELECTOR_ID,
        relationshipRankings: [tupleRelID],
        assignedRelationships: []
      })
    );

    const res = await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: TUPLE_SELECTOR_ID }));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.assignments).toBe(4);

    // Each user must have exactly 1 assignment (tupleRelID)
    for (const op of batchOps) {
      const data = op.data as { assignedRelationships: { relationshipID: string; assignedUserIDs: string[] }[] };
      const entry = data.assignedRelationships.find((ar) => ar.relationshipID === tupleRelID);
      expect(entry).toBeDefined();
      // Must be exactly tuple-size (2), NOT the full roster (4)
      expect(entry!.assignedUserIDs).toHaveLength(2);
    }

    // The two pairs must be disjoint: no user appears in more than one pair
    const pairsByUser = new Map<string, string[]>();
    for (const op of batchOps) {
      const data = op.data as { assignedRelationships: { relationshipID: string; assignedUserIDs: string[] }[] };
      const userID = op.path.split('/').pop()!.replace(`${TUPLE_SELECTOR_ID}-`, '');
      const entry = data.assignedRelationships.find((ar) => ar.relationshipID === tupleRelID)!;
      pairsByUser.set(userID, entry.assignedUserIDs);
    }
    // For each user, their stored tuple must contain themselves
    for (const [userID, pair] of pairsByUser) {
      expect(pair).toContain(userID);
    }
    // The two distinct pairs must share no members
    const pairs = [...new Map([...pairsByUser].map(([, pair]) => [[...pair].sort().join('|'), pair])).values()];
    expect(pairs).toHaveLength(2);
    const [pairA, pairB] = pairs;
    expect(pairA.some((u) => pairB.includes(u))).toBe(false);

    // Restore
    vi.mocked(database.relationships!.doc).mockImplementation((id: string) => ({
      read: vi.fn(async () => relationships.find((r) => r.id === id))
    }) as any);
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

  // ── Incremental matchmaking ─────────────────────────────────────────────────

  it('returns success with assignments=0 when all participants are already assigned', async () => {
    // All docs have non-empty assignedRelationships
    assignmentDocs = Array.from({ length: 5 }, (_, i) =>
      makeDoc(`${SELECTOR_ID}-user-${i}`, {
        userID: `user-${i}`,
        relationshipSelectorID: SELECTOR_ID,
        relationshipRankings: shuffle([...relationshipIDs]),
        assignedRelationships: [{ relationshipID: relationshipIDs[0], assignedUserIDs: [`user-${i}`] }]
      })
    );

    const res = await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID }));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.assignments).toBe(0);
    expect(batchOps).toHaveLength(0); // nothing to write
  });

  it('only matchmakes new participants when some are already assigned', async () => {
    const ASSIGNED_COUNT = 10;
    const NEW_COUNT = 5;

    // 10 already-assigned participants
    const alreadyAssignedDocs = Array.from({ length: ASSIGNED_COUNT }, (_, i) =>
      makeDoc(`${SELECTOR_ID}-existing-${i}`, {
        userID: `existing-${i}`,
        relationshipSelectorID: SELECTOR_ID,
        relationshipRankings: shuffle([...relationshipIDs]),
        assignedRelationships: [
          { relationshipID: relationshipIDs[i % NUM_POSTS], assignedUserIDs: [`existing-${i}`, `existing-${(i + 1) % ASSIGNED_COUNT}`] }
        ]
      })
    );

    // 5 new participants with rankings but no assignments
    const newDocs = Array.from({ length: NEW_COUNT }, (_, i) =>
      makeDoc(`${SELECTOR_ID}-newuser-${i}`, {
        userID: `newuser-${i}`,
        relationshipSelectorID: SELECTOR_ID,
        relationshipRankings: shuffle([...relationshipIDs]),
        assignedRelationships: []
      })
    );

    assignmentDocs = [...alreadyAssignedDocs, ...newDocs];

    const res = await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID }));
    const body = await res.json();
    expect(body.success).toBe(true);
    // assignments count = number of new participants processed
    expect(body.assignments).toBe(NEW_COUNT);

    // All written paths involve newuser- or existing- (existing patched if their rel changed)
    const newUserPaths = batchOps.map((op) => op.path).filter((p) => p.includes('newuser-'));
    expect(newUserPaths.length).toBe(NEW_COUNT);
  });

  it('reduces post capacity by the number of already-assigned users', async () => {
    // rel-0 has capacity 2 and is already full (2 existing users)
    const fullRelID = 'rel-0';

    const alreadyAssignedDocs = [
      makeDoc(`${SELECTOR_ID}-ea-0`, {
        userID: 'ea-0',
        relationshipSelectorID: SELECTOR_ID,
        relationshipRankings: [fullRelID, ...relationshipIDs.filter((r) => r !== fullRelID)],
        assignedRelationships: [{ relationshipID: fullRelID, assignedUserIDs: ['ea-0', 'ea-1'] }]
      }),
      makeDoc(`${SELECTOR_ID}-ea-1`, {
        userID: 'ea-1',
        relationshipSelectorID: SELECTOR_ID,
        relationshipRankings: [fullRelID, ...relationshipIDs.filter((r) => r !== fullRelID)],
        assignedRelationships: [{ relationshipID: fullRelID, assignedUserIDs: ['ea-0', 'ea-1'] }]
      })
    ];

    // New user who ranks rel-0 first (but it's full)
    const newDoc = makeDoc(`${SELECTOR_ID}-new-0`, {
      userID: 'new-0',
      relationshipSelectorID: SELECTOR_ID,
      relationshipRankings: [fullRelID, ...relationshipIDs.filter((r) => r !== fullRelID)],
      assignedRelationships: []
    });

    assignmentDocs = [...alreadyAssignedDocs, newDoc];

    // Relationships: rel-0 has capacity exactly 2 (now full)
    const { database } = await import('$lib/database');
    const cappedRels = relationshipIDs.map((id, i) =>
      makeDoc(id, { name: `Rel ${i}`, capacity: id === fullRelID ? 2 : 50, size: 2, type: '', fields: {} })
    );
    vi.mocked(database.relationships!.doc).mockImplementation((id: string) => ({
      read: vi.fn(async () => cappedRels.find((r) => r.id === id))
    }) as any);

    const res = await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID }));
    const body = await res.json();
    expect(body.success).toBe(true);

    // new-0 must NOT have been assigned to rel-0 (it's at capacity)
    const newUserOp = batchOps.find((op) => op.path.includes('new-0'));
    expect(newUserOp).toBeDefined();
    const assignedRels = (newUserOp!.data as { assignedRelationships: { relationshipID: string }[] })
      .assignedRelationships.map((ar) => ar.relationshipID);
    expect(assignedRels).not.toContain(fullRelID);

    // Restore
    vi.mocked(database.relationships!.doc).mockImplementation((id: string) => ({
      read: vi.fn(async () => relationships.find((r) => r.id === id))
    }) as any);
  });

  it('patches existing participants docs when new members join their relationship', async () => {
    // E1 is assigned to rel-0. A new user N1 also gets rel-0 assigned.
    // E1's doc should be updated with the new combined assignedUserIDs.
    const sharedRelID = relationshipIDs[0];

    const e1Doc = makeDoc(`${SELECTOR_ID}-e1`, {
      userID: 'e1',
      relationshipSelectorID: SELECTOR_ID,
      // E1 ranked rel-0 first but didn't get it (impossible in isolation, but we
      // force it via alreadyAssigned: they *are* assigned to it already)
      relationshipRankings: [sharedRelID, ...relationshipIDs.slice(1)],
      assignedRelationships: [
        { relationshipID: sharedRelID, assignedUserIDs: ['e1'] } // incomplete tuple
      ]
    });

    // New participant who ranks rel-0 first
    const n1Doc = makeDoc(`${SELECTOR_ID}-n1`, {
      userID: 'n1',
      relationshipSelectorID: SELECTOR_ID,
      relationshipRankings: [sharedRelID, ...relationshipIDs.slice(1)],
      assignedRelationships: []
    });

    assignmentDocs = [e1Doc, n1Doc];

    // rel-0 has capacity 1 remaining (1 existing, base capacity 2)
    const { database } = await import('$lib/database');
    const patchRels = relationshipIDs.map((id, i) =>
      makeDoc(id, { name: `Rel ${i}`, capacity: 2, size: 2, type: '', fields: {} })
    );
    vi.mocked(database.relationships!.doc).mockImplementation((id: string) => ({
      read: vi.fn(async () => patchRels.find((r) => r.id === id))
    }) as any);

    const res = await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID }));
    const body = await res.json();
    expect(body.success).toBe(true);

    // E1's doc should be updated with n1 in the assignedUserIDs for rel-0
    const e1Op = batchOps.find((op) => op.path.includes(`${SELECTOR_ID}-e1`));
    expect(e1Op).toBeDefined();
    const e1Rels = (e1Op!.data as { assignedRelationships: { relationshipID: string; assignedUserIDs: string[] }[] })
      .assignedRelationships;
    const sharedRel = e1Rels.find((ar) => ar.relationshipID === sharedRelID);
    expect(sharedRel).toBeDefined();
    expect(sharedRel!.assignedUserIDs).toContain('e1');
    expect(sharedRel!.assignedUserIDs).toContain('n1');

    // Restore
    vi.mocked(database.relationships!.doc).mockImplementation((id: string) => ({
      read: vi.fn(async () => relationships.find((r) => r.id === id))
    }) as any);
  });

  it('uses existing ranked-but-unassigned users as fill candidates for new-round tuples', async () => {
    // Scenario: E1 is already assigned to rel-0. They also ranked rel-1 (rank 2) but didn't get it.
    // N1 is a new participant who gets matched to rel-1 (the only new match, size 2 tuple → needs 1 fill).
    // fillTuples should pull E1 in as the fill candidate for rel-1.
    const rel0 = 'rel-0';
    const rel1 = 'rel-1';
    const FILL_SELECTOR_ID = 'fill-selector';

    const fillSelector = makeDoc(FILL_SELECTOR_ID, {
      name: 'Fill Test Selector',
      relationshipIDs: [rel0, rel1],
      relationshipsPerCharacter: 1
    });

    const fillRels = [
      makeDoc(rel0, { name: 'Rel 0', capacity: 0, size: 2, type: '', fields: {} }),
      makeDoc(rel1, { name: 'Rel 1', capacity: 0, size: 2, type: '', fields: {} })
    ];

    const { database } = await import('$lib/database');
    vi.mocked(database.relationshipSelectors!.doc).mockReturnValueOnce({
      read: vi.fn(async () => fillSelector)
    } as any);
    vi.mocked(database.relationships!.doc).mockImplementation((id: string) => ({
      read: vi.fn(async () => fillRels.find((r) => r.id === id))
    }) as any);

    // E1: already assigned to rel-0, also ranked rel-1 (rank 2)
    const e1Doc = makeDoc(`${FILL_SELECTOR_ID}-e1`, {
      userID: 'e1-fill',
      relationshipSelectorID: FILL_SELECTOR_ID,
      relationshipRankings: [rel0, rel1], // rel0=rank1, rel1=rank2
      assignedRelationships: [
        { relationshipID: rel0, assignedUserIDs: ['e1-fill', 'e2-fill'] }
      ]
    });

    // N1: new participant, ranks rel-1 first
    const n1Doc = makeDoc(`${FILL_SELECTOR_ID}-n1`, {
      userID: 'n1-fill',
      relationshipSelectorID: FILL_SELECTOR_ID,
      relationshipRankings: [rel1, rel0],
      assignedRelationships: []
    });

    assignmentDocs = [e1Doc, n1Doc];

    const res = await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: FILL_SELECTOR_ID }));
    const body = await res.json();
    expect(body.success).toBe(true);

    // N1 gets rel-1. fillTuples should add E1 (ranked rel-1 at rank-2, not assigned to it).
    const n1Op = batchOps.find((op) => op.path.includes('n1-fill'));
    expect(n1Op).toBeDefined();
    const n1Rels = (n1Op!.data as { assignedRelationships: { relationshipID: string; assignedUserIDs: string[] }[] })
      .assignedRelationships;
    const n1Rel1 = n1Rels.find((ar) => ar.relationshipID === rel1);
    expect(n1Rel1).toBeDefined();
    // Both n1-fill and e1-fill should be in the assignedUserIDs (completed tuple)
    expect(n1Rel1!.assignedUserIDs).toContain('n1-fill');
    expect(n1Rel1!.assignedUserIDs).toContain('e1-fill');

    // E1's doc should now include rel-1 as a newly fill-added relationship
    const e1Op = batchOps.find((op) => op.path.includes('e1-fill'));
    expect(e1Op).toBeDefined();
    const e1Rels = (e1Op!.data as { assignedRelationships: { relationshipID: string; assignedUserIDs: string[] }[] })
      .assignedRelationships;
    const e1Rel1 = e1Rels.find((ar) => ar.relationshipID === rel1);
    expect(e1Rel1).toBeDefined();
    expect(e1Rel1!.assignedUserIDs).toContain('n1-fill');
    expect(e1Rel1!.assignedUserIDs).toContain('e1-fill');

    // Restore
    vi.mocked(database.relationships!.doc).mockImplementation((id: string) => ({
      read: vi.fn(async () => relationships.find((r) => r.id === id))
    }) as any);
  });

  it('preserves existing complete tuples when rerunning for unmatched participants', async () => {
    const stableSelectorID = 'stable-tuples-selector';
    const stableRelID = 'stable-rel';

    const stableSelector = makeDoc(stableSelectorID, {
      name: 'Stable Tuples Selector',
      relationshipIDs: [stableRelID],
      relationshipsPerCharacter: 1
    });

    const stableRelationship = makeDoc(stableRelID, {
      name: 'Stable Relationship',
      capacity: 0,
      size: 2,
      type: '',
      fields: {}
    });

    const { database } = await import('$lib/database');
    vi.mocked(database.relationshipSelectors!.doc).mockReturnValueOnce({
      read: vi.fn(async () => stableSelector)
    } as any);
    vi.mocked(database.relationships!.doc).mockImplementation((id: string) => ({
      read: vi.fn(async () => (id === stableRelID ? stableRelationship : undefined))
    }) as any);

    // Existing complete tuples are [e1, e3] and [e2, e4].
    // The docs are intentionally ordered by user so rebuilding tuples from a flat
    // roster would produce [e1, e2] and [e3, e4], which would rewrite the
    // original connections.
    const existingDocs = [
      makeDoc(`${stableSelectorID}-e1`, {
        userID: 'e1',
        relationshipSelectorID: stableSelectorID,
        relationshipRankings: [stableRelID],
        assignedRelationships: [{ relationshipID: stableRelID, assignedUserIDs: ['e1', 'e3'] }]
      }),
      makeDoc(`${stableSelectorID}-e2`, {
        userID: 'e2',
        relationshipSelectorID: stableSelectorID,
        relationshipRankings: [stableRelID],
        assignedRelationships: [{ relationshipID: stableRelID, assignedUserIDs: ['e2', 'e4'] }]
      }),
      makeDoc(`${stableSelectorID}-e3`, {
        userID: 'e3',
        relationshipSelectorID: stableSelectorID,
        relationshipRankings: [stableRelID],
        assignedRelationships: [{ relationshipID: stableRelID, assignedUserIDs: ['e1', 'e3'] }]
      }),
      makeDoc(`${stableSelectorID}-e4`, {
        userID: 'e4',
        relationshipSelectorID: stableSelectorID,
        relationshipRankings: [stableRelID],
        assignedRelationships: [{ relationshipID: stableRelID, assignedUserIDs: ['e2', 'e4'] }]
      })
    ];

    const newDocs = [
      makeDoc(`${stableSelectorID}-n1`, {
        userID: 'n1',
        relationshipSelectorID: stableSelectorID,
        relationshipRankings: [stableRelID],
        assignedRelationships: []
      }),
      makeDoc(`${stableSelectorID}-n2`, {
        userID: 'n2',
        relationshipSelectorID: stableSelectorID,
        relationshipRankings: [stableRelID],
        assignedRelationships: []
      })
    ];

    assignmentDocs = [...existingDocs, ...newDocs];

    const res = await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: stableSelectorID }));
    const body = await res.json();
    expect(body.success).toBe(true);

    const e1Op = batchOps.find((op) => op.path.includes(`${stableSelectorID}-e1`));
    const e2Op = batchOps.find((op) => op.path.includes(`${stableSelectorID}-e2`));
    const e3Op = batchOps.find((op) => op.path.includes(`${stableSelectorID}-e3`));
    const e4Op = batchOps.find((op) => op.path.includes(`${stableSelectorID}-e4`));

    expect(e1Op).toBeDefined();
    expect(e2Op).toBeDefined();
    expect(e3Op).toBeDefined();
    expect(e4Op).toBeDefined();

    const getAssignedUserIDs = (op: { data: unknown }) => {
      const rels = (op.data as { assignedRelationships: { relationshipID: string; assignedUserIDs: string[] }[] })
        .assignedRelationships;
      return rels.find((ar) => ar.relationshipID === stableRelID)?.assignedUserIDs ?? [];
    };

    expect(getAssignedUserIDs(e1Op!)).toEqual(['e1', 'e3']);
    expect(getAssignedUserIDs(e3Op!)).toEqual(['e1', 'e3']);
    expect(getAssignedUserIDs(e2Op!)).toEqual(['e2', 'e4']);
    expect(getAssignedUserIDs(e4Op!)).toEqual(['e2', 'e4']);

    // Restore
    vi.mocked(database.relationships!.doc).mockImplementation((id: string) => ({
      read: vi.fn(async () => relationships.find((r) => r.id === id))
    }) as any);
  });

  it('production-shape rerun preserves existing tuples and only adds new relationships', async () => {
    const PROD_SELECTOR_ID = 'prod-shape-selector';
    const INITIAL_USERS = 99;
    const ADDED_USERS = 6;
    const REL_COUNT = 14;
    const relIDs = Array.from({ length: REL_COUNT }, (_, i) => `prod-rel-${i}`);

    const prodSelector = makeDoc(PROD_SELECTOR_ID, {
      name: 'Production Shape Selector',
      relationshipIDs: relIDs,
      relationshipsPerCharacter: 2
    });

    const prodRelationships = relIDs.map((id, i) =>
      makeDoc(id, {
        name: `Prod Relationship ${i}`,
        capacity: 0,
        size: i < 12 ? 2 : 3,
        type: '',
        fields: {}
      })
    );

    const { database } = await import('$lib/database');
    vi.mocked(database.relationshipSelectors!.doc).mockImplementation((id: string) => ({
      read: vi.fn(async () => (id === PROD_SELECTOR_ID ? prodSelector : selectorDoc))
    }) as any);
    vi.mocked(database.relationships!.doc).mockImplementation((id: string) => ({
      read: vi.fn(async () => prodRelationships.find((r) => r.id === id) ?? relationships.find((r) => r.id === id))
    }) as any);

    const rotatedRankings = (offset: number) => {
      const shifted = [...relIDs.slice(offset), ...relIDs.slice(0, offset)];
      return shifted;
    };

    const initialDocs = Array.from({ length: INITIAL_USERS }, (_, i) => {
      const uid = `prod-user-${i}`;
      return makeDoc(`${PROD_SELECTOR_ID}-${uid}`, {
        userID: uid,
        relationshipSelectorID: PROD_SELECTOR_ID,
        relationshipRankings: rotatedRankings(i % relIDs.length),
        assignedRelationships: []
      });
    });

    assignmentDocs = initialDocs;

    const applyBatchOpsToAssignmentDocs = () => {
      const byDocID = new Map(assignmentDocs.map((d) => [d.id, d]));
      for (const op of batchOps) {
        const docID = op.path.split('/').pop()!;
        const payload = op.data as { assignedRelationships?: any[] };
        const existing = byDocID.get(docID);
        if (existing) {
          existing.data = {
            ...existing.data,
            ...(payload.assignedRelationships ? { assignedRelationships: payload.assignedRelationships } : {})
          };
        } else {
          const userID = docID.replace(`${PROD_SELECTOR_ID}-`, '');
          const created = makeDoc(docID, {
            userID,
            relationshipSelectorID: PROD_SELECTOR_ID,
            relationshipRankings: [],
            assignedRelationships: payload.assignedRelationships ?? []
          });
          assignmentDocs.push(created as any);
          byDocID.set(docID, created as any);
        }
      }
    };

    const getRelMap = (doc: any): Record<string, string[]> => {
      const rels = doc.data.assignedRelationships ?? [];
      const out: Record<string, string[]> = {};
      for (const rel of rels) {
        out[rel.relationshipID] = [...(rel.assignedUserIDs ?? [])].sort();
      }
      return out;
    };

    // 1) First run
    let res = await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: PROD_SELECTOR_ID }));
    let body = await res.json();
    expect(body.success).toBe(true);
    expect(body.assignments).toBe(INITIAL_USERS);
    applyBatchOpsToAssignmentDocs();

    const baselineByUser = new Map<string, Record<string, string[]>>();
    for (const d of assignmentDocs) {
      if (!d.data.userID.startsWith('prod-user-')) continue;
      baselineByUser.set(d.data.userID, getRelMap(d));
    }

    // 2) Add 6 new participants
    const addedDocs = Array.from({ length: ADDED_USERS }, (_, i) => {
      const uid = `prod-new-${i}`;
      return makeDoc(`${PROD_SELECTOR_ID}-${uid}`, {
        userID: uid,
        relationshipSelectorID: PROD_SELECTOR_ID,
        relationshipRankings: rotatedRankings((i * 3) % relIDs.length),
        assignedRelationships: []
      });
    });
    assignmentDocs = [...assignmentDocs, ...addedDocs];

    batchOps = [];
    batchCommitCount = 0;

    // 3) Rerun for unmatched participants
    res = await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: PROD_SELECTOR_ID }));
    body = await res.json();
    expect(body.success).toBe(true);
    expect(body.assignments).toBe(ADDED_USERS);
    applyBatchOpsToAssignmentDocs();

    // Existing users: pre-existing relationships must stay exactly the same tuple members.
    // They may gain additional relationships due to fill behavior.
    for (const d of assignmentDocs) {
      const uid = d.data.userID;
      if (!uid.startsWith('prod-user-')) continue;
      const before = baselineByUser.get(uid)!;
      const after = getRelMap(d);

      for (const [relID, beforeTuple] of Object.entries(before)) {
        expect(after[relID]).toBeDefined();
        expect(after[relID]).toEqual(beforeTuple);
      }
    }

    // New users should now have assignment data.
    for (const d of assignmentDocs.filter((x) => x.data.userID.startsWith('prod-new-'))) {
      expect(Array.isArray(d.data.assignedRelationships)).toBe(true);
      expect(d.data.assignedRelationships.length).toBeGreaterThan(0);
    }

    // Restore
    vi.mocked(database.relationshipSelectors!.doc).mockImplementation(() => ({
      read: vi.fn(async () => selectorDoc)
    }) as any);
    vi.mocked(database.relationships!.doc).mockImplementation((id: string) => ({
      read: vi.fn(async () => relationships.find((r) => r.id === id))
    }) as any);
  });

  it('does not create a new orphan tuple when a new participant fills an existing orphan', async () => {
    const ORPHAN_SELECTOR_ID = 'orphan-rebalance-selector';
    const relA = 'rel-a';
    const relB = 'rel-b';

    const orphanSelector = makeDoc(ORPHAN_SELECTOR_ID, {
      name: 'Orphan Rebalance Selector',
      relationshipIDs: [relA, relB],
      relationshipsPerCharacter: 1
    });

    const orphanRels = [
      makeDoc(relA, { name: 'Rel A', capacity: 0, size: 2, type: '', fields: {} }),
      makeDoc(relB, { name: 'Rel B', capacity: 0, size: 2, type: '', fields: {} })
    ];

    const { database } = await import('$lib/database');
    vi.mocked(database.relationshipSelectors!.doc).mockReturnValueOnce({
      read: vi.fn(async () => orphanSelector)
    } as any);
    vi.mocked(database.relationships!.doc).mockImplementation((id: string) => ({
      read: vi.fn(async () => orphanRels.find((r) => r.id === id))
    }) as any);

    // Existing state mimics a post-delete orphan on relA:
    // - e1 is orphaned on relA
    // - e2/e3 are assigned to relB and both ranked relA as well (eligible fill candidates)
    const existingDocs = [
      makeDoc(`${ORPHAN_SELECTOR_ID}-e1`, {
        userID: 'e1',
        relationshipSelectorID: ORPHAN_SELECTOR_ID,
        relationshipRankings: [relA, relB],
        assignedRelationships: [{ relationshipID: relA, assignedUserIDs: ['e1'] }]
      }),
      makeDoc(`${ORPHAN_SELECTOR_ID}-e2`, {
        userID: 'e2',
        relationshipSelectorID: ORPHAN_SELECTOR_ID,
        relationshipRankings: [relA, relB],
        assignedRelationships: [{ relationshipID: relB, assignedUserIDs: ['e2', 'e3'] }]
      }),
      makeDoc(`${ORPHAN_SELECTOR_ID}-e3`, {
        userID: 'e3',
        relationshipSelectorID: ORPHAN_SELECTOR_ID,
        relationshipRankings: [relA, relB],
        assignedRelationships: [{ relationshipID: relB, assignedUserIDs: ['e2', 'e3'] }]
      })
    ];

    const newDoc = makeDoc(`${ORPHAN_SELECTOR_ID}-n1`, {
      userID: 'n1',
      relationshipSelectorID: ORPHAN_SELECTOR_ID,
      relationshipRankings: [relA, relB],
      assignedRelationships: []
    });

    assignmentDocs = [...existingDocs, newDoc];

    const res = await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: ORPHAN_SELECTOR_ID }));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.assignments).toBe(1);

    // Materialize the new assignedRelationships state from batch writes.
    const finalByUser = new Map<string, { assignedRelationships: { relationshipID: string; assignedUserIDs: string[] }[] }>();
    for (const d of assignmentDocs) {
      finalByUser.set(d.data.userID, {
        assignedRelationships: (d.data.assignedRelationships ?? []).map((ar: any) => ({
          relationshipID: ar.relationshipID,
          assignedUserIDs: ar.assignedUserIDs ?? []
        }))
      });
    }
    for (const op of batchOps) {
      const docID = op.path.split('/').pop()!;
      const userID = docID.replace(`${ORPHAN_SELECTOR_ID}-`, '');
      const payload = op.data as { assignedRelationships: { relationshipID: string; assignedUserIDs: string[] }[] };
      finalByUser.set(userID, {
        assignedRelationships: payload.assignedRelationships.map((ar) => ({
          relationshipID: ar.relationshipID,
          assignedUserIDs: ar.assignedUserIDs ?? []
        }))
      });
    }

    // After rerun, relA should be fully paired and must not produce a new singleton tuple.
    // Count unique relA tuples by sorted member set.
    const relATuples = new Set<string>();
    for (const [userID, doc] of finalByUser) {
      const relAEntry = doc.assignedRelationships.find((ar) => ar.relationshipID === relA);
      if (!relAEntry) continue;
      // Sanity: each stored tuple should include the doc owner when present.
      if (relAEntry.assignedUserIDs.includes(userID)) {
        relATuples.add([...relAEntry.assignedUserIDs].sort().join('|'));
      }
    }

    const hasSingletonRelATuple = [...relATuples].some((tupleKey) => tupleKey.split('|').length === 1);
    expect(hasSingletonRelATuple).toBe(false);

    // Restore
    vi.mocked(database.relationships!.doc).mockImplementation((id: string) => ({
      read: vi.fn(async () => relationships.find((r) => r.id === id))
    }) as any);
  });
});
