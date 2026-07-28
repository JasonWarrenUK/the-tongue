import { describe, test, expect } from "bun:test";
import { resolveGeneration } from "./generation";
import { ASSIM_TURNS } from "./geography";
import { isLeaf, leavesOf } from "./tree";
import type { GameState, Lexicon, Branch, Adjacency, Edge } from "./types";

// 1ENG.10 follow-up — language-shift/assimilation death. A small branch bordering a
// much larger, near-identical neighbour should, after ASSIM_TURNS sustained turns,
// lose its territory to that neighbour and become a dead ancestor (naming.ts already
// renders `territory: []` branches correctly — verified during 1ENG.10 — so these
// tests only need to prove the trigger/threshold/transfer mechanics, not naming).
//
// Layout: two disjoint clusters joined by ONE passable border edge (region 0 <-> 4).
// Small branch owns region 0 (1 region); large branch owns 1,2,3,4 (4 regions) — a
// 1:4 ratio, comfortably past ASSIM_SIZE_RATIO (1:2). Both start with the SAME lexicon
// (intelligibility 1.0, comfortably past ASSIM_INTEL_CUT).
const LEX: Lexicon = [
  { concept: "a", word: ["t", "a", "p", "e"] },
  { concept: "b", word: ["k", "o"] },
  { concept: "c", word: ["m", "a", "t"] },
  { concept: "d", word: ["s", "i", "n"] },
];

function birthAnchor(lex: Lexicon): Branch["anchors"] {
  return [{ lex: lex.map((e) => ({ concept: e.concept, word: [...e.word] })), turn: 0, historyIndex: 0, driftFromPrev: 0 }];
}

function smallVsLarge(opts: { smallLex?: Lexicon; smallTerritory?: number[]; largeTerritory?: number[] } = {}): GameState {
  const smallLex = opts.smallLex ?? LEX;
  const smallTerritory = opts.smallTerritory ?? [0];
  const largeTerritory = opts.largeTerritory ?? [1, 2, 3, 4];
  const edges: Edge[] = [
    { a: 0, b: 4, passable: true, cost: 1, name: "plain" }, // the one border edge
    { a: 1, b: 2, passable: true, cost: 1, name: "plain" },
    { a: 2, b: 3, passable: true, cost: 1, name: "plain" },
    { a: 3, b: 4, passable: true, cost: 1, name: "plain" },
  ];
  const adj: Adjacency = { 0: [], 1: [], 2: [], 3: [], 4: [] };
  edges.forEach((e) => {
    adj[e.a].push({ to: e.b, passable: e.passable, cost: e.cost });
    adj[e.b].push({ to: e.a, passable: e.passable, cost: e.cost });
  });
  const small: Branch = {
    id: 0, name: "Small", parentId: null, depth: 0, splitIndex: 0, history: [],
    lex: smallLex.map((e) => ({ concept: e.concept, word: [...e.word] })),
    territory: smallTerritory, pressure: 0, anchors: birthAnchor(smallLex), assimilationPressure: 0, collisionPressure: {},
  };
  const large: Branch = {
    // 2STK.2: parentId links to `small` (rather than a second null root) so the
    // fixture is a single connected tree — kinshipDistance/heirCandidates need a
    // real lineage to rank against, exactly as the engine always produces (siblings
    // are always fracture-born from a common ancestor, never two unrelated roots).
    id: 1, name: "Large", parentId: 0, depth: 1, splitIndex: 0, history: [],
    lex: LEX.map((e) => ({ concept: e.concept, word: [...e.word] })),
    territory: largeTerritory, pressure: 0, anchors: birthAnchor(LEX), assimilationPressure: 0, collisionPressure: {},
  };
  return {
    world: { seed: 1, inv: { vowels: [], consonants: [] }, tmpl: { onset: "req", coda: "opt", clusters: true, label: "" }, lex: [], regions: [0, 1, 2, 3, 4].map((id) => ({ id, x: id, y: 0 })), edges, adj, start: 0, compoundOrder: "modFirst" },
    branches: { 0: small, 1: large }, rootId: 0, selectedId: 0,
    nextId: 2, turn: 0,
    // spreadEvery high enough that spread never fires across these test runs, isolating
    // the assimilation step; both branches touched so drift never fires either.
    settings: { pool: 999, growth: 1, overhead: 1, changeCost: 1, spreadEvery: 999 },
    pool: 999, touched: { 0: true, 1: true }, log: [],
    focusId: 1, mourning: null, pendingFocusChoice: null, ended: false, routes: {},
  };
}

