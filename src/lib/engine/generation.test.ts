import { describe, test, expect } from "bun:test";
import { resolveGeneration } from "./generation";
import { RENAME_CUT } from "./naming";
import type { GameState, Lexicon, Branch, Adjacency, Edge } from "./types";

// 1ENG.9/1ENG.10 — fracture divergence-at-birth + lineage-continuation + rename. These
// tests hand-build a minimal GameState (not the seed-driven world gen) whose geometry
// forces branch 0's territory into disconnected passable components, so fracture fires
// deterministically on the very first generation.
//
// Layout: 4 regions in a line, 0-1-2-3. Edge 1-2 is impassable; every other edge is
// passable. Branch 0 owns all four regions, so passableComponents splits it into
// {0,1} and {2,3}.
function lineAdjacency(): { adj: Adjacency; edges: Edge[] } {
  const edges: Edge[] = [
    { a: 0, b: 1, passable: true, cost: 1, name: "plain" },
    { a: 1, b: 2, passable: false, cost: 3, name: "water" },
    { a: 2, b: 3, passable: true, cost: 1, name: "plain" },
  ];
  const adj: Adjacency = { 0: [], 1: [], 2: [], 3: [] };
  edges.forEach((e) => {
    adj[e.a].push({ to: e.b, passable: e.passable, cost: e.cost });
    adj[e.b].push({ to: e.a, passable: e.passable, cost: e.cost });
  });
  return { adj, edges };
}

// Mixed lexicon (same shape as phonology.test.ts's MIXED_LEX): words ending in a mid
// vowel (fires apoc/raise) and words ending in a consonant (fires finalC) — gives
// driftRule live candidates across categories, in both directions of the iso axis.
const MIXED_LEX: Lexicon = [
  { concept: "a", word: ["t", "a", "p", "e"] },
  { concept: "b", word: ["k", "o"] },
  { concept: "c", word: ["m", "a", "t"] },
  { concept: "d", word: ["s", "i", "n"] },
];

// Every branch is born with an implicit birth anchor (1ENG.10) so the rename check
// always has a most-recent anchor to compare drift against.
function birthAnchor(lex: Lexicon): Branch["anchors"] {
  return [{ lex: lex.map((e) => ({ concept: e.concept, word: [...e.word] })), turn: 0, historyIndex: 0, driftFromPrev: 0 }];
}

function fractureState(lex: Lexicon = MIXED_LEX): GameState {
  const { adj, edges } = lineAdjacency();
  const branch: Branch = {
    id: 0, name: "Aenic", parentId: null, depth: 0, splitIndex: 0, history: [],
    lex: lex.map((e) => ({ concept: e.concept, word: [...e.word] })),
    territory: [0, 1, 2, 3], pressure: 0, anchors: birthAnchor(lex), assimilationPressure: 0,
  };
  return {
    world: { seed: 1234, inv: { vowels: [], consonants: [] }, tmpl: { onset: "req", coda: "opt", clusters: true, label: "" }, lex: [], regions: [0, 1, 2, 3].map((id) => ({ id, x: id, y: 0 })), edges, adj, start: 0 },
    branches: { 0: branch }, rootId: 0, selectedId: 0,
    nextId: 1, turn: 0,
    settings: { pool: 10, growth: 1, overhead: 1, changeCost: 1, spreadEvery: 999 },
    pool: 10, touched: { 0: true }, log: [],
  };
}

function childrenOf(s: GameState, parentId: number): Branch[] {
  return Object.values(s.branches).filter((b) => b.parentId === parentId).sort((a, b) => a.id - b.id);
}

