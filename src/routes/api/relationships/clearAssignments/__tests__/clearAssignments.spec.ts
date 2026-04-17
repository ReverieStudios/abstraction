/**
 * Tests for POST /api/relationships/clearAssignments
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../+server';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeDoc<T>(id: string, data: T, exists = true) {
  return { id, data, exists, update: vi.fn().mockResolvedValue(undefined) };
}

function makeEvent(body: object, overrides: { decodedToken?: unknown; user?: unknown } = {}) {
  return {
    request: { json: vi.fn(async () => body) },
    locals: {
      decodedToken: 'decodedToken' in overrides ? overrides.decodedToken : { uid: 'admin-uid' },
      user: overrides.user ?? { roles: { system: 4 } }
    }
  } as any;
}

// ── Fixture data ──────────────────────────────────────────────────────────────

const GAME_ID = 'game-test';
const SELECTOR_ID = 'selector-1';

const makeAssignmentDocs = () => [
  // 3 with assignments
  makeDoc('doc-1', { userID: 'u1', relationshipSelectorID: SELECTOR_ID, relationshipRankings: ['r1', 'r2'], assignedRelationships: [{ relationshipID: 'r1', assignedUserIDs: ['u1', 'u2'] }] }),
  makeDoc('doc-2', { userID: 'u2', relationshipSelectorID: SELECTOR_ID, relationshipRankings: ['r2', 'r1'], assignedRelationships: [{ relationshipID: 'r1', assignedUserIDs: ['u1', 'u2'] }] }),
  makeDoc('doc-3', { userID: 'u3', relationshipSelectorID: SELECTOR_ID, relationshipRankings: ['r1', 'r2'], assignedRelationships: [{ relationshipID: 'r2', assignedUserIDs: ['u3', 'u4'] }] }),
  // 2 without assignments (rankings only)
  makeDoc('doc-4', { userID: 'u4', relationshipSelectorID: SELECTOR_ID, relationshipRankings: ['r1', 'r2'], assignedRelationships: [] }),
  makeDoc('doc-5', { userID: 'u5', relationshipSelectorID: SELECTOR_ID, relationshipRankings: ['r2', 'r1'], assignedRelationships: [] }),
];

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
      doc: vi.fn((id: string) => {
        // Return the actual mock doc so we can inspect its update() calls
        return { update: vi.fn().mockResolvedValue(undefined) };
      })
    }
  };
  return { database, setGameID };
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('POST /api/relationships/clearAssignments', () => {
  beforeEach(() => {
    assignmentDocs = makeAssignmentDocs();
    vi.clearAllMocks();
  });

  // ── Auth / permission guards ────────────────────────────────────────────────

  it('returns error when not authenticated', async () => {
    const res = await POST(makeEvent(
      { gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID },
      { decodedToken: null }
    ));
    const body = JSON.parse(await res.text());
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/not authenticated/i);
  });

  it('returns error when gameID is missing', async () => {
    const res = await POST(makeEvent({ relationshipSelectorID: SELECTOR_ID }));
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(body.message).toMatch(/missing/i);
  });

  it('returns error when relationshipSelectorID is missing', async () => {
    const res = await POST(makeEvent({ gameID: GAME_ID }));
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

  // ── Happy path ────────────────────────────────────────────────────────────

  it('succeeds and reports the correct cleared count', async () => {
    const res = await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID }));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.cleared).toBe(3); // only the 3 docs that had assignedRelationships
  });

  it('calls update({ assignedRelationships: [] }) on each assigned doc', async () => {
    const { database } = await import('$lib/database');
    await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID }));

    // doc() should have been called once per assigned document (3 times)
    expect(vi.mocked(database.relationshipAssignments!.doc).mock.calls).toHaveLength(3);

    // Each call should have been for one of the assigned doc IDs
    const calledIDs = vi.mocked(database.relationshipAssignments!.doc).mock.calls.map(([id]) => id);
    expect(calledIDs).toEqual(expect.arrayContaining(['doc-1', 'doc-2', 'doc-3']));
    expect(calledIDs).not.toContain('doc-4');
    expect(calledIDs).not.toContain('doc-5');
  });

  it('does not touch docs that have no assignments', async () => {
    // Only docs with non-empty assignedRelationships should be updated
    const { database } = await import('$lib/database');
    await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID }));

    const calledIDs = vi.mocked(database.relationshipAssignments!.doc).mock.calls.map(([id]) => id);
    expect(calledIDs).not.toContain('doc-4');
    expect(calledIDs).not.toContain('doc-5');
  });

  it('returns cleared: 0 when nothing has been assigned yet', async () => {
    assignmentDocs = [
      makeDoc('doc-a', { userID: 'u1', relationshipSelectorID: SELECTOR_ID, relationshipRankings: ['r1'], assignedRelationships: [] }),
      makeDoc('doc-b', { userID: 'u2', relationshipSelectorID: SELECTOR_ID, relationshipRankings: ['r1'], assignedRelationships: [] }),
    ];
    const res = await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID }));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.cleared).toBe(0);

    const { database } = await import('$lib/database');
    expect(vi.mocked(database.relationshipAssignments!.doc).mock.calls).toHaveLength(0);
  });

  it('returns cleared: 0 when there are no assignment docs at all', async () => {
    assignmentDocs = [];
    const res = await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID }));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.cleared).toBe(0);
  });
});
