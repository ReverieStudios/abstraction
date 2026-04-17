/**
 * Capacitated Rank-Maximal Matching
 *
 * Based on the algorithm described in:
 *   Katarzyna E. Paluch, "Capacitated Rank-Maximal Matchings"
 *   8th International Conference on Algorithms and Complexity (CIAC 2013)
 *   Lecture Notes in Computer Science, vol. 7878, Springer, pp. 324–335
 *   DOI: 10.1007/978-3-642-38233-8_27
 */

type NodeId = string;

interface Edge {
  to: NodeId;
  rank: number;
}

export interface Match {
  applicant: NodeId;
  post: NodeId;
}

export class CapacitatedRankMaximalMatcher {
  private applicants = new Set<NodeId>();
  private posts = new Set<NodeId>();
  private capacities = new Map<NodeId, number>();
  private adj = new Map<NodeId, Edge[]>();
  private originalAdj = new Map<NodeId, Edge[]>(); // Unpruned, used by fillTuples
  private currentMatching = new Set<Match>();
  private usedCapacity = new Map<NodeId, number>();
  private matchIndex = new Map<string, Match>(); // Key: `${applicant}|${post}`

  addNode(id: NodeId, isPost: boolean, capacity: number) {
    if (isPost) this.posts.add(id);
    else this.applicants.add(id);
    this.capacities.set(id, capacity);
    this.adj.set(id, []);
    this.originalAdj.set(id, []);
  }

  addEdge(u: NodeId, v: NodeId, rank: number) {
    this.adj.get(u)!.push({ to: v, rank });
    this.adj.get(v)!.push({ to: u, rank });
    this.originalAdj.get(u)!.push({ to: v, rank });
    this.originalAdj.get(v)!.push({ to: u, rank });
  }

  private getUsedCapacity(node: NodeId): number {
    return this.usedCapacity.get(node) ?? 0;
  }

  private addMatch(applicant: NodeId, post: NodeId) {
    const match: Match = { applicant, post };
    this.currentMatching.add(match);
    this.matchIndex.set(`${applicant}|${post}`, match);
    this.usedCapacity.set(applicant, (this.usedCapacity.get(applicant) ?? 0) + 1);
    this.usedCapacity.set(post, (this.usedCapacity.get(post) ?? 0) + 1);
    return match;
  }

  private removeMatch(match: Match) {
    this.currentMatching.delete(match);
    this.matchIndex.delete(`${match.applicant}|${match.post}`);
    this.usedCapacity.set(match.applicant, (this.usedCapacity.get(match.applicant) ?? 0) - 1);
    this.usedCapacity.set(match.post, (this.usedCapacity.get(match.post) ?? 0) - 1);
  }

  private findMatch(applicant: NodeId, post: NodeId): Match | undefined {
    return this.matchIndex.get(`${applicant}|${post}`);
  }

  /**
   * Standard b-matching augmentation using Edmonds-Karp.
   */
  augmentMatching(rankLimit: number) {
    while (true) {
      const parent = new Map<NodeId, NodeId>();
      const queue: NodeId[] = [];
      let sinkReached: NodeId | null = null;

      // BFS starts from any applicant who hasn't reached capacity
      for (const a of this.applicants) {
        if (this.getUsedCapacity(a) < (this.capacities.get(a) || 0)) {
          queue.push(a);
          parent.set(a, "SOURCE");
        }
      }

      while (queue.length > 0 && !sinkReached) {
        const u = queue.shift()!;
        if (this.applicants.has(u)) {
          // Applicant -> Post: Check all available edges up to current rank
          for (const edge of this.adj.get(u)!) {
            const v = edge.to;
            if (edge.rank <= rankLimit && !this.findMatch(u, v)) {
              if (!parent.has(v)) {
                parent.set(v, u);
                if (this.getUsedCapacity(v) < (this.capacities.get(v) || 0)) {
                  sinkReached = v;
                  break;
                }
                queue.push(v);
              }
            }
          }
        } else {
          // Post -> Applicant: Must follow a currently matched edge (residual graph)
          for (const edge of this.adj.get(u)!) {
            const v = edge.to;
            if (this.findMatch(v, u) && !parent.has(v)) {
              parent.set(v, u);
              queue.push(v);
            }
          }
        }
      }

      if (!sinkReached) break;

      // Augment path in currentMatching
      let curr = sinkReached;
      while (curr !== "SOURCE") {
        const prev = parent.get(curr)!;
        if (prev !== "SOURCE") {
          const [applicant, post] = this.applicants.has(prev) ? [prev, curr] : [curr, prev];
          const existing = this.findMatch(applicant, post);
          if (existing) this.removeMatch(existing);
          else this.addMatch(applicant, post);
        }
        curr = prev;
      }
    }
  }

