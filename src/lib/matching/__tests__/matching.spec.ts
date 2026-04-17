import { describe, it, expect } from 'vitest';
import { CapacitatedRankMaximalMatcher, type Match } from '../matching';

const hasMatch = (result: Set<Match>, applicant: string, post: string) =>
  Array.from(result).some(m => m.applicant === applicant && m.post === post);

describe('CapacitatedRankMaximalMatcher', () => {
  describe('basic matching', () => {
    it('matches a single applicant to their only post', () => {
      const m = new CapacitatedRankMaximalMatcher();
      m.addNode('A1', false, 1);
      m.addNode('P1', true, 1);
      m.addEdge('A1', 'P1', 1);

      const result = m.solve(1);
      expect(Array.from(result)).toEqual([{ applicant: 'A1', post: 'P1' }]);
    });

    it('returns an empty matching when there are no edges', () => {
      const m = new CapacitatedRankMaximalMatcher();
      m.addNode('A1', false, 1);
      m.addNode('P1', true, 1);

      const result = m.solve(1);
      expect(result.size).toBe(0);
    });

    it('returns an empty matching when there are no nodes', () => {
      const m = new CapacitatedRankMaximalMatcher();
      const result = m.solve(1);
      expect(result.size).toBe(0);
    });
  });

  describe('rank maximality', () => {
    it('prefers rank-1 matches over rank-2 matches', () => {
      // A1 can match P1 (rank 1) or P2 (rank 2). Should choose P1.
      const m = new CapacitatedRankMaximalMatcher();
      m.addNode('A1', false, 1);
      m.addNode('P1', true, 1);
      m.addNode('P2', true, 1);
      m.addEdge('A1', 'P1', 1);
      m.addEdge('A1', 'P2', 2);

      const result = m.solve(2);
      expect(hasMatch(result, 'A1', 'P1')).toBe(true);
      expect(hasMatch(result, 'A1', 'P2')).toBe(false);
    });

    it('falls back to rank-2 match when rank-1 post is unavailable', () => {
      // A1 and A2 both want P1 (rank 1). A2 gets P1; A1 should fall back to P2 (rank 2).
      const m = new CapacitatedRankMaximalMatcher();
      m.addNode('A1', false, 1);
      m.addNode('A2', false, 1);
      m.addNode('P1', true, 1);
      m.addNode('P2', true, 1);
      m.addEdge('A1', 'P1', 1);
      m.addEdge('A1', 'P2', 2);
      m.addEdge('A2', 'P1', 1);

      const result = m.solve(2);
      expect(result.size).toBe(2);
      expect(hasMatch(result, 'A2', 'P1')).toBe(true);
      expect(hasMatch(result, 'A1', 'P2')).toBe(true);
    });

    it('maximises the number of rank-1 matches before assigning rank-2', () => {
      // Both A1 and A2 have rank-1 edges. Both should be matched at rank 1.
      const m = new CapacitatedRankMaximalMatcher();
      m.addNode('A1', false, 1);
      m.addNode('A2', false, 1);
      m.addNode('P1', true, 1);
      m.addNode('P2', true, 1);
      m.addEdge('A1', 'P1', 1);
      m.addEdge('A2', 'P2', 1);
      m.addEdge('A1', 'P2', 2);

      const result = m.solve(2);
      expect(hasMatch(result, 'A1', 'P1')).toBe(true);
      expect(hasMatch(result, 'A2', 'P2')).toBe(true);
      expect(result.size).toBe(2);
    });
  });

  describe('capacity constraints', () => {
    it('respects applicant capacity of 1', () => {
      const m = new CapacitatedRankMaximalMatcher();
      m.addNode('A1', false, 1);
      m.addNode('P1', true, 1);
      m.addNode('P2', true, 1);
      m.addEdge('A1', 'P1', 1);
      m.addEdge('A1', 'P2', 1);

      const result = m.solve(1);
      expect(result.size).toBe(1);
    });

    it('respects post capacity of 1', () => {
      const m = new CapacitatedRankMaximalMatcher();
      m.addNode('A1', false, 1);
      m.addNode('A2', false, 1);
      m.addNode('P1', true, 1);
      m.addEdge('A1', 'P1', 1);
      m.addEdge('A2', 'P1', 1);

      const result = m.solve(1);
      expect(result.size).toBe(1);
    });

    it('fills capacity=2 nodes with multiple matches', () => {
      // With capacity 2, A1 should match both P1 and P2; A2 also matches P1.
      const m = new CapacitatedRankMaximalMatcher();
      m.addNode('A1', false, 2);
      m.addNode('A2', false, 2);
      m.addNode('P1', true, 2);
      m.addNode('P2', true, 2);
      m.addEdge('A1', 'P1', 1);
      m.addEdge('A1', 'P2', 2);
      m.addEdge('A2', 'P1', 1);

      const result = m.solve(2);
      expect(result.size).toBe(3);
      expect(hasMatch(result, 'A1', 'P1')).toBe(true);
      expect(hasMatch(result, 'A1', 'P2')).toBe(true);
      expect(hasMatch(result, 'A2', 'P1')).toBe(true);
    });

    it('does not exceed capacity even when more edges are available', () => {
      const m = new CapacitatedRankMaximalMatcher();
      m.addNode('A1', false, 1);
      m.addNode('P1', true, 2);
      m.addNode('P2', true, 2);
      m.addNode('P3', true, 2);
      m.addEdge('A1', 'P1', 1);
      m.addEdge('A1', 'P2', 1);
      m.addEdge('A1', 'P3', 1);

      const result = m.solve(1);
      expect(result.size).toBe(1);
    });
  });

  describe('solve is idempotent', () => {
    it('returns the same result when called twice on the same instance', () => {
      const m = new CapacitatedRankMaximalMatcher();
      m.addNode('A1', false, 1);
      m.addNode('A2', false, 1);
      m.addNode('P1', true, 1);
      m.addNode('P2', true, 1);
      m.addEdge('A1', 'P1', 1);
      m.addEdge('A1', 'P2', 2);
      m.addEdge('A2', 'P1', 1);

      const first = Array.from(m.solve(2)).map(m => `${m.applicant}|${m.post}`).sort();
      const second = Array.from(m.solve(2)).map(m => `${m.applicant}|${m.post}`).sort();
      expect(first).toEqual(second);
    });
  });

  describe('Gallai-Edmonds decomposition (E, O, U nodes)', () => {
    it('U nodes: two isolated matched pairs — rank-2 cross-edges between them are pruned', () => {
      // After round 1: A1-P1 and A2-P2 are both saturated with no alternating
      // path between them, so all four nodes land in U. The rank-2 cross-edges
      // (A1->P2, A2->P1) must be pruned (U-U), so the final matching is
      // unchanged: A1-P1 and A2-P2, not some rank-2 reassignment.
      const m = new CapacitatedRankMaximalMatcher();
      m.addNode('A1', false, 1); m.addNode('A2', false, 1);
      m.addNode('P1', true, 1);  m.addNode('P2', true, 1);
      m.addEdge('A1', 'P1', 1);
      m.addEdge('A2', 'P2', 1);
      m.addEdge('A1', 'P2', 2); // cross-edge — should be pruned
      m.addEdge('A2', 'P1', 2); // cross-edge — should be pruned

      const result = m.solve(2);
      expect(result.size).toBe(2);
      expect(hasMatch(result, 'A1', 'P1')).toBe(true);
      expect(hasMatch(result, 'A2', 'P2')).toBe(true);
    });

    it('mixed E+O+U: isolated matched pair (U) coexists with a contested pair (E/O)', () => {
      // A3-P3 is an isolated matched pair → U after round 1.
      // A1 and A2 both want P1 (rank 1); A1 also has a rank-2 fallback to P2.
      // → P1 is O, A1/A2/P2 are E after round 1. A3/P3 are U.
      // Round 2: A2 bumps A1 off P1; A1 falls back to P2.
      // The U pair (A3-P3) is unaffected throughout.
      const m = new CapacitatedRankMaximalMatcher();
      m.addNode('A1', false, 1); m.addNode('A2', false, 1); m.addNode('A3', false, 1);
      m.addNode('P1', true, 1);  m.addNode('P2', true, 1);  m.addNode('P3', true, 1);
      m.addEdge('A1', 'P1', 1);
      m.addEdge('A1', 'P2', 2);
      m.addEdge('A2', 'P1', 1);
      m.addEdge('A3', 'P3', 1); // isolated pair → U

      const result = m.solve(2);
      expect(result.size).toBe(3);
      expect(hasMatch(result, 'A2', 'P1')).toBe(true);
      expect(hasMatch(result, 'A1', 'P2')).toBe(true);
      expect(hasMatch(result, 'A3', 'P3')).toBe(true);
    });

    it('pruning correctness: O-node rank-2 edge is pruned, preserving a rank-1 match for another applicant', () => {
      // After round 1: A1-P1 matched. A2 is unsaturated (E); P2 is reachable
      // from A2 via no edges yet, but A1->P2 is rank-2 and P2 is in O
      // (reachable from unsaturated A2 via... actually P2 has no rank-1 edge
      // from A2, so let's use: A2->P2 rank-1 exists, making P2 reachable=O).
      // The A1->P2 rank-2 edge touches O node P2 → pruned.
      // Round 2: A2 gets P2 via its rank-1 edge. Result: 2 rank-1 matches.
      // Without pruning, A1 could greedily take P2 at rank-2, blocking A2.
      const m = new CapacitatedRankMaximalMatcher();
      m.addNode('A1', false, 1); m.addNode('A2', false, 1);
      m.addNode('P1', true, 1);  m.addNode('P2', true, 1);
      m.addEdge('A1', 'P1', 1);
      m.addEdge('A1', 'P2', 2); // rank-2 edge to an O node — should be pruned
      m.addEdge('A2', 'P2', 1); // A2's rank-1 preference

      const result = m.solve(2);
      expect(result.size).toBe(2);
      expect(hasMatch(result, 'A1', 'P1')).toBe(true);
      expect(hasMatch(result, 'A2', 'P2')).toBe(true);
      // If pruning were absent, A1 might take P2 at rank-2 and A2 gets nothing
      expect(hasMatch(result, 'A1', 'P2')).toBe(false);
    });
  });

  describe('larger inputs', () => {
    it('10 applicants, 5 posts (cap 2), 3 ranks — all applicants get their rank-1 or rank-2 post', () => {
      // 5 posts × capacity 2 = exactly 10 slots for 10 applicants.
      // Each applicant has a clear rank-1 preference, a rank-2 fallback, and a
      // rank-3 last resort. The graph is designed so every applicant can be
      // satisfied at rank 1 or rank 2 without conflict, and rank-3 edges are
      // never needed.
      //
      // Assignments:
      //   A1  → P1 (r1), P2 (r2), P3 (r3)
      //   A2  → P1 (r1), P3 (r2), P4 (r3)
      //   A3  → P2 (r1), P1 (r2), P3 (r3)
      //   A4  → P2 (r1), P4 (r2), P5 (r3)
      //   A5  → P3 (r1), P2 (r2), P1 (r3)
      //   A6  → P3 (r1), P5 (r2), P4 (r3)
      //   A7  → P4 (r1), P3 (r2), P2 (r3)
      //   A8  → P4 (r1), P1 (r2), P5 (r3)
      //   A9  → P5 (r1), P4 (r2), P3 (r3)
      //   A10 → P5 (r1), P2 (r2), P1 (r3)
      //
      // Each post appears as rank-1 exactly twice → all 10 rank-1 slots filled.
      // Every applicant should land their rank-1 match.
      const m = new CapacitatedRankMaximalMatcher();

      ['A1','A2','A3','A4','A5','A6','A7','A8','A9','A10'].forEach(a => m.addNode(a, false, 1));
      ['P1','P2','P3','P4','P5'].forEach(p => m.addNode(p, true, 2));

      m.addEdge('A1',  'P1', 1); m.addEdge('A1',  'P2', 2); m.addEdge('A1',  'P3', 3);
      m.addEdge('A2',  'P1', 1); m.addEdge('A2',  'P3', 2); m.addEdge('A2',  'P4', 3);
      m.addEdge('A3',  'P2', 1); m.addEdge('A3',  'P1', 2); m.addEdge('A3',  'P3', 3);
      m.addEdge('A4',  'P2', 1); m.addEdge('A4',  'P4', 2); m.addEdge('A4',  'P5', 3);
      m.addEdge('A5',  'P3', 1); m.addEdge('A5',  'P2', 2); m.addEdge('A5',  'P1', 3);
      m.addEdge('A6',  'P3', 1); m.addEdge('A6',  'P5', 2); m.addEdge('A6',  'P4', 3);
      m.addEdge('A7',  'P4', 1); m.addEdge('A7',  'P3', 2); m.addEdge('A7',  'P2', 3);
      m.addEdge('A8',  'P4', 1); m.addEdge('A8',  'P1', 2); m.addEdge('A8',  'P5', 3);
      m.addEdge('A9',  'P5', 1); m.addEdge('A9',  'P4', 2); m.addEdge('A9',  'P3', 3);
      m.addEdge('A10', 'P5', 1); m.addEdge('A10', 'P2', 2); m.addEdge('A10', 'P1', 3);

      const result = m.solve(3);

      expect(result.size).toBe(10);

      // Every applicant is matched at rank 1
      expect(hasMatch(result, 'A1',  'P1')).toBe(true);
      expect(hasMatch(result, 'A2',  'P1')).toBe(true);
      expect(hasMatch(result, 'A3',  'P2')).toBe(true);
      expect(hasMatch(result, 'A4',  'P2')).toBe(true);
      expect(hasMatch(result, 'A5',  'P3')).toBe(true);
      expect(hasMatch(result, 'A6',  'P3')).toBe(true);
      expect(hasMatch(result, 'A7',  'P4')).toBe(true);
      expect(hasMatch(result, 'A8',  'P4')).toBe(true);
      expect(hasMatch(result, 'A9',  'P5')).toBe(true);
      expect(hasMatch(result, 'A10', 'P5')).toBe(true);

      // No rank-3 edges used
      expect(hasMatch(result, 'A1',  'P3')).toBe(false);
      expect(hasMatch(result, 'A2',  'P4')).toBe(false);
      expect(hasMatch(result, 'A4',  'P5')).toBe(false);
    });
  });

  describe('fillTuples', () => {
    it('returns rosters unchanged when all posts already divide evenly', () => {
      // P1 has 2 applicants, tuple size 2 — no fill needed
      const m = new CapacitatedRankMaximalMatcher();
      m.addNode('A1', false, 1); m.addNode('A2', false, 1);
      m.addNode('P1', true, 2);
      m.addEdge('A1', 'P1', 1);
      m.addEdge('A2', 'P1', 1);

      const matching = m.solve(1);
      const rosters = m.fillTuples(matching, new Map([['P1', 2]]));

      expect(rosters.get('P1')!.length).toBe(2);
    });

    it('fills a post that has 1 applicant up to the nearest multiple of tuple size 2', () => {
      // P1 matched to A1 only (1 applicant). A2 ranked P1 rank-2 and was not matched.
      // fillTuples should add A2 to P1's roster to reach 2.
      const m = new CapacitatedRankMaximalMatcher();
      m.addNode('A1', false, 1); m.addNode('A2', false, 1);
      m.addNode('P1', true, 1);  m.addNode('P2', true, 1);
      m.addEdge('A1', 'P1', 1);
      m.addEdge('A2', 'P2', 1); // A2 gets P2, not P1
      m.addEdge('A2', 'P1', 2); // A2's rank-2 fallback — used as fill candidate

      const matching = m.solve(2);
      // matching: A1→P1, A2→P2
      expect(matching.size).toBe(2);

      const rosters = m.fillTuples(matching, new Map([['P1', 2], ['P2', 2]]));

      // P1 has 1 matched applicant; needs 1 fill → A2 is the best candidate (rank-2)
      expect(rosters.get('P1')!).toContain('A1');
      expect(rosters.get('P1')!).toContain('A2');
      expect(rosters.get('P1')!.length).toBe(2);

      // P2 already has 1 matched applicant and tuple size 2, needs 1 fill
      // A1 ranked P2? No — only A2 has P2. So P2 stays at 1 (no candidates).
      expect(rosters.get('P2')!).toContain('A2');
    });

    it('prefers the highest-ranking (lowest rank number) unmatched candidate when filling', () => {
      // P1 has 1 matched applicant (A1). Candidates: A2 (rank-1 to P1), A3 (rank-2 to P1).
      // A2 should be picked first as the better-ranking candidate.
      const m = new CapacitatedRankMaximalMatcher();
      m.addNode('A1', false, 1); m.addNode('A2', false, 1); m.addNode('A3', false, 1);
      m.addNode('P1', true, 1);  m.addNode('P2', true, 1);  m.addNode('P3', true, 1);
      m.addEdge('A1', 'P1', 1);
      m.addEdge('A2', 'P2', 1); m.addEdge('A2', 'P1', 1); // A2 ranks P1 at rank-1
      m.addEdge('A3', 'P3', 1); m.addEdge('A3', 'P1', 2); // A3 ranks P1 at rank-2

      const matching = m.solve(2);
      // A1→P1, A2→P2 or A2→P1 depending on BFS order — either way P1 gets 1 match
      const p1Roster = Array.from(matching).filter(m => m.post === 'P1').map(m => m.applicant);
      expect(p1Roster.length).toBe(1);

      const rosters = m.fillTuples(matching, new Map([['P1', 2]]));
      const filled = rosters.get('P1')!;
      expect(filled.length).toBe(2);

      // The fill candidate must be the one with the lower rank number for P1
      const fillCandidate = filled.find(a => !p1Roster.includes(a))!;
      const fillCandidateRank = fillCandidate === 'A2' ? 1 : 2;
      const otherCandidateRank = fillCandidate === 'A2' ? 2 : 1;
      expect(fillCandidateRank).toBeLessThan(otherCandidateRank);
    });

    it('fills up to tuple size 3 when needed', () => {
      // P1 matched to 2 applicants, tuple size 3 → needs 1 fill
      const m = new CapacitatedRankMaximalMatcher();
      m.addNode('A1', false, 1); m.addNode('A2', false, 1); m.addNode('A3', false, 1);
      m.addNode('P1', true, 2);  m.addNode('P2', true, 1);
      m.addEdge('A1', 'P1', 1);
      m.addEdge('A2', 'P1', 1);
      m.addEdge('A3', 'P2', 1); m.addEdge('A3', 'P1', 2); // A3 is fill candidate for P1

      const matching = m.solve(1);
      expect(Array.from(matching).filter(m => m.post === 'P1').length).toBe(2);

      const rosters = m.fillTuples(matching, new Map([['P1', 3]]));
      expect(rosters.get('P1')!.length).toBe(3);
      expect(rosters.get('P1')!).toContain('A3');
    });

    it('does not add fill candidates who have no edge to the post', () => {
      // P1 has 1 applicant. A2 has no edge to P1 at all — should not be added.
      const m = new CapacitatedRankMaximalMatcher();
      m.addNode('A1', false, 1); m.addNode('A2', false, 1);
      m.addNode('P1', true, 1);  m.addNode('P2', true, 1);
      m.addEdge('A1', 'P1', 1);
      m.addEdge('A2', 'P2', 1); // A2 has no edge to P1

      const matching = m.solve(1);
      const rosters = m.fillTuples(matching, new Map([['P1', 2]]));

      // No valid fill candidate exists for P1 — roster stays at 1
      expect(rosters.get('P1')!.length).toBe(1);
      expect(rosters.get('P1')!).not.toContain('A2');
    });

    it('does not mutate the original matching', () => {
      const m = new CapacitatedRankMaximalMatcher();
      m.addNode('A1', false, 1); m.addNode('A2', false, 1);
      m.addNode('P1', true, 1);  m.addNode('P2', true, 1);
      m.addEdge('A1', 'P1', 1);
      m.addEdge('A2', 'P2', 1);
      m.addEdge('A2', 'P1', 2);

      const matching = m.solve(2);
      const sizeBefore = matching.size;
      m.fillTuples(matching, new Map([['P1', 2]]));

      expect(matching.size).toBe(sizeBefore);
    });
  });

  describe('edge cases', () => {
    it('handles a single unmatched applicant with no available posts', () => {
      const m = new CapacitatedRankMaximalMatcher();
      m.addNode('A1', false, 1);
      m.addNode('P1', true, 0); // post has zero capacity
      m.addEdge('A1', 'P1', 1);

      const result = m.solve(1);
      expect(result.size).toBe(0);
    });

    it('handles disconnected applicants independently', () => {
      // A1-P1 and A2-P2 are independent pairs, both should be matched
      const m = new CapacitatedRankMaximalMatcher();
      m.addNode('A1', false, 1);
      m.addNode('A2', false, 1);    
      m.addNode('P1', true, 1);
      m.addNode('P2', true, 1);
      m.addEdge('A1', 'P1', 1);
      m.addEdge('A2', 'P2', 1);

      const result = m.solve(1);
      expect(result.size).toBe(2);
      expect(hasMatch(result, 'A1', 'P1')).toBe(true);
      expect(hasMatch(result, 'A2', 'P2')).toBe(true);
    });

    it('handles a maxRank of 1 correctly — only rank-1 edges are considered', () => {
      const m = new CapacitatedRankMaximalMatcher();
      m.addNode('A1', false, 1);
      m.addNode('P1', true, 1);
      m.addNode('P2', true, 1);
      m.addEdge('A1', 'P2', 2); // only rank-2 edge available

      const result = m.solve(1);
      expect(result.size).toBe(0);
    });
  });
});