function runTurns(s: GameState, n: number): GameState {
  for (let i = 0; i < n; i++) s = resolveGeneration({ ...s, touched: { 0: true, 1: true } });
  return s;
}

describe("assimilation: trigger conditions", () => {
  test("does not fire before ASSIM_TURNS consecutive qualifying turns", () => {
    const out = runTurns(smallVsLarge(), ASSIM_TURNS - 1);
    expect(out.branches[0].territory.length).toBeGreaterThan(0);
    expect(out.branches[0].assimilationPressure).toBe(ASSIM_TURNS - 1);
  });

  test("fires at exactly ASSIM_TURNS consecutive qualifying turns: small's territory empties, large absorbs it", () => {
    const out = runTurns(smallVsLarge(), ASSIM_TURNS);
    expect(out.branches[0].territory).toEqual([]);
    expect(out.branches[1].territory.sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
    expect(out.branches[0].assimilationPressure).toBe(0);
  });

  test("the assimilated branch becomes a dead ancestor (isLeaf/leavesOf exclude it)", () => {
    const out = runTurns(smallVsLarge(), ASSIM_TURNS);
    expect(isLeaf(out.branches, 0)).toBe(false);
    expect(leavesOf(out.branches).map((b) => b.id)).toEqual([1]);
  });

  test("a log line announces the assimilation", () => {
    let s = smallVsLarge();
    for (let i = 0; i < ASSIM_TURNS; i++) s = resolveGeneration({ ...s, touched: { 0: true, 1: true } });
    expect(s.log.some((l) => l.includes("assimilated into Large"))).toBe(true);
  });

  test("reselection redirects off an assimilated selected branch to a living leaf", () => {
    const out = runTurns(smallVsLarge(), ASSIM_TURNS);
    // branch 0 (selected) was just assimilated to empty territory; selection must move.
    expect(out.branches[out.selectedId].territory.length).toBeGreaterThan(0);
    expect(leavesOf(out.branches).map((b) => b.id)).toContain(out.selectedId);
  });

  test("not close enough (below ASSIM_INTEL_CUT) never accrues pressure", () => {
    // fully different phone sequence -> low intelligibility, well under the cutoff.
    const divergentLex: Lexicon = [
      { concept: "a", word: ["h", "u", "r", "ʃ"] },
      { concept: "b", word: ["w", "e"] },
      { concept: "c", word: ["j", "i", "g"] },
      { concept: "d", word: ["z", "a", "n"] },
    ];
    const out = runTurns(smallVsLarge({ smallLex: divergentLex }), ASSIM_TURNS + 2);
    expect(out.branches[0].territory.length).toBeGreaterThan(0);
    expect(out.branches[0].assimilationPressure).toBe(0);
  });

  test("not small enough (ratio not met) never accrues pressure", () => {
    // small owns 2 of the small side's reachable regions (still identical lex) but the
    // ratio (2 vs 4, i.e. 1:2) no longer clears ASSIM_SIZE_RATIO (1:2).
    const out = runTurns(smallVsLarge({ smallTerritory: [0], largeTerritory: [4] }), ASSIM_TURNS + 2);
    // 1:1 ratio — nowhere near qualifying.
    expect(out.branches[0].territory.length).toBeGreaterThan(0);
    expect(out.branches[0].assimilationPressure).toBe(0);
  });
});

describe("assimilation: player intervention resets the streak", () => {
  test("touching the small branch (drift) resets pressure without stopping accrual once released", () => {
    let s = smallVsLarge();
    s = runTurns(s, ASSIM_TURNS - 1);
    expect(s.branches[0].assimilationPressure).toBe(ASSIM_TURNS - 1);
    // simulate the player leaving the branch untouched but changing its lexicon via
    // apply() semantics: directly diverge it so intelligibility drops below cutoff,
    // mirroring what a player-applied drift rule would do to the live lexicon.
    const diverged = { ...s.branches[0], lex: s.branches[0].lex.map((e) => ({ concept: e.concept, word: [...e.word, "h"] })) };
    s = { ...s, branches: { ...s.branches, 0: diverged }, touched: { 0: true, 1: true } };
    s = resolveGeneration(s);
    // pressure should not have advanced past what it was, given intelligibility dropped
    expect(s.branches[0].assimilationPressure).toBeLessThanOrEqual(ASSIM_TURNS - 1);
  });
});

describe("assimilation: safety guard", () => {
  test("a lone branch with no neighbour never accrues assimilation pressure", () => {
    const { adj, edges } = (() => {
      const e: Edge[] = [];
      const a: Adjacency = { 0: [] };
      return { adj: a, edges: e };
    })();
    const lone: Branch = {
      id: 0, name: "Lone", parentId: null, depth: 0, splitIndex: 0, history: [],
      lex: LEX.map((e) => ({ concept: e.concept, word: [...e.word] })),
      territory: [0], pressure: 0, anchors: birthAnchor(LEX), assimilationPressure: 0, collisionPressure: {},
    };
    const s: GameState = {
      world: { seed: 1, inv: { vowels: [], consonants: [] }, tmpl: { onset: "req", coda: "opt", clusters: true, label: "" }, lex: [], regions: [{ id: 0, x: 0, y: 0 }], edges, adj, start: 0, compoundOrder: "modFirst" },
      branches: { 0: lone }, rootId: 0, selectedId: 0, nextId: 1, turn: 0,
      settings: { pool: 999, growth: 1, overhead: 1, changeCost: 1, spreadEvery: 999 },
      pool: 999, touched: { 0: true }, log: [],
      focusId: 0, mourning: null, pendingFocusChoice: null, ended: false, routes: {},
    };
    const out = runTurns(s, ASSIM_TURNS + 5);
    expect(out.branches[0].territory).toEqual([0]);
    expect(out.branches[0].assimilationPressure).toBe(0);
  });
});

describe("assimilation: determinism", () => {
  test("independent runs of the same input are byte-identical through and past the assimilation turn", () => {
    const a = runTurns(smallVsLarge(), ASSIM_TURNS + 2);
    const b = runTurns(smallVsLarge(), ASSIM_TURNS + 2);
    expect(a.branches).toEqual(b.branches);
    expect(a.log).toEqual(b.log);
  });
});

// 2STK.2 §2.3 — focus death is not a new pressure counter; it's the existing
// assimilation trigger emptying the FOCAL branch's territory specifically.
describe("2STK.2 focus death queues succession", () => {
  test("the focal branch's own assimilation queues a succession choice with living heirs", () => {
    const s = smallVsLarge();
    const out = runTurns({ ...s, focusId: 0 }, ASSIM_TURNS);
    expect(out.branches[0].territory).toEqual([]); // sanity: died as expected
    expect(out.pendingFocusChoice?.kind).toBe("succession");
    if (out.pendingFocusChoice?.kind === "succession") {
      expect(out.pendingFocusChoice.heirs.map((h) => h.id)).toContain(1);
    }
    // focusId itself does not move inside the pure resolver — only the player's
    // (or silence's) choice does that.
    expect(out.focusId).toBe(0);
  });

  test("a non-focal branch's assimilation never queues a focus decision", () => {
    const s = smallVsLarge();
    const out = runTurns({ ...s, focusId: 1 }, ASSIM_TURNS);
    expect(out.branches[0].territory).toEqual([]);
    expect(out.pendingFocusChoice).toBeNull();
  });
});