  decompose(rankLimit: number) {
    const E = new Set<NodeId>(), O = new Set<NodeId>(), U = new Set<NodeId>();
    const queue: [NodeId, number][] = [];
    const visited = new Set<NodeId>();

    // Saturated nodes logic for Gallai-Edmonds
    for (const node of [...this.applicants, ...this.posts]) {
      if (this.getUsedCapacity(node) < (this.capacities.get(node) || 0)) {
        E.add(node);
        visited.add(node);
        queue.push([node, 0]);
      }
    }

    while (queue.length > 0) {
      const [u, dist] = queue.shift()!;
      for (const edge of this.adj.get(u)!) {
        if (edge.rank <= rankLimit) {
          const v = edge.to;
          if (dist % 2 === 0) { // Forward to any reachable node
            if (!visited.has(v)) {
              visited.add(v); O.add(v); queue.push([v, dist + 1]);
            }
          } else { // Backward only via matched edge
            const [applicant, post] = this.applicants.has(u) ? [u, v] : [v, u];
            if (!visited.has(v) && this.findMatch(applicant, post)) {
              visited.add(v); E.add(v); queue.push([v, dist + 1]);
            }
          }
        }
      }
    }

    for (const node of [...this.applicants, ...this.posts]) if (!visited.has(node)) U.add(node);
    return { E, O, U };
  }

  solve(maxRank: number) {
    this.currentMatching.clear();
    this.usedCapacity.clear();
    this.matchIndex.clear();
    for (let r = 1; r <= maxRank; r++) {
      this.augmentMatching(r);
      const { E, O, U } = this.decompose(r);

      // Pruning
      for (const node of this.adj.keys()) {
        this.adj.set(node, this.adj.get(node)!.filter(edge => {
          const v = edge.to;
          if (edge.rank > r && (O.has(node) || O.has(v) || U.has(node) || U.has(v))) return false;
          if ((O.has(node) && (O.has(v) || U.has(v))) || (U.has(node) && O.has(v))) return false;
          return true;
        }));
      }
    }
    return this.currentMatching;
  }

  /**
   * After solve(), fills each post's applicant list up to the nearest multiple
   * of that post's tuple size by greedily adding the unmatched applicants who
   * ranked the post highest.
   *
   * Returns a new Map<postId, NodeId[]> of the complete (possibly over-capacity)
   * rosters per post. Posts that already divide evenly are included unchanged.
   *
   * @param matching - the Set<Match> returned by solve()
   * @param tupleSizes - per-post tuple size (defaults to 2 for any post not listed)
   */
  fillTuples(matching: Set<Match>, tupleSizes: Map<NodeId, number> = new Map()): Map<NodeId, NodeId[]> {
    // Build initial rosters from the matching
    const rosters = new Map<NodeId, NodeId[]>();
    for (const post of this.posts) rosters.set(post, []);
    for (const { applicant, post } of matching) rosters.get(post)!.push(applicant);

    // Build a lookup: post -> sorted list of (applicant, rank) for unmatched applicants
    // adj stores edges on both sides, so we read from each post's adjacency list
    for (const post of this.posts) {
      const tupleSize = tupleSizes.get(post) ?? 2;
      const roster = rosters.get(post)!;
      const remainder = roster.length % tupleSize;
      if (remainder === 0) continue;

      const needed = tupleSize - remainder;

      // Collect unmatched applicants who have an edge to this post, sorted by rank (ascending)
      const candidates: { applicant: NodeId; rank: number }[] = [];
      for (const edge of this.originalAdj.get(post) ?? []) {
        const applicant = edge.to;
        if (!this.applicants.has(applicant)) continue; // skip post-side neighbours
        if (roster.includes(applicant)) continue;      // already assigned
        candidates.push({ applicant, rank: edge.rank });
      }
      candidates.sort((a, b) => a.rank - b.rank);

      for (let i = 0; i < needed && i < candidates.length; i++) {
        roster.push(candidates[i].applicant);
      }
    }

    return rosters;
  }
}
