import { describe, test, expect } from "bun:test";
import { resolveContact, borderingPairs, routeKey, routeOpen, CONTACT_YIELD, CONTACT_TRADE_LOSS, ROUTE_TURNS } from "./contact";
import { hashRand } from "./rng";
import { intelligibility } from "./intelligibility";
import * as fixtures from "../../../tests/fixtures/geography";
import { branchDefaults, worldDefaults } from "../../../tests/fixtures/branch";
import type { Branch, GameState, Lexicon } from "./types";

// 2STK.5 §5/§8 (docs/spikes/2stk-1-rule-choice-stakes.md). Local mkBranch/mkState
// helpers, matching borrowing.test.ts's convention; geometry fixtures pulled from
// tests/fixtures/geography.ts per repo convention.
const LEX: Lexicon = [
  { concept: "a", word: ["t", "a", "p", "e"] },
  { concept: "b", word: ["k", "o"] },
];
const DIVERGENT_LEX: Lexicon = [
  { concept: "a", word: ["h", "u", "r", "ʃ"] },
  { concept: "b", word: ["w", "e"] },
];

function mkBranch(id: number, territory: number[], lex: Lexicon = LEX): Branch {
  return {
    id, name: `B${id}`, parentId: null, depth: 0, splitIndex: 0, history: [],
    lex, territory, pressure: 0, anchors: [], ...branchDefaults,
  };
}
function mkState(
  branches: Record<number, Branch>, edges: GameState["world"]["edges"],
  opts: { seed?: number; turn?: number } = {},
): GameState {
  return {
    world: { seed: opts.seed ?? 1, inv: { vowels: [], consonants: [] }, tmpl: { onset: "req", coda: "opt", clusters: true, label: "" }, lex: [], regions: [], edges, adj: {}, start: 0, compoundOrder: "modFirst", ...worldDefaults },
    branches, rootId: 0, selectedId: 0, nextId: Object.keys(branches).length, turn: opts.turn ?? 0,
    settings: { pool: 10, growth: 1, overhead: 1, changeCost: 1, spreadEvery: 999 },
    pool: 10, touched: {}, log: [], appliedRules: {}, focusId: 0, mourning: null, pendingFocusChoice: null, ended: false, routes: {},
  };
}

describe("routeKey", () => {
  test("canonical regardless of argument order", () => {
    expect(routeKey(1, 5)).toBe("1:5");
    expect(routeKey(5, 1)).toBe("1:5");
  });
  test("well-formed for a self-pair (defensive, never produced by resolveContact)", () => {
    expect(routeKey(3, 3)).toBe("3:3");
  });
});

describe("routeOpen", () => {
  test("absent key → closed", () => {
    expect(routeOpen({}, 0, 1, 0)).toBe(false);
  });
  test("turn < until → open", () => {
    expect(routeOpen({ "0:1": 5 }, 0, 1, 4)).toBe(true);
  });
  test("turn === until → closed (expiry is exclusive, matching mourningMult's turn < untilTurn)", () => {
    expect(routeOpen({ "0:1": 5 }, 0, 1, 5)).toBe(false);
  });
  test("turn > until → closed", () => {
    expect(routeOpen({ "0:1": 5 }, 0, 1, 9)).toBe(false);
  });
});

describe("borderingPairs", () => {
  test("a 3-branch chain gives exactly its two unordered pairs, sorted, each once", () => {
    const { edges, owner } = fixtures.chainThree;
    const s = mkState({ 0: mkBranch(0, [0]), 1: mkBranch(1, [1]), 2: mkBranch(2, [2]) }, edges);
    expect(borderingPairs(s, owner)).toEqual([[0, 1], [1, 2]]);
  });

  test("a closed triangle gives all three pairs, sorted", () => {
    const { edges, owner } = fixtures.triangleThree;
    const s = mkState({ 0: mkBranch(0, [0]), 1: mkBranch(1, [1]), 2: mkBranch(2, [2]) }, edges);
    expect(borderingPairs(s, owner)).toEqual([[0, 1], [0, 2], [1, 2]]);
  });

  test("canonical regardless of branch insertion order into s.branches", () => {
    const { edges, owner } = fixtures.chainThree;
    const forward = mkState({ 0: mkBranch(0, [0]), 1: mkBranch(1, [1]), 2: mkBranch(2, [2]) }, edges);
    const reverse = mkState({ 2: mkBranch(2, [2]), 1: mkBranch(1, [1]), 0: mkBranch(0, [0]) }, edges);
    expect(borderingPairs(forward, owner)).toEqual(borderingPairs(reverse, owner));
  });

  test("impassable-only border → excluded", () => {
    const { edges, owner } = fixtures.walledBorder;
    const s = mkState({ 0: mkBranch(0, [0]), 1: mkBranch(1, [1]), 2: mkBranch(2, [2]) }, edges);
    expect(borderingPairs(s, owner)).toEqual([]);
  });

  test("a dead branch (empty territory) is excluded even if geometrically bordering", () => {
    const { edges, owner } = fixtures.chainThree;
    const s = mkState({ 0: mkBranch(0, [0]), 1: mkBranch(1, []), 2: mkBranch(2, [2]) }, edges);
    // branch 1 is dead — only pairs it appears in are affected; here that's both,
    // since branch 1 sits at the middle of the chain.
    expect(borderingPairs(s, owner)).toEqual([]);
  });

  test("a lone branch has no pairs", () => {
    const s = mkState({ 0: mkBranch(0, [0]) }, []);
    expect(borderingPairs(s, {})).toEqual([]);
  });
});

