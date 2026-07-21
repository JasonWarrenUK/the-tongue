import type { Edge } from "../../src/lib/engine/types";

// Branch 0 owns region 0 (single-region leaf), regions 1-4 owned by other leaf branches.
// Region 5 is unowned (free territory) for the "no border edges" case.

const e = (a: number, b: number, passable: boolean, name: Edge["name"]): Edge =>
  ({ a, b, passable, cost: passable ? 1 : 3, name });

// All border edges passable — fully open branch.
export const openBorder = {
  edges: [e(0, 1, true, "plain"), e(0, 2, true, "hill")] as Edge[],
  owner: { 0: 0, 1: 1, 2: 2 },
};

// All border edges impassable — fully walled branch.
export const walledBorder = {
  edges: [e(0, 1, false, "mountain"), e(0, 2, false, "water")] as Edge[],
  owner: { 0: 0, 1: 1, 2: 2 },
};

// All border edges impassable AND all internal edges impassable — fully isolated
// on both signals, the only configuration that reaches isolationScore ~1.
export const fullyWalled = {
  edges: [
    e(0, 1, false, "mountain"), // border, impassable
    e(0, 3, false, "water"),    // internal, impassable
  ] as Edge[],
  owner: { 0: 0, 1: 1, 3: 0 },
};

// No border edges at all (isolated interior region, no neighbours) — neutral.
export const noBorder = {
  edges: [e(1, 2, true, "plain")] as Edge[], // unrelated edge, region 0 has none
  owner: { 0: 0, 1: 1, 2: 2 },
};

// Mixed: one passable + one impassable border edge, plus internal impassable terrain.
// Branch 0 owns regions 0 and 3, linked internally by an impassable edge.
export const mixed = {
  edges: [
    e(0, 1, true, "plain"),      // border, passable
    e(0, 2, false, "mountain"),  // border, impassable
    e(0, 3, false, "water"),     // internal, impassable (both endpoints owned by branch 0)
  ] as Edge[],
  owner: { 0: 0, 1: 1, 2: 2, 3: 0 },
};

// Dominant terrain: plurality with a tie broken toward the more impassable terrain.
export const terrainTie = {
  edges: [e(0, 1, true, "hill"), e(0, 2, false, "mountain")] as Edge[],
  owner: { 0: 0, 1: 1, 2: 2 },
};

export const terrainPlurality = {
  edges: [e(0, 1, true, "plain"), e(0, 2, true, "plain"), e(0, 3, false, "mountain")] as Edge[],
  owner: { 0: 0, 1: 1, 2: 2, 3: 3 },
};

// pairContact fixtures (2GEO.5) —branch 0's entire border is with branch 1.
export const wholeBorderOneNeighbour = {
  edges: [e(0, 1, true, "plain"), e(0, 4, true, "plain")] as Edge[],
  owner: { 0: 0, 1: 1, 4: 1 },
};

// Branch 0 borders branch 1 on one of several passable edges (a sliver of a wide
// frontier); branches 2 and 3 make up the rest of branch 0's border.
export const slivBorderOneNeighbour = {
  edges: [e(0, 1, true, "plain"), e(0, 2, true, "plain"), e(0, 3, true, "plain"), e(0, 4, true, "plain")] as Edge[],
  owner: { 0: 0, 1: 1, 2: 2, 3: 2, 4: 2 },
};

// Asymmetric border sizes: branch 0 (small) borders branch 1 (large) on its only edge,
// so contact(0,1) = 1; branch 1 has many other neighbours too, so contact(1,0) is small.
export const asymmetricBorder = {
  edges: [e(0, 1, true, "plain"), e(1, 2, true, "plain"), e(1, 3, true, "plain"), e(1, 4, true, "plain")] as Edge[],
  owner: { 0: 0, 1: 1, 2: 2, 3: 3, 4: 4 },
};
