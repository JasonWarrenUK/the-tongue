import { describe, test, expect } from "bun:test";
import { resolveGeneration } from "./generation";
import type { GameState, Lexicon, Branch, Adjacency, Edge } from "./types";

// 1ENG.9 — fracture divergence-at-birth. These tests hand-build a minimal GameState
// (not the seed-driven world gen) whose geometry forces branch 0's territory into two
// disconnected passable components, so section 3 (fracture) fires deterministically
// on the very first generation.
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

function fractureState(lex: Lexicon = MIXED_LEX): GameState {
  const { adj, edges } = lineAdjacency();
  const branch: Branch = {
    id: 0, name: "Aenic", parentId: null, depth: 0, splitIndex: 0, history: [],
    lex: lex.map((e) => ({ concept: e.concept, word: [...e.word] })),
    territory: [0, 1, 2, 3], pressure: 0,
  };
  return {
    world: { seed: 1234, inv: { vowels: [], consonants: [] }, tmpl: { onset: "req", coda: "opt", clusters: true, label: "" }, lex: [], regions: [0, 1, 2, 3].map((id) => ({ id, x: id, y: 0 })), edges, adj, start: 0 },
    branches: { 0: branch }, rootId: 0, selectedId: 0,
    nextId: 1, nameIdx: 0, turn: 0,
    settings: { pool: 10, growth: 1, overhead: 1, changeCost: 1, spreadEvery: 999 },
    pool: 10, touched: { 0: true }, log: [],
  };
}

function childrenOf(s: GameState, parentId: number): Branch[] {
  return Object.values(s.branches).filter((b) => b.parentId === parentId).sort((a, b) => a.id - b.id);
}

describe("1ENG.9 fracture divergence-at-birth", () => {
  test("fracture fires and produces exactly two children", () => {
    const out = resolveGeneration(fractureState());
    const kids = childrenOf(out, 0);
    expect(kids.length).toBe(2);
  });

  test("(a) at least one child's lexicon differs from the parent's pre-fracture lexicon", () => {
    const before = fractureState();
    const parentLexBefore = before.branches[0].lex;
    const out = resolveGeneration(before);
    const kids = childrenOf(out, 0);
    const anyDiffers = kids.some((k) => JSON.stringify(k.lex) !== JSON.stringify(parentLexBefore));
    expect(anyDiffers).toBe(true);
  });

  test("(b) siblings diverge from each other (distinct child ids -> distinct drift rolls)", () => {
    const out = resolveGeneration(fractureState());
    const kids = childrenOf(out, 0);
    expect(kids.length).toBe(2);
    expect(JSON.stringify(kids[0].lex)).not.toBe(JSON.stringify(kids[1].lex));
  });

  test("(c) determinism: resolveGeneration on independent copies of the same input is byte-identical", () => {
    const a = resolveGeneration(fractureState());
    const b = resolveGeneration(fractureState());
    expect(a.branches).toEqual(b.branches);
  });

  test("(c) determinism holds across a two-generation transcript", () => {
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

  test("(d) null-guard: an empty parent lexicon fractures into exact (empty) copies without throwing", () => {
    const s = fractureState([]);
    expect(() => resolveGeneration(s)).not.toThrow();
    const out = resolveGeneration(s);
    const kids = childrenOf(out, 0);
    expect(kids.length).toBe(2);
    kids.forEach((k) => {
      expect(k.lex).toEqual([]);
      expect(k.history.length).toBe(k.splitIndex);
    });
  });

  test("(e) splitIndex marks the exact parent/child history boundary", () => {
    const before = fractureState();
    const parentHistory = before.branches[0].history;
    const out = resolveGeneration(before);
    const kids = childrenOf(out, 0);
    kids.forEach((k) => {
      expect(k.splitIndex).toBe(parentHistory.length);
      expect(k.history.slice(0, k.splitIndex)).toEqual(parentHistory);
    });
  });

  test("(e) a rule-fired child appends exactly one birth-divergence history entry, flagged as drift", () => {
    const out = resolveGeneration(fractureState());
    const kids = childrenOf(out, 0);
    const fired = kids.filter((k) => k.history.length === k.splitIndex + 1);
    expect(fired.length).toBeGreaterThan(0);
    fired.forEach((k) => {
      const entry = k.history[k.splitIndex];
      expect(entry.drift).toBe(true);
      expect(entry.note.startsWith("at fracture:")).toBe(true);
    });
  });

  test("(f) multi-parent same-generation split: two leaves fracturing in one turn each get a correct post-split owner map", () => {
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
      territory, pressure: 0,
    });

    const s: GameState = {
      world: { seed: 4321, inv: { vowels: [], consonants: [] }, tmpl: { onset: "req", coda: "opt", clusters: true, label: "" }, lex: [], regions: [0, 1, 2, 3, 4, 5, 6, 7].map((id) => ({ id, x: id, y: 0 })), edges, adj, start: 0 },
      branches: { 0: mkBranch(0, "Aenic", [0, 1, 2, 3]), 1: mkBranch(1, "Boran", [4, 5, 6, 7]) },
      rootId: 0, selectedId: 0,
      nextId: 2, nameIdx: 0, turn: 0,
      settings: { pool: 10, growth: 1, overhead: 1, changeCost: 1, spreadEvery: 999 },
      pool: 10, touched: { 0: true, 1: true }, log: [],
    };

    const out = resolveGeneration(s);
    const kidsOf0 = childrenOf(out, 0);
    const kidsOf1 = childrenOf(out, 1);
    expect(kidsOf0.length).toBe(2);
    expect(kidsOf1.length).toBe(2);

    const allIds = [...kidsOf0, ...kidsOf1].map((k) => k.id).sort((a, b) => a - b);
    expect(new Set(allIds).size).toBe(4); // all distinct ids
    expect(allIds).toEqual([2, 3, 4, 5]); // sequential from nextId

    // Determinism holds for the multi-parent case too.
    const out2 = resolveGeneration(s);
    expect(out.branches).toEqual(out2.branches);
  });
});
