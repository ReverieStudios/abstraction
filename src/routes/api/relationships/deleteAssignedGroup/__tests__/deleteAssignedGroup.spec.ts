import { beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from '../+server';

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

const GAME_ID = 'game-test';
const SELECTOR_ID = 'selector-1';
const REL_ID = 'rivalry';
const GROUP_A = ['bob', 'steve'];
const GROUP_B = ['karen', 'sarah'];

const makeAssignmentDocs = () => [
	makeDoc('doc-bob', {
		userID: 'bob',
		relationshipSelectorID: SELECTOR_ID,
		relationshipRankings: ['rivalry'],
		assignedRelationships: [{ relationshipID: REL_ID, assignedUserIDs: GROUP_A, shared: false }]
	}),
	makeDoc('doc-steve', {
		userID: 'steve',
		relationshipSelectorID: SELECTOR_ID,
		relationshipRankings: ['rivalry'],
		assignedRelationships: [{ relationshipID: REL_ID, assignedUserIDs: GROUP_A, shared: false }]
	}),
	makeDoc('doc-karen', {
		userID: 'karen',
		relationshipSelectorID: SELECTOR_ID,
		relationshipRankings: ['rivalry'],
		assignedRelationships: [{ relationshipID: REL_ID, assignedUserIDs: GROUP_B, shared: false }]
	}),
	makeDoc('doc-sarah', {
		userID: 'sarah',
		relationshipSelectorID: SELECTOR_ID,
		relationshipRankings: ['rivalry'],
		assignedRelationships: [{ relationshipID: REL_ID, assignedUserIDs: GROUP_B, shared: false }]
	}),
	makeDoc('doc-other', {
		userID: 'other',
		relationshipSelectorID: SELECTOR_ID,
		relationshipRankings: ['rivalry'],
		assignedRelationships: [{ relationshipID: REL_ID, assignedUserIDs: ['other', 'x'], shared: false }]
	})
];

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
			doc: vi.fn((id: string) =>
				assignmentDocs.find((d) => d.id === id) ?? { update: vi.fn().mockResolvedValue(undefined) }
			)
		}
	};
	return { database, setGameID };
});

describe('POST /api/relationships/deleteAssignedGroup', () => {
	beforeEach(async () => {
		assignmentDocs = makeAssignmentDocs();
		vi.clearAllMocks();
		vi.mocked((await import('$lib/permissions')).isEditor).mockReturnValue(true);
	});

	it('returns error when not authenticated', async () => {
		const res = await POST(
			makeEvent(
				{
					gameID: GAME_ID,
					relationshipSelectorID: SELECTOR_ID,
					relationshipID: REL_ID,
					tupleUserIDs: GROUP_A
				},
				{ decodedToken: null }
			)
		);
		const body = await res.json();
		expect(body.success).toBe(false);
		expect(body.message).toMatch(/not authenticated/i);
	});

	it('returns error when fields are missing', async () => {
		const res = await POST(makeEvent({ gameID: GAME_ID, relationshipSelectorID: SELECTOR_ID }));
		const body = await res.json();
		expect(body.success).toBe(false);
		expect(body.message).toMatch(/missing/i);
	});

	it('returns error when not an editor', async () => {
		const { isEditor } = await import('$lib/permissions');
		vi.mocked(isEditor).mockReturnValueOnce(false);
		const res = await POST(
			makeEvent({
				gameID: GAME_ID,
				relationshipSelectorID: SELECTOR_ID,
				relationshipID: REL_ID,
				tupleUserIDs: GROUP_A
			})
		);
		const body = await res.json();
		expect(body.success).toBe(false);
		expect(body.message).toMatch(/permission/i);
	});

	it('deletes only the targeted group and keeps other groups intact', async () => {
		const res = await POST(
			makeEvent({
				gameID: GAME_ID,
				relationshipSelectorID: SELECTOR_ID,
				relationshipID: REL_ID,
				tupleUserIDs: GROUP_A
			})
		);
		const body = await res.json();
		expect(body.success).toBe(true);
		expect(body.updated).toBe(2);

		const bob = assignmentDocs.find((d) => d.id === 'doc-bob')!;
		const steve = assignmentDocs.find((d) => d.id === 'doc-steve')!;
		const karen = assignmentDocs.find((d) => d.id === 'doc-karen')!;
		const sarah = assignmentDocs.find((d) => d.id === 'doc-sarah')!;
		const other = assignmentDocs.find((d) => d.id === 'doc-other')!;

		expect(bob.update).toHaveBeenCalledOnce();
		expect(steve.update).toHaveBeenCalledOnce();
		expect(karen.update).not.toHaveBeenCalled();
		expect(sarah.update).not.toHaveBeenCalled();
		expect(other.update).not.toHaveBeenCalled();

		const bobPayload = bob.update.mock.calls[0][0] as Record<string, unknown>;
		const stevePayload = steve.update.mock.calls[0][0] as Record<string, unknown>;
		expect(Object.keys(bobPayload)).toEqual(['assignedRelationships']);
		expect(Object.keys(stevePayload)).toEqual(['assignedRelationships']);
		expect((bobPayload.assignedRelationships as unknown[]).length).toBe(0);
		expect((stevePayload.assignedRelationships as unknown[]).length).toBe(0);
	});
});
