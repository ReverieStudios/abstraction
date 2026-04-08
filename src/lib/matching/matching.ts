type NodeId = string;

interface Edge {
  to: NodeId;
  rank: number;
}

class CapacitatedRankMaximalMatcher {
  private applicants = new Set<NodeId>();
  private posts = new Set<NodeId>();
  private capacities = new Map<NodeId, number>();
  private adj = new Map<NodeId, Edge[]>();
  private currentMatching = new Set<string>(); // Persists across rank iterations

  addNode(id: NodeId, isPost: boolean, capacity: number) {
    if (isPost) this.posts.add(id);
    else this.applicants.add(id);
    this.capacities.set(id, capacity);
    this.adj.set(id, []);
  }

  addEdge(u: NodeId, v: NodeId, rank: number) {
    this.adj.get(u)!.push({ to: v, rank });
    this.adj.get(v)!.push({ to: u, rank });
  }

  private getUsedCapacity(node: NodeId, matching: Set<string>): number {
    let count = 0;
    for (const pair of matching) {
      if (pair.split('|').includes(node)) count++;
    }
    return count;
  }

  /**
   * Standard b-matching augmentation using Edmonds-Karp.
   * Crucially, it takes the EXISTING matching and tries to find new paths.
   */
  augmentMatching(rankLimit: number) {
    while (true) {
      const parent = new Map<NodeId, NodeId>();
      const queue: NodeId[] = [];
      let sinkReached: NodeId | null = null;

      // BFS starts from any applicant who hasn't reached capacity
      for (const a of this.applicants) {
        if (this.getUsedCapacity(a, this.currentMatching) < (this.capacities.get(a) || 0)) {
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
            const pair = `${u}|${v}`;
            if (edge.rank <= rankLimit && !this.currentMatching.has(pair)) {
              if (!parent.has(v)) {
                parent.set(v, u);
                if (this.getUsedCapacity(v, this.currentMatching) < (this.capacities.get(v) || 0)) {
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
            const pair = `${v}|${u}`;
            if (this.currentMatching.has(pair) && !parent.has(v)) {
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
          const pair = this.applicants.has(prev) ? `${prev}|${curr}` : `${curr}|${prev}`;
          if (this.currentMatching.has(pair)) this.currentMatching.delete(pair);
          else this.currentMatching.add(pair);
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
      if (this.getUsedCapacity(node, this.currentMatching) < (this.capacities.get(node) || 0)) {
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
            const pair = this.applicants.has(u) ? `${u}|${v}` : `${v}|${u}`;
            if (!visited.has(v) && this.currentMatching.has(pair)) {
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
}

// --- Test Case (Capacity 2) ---
const matcher = new CapacitatedRankMaximalMatcher();
matcher.addNode("A1", false, 1);
matcher.addNode("A2", false, 1);
matcher.addNode("P1", true, 1);
matcher.addNode("P2", true, 1);

matcher.addEdge("A1", "P1", 1);
matcher.addEdge("A1", "P2", 2);
matcher.addEdge("A2", "P1", 1);

console.log("Result:", Array.from(matcher.solve(2))); 
// Correct Output: ["A1|P1", "A2|P1", "A1|P2"]