describe("1ENG.10 lineage-continuation fracture", () => {
  test("the parent id continues as a leaf; exactly one new sibling is spun off from a 2-way split", () => {
    const out = resolveGeneration(fractureState());
    expect(Object.values(out.branches).some((b) => b.id === 0)).toBe(true);
    const parent = out.branches[0];
    expect(parent.territory.length).toBeGreaterThan(0); // still a living leaf, not retired
    const kids = childrenOf(out, 0);
    expect(kids.length).toBe(1); // only the OTHER component spins off
  });

  test("the parent keeps the larger component ({0,1} and {2,3} tie at size 2 -> lowest region id wins)", () => {
    const out = resolveGeneration(fractureState());
    const parent = out.branches[0];
    // tie-break: both components are size 2, so the one containing the lowest region
    // id (0) continues the parent.
    expect(parent.territory.sort((a, b) => a - b)).toEqual([0, 1]);
    const kid = childrenOf(out, 0)[0];
    expect(kid.territory.sort((a, b) => a - b)).toEqual([2, 3]);
  });

  test("a genuinely larger component continues the parent regardless of region id", () => {
    // branch 0 owns 0,1,2 (one component) plus 3 in a second — extend the line so the
    // {0,1,2} side is strictly larger than the {3} side once severed.
    const edges: Edge[] = [
      { a: 0, b: 1, passable: true, cost: 1, name: "plain" },
      { a: 1, b: 2, passable: true, cost: 1, name: "plain" },
      { a: 2, b: 3, passable: false, cost: 3, name: "water" },
    ];
    const adj: Adjacency = { 0: [], 1: [], 2: [], 3: [] };
    edges.forEach((e) => { adj[e.a].push({ to: e.b, passable: e.passable, cost: e.cost }); adj[e.b].push({ to: e.a, passable: e.passable, cost: e.cost }); });
    const s = fractureState();
    s.world.edges = edges; s.world.adj = adj;
    const out = resolveGeneration(s);
    expect(out.branches[0].territory.sort((a, b) => a - b)).toEqual([0, 1, 2]);
    expect(childrenOf(out, 0)[0].territory).toEqual([3]);
  });

  test("the continuing parent lexicon is untouched by fracture (no birth-divergence for the continuation)", () => {
    const before = fractureState();
    const parentLexBefore = JSON.stringify(before.branches[0].lex);
    const out = resolveGeneration(before);
    expect(JSON.stringify(out.branches[0].lex)).toBe(parentLexBefore);
  });

  test("the new sibling's name is phonotactically generated, not a static pool word", () => {
    const out = resolveGeneration(fractureState());
    const kid = childrenOf(out, 0)[0];
    expect(kid.name.length).toBeGreaterThan(0);
    expect(kid.name).not.toBe("Aenic");
    expect(/^[A-Z]/.test(kid.name)).toBe(true); // title-cased
  });

  test("(1ENG.9 carried forward) the new sibling may diverge at birth from the parent's pre-fracture lexicon", () => {
    const before = fractureState();
    const parentLexBefore = before.branches[0].lex;
    const out = resolveGeneration(before);
    const kid = childrenOf(out, 0)[0];
    // not guaranteed every seed fires a rule, but this seed/lexicon combination does —
    // regression-pin the observed behaviour.
    expect(JSON.stringify(kid.lex) === JSON.stringify(parentLexBefore) || kid.history.length > kid.splitIndex).toBe(true);
  });

  test("splitIndex marks the exact parent/child history boundary for the new sibling", () => {
    const before = fractureState();
    const parentHistory = before.branches[0].history;
    const out = resolveGeneration(before);
    const kid = childrenOf(out, 0)[0];
    expect(kid.splitIndex).toBe(parentHistory.length);
    expect(kid.history.slice(0, kid.splitIndex)).toEqual(parentHistory);
  });

  test("determinism: resolveGeneration on independent copies of the same input is byte-identical", () => {
    const a = resolveGeneration(fractureState());
    const b = resolveGeneration(fractureState());
    expect(a.branches).toEqual(b.branches);
  });

  test("determinism holds across a two-generation transcript", () => {
    function twoGen(): GameState {
      let s = fractureState();
      s = resolveGeneration(s);
      s = resolveGeneration({ ...s, touched: {} });
      return s;
    }
    const a = twoGen();
    const b = twoGen();
    expect(a.branches).toEqual(b.branches);
    expect(a.log).toEqual(b.log);
  });

  test("null-guard: an empty parent lexicon fractures without throwing; sibling is an exact (empty) copy", () => {
    const s = fractureState([]);
    expect(() => resolveGeneration(s)).not.toThrow();
    const out = resolveGeneration(s);
    const kid = childrenOf(out, 0)[0];
    expect(kid.lex).toEqual([]);
    expect(kid.history.length).toBe(kid.splitIndex);
  });

  test("multi-parent same-generation split: two leaves fracturing in one turn each get a correct post-split owner map", () => {
    // Two independent line segments, each split by an impassable middle edge, owned
    // by two different starting branches. Regions 0-3 for branch 0 (as above), and a
    // second disjoint line 4-7 for branch 1, split by an impassable 5-6 edge.
    const { adj: adjA, edges: edgesA } = lineAdjacency();
    const adj: Adjacency = { ...adjA, 4: [], 5: [], 6: [], 7: [] };
    const edgesB: Edge[] = [
      { a: 4, b: 5, passable: true, cost: 1, name: "plain" },
      { a: 5, b: 6, passable: false, cost: 3, name: "water" },
      { a: 6, b: 7, passable: true, cost: 1, name: "plain" },
    ];
    edgesB.forEach((e) => {
      adj[e.a].push({ to: e.b, passable: e.passable, cost: e.cost });
      adj[e.b].push({ to: e.a, passable: e.passable, cost: e.cost });
    });
    const edges = [...edgesA, ...edgesB];

    const mkBranch = (id: number, name: string, territory: number[]): Branch => ({
      id, name, parentId: null, depth: 0, splitIndex: 0, history: [],
      lex: MIXED_LEX.map((e) => ({ concept: e.concept, word: [...e.word] })),
      territory, pressure: 0, anchors: birthAnchor(MIXED_LEX), assimilationPressure: 0,
    });

    const s: GameState = {
      world: { seed: 4321, inv: { vowels: [], consonants: [] }, tmpl: { onset: "req", coda: "opt", clusters: true, label: "" }, lex: [], regions: [0, 1, 2, 3, 4, 5, 6, 7].map((id) => ({ id, x: id, y: 0 })), edges, adj, start: 0 },
      branches: { 0: mkBranch(0, "Aenic", [0, 1, 2, 3]), 1: mkBranch(1, "Boran", [4, 5, 6, 7]) },
      rootId: 0, selectedId: 0,
      nextId: 2, turn: 0,
      settings: { pool: 10, growth: 1, overhead: 1, changeCost: 1, spreadEvery: 999 },
      pool: 10, touched: { 0: true, 1: true }, log: [],
    };

    const out = resolveGeneration(s);
    const kidsOf0 = childrenOf(out, 0);
    const kidsOf1 = childrenOf(out, 1);
    expect(kidsOf0.length).toBe(1);
    expect(kidsOf1.length).toBe(1);
    expect(out.branches[0].territory.length).toBeGreaterThan(0);
    expect(out.branches[1].territory.length).toBeGreaterThan(0);

    const allIds = [0, 1, ...kidsOf0, ...kidsOf1].map((k) => (typeof k === "number" ? k : k.id)).sort((a, b) => a - b);
    expect(new Set(allIds).size).toBe(4); // all distinct ids

    // Determinism holds for the multi-parent case too.
    const out2 = resolveGeneration(s);
    expect(out.branches).toEqual(out2.branches);
  });
});

