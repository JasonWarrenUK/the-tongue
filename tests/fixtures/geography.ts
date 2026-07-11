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
