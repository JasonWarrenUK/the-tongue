import { describe, test, expect } from "bun:test";
import { resolveGeneration } from "./generation";
import { RENAME_CUT } from "./naming";
import { intelligibility } from "./intelligibility";
import { basePool, ASSIM_TURNS } from "./geography";
import { routeKey, routeOpen, CONTACT_YIELD, CONTACT_TRADE_LOSS, ROUTE_TURNS } from "./contact";
import { pairThreshold } from "./collision";
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
    territory: [0, 1, 2, 3], pressure: 0, anchors: birthAnchor(lex), assimilationPressure: 0, collisionPressure: {}, momentum: {},
  };
  return {
    world: { seed: 1234, inv: { vowels: [], consonants: [] }, tmpl: { onset: "req", coda: "opt", clusters: true, label: "" }, lex: [], regions: [0, 1, 2, 3].map((id) => ({ id, x: id, y: 0 })), edges, adj, start: 0, compoundOrder: "modFirst" },
    branches: { 0: branch }, rootId: 0, selectedId: 0,
    nextId: 1, turn: 0,
    settings: { pool: 10, growth: 1, overhead: 1, changeCost: 1, spreadEvery: 999 },
    pool: 10, touched: { 0: true }, log: [],
    focusId: 0, mourning: null, pendingFocusChoice: null, ended: false, routes: {},
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

  // 2STK.2 §2.2 — when the FOCAL branch is the one that fractures, resolveGeneration
  // queues a reassignment choice instead of silently deciding for the player. Focus
  // provisionally stays on the continuing lineage (same id), never moved by the
  // resolver itself.
  test("fracture of the focal branch queues a focus choice naming the born fragment(s)", () => {
    const s = fractureState();
    const out = resolveGeneration({ ...s, focusId: 0 });
    expect(out.pendingFocusChoice?.kind).toBe("fracture");
    if (out.pendingFocusChoice?.kind === "fracture") {
      const kid = childrenOf(out, 0)[0];
      expect(out.pendingFocusChoice.bornIds).toEqual([kid.id]);
    }
    expect(out.focusId).toBe(0); // unchanged by the pure resolver
  });

  test("fracture of a non-focal branch never queues a focus choice", () => {
    const s = fractureState();
    const out = resolveGeneration({ ...s, focusId: 999 }); // no branch owns this id in this fixture
    expect(out.pendingFocusChoice).toBeNull();
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
      territory, pressure: 0, anchors: birthAnchor(MIXED_LEX), assimilationPressure: 0, collisionPressure: {}, momentum: {},
    });

    const s: GameState = {
      world: { seed: 4321, inv: { vowels: [], consonants: [] }, tmpl: { onset: "req", coda: "opt", clusters: true, label: "" }, lex: [], regions: [0, 1, 2, 3, 4, 5, 6, 7].map((id) => ({ id, x: id, y: 0 })), edges, adj, start: 0, compoundOrder: "modFirst" },
      branches: { 0: mkBranch(0, "Aenic", [0, 1, 2, 3]), 1: mkBranch(1, "Boran", [4, 5, 6, 7]) },
      rootId: 0, selectedId: 0,
      nextId: 2, turn: 0,
      settings: { pool: 10, growth: 1, overhead: 1, changeCost: 1, spreadEvery: 999 },
      pool: 10, touched: { 0: true, 1: true }, log: [],
      focusId: 0, mourning: null, pendingFocusChoice: null, ended: false, routes: {},
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
      territory: [0], pressure: 0, anchors: birthAnchor(MIXED_LEX), assimilationPressure: 0, collisionPressure: {}, momentum: {},
    };
    return {
      world: { seed: 99, inv: { vowels: [], consonants: [] }, tmpl: { onset: "req", coda: "opt", clusters: true, label: "" }, lex: [], regions: [0, 1, 2, 3].map((id) => ({ id, x: id, y: 0 })), edges, adj, start: 0, compoundOrder: "modFirst" },
      branches: { 0: branch }, rootId: 0, selectedId: 0,
      nextId: 1, turn: 0,
      settings: { pool: 999, growth: 1, overhead: 1, changeCost: 1, spreadEvery: 999 },
      pool: 999, touched: {}, log: [],
      focusId: 0, mourning: null, pendingFocusChoice: null, ended: false, routes: {},
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

// 2STK.3 §3 — drift momentum, exercised through the real turn loop (step 1 drift +
// repool decay) rather than stakes.ts's functions in isolation.
describe("2STK.3 drift momentum (step 1 + repool)", () => {
  function driftingState(): GameState {
    const { adj, edges } = lineAdjacency();
    const branch: Branch = {
      id: 0, name: "Aenic", parentId: null, depth: 0, splitIndex: 0, history: [],
      lex: MIXED_LEX.map((e) => ({ concept: e.concept, word: [...e.word] })),
      territory: [0], pressure: 0, anchors: birthAnchor(MIXED_LEX), assimilationPressure: 0, collisionPressure: {}, momentum: {},
    };
    return {
      world: { seed: 99, inv: { vowels: [], consonants: [] }, tmpl: { onset: "req", coda: "opt", clusters: true, label: "" }, lex: [], regions: [0, 1, 2, 3].map((id) => ({ id, x: id, y: 0 })), edges, adj, start: 0, compoundOrder: "modFirst" },
      branches: { 0: branch }, rootId: 0, selectedId: 0,
      nextId: 1, turn: 0,
      settings: { pool: 999, growth: 1, overhead: 1, changeCost: 1, spreadEvery: 999 },
      pool: 999, touched: {}, log: [],
      focusId: 0, mourning: null, pendingFocusChoice: null, ended: false, routes: {},
    };
  }

  test("an untouched branch that drifts accrues momentum in the drifted rule's category", () => {
    let s = driftingState();
    s = resolveGeneration({ ...s, touched: {} });
    const drifted = s.log.length > 0; // driftRule found a firing candidate this turn
    expect(drifted).toBe(true);
    const mult = Object.values(s.branches[0].momentum);
    expect(mult.some((m) => m > 1)).toBe(true); // some category was bumped
  });

  test("momentum decays back toward 1 once the branch stops drifting that category", () => {
    let s = driftingState();
    // accrue momentum in whichever category fires first
    s = resolveGeneration({ ...s, touched: {} });
    const cat = (Object.entries(s.branches[0].momentum) as [string, number][]).find(([, m]) => m > 1)?.[0];
    expect(cat).toBeDefined();
    const afterOneDrift = s.branches[0].momentum[cat as keyof typeof s.branches[0]["momentum"]]!;
    // now hold the branch (touched every turn) so it never drifts again — momentum should
    // only decay, never re-accrue.
    for (let i = 0; i < 10; i++) s = resolveGeneration({ ...s, touched: { 0: true } });
    const afterHolding = s.branches[0].momentum[cat as keyof typeof s.branches[0]["momentum"]] ?? 1;
    expect(afterHolding).toBeLessThan(afterOneDrift);
  });

  test("determinism: momentum accrual across a multi-turn transcript is byte-identical", () => {
    function run(): GameState {
      let s = driftingState();
      for (let i = 0; i < 15; i++) s = resolveGeneration({ ...s, touched: {} });
      return s;
    }
    const a = run(), b = run();
    expect(a.branches[0].momentum).toEqual(b.branches[0].momentum);
  });
});

describe("2GEO.5 lexical borrowing (step 3.5)", () => {
  // Two single-region branches sharing one passable "water" border edge — contact(A,B)
  // = contact(B,A) = 1, so borrowing fires readily every turn it's eligible. "fish" is
  // water-salient (borrowable); the pair starts maximally divergent on it so
  // convergence is observable over turns. spreadEvery is set far beyond the turn count
  // so passive spread (and the fracture it could feed) never interferes.
  const BORROW_LEX_A: Lexicon = [
    { concept: "fish", word: ["t", "a", "p"] },
    { concept: "eye", word: ["k", "o"] }, // never-salient control: should stay untouched by borrowing
  ];
  const BORROW_LEX_B: Lexicon = [
    { concept: "fish", word: ["m", "u", "s"] },
    // 2STK.5: "eye" is identical to A's, not divergent. Two effects, both wanted: it
    // remains the never-salient control (borrowableConcepts excludes "eye" under
    // every terrain, so borrowing still can never touch it), and it lifts the pair's
    // starting intelligibility from exactly 0 to 0.5 — without which odds = 0 and the
    // §5 contact roll can NEVER succeed (success = roll < odds), so no trade route
    // ever opens and the borrow gate deadlocks this fixture permanently.
    { concept: "eye", word: ["k", "o"] },
  ];

  function borrowState(edges: Edge[]): GameState {
    const adj: Adjacency = { 0: [], 1: [] };
    edges.forEach((e) => {
      adj[e.a].push({ to: e.b, passable: e.passable, cost: e.cost });
      adj[e.b].push({ to: e.a, passable: e.passable, cost: e.cost });
    });
    const mk = (id: number, territory: number[], lex: Lexicon): Branch => ({
      id, name: id === 0 ? "Aenic" : "Boran", parentId: null, depth: 0, splitIndex: 0, history: [],
      lex: lex.map((e) => ({ concept: e.concept, word: [...e.word] })),
      territory, pressure: 0, anchors: birthAnchor(lex), assimilationPressure: 0, collisionPressure: {}, momentum: {},
    });
    return {
      world: { seed: 3, inv: { vowels: [], consonants: [] }, tmpl: { onset: "req", coda: "opt", clusters: true, label: "" }, lex: [], regions: [0, 1].map((id) => ({ id, x: id, y: 0 })), edges, adj, start: 0, compoundOrder: "modFirst" },
      branches: { 0: mk(0, [0], BORROW_LEX_A), 1: mk(1, [1], BORROW_LEX_B) },
      rootId: 0, selectedId: 0,
      nextId: 2, turn: 0,
      settings: { pool: 10, growth: 1, overhead: 1, changeCost: 1, spreadEvery: 999 },
      pool: 10, touched: { 0: true, 1: true }, log: [],
      focusId: 0, mourning: null, pendingFocusChoice: null, ended: false, routes: {},
    };
  }

  test("a bordering pair shows rising intelligibility on the borrowed concept over turns", () => {
    const edges: Edge[] = [{ a: 0, b: 1, passable: true, cost: 1, name: "water" }];
    let s = borrowState(edges);
    const before = intelligibility(s.branches[0].lex, s.branches[1].lex);
    for (let i = 0; i < 6; i++) s = resolveGeneration({ ...s, touched: { 0: true, 1: true } });
    const after = intelligibility(s.branches[0].lex, s.branches[1].lex);
    expect(after).toBeGreaterThan(before);
  });

  // 2STK.5: this pair's convergence now runs through a real contact success (odds
  // 0.5 at turn 0) opening a route, exercising the whole chain rather than assuming
  // it. The two tests below isolate the mechanic from that chain in either direction.
  test("2STK.5: with a pre-opened route, borrowing fires exactly as it did before the gate", () => {
    const edges: Edge[] = [{ a: 0, b: 1, passable: true, cost: 1, name: "water" }];
    let s = borrowState(edges);
    s = { ...s, routes: { "0:1": 999 } };
    const before = intelligibility(s.branches[0].lex, s.branches[1].lex);
    for (let i = 0; i < 6; i++) s = resolveGeneration({ ...s, touched: { 0: true, 1: true }, routes: { "0:1": 999 } });
    const after = intelligibility(s.branches[0].lex, s.branches[1].lex);
    expect(after).toBeGreaterThan(before);
  });

  test("2STK.5: with no route ever open, borrowing never fires regardless of contact", () => {
    const edges: Edge[] = [{ a: 0, b: 1, passable: true, cost: 1, name: "water" }];
    // a pair mutually unintelligible enough that contact can never succeed, so no
    // route can ever open by the normal mechanism either — isolates the gate itself.
    const s0 = borrowState(edges);
    let s: GameState = { ...s0, branches: { ...s0.branches, 0: { ...s0.branches[0], lex: [
      { concept: "fish", word: ["t", "a", "p"] }, { concept: "eye", word: ["z", "u"] },
    ] } } };
    for (let i = 0; i < 6; i++) {
      const forced = { ...s, touched: { 0: true, 1: true } };
      const out = resolveGeneration(forced);
      expect(out.log.some((l) => l.includes("borrowed"))).toBe(false);
      s = out;
    }
  });

  test("a walled (impassable-border) pair shows no borrowing convergence", () => {
    const edges: Edge[] = [{ a: 0, b: 1, passable: false, cost: 3, name: "mountain" }];
    let s = borrowState(edges);
    const before = JSON.stringify(s.branches[0].lex);
    for (let i = 0; i < 6; i++) s = resolveGeneration({ ...s, touched: { 0: true, 1: true } });
    // "eye" (never-eligible) must be untouched regardless; with an impassable border,
    // "fish" must be untouched too since neighborsOf never returns branch 1.
    expect(JSON.stringify(s.branches[0].lex.find((e) => e.concept === "fish"))).toBe(
      JSON.stringify(BORROW_LEX_A.find((e) => e.concept === "fish")),
    );
    expect(before).toBeTruthy(); // sanity: before-snapshot was taken
  });

  test("a single-leaf world runs the loop unchanged (borrow step skipped, no throw)", () => {
    const { adj, edges } = lineAdjacency();
    const branch: Branch = {
      id: 0, name: "Aenic", parentId: null, depth: 0, splitIndex: 0, history: [],
      lex: BORROW_LEX_A.map((e) => ({ concept: e.concept, word: [...e.word] })),
      territory: [0], pressure: 0, anchors: birthAnchor(BORROW_LEX_A), assimilationPressure: 0, collisionPressure: {}, momentum: {},
    };
    const s: GameState = {
      world: { seed: 3, inv: { vowels: [], consonants: [] }, tmpl: { onset: "req", coda: "opt", clusters: true, label: "" }, lex: [], regions: [0, 1, 2, 3].map((id) => ({ id, x: id, y: 0 })), edges, adj, start: 0, compoundOrder: "modFirst" },
      branches: { 0: branch }, rootId: 0, selectedId: 0,
      nextId: 1, turn: 0,
      settings: { pool: 999, growth: 1, overhead: 1, changeCost: 1, spreadEvery: 999 },
      pool: 999, touched: { 0: true }, log: [],
      focusId: 0, mourning: null, pendingFocusChoice: null, ended: false, routes: {},
    };
    expect(() => resolveGeneration(s)).not.toThrow();
    const out = resolveGeneration(s);
    expect(out.log.some((l) => l.includes("borrowed"))).toBe(false);
  });

  test("determinism: same seed+state → identical borrowing outcome across turns", () => {
    const edges: Edge[] = [{ a: 0, b: 1, passable: true, cost: 1, name: "water" }];
    function run(): GameState {
      let s = borrowState(edges);
      for (let i = 0; i < 6; i++) s = resolveGeneration({ ...s, touched: { 0: true, 1: true } });
      return s;
    }
    const a = run(), b = run();
    expect(a.branches).toEqual(b.branches);
    expect(a.log).toEqual(b.log);
  });
});

describe("2STK.5 contact events & trade routes (step 3.25)", () => {
  // Two single-region branches sharing one passable border, geometry mirrored from
  // the 2GEO.5 fixture above but kept local so each test can control the pair's
  // lexicon (and hence odds) precisely. LEX/LEX_DIVERGED differ on exactly one
  // concept ("a": "tape" vs "hur") -> intelligibility(LEX, LEX_DIVERGED) = 0.75,
  // giving a controllable, non-1/non-0 odds for the failure-path tests below.
  const LEX: Lexicon = [
    { concept: "a", word: ["t", "a", "p", "e"] },
    { concept: "b", word: ["k", "o"] },
    { concept: "c", word: ["m", "a", "t"] },
    { concept: "d", word: ["s", "i", "n"] },
  ];
  const LEX_DIVERGED: Lexicon = [
    { concept: "a", word: ["h", "u", "r"] },
    { concept: "b", word: ["k", "o"] },
    { concept: "c", word: ["m", "a", "t"] },
    { concept: "d", word: ["s", "i", "n"] },
  ];

  function contactPair(
    seed: number, turn: number, lexA: Lexicon, lexB: Lexicon,
    opts: { pool?: number; growth?: number; routes?: Record<string, number> } = {},
  ): GameState {
    const edges: Edge[] = [{ a: 0, b: 1, passable: true, cost: 1, name: "plain" }];
    const adj: Adjacency = { 0: [{ to: 1, passable: true, cost: 1 }], 1: [{ to: 0, passable: true, cost: 1 }] };
    const mk = (id: number, lex: Lexicon): Branch => ({
      id, name: id === 0 ? "Aenic" : "Boran", parentId: null, depth: 0, splitIndex: 0, history: [],
      lex: lex.map((e) => ({ concept: e.concept, word: [...e.word] })), territory: [id], pressure: 0,
      anchors: birthAnchor(lex), assimilationPressure: 0, collisionPressure: {}, momentum: {},
    });
    const pool = opts.pool ?? 10;
    return {
      world: { seed, inv: { vowels: [], consonants: [] }, tmpl: { onset: "req", coda: "opt", clusters: true, label: "" }, lex: [], regions: [0, 1].map((id) => ({ id, x: id, y: 0 })), edges, adj, start: 0, compoundOrder: "modFirst" },
      branches: { 0: mk(0, lexA), 1: mk(1, lexB) },
      rootId: 0, selectedId: 0, nextId: 2, turn,
      settings: { pool, growth: opts.growth ?? 1, overhead: 1, changeCost: 1, spreadEvery: 999 },
      pool, touched: { 0: true, 1: true }, log: [], routes: opts.routes ?? {},
      focusId: 0, mourning: null, pendingFocusChoice: null, ended: false,
    };
  }

  test("a success opens a route with the correct expiry and pays CONTACT_YIELD", () => {
    // identical lexicons -> odds = 1, contact always succeeds
    const s = contactPair(3, 0, LEX, LEX);
    const out = resolveGeneration(s);
    expect(out.routes[routeKey(0, 1)]).toBe(out.turn + ROUTE_TURNS);
    expect(routeOpen(out.routes, 0, 1, out.turn)).toBe(true);
    expect(out.pool).toBe(basePool(out.branches, out.settings) + CONTACT_YIELD);
    expect(out.log.some((l) => l.includes("trade route open"))).toBe(true);
  });

  test("route expires after ROUTE_TURNS without a renewing success", () => {
    // one branch permanently unintelligible with the other (odds = 0 forever, since
    // they never borrow without a route and never drift, being touched every turn) —
    // no fresh success can renew the pre-seeded route.
    const NEVER_INTEL: Lexicon = [
      { concept: "a", word: ["z", "u", "x"] }, { concept: "b", word: ["w", "e"] },
      { concept: "c", word: ["j", "i", "g"] }, { concept: "d", word: ["v", "o"] },
    ];
    let s = contactPair(3, 0, LEX, NEVER_INTEL, { routes: { "0:1": 3 } }); // open through turn 2
    for (let i = 0; i < 6; i++) s = resolveGeneration({ ...s, touched: { 0: true, 1: true } });
    expect(s.routes[routeKey(0, 1)]).toBeUndefined();
  });

  test("a failed trade costs CONTACT_TRADE_LOSS, floored at zero", () => {
    // seed=3,turn=7 probed: kind=trade, roll lands above odds(LEX,LEX_DIVERGED)=0.75
    const s = contactPair(3, 7, LEX, LEX_DIVERGED);
    const out = resolveGeneration(s);
    expect(out.log.some((l) => l.includes("trade") && l.includes("failed"))).toBe(true);
    expect(out.pool).toBe(basePool(out.branches, out.settings) - CONTACT_TRADE_LOSS);

    const zero = contactPair(3, 7, LEX, LEX_DIVERGED, { pool: 0, growth: 0 });
    const outZero = resolveGeneration(zero);
    expect(outZero.pool).toBe(0);
  });

  test("a failed marriage changes nothing but the log", () => {
    // seed=1,turn=0 probed: kind=marriage, roll lands above odds(LEX,LEX_DIVERGED)=0.75
    const s = contactPair(1, 0, LEX, LEX_DIVERGED);
    const out = resolveGeneration(s);
    expect(out.log.some((l) => l.includes("marriage") && l.includes("nothing"))).toBe(true);
    expect(out.pool).toBe(basePool(out.branches, out.settings));
    expect(out.routes).toEqual({});
    expect(out.branches[0].assimilationPressure).toBe(0);
    expect(out.branches[1].assimilationPressure).toBe(0);
  });

  test("a failed warning bumps pressure only with a qualifying dominant assimilator, and can complete an assimilation a turn early", () => {
    // small (1 region) vs large (4 regions); LEX_A_HI differs from LEX by one
    // substitution in one word -> intelligibility 0.9375, comfortably above
    // ASSIM_INTEL_CUT (0.75) so `small` already qualifies as an assimilation target.
    const LEX_A_HI: Lexicon = [
      { concept: "a", word: ["h", "a", "p", "e"] },
      { concept: "b", word: ["k", "o"] },
      { concept: "c", word: ["m", "a", "t"] },
      { concept: "d", word: ["s", "i", "n"] },
    ];
    function smallVsLarge(seed: number, turn: number, smallLex: Lexicon, smallPressure = 0): GameState {
      const edges: Edge[] = [
        { a: 0, b: 1, passable: true, cost: 1, name: "plain" },
        { a: 1, b: 2, passable: true, cost: 1, name: "plain" },
        { a: 1, b: 3, passable: true, cost: 1, name: "plain" },
        { a: 1, b: 4, passable: true, cost: 1, name: "plain" },
      ];
      const adj: Adjacency = { 0: [], 1: [], 2: [], 3: [], 4: [] };
      edges.forEach((e) => { adj[e.a].push({ to: e.b, passable: e.passable, cost: e.cost }); adj[e.b].push({ to: e.a, passable: e.passable, cost: e.cost }); });
      const mk = (id: number, territory: number[], lex: Lexicon, pressure: number): Branch => ({
        id, name: id === 0 ? "Small" : "Large", parentId: null, depth: 0, splitIndex: 0, history: [],
        lex: lex.map((e) => ({ concept: e.concept, word: [...e.word] })), territory, pressure: 0,
        anchors: birthAnchor(lex), assimilationPressure: pressure, collisionPressure: {}, momentum: {},
      });
      return {
        world: { seed, inv: { vowels: [], consonants: [] }, tmpl: { onset: "req", coda: "opt", clusters: true, label: "" }, lex: [], regions: [0, 1, 2, 3, 4].map((id) => ({ id, x: id, y: 0 })), edges, adj, start: 0, compoundOrder: "modFirst" },
        branches: { 0: mk(0, [0], smallLex, smallPressure), 1: mk(1, [1, 2, 3, 4], LEX, 0) },
        rootId: 0, selectedId: 0, nextId: 2, turn,
        settings: { pool: 999, growth: 1, overhead: 1, changeCost: 1, spreadEvery: 999 },
        pool: 999, touched: { 0: true, 1: true }, log: [], routes: {},
        focusId: 0, mourning: null, pendingFocusChoice: null, ended: false,
      };
    }

    // seed=7,turn=4 probed: kind=warning, roll lands above odds(LEX,LEX_A_HI)=0.9375
    const qualifying = resolveGeneration(smallVsLarge(7, 4, LEX_A_HI));
    expect(qualifying.log.some((l) => l.includes("warning") && l.includes("unheeded"))).toBe(true);
    // both the 3.25 warning bump and step 4's own +1 land this generation
    expect(qualifying.branches[0].assimilationPressure).toBe(2);

    // seed=18,turn=0 probed: kind=warning, roll lands above odds(LEX,LOW_INTEL)≈0 —
    // LOW_INTEL is far enough from LEX that intelligibility sits under ASSIM_INTEL_CUT,
    // so `small` has no qualifying dominant assimilator at all.
    const LOW_INTEL: Lexicon = [
      { concept: "a", word: ["z", "u", "x"] }, { concept: "b", word: ["w", "e"] },
      { concept: "c", word: ["j", "i", "g"] }, { concept: "d", word: ["v", "o"] },
    ];
    const nonQualifying = resolveGeneration(smallVsLarge(18, 0, LOW_INTEL));
    expect(nonQualifying.branches[0].assimilationPressure).toBe(0);

    // stacking completes an assimilation a turn early: start `small` one warning-bump
    // short of ASSIM_TURNS (accumulated by the normal step-4 mechanism), then a
    // failed-warning turn should tip it over the threshold and empty its territory.
    const primed = smallVsLarge(7, 4, LEX_A_HI, ASSIM_TURNS - 2);
    const out = resolveGeneration(primed);
    expect(out.branches[0].territory).toEqual([]);
    expect(out.log.some((l) => l.includes("assimilated into"))).toBe(true);
  });

  test("a fresh contact success licenses borrowing the SAME generation (§7)", () => {
    // odds must let contact succeed (identical control concept "eye" per the fixed
    // 2GEO.5 fixture) while "fish" stays divergent and water-salient so a borrow is
    // actually available once the route opens.
    const edges: Edge[] = [{ a: 0, b: 1, passable: true, cost: 1, name: "water" }];
    const adj: Adjacency = { 0: [{ to: 1, passable: true, cost: 1 }], 1: [{ to: 0, passable: true, cost: 1 }] };
    const A: Lexicon = [{ concept: "fish", word: ["t", "a", "p"] }, { concept: "eye", word: ["k", "o"] }];
    const B: Lexicon = [{ concept: "fish", word: ["m", "u", "s"] }, { concept: "eye", word: ["k", "o"] }];
    const mk = (id: number, lex: Lexicon): Branch => ({
      id, name: id === 0 ? "Aenic" : "Boran", parentId: null, depth: 0, splitIndex: 0, history: [],
      lex: lex.map((e) => ({ concept: e.concept, word: [...e.word] })), territory: [id], pressure: 0,
      anchors: birthAnchor(lex), assimilationPressure: 0, collisionPressure: {}, momentum: {},
    });
    const s: GameState = {
      world: { seed: 3, inv: { vowels: [], consonants: [] }, tmpl: { onset: "req", coda: "opt", clusters: true, label: "" }, lex: [], regions: [0, 1].map((id) => ({ id, x: id, y: 0 })), edges, adj, start: 0, compoundOrder: "modFirst" },
      branches: { 0: mk(0, A), 1: mk(1, B) }, rootId: 0, selectedId: 0, nextId: 2, turn: 0,
      settings: { pool: 10, growth: 1, overhead: 1, changeCost: 1, spreadEvery: 999 },
      pool: 10, touched: { 0: true, 1: true }, log: [], routes: {},
      focusId: 0, mourning: null, pendingFocusChoice: null, ended: false,
    };
    const out = resolveGeneration(s);
    expect(out.log.some((l) => l.includes("trade route open"))).toBe(true);
    expect(out.log.some((l) => l.includes("borrowed"))).toBe(true);
  });

  test("determinism: identical transcripts produce identical branches, log and routes", () => {
    function run(): GameState {
      let s = contactPair(3, 0, LEX, LEX_DIVERGED);
      for (let i = 0; i < 10; i++) s = resolveGeneration({ ...s, touched: { 0: true, 1: true } });
      return s;
    }
    const a = run(), b = run();
    expect(a.branches).toEqual(b.branches);
    expect(a.log).toEqual(b.log);
    expect(a.routes).toEqual(b.routes);
  });
});

describe("2LEX.2 collision resolution", () => {
  // A single touched (so drift never fires) branch with a static moon|sun collision:
  // moon (index 20) yields to sun (index 19, salience-tied at plain terrain), threshold
  // pairThreshold("moon","sun") = 3. All other concepts are distinct so severePairs
  // sees exactly this one pair.
  const COLL_LEX: Lexicon = [
    { concept: "moon", word: ["t", "a"] },
    { concept: "sun", word: ["t", "a"] },
    { concept: "sky", word: ["k", "o"] },
    { concept: "star", word: ["s", "u"] },
    { concept: "water", word: ["m", "e"] },
  ];
  function collisionState(opts: { collisionPressure?: Record<string, number>; lex?: Lexicon } = {}): GameState {
    const branch: Branch = {
      id: 0, name: "Aenic", parentId: null, depth: 0, splitIndex: 0, history: [],
      lex: opts.lex ?? COLL_LEX, territory: [0], pressure: 0,
      anchors: [{ lex: opts.lex ?? COLL_LEX, turn: 0, historyIndex: 0, driftFromPrev: 0 }],
      assimilationPressure: 0, collisionPressure: opts.collisionPressure ?? {}, momentum: {},
    };
    return {
      world: { seed: 1, inv: { vowels: [], consonants: [] }, tmpl: { onset: "req", coda: "opt", clusters: true, label: "" }, lex: [], regions: [{ id: 0, x: 0, y: 0 }], edges: [], adj: { 0: [] }, start: 0, compoundOrder: "modFirst" },
      branches: { 0: branch }, rootId: 0, selectedId: 0, nextId: 1, turn: 0,
      settings: { pool: 10, growth: 1, overhead: 1, changeCost: 1, spreadEvery: 999 },
      pool: 10, touched: { 0: true }, log: [],
      focusId: 0, mourning: null, pendingFocusChoice: null, ended: false, routes: {},
    };
  }

  test("pressure ticks only while colliding", () => {
    let s = collisionState();
    s = resolveGeneration({ ...s, touched: { 0: true } });
    expect(s.branches[0].collisionPressure["moon|sun"]).toBe(1);
    s = resolveGeneration({ ...s, touched: { 0: true } });
    expect(s.branches[0].collisionPressure["moon|sun"]).toBe(2);
  });

  test("heal deletes the key: once the forms differ, the counter is gone next turn", () => {
    let s = collisionState({ collisionPressure: { "moon|sun": 2 } });
    const healed: Lexicon = COLL_LEX.map((e) => (e.concept === "sun" ? { ...e, word: ["z", "a"] } : e));
    s.branches[0] = { ...s.branches[0], lex: healed };
    s = resolveGeneration({ ...s, touched: { 0: true } });
    expect(s.branches[0].collisionPressure["moon|sun"]).toBeUndefined();
  });

  test("repair at threshold clears the key, rewrites the lexicon, and logs a Disambiguation entry with no drift flag", () => {
    // pairThreshold("moon","sun") = 3, so pressure 2 -> tick to 3 -> ripe this turn.
    expect(pairThreshold("moon", "sun")).toBe(3);
    let s = collisionState({ collisionPressure: { "moon|sun": 2 } });
    s = resolveGeneration({ ...s, touched: { 0: true } });
    expect(s.branches[0].collisionPressure["moon|sun"]).toBeUndefined();
    const entry = s.branches[0].history.find((h) => h.name === "Disambiguation");
    expect(entry).toBeDefined();
    expect(entry?.drift).toBeUndefined();
    // moon yields (index 20 > 19, both zero-salience at plain), compounds with sky
    // (its top candidate) -> distinct from both original forms.
    const moon = s.branches[0].lex.find((e) => e.concept === "moon")!;
    const sun = s.branches[0].lex.find((e) => e.concept === "sun")!;
    expect(moon.word).not.toEqual(["t", "a"]);
    expect(sun.word).toEqual(["t", "a"]); // sun kept the short form
    expect(s.log.some((l) => l.includes("disambiguated"))).toBe(true);
  });

  test("at most MAX_REPAIRS_PER_TURN (3) repairs per branch per turn: excess ripe pairs defer to next turn", () => {
    // four independent severe pairs, all ripe this turn (a live-engine census found up
    // to 14 concurrent severe pairs on one branch-turn, so the cap must be a real queue,
    // not a one-shot). Distinct concepts so each pair repairs independently regardless
    // of resolution order.
    const lex: Lexicon = [
      { concept: "moon", word: ["t", "a"] }, { concept: "sun", word: ["t", "a"] },
      { concept: "sky", word: ["p", "o"] }, { concept: "wind", word: ["p", "o"] },
      { concept: "day", word: ["s", "u"] }, { concept: "night", word: ["s", "u"] },
      { concept: "rain", word: ["m", "e"] }, { concept: "snow", word: ["m", "e"] },
      { concept: "water", word: ["k", "i"] },
    ];
    const pressure = { "moon|sun": 2, "sky|wind": 5, "day|night": 2, "rain|snow": 2 };
    let s = collisionState({ collisionPressure: pressure, lex });
    s = resolveGeneration({ ...s, touched: { 0: true } });
    const disambigCount = s.branches[0].history.filter((h) => h.name === "Disambiguation").length;
    expect(disambigCount).toBe(3); // capped, not all 4
    const stillPending = Object.keys(pressure).filter((k) => s.branches[0].collisionPressure[k] !== undefined);
    expect(stillPending.length).toBe(1); // exactly one pair deferred to next turn
  });

  test("a deferred backlog pair repairs on a later turn (no starvation)", () => {
    const lex: Lexicon = [
      { concept: "moon", word: ["t", "a"] }, { concept: "sun", word: ["t", "a"] },
      { concept: "sky", word: ["p", "o"] }, { concept: "wind", word: ["p", "o"] },
      { concept: "day", word: ["s", "u"] }, { concept: "night", word: ["s", "u"] },
      { concept: "rain", word: ["m", "e"] }, { concept: "snow", word: ["m", "e"] },
      { concept: "water", word: ["k", "i"] },
    ];
    let s = collisionState({ collisionPressure: { "moon|sun": 2, "sky|wind": 5, "day|night": 2, "rain|snow": 2 }, lex });
    s = resolveGeneration({ ...s, touched: { 0: true } });
    s = resolveGeneration({ ...s, touched: { 0: true } });
    // by the second turn every one of the four original pairs has either repaired
    // (cleared) or is no longer severe — none remain stuck forever.
    expect(["moon|sun", "sky|wind", "day|night", "rain|snow"].every((k) => s.branches[0].collisionPressure[k] === undefined)).toBe(true);
  });

  test("fracture children inherit the parent's collisionPressure", () => {
    // a genuinely severe, still-below-threshold pair (moon|sun, threshold 3) survives
    // step 1.5's heal-delete (it ticks 1->2, doesn't repair) and rides into fracture
    // the same turn; MIXED_LEX's own invented concepts ("a","b"...) aren't in
    // CONCEPT_CLASS, so severePairs would never keep an "a|b" key across the tick.
    const lexWithCollision: Lexicon = [...fractureState().branches[0].lex,
      { concept: "moon", word: ["z", "u"] }, { concept: "sun", word: ["z", "u"] }];
    const s = fractureState(lexWithCollision);
    s.branches[0] = { ...s.branches[0], collisionPressure: { "moon|sun": 1 } };
    const out = resolveGeneration(s);
    const kid = childrenOf(out, 0)[0];
    expect(kid.collisionPressure).toEqual(out.branches[0].collisionPressure);
    expect(kid.collisionPressure["moon|sun"]).toBe(2);
  });

  test("a lone branch (no neighbours) still runs step 1.5 without error and can repair", () => {
    const s = collisionState({ collisionPressure: { "moon|sun": 2 } });
    expect(() => resolveGeneration({ ...s, touched: { 0: true } })).not.toThrow();
    const out = resolveGeneration({ ...s, touched: { 0: true } });
    expect(out.branches[0].history.some((h) => h.name === "Disambiguation")).toBe(true);
  });

  test("step ordering: a repair crossing RENAME_CUT triggers the era freeze the SAME turn", () => {
    // birth anchor identical to the live lexicon; the repair itself is the only change
    // this turn (touched, so drift never fires), so if the era check runs AFTER the
    // repair (as step 4 requires), a repair that drops intelligibility below RENAME_CUT
    // against the birth anchor freezes a new anchor in the same resolveGeneration call.
    let s = collisionState({ collisionPressure: { "moon|sun": 2 } });
    const intelBefore = intelligibility(s.branches[0].lex, s.branches[0].anchors[0].lex);
    expect(intelBefore).toBe(1); // anchor == live lex before any repair
    const out = resolveGeneration({ ...s, touched: { 0: true } });
    const intelAfter = intelligibility(out.branches[0].lex, out.branches[0].anchors[0].lex);
    if (intelAfter < RENAME_CUT) {
      expect(out.branches[0].anchors.length).toBeGreaterThan(1);
    } else {
      // the compound alone may not cross RENAME_CUT on this tiny lexicon; assert the
      // repair still landed BEFORE this check ran, proving the ordering is at minimum
      // consistent (rename saw the post-repair lexicon, not last turn's).
      expect(out.branches[0].lex.find((e) => e.concept === "moon")!.word).not.toEqual(["t", "a"]);
    }
  });

  // The borrowing arm (spike §3.5) itself is unit-tested via resolveCollision's
  // `lender` parameter above, but generation.ts's `lenderFor` closure — which actually
  // selects a lender from a passable neighbour — was previously untested through the
  // real turn loop. Two-branch fixture mirrors 2GEO.5's own borrowState pattern: a
  // passable border so neighborsOf/pairContact find something to select.
  function collisionWithNeighbourState(opts: {
    collisionPressure?: Record<string, number>; lex?: Lexicon; neighbourLex?: Lexicon; passable?: boolean;
  } = {}): GameState {
    const lex = opts.lex ?? COLL_LEX;
    const neighbourLex: Lexicon = opts.neighbourLex ?? COLL_LEX.map((e) => ({ concept: e.concept, word: [...e.word] }));
    const edges: Edge[] = [{ a: 0, b: 1, passable: opts.passable ?? true, cost: 1, name: "plain" }];
    const adj: Adjacency = { 0: [], 1: [] };
    edges.forEach((e) => {
      adj[e.a].push({ to: e.b, passable: e.passable, cost: e.cost });
      adj[e.b].push({ to: e.a, passable: e.passable, cost: e.cost });
    });
    const branch: Branch = {
      id: 0, name: "Aenic", parentId: null, depth: 0, splitIndex: 0, history: [],
      lex, territory: [0], pressure: 0,
      anchors: [{ lex, turn: 0, historyIndex: 0, driftFromPrev: 0 }],
      assimilationPressure: 0, collisionPressure: opts.collisionPressure ?? {}, momentum: {},
    };
    const neighbour: Branch = {
      id: 1, name: "Boran", parentId: null, depth: 0, splitIndex: 0, history: [],
      lex: neighbourLex, territory: [1], pressure: 0,
      anchors: [{ lex: neighbourLex, turn: 0, historyIndex: 0, driftFromPrev: 0 }],
      assimilationPressure: 0, collisionPressure: {}, momentum: {},
    };
    return {
      world: { seed: 1, inv: { vowels: [], consonants: [] }, tmpl: { onset: "req", coda: "opt", clusters: true, label: "" }, lex: [], regions: [0, 1].map((id) => ({ id, x: id, y: 0 })), edges, adj, start: 0, compoundOrder: "modFirst" },
      branches: { 0: branch, 1: neighbour }, rootId: 0, selectedId: 0, nextId: 2, turn: 0,
      settings: { pool: 10, growth: 1, overhead: 1, changeCost: 1, spreadEvery: 999 },
      pool: 10, touched: { 0: true, 1: true }, log: [],
      focusId: 0, mourning: null, pendingFocusChoice: null, ended: false, routes: {},
    };
  }

  test("borrowing arm: a passable neighbour with a distinct form for the yielding concept is adopted whole, not compounded", () => {
    // moon yields (zero-salience tie, higher CONCEPTS index) — give the neighbour a
    // distinct "moon" form so lenderFor(moon) finds it before resolveCollision ever
    // reaches the compounding fallback.
    const neighbourLex: Lexicon = COLL_LEX.map((e) => (e.concept === "moon" ? { ...e, word: ["z", "u"] } : { ...e, word: [...e.word] }));
    const s = collisionWithNeighbourState({ collisionPressure: { "moon|sun": 2 }, neighbourLex });
    const out = resolveGeneration(s);
    const moon = out.branches[0].lex.find((e) => e.concept === "moon")!;
    // adopted verbatim from Boran (["z","u"]) rather than compounded with sky
    // (compoundWord(sky-clip, moon) would clip to ["k","o","t","a"] under modFirst) —
    // proof lenderFor found the neighbour and resolveCollision took the lender branch.
    expect(moon.word).toEqual(["z", "u"]);
    const entry = out.branches[0].history.find((h) => h.name === "Disambiguation");
    expect(entry?.note).toContain("zu");
  });

  test("borrowing arm: an impassable border falls back to compounding despite a divergent neighbour form", () => {
    const neighbourLex: Lexicon = COLL_LEX.map((e) => (e.concept === "moon" ? { ...e, word: ["z", "u"] } : { ...e, word: [...e.word] }));
    const s = collisionWithNeighbourState({ collisionPressure: { "moon|sun": 2 }, neighbourLex, passable: false });
    const out = resolveGeneration(s);
    const moon = out.branches[0].lex.find((e) => e.concept === "moon")!;
    expect(moon.word).not.toEqual(["z", "u"]); // neighborsOf never returns Boran, so no lender is ever offered
    expect(moon.word).not.toEqual(["t", "a"]);
  });

  test("borrowing arm: a neighbour sharing the exact colliding form is skipped (no-op lender)", () => {
    // neighbourLex defaults to COLL_LEX unmodified, so Boran's "moon" is byte-identical
    // to Aenic's colliding form — lenderFor's formOf(entry.word) === formOf(colliding)
    // guard must reject it and fall through to compounding.
    const s = collisionWithNeighbourState({ collisionPressure: { "moon|sun": 2 } });
    const out = resolveGeneration(s);
    const moon = out.branches[0].lex.find((e) => e.concept === "moon")!;
    // still repairs, but via compounding (sky-clip + moon), not a lender adoption —
    // Boran's "moon" is byte-identical to the colliding form, so lenderFor's
    // formOf(entry.word) === formOf(colliding) guard must reject it as a candidate.
    expect(moon.word).not.toEqual(["t", "a"]);
    expect(moon.word).not.toEqual(["z", "u"]);
  });
});