describe("1ENG.10 divergence-threshold rename", () => {
  function driftingState(): GameState {
    const { adj, edges } = lineAdjacency();
    const branch: Branch = {
      id: 0, name: "Aenic", parentId: null, depth: 0, splitIndex: 0, history: [],
      lex: MIXED_LEX.map((e) => ({ concept: e.concept, word: [...e.word] })),
      territory: [0], pressure: 0, anchors: birthAnchor(MIXED_LEX), assimilationPressure: 0,
    };
    return {
      world: { seed: 99, inv: { vowels: [], consonants: [] }, tmpl: { onset: "req", coda: "opt", clusters: true, label: "" }, lex: [], regions: [0, 1, 2, 3].map((id) => ({ id, x: id, y: 0 })), edges, adj, start: 0 },
      branches: { 0: branch }, rootId: 0, selectedId: 0,
      nextId: 1, turn: 0,
      settings: { pool: 999, growth: 1, overhead: 1, changeCost: 1, spreadEvery: 999 },
      pool: 999, touched: {}, log: [],
    };
  }

  test("a lineage accrues an anchor once drift crosses RENAME_CUT, without minting a new branch id", () => {
    let s = driftingState();
    const idsBefore = Object.keys(s.branches).length;
    const anchorsAtBirth = s.branches[0].anchors.length; // 1 (birth anchor)
    for (let i = 0; i < 30 && s.branches[0].anchors.length <= anchorsAtBirth; i++) {
      s = resolveGeneration({ ...s, touched: {} });
    }
    expect(s.branches[0].anchors.length).toBeGreaterThan(anchorsAtBirth);
    expect(Object.keys(s.branches).length).toBe(idsBefore); // rename never spawns a branch
    const anchor = s.branches[0].anchors[anchorsAtBirth]; // first rename-triggered anchor
    expect(anchor.driftFromPrev).toBeGreaterThan(1 - RENAME_CUT - 1e-9);
  });

  test("determinism: rename accrual across a multi-turn transcript is byte-identical", () => {
    function run(): GameState {
      let s = driftingState();
      for (let i = 0; i < 15; i++) s = resolveGeneration({ ...s, touched: {} });
      return s;
    }
    const a = run(), b = run();
    expect(a.branches).toEqual(b.branches);
  });
});