describe("resolveContact", () => {
  test("determinism: same (seed, turn) → identical result", () => {
    const { edges, owner } = fixtures.chainThree;
    const s = mkState({ 0: mkBranch(0, [0]), 1: mkBranch(1, [1]), 2: mkBranch(2, [2]) }, edges, { seed: 5, turn: 3 });
    expect(resolveContact(s, owner)).toEqual(resolveContact(s, owner));
  });

  test("results vary across turns (guards against a constant-hash bug)", () => {
    const { edges, owner } = fixtures.chainThree;
    const branches = { 0: mkBranch(0, [0]), 1: mkBranch(1, [1]), 2: mkBranch(2, [2]) };
    const results = Array.from({ length: 10 }, (_, t) =>
      JSON.stringify(resolveContact(mkState(branches, edges, { seed: 5, turn: t }), owner)));
    expect(new Set(results).size).toBeGreaterThan(1);
  });

  test("odds equal the pair's mutual intelligibility exactly", () => {
    const { edges, owner } = fixtures.openBorder;
    const s = mkState({ 0: mkBranch(0, [0], LEX), 1: mkBranch(1, [1], DIVERGENT_LEX) }, edges, { seed: 2, turn: 0 });
    const r = resolveContact(s, owner);
    expect(r).not.toBeNull();
    expect(r!.odds).toBe(intelligibility(LEX, DIVERGENT_LEX));
  });

  test("success requires roll < odds: identical lexicons (odds=1) always succeed", () => {
    const { edges, owner } = fixtures.openBorder;
    const branches = { 0: mkBranch(0, [0], LEX), 1: mkBranch(1, [1], LEX) };
    for (let turn = 0; turn < 10; turn++) {
      const r = resolveContact(mkState(branches, edges, { seed: 3, turn }), owner);
      expect(r!.success).toBe(true);
    }
  });

  test("success requires roll < odds: maximally divergent lexicons (odds=0) never succeed — the absorbing state 2STK.7 will address", () => {
    const { edges, owner } = fixtures.openBorder;
    const ZERO_A: Lexicon = [{ concept: "a", word: ["t", "a", "p"] }];
    const ZERO_B: Lexicon = [{ concept: "a", word: ["m", "u", "s"] }];
    const branches = { 0: mkBranch(0, [0], ZERO_A), 1: mkBranch(1, [1], ZERO_B) };
    for (let turn = 0; turn < 10; turn++) {
      const r = resolveContact(mkState(branches, edges, { seed: 3, turn }), owner);
      expect(r!.odds).toBe(0);
      expect(r!.success).toBe(false);
    }
  });

  test("all three kinds appear across a turn sweep", () => {
    const { edges, owner } = fixtures.chainThree;
    const branches = { 0: mkBranch(0, [0]), 1: mkBranch(1, [1]), 2: mkBranch(2, [2]) };
    const kinds = new Set<string>();
    for (let turn = 0; turn < 30; turn++) {
      const r = resolveContact(mkState(branches, edges, { seed: 1, turn }), owner);
      if (r) kinds.add(r.kind);
    }
    expect(kinds).toEqual(new Set(["trade", "marriage", "warning"]));
  });

  test("no bordering pairs → null", () => {
    const s = mkState({ 0: mkBranch(0, [0]) }, []);
    expect(resolveContact(s, {})).toBeNull();
  });

  test("the returned pair is always a live bordering pair", () => {
    const { edges, owner } = fixtures.triangleThree;
    const branches = { 0: mkBranch(0, [0]), 1: mkBranch(1, [1]), 2: mkBranch(2, [2]) };
    const pairs = borderingPairs(mkState(branches, edges), owner);
    for (let turn = 0; turn < 20; turn++) {
      const r = resolveContact(mkState(branches, edges, { seed: 1, turn }), owner)!;
      expect(pairs).toContainEqual([r.aId, r.bId]);
    }
  });

  test("contact's salt draws a different value than drift/spread/salience/borrow at the same (turn, id)", () => {
    const seed = 3, turn = 0, id = 0;
    const contactRoll = hashRand(seed + 23, turn * 211 + 53, 2);
    const driftRoll = hashRand(seed + 7, turn * 131 + 17, id * 911 + 3);
    const spreadRoll = hashRand(seed, turn * 7 + 1, id * 13 + 5);
    const salienceRoll = hashRand(seed + 13, turn * 151 + 29, id * 733 + 0);
    const borrowRoll = hashRand(seed + 19, turn * 181 + 41, id * 1009 + 1);
    expect(contactRoll).not.toBeCloseTo(driftRoll, 5);
    expect(contactRoll).not.toBeCloseTo(spreadRoll, 5);
    expect(contactRoll).not.toBeCloseTo(salienceRoll, 5);
    expect(contactRoll).not.toBeCloseTo(borrowRoll, 5);
  });

  test("constants are the tuned first-pass values from the spike", () => {
    expect(CONTACT_YIELD).toBe(2);
    expect(CONTACT_TRADE_LOSS).toBe(1);
    expect(ROUTE_TURNS).toBe(4);
  });
});
