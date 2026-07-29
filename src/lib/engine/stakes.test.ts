import { describe, test, expect } from "bun:test";
import { blendDistance, reachMult, heirCandidates, momentumMult, bumpMomentum, decayMomentum, REACH_CAP, HEIR_CUT, COST_CAP, MOMENTUM_CAP, MOMENTUM_GAIN, MOMENTUM_DECAY } from "./stakes";
import { kinshipDistance } from "./tree";
import type { Branch, GameState, Lexicon } from "./types";

// 2STK.2 §2 — focal identity & reach. A small hand-built family tree:
//        0 (root)
//       / \
//      1   2
//     /
//    3
// plus branch 4, a fresh sibling of 0 with no shared ancestor closer than the (absent)
// world root — used as the "distant cousin" case. All branches share the same starting
// lexicon except where a test needs divergence.
const LEX: Lexicon = [
  { concept: "a", word: ["t", "a", "p", "e"] },
  { concept: "b", word: ["k", "o"] },
  { concept: "c", word: ["m", "a", "t"] },
  { concept: "d", word: ["s", "i", "n"] },
];
const DIVERGENT_LEX: Lexicon = [
  { concept: "a", word: ["h", "u", "r", "ʃ"] },
  { concept: "b", word: ["w", "e"] },
  { concept: "c", word: ["j", "i", "g"] },
  { concept: "d", word: ["z", "a", "n"] },
];

function mkBranch(id: number, parentId: number | null, depth: number, lex: Lexicon = LEX): Branch {
  return {
    id, name: `B${id}`, parentId, depth, splitIndex: 0, history: [],
    lex: lex.map((e) => ({ concept: e.concept, word: [...e.word] })),
    territory: [id], pressure: 0,
    anchors: [{ lex: lex.map((e) => ({ concept: e.concept, word: [...e.word] })), turn: 0, historyIndex: 0, driftFromPrev: 0 }],
    assimilationPressure: 0, collisionPressure: {}, momentum: {},
  };
}

const branches: Record<number, Branch> = {
  0: mkBranch(0, null, 0),
  1: mkBranch(1, 0, 1),
  2: mkBranch(2, 0, 1),
  3: mkBranch(3, 1, 2),
};

function baseState(overrides: Partial<GameState> = {}): GameState {
  return {
    world: { seed: 1, inv: { vowels: [], consonants: [] }, tmpl: { onset: "req", coda: "opt", clusters: true, label: "" }, lex: [], regions: [], edges: [], adj: {}, start: 0, compoundOrder: "modFirst" },
    branches, rootId: 0, selectedId: 0, nextId: 4, turn: 5,
    settings: { pool: 999, growth: 1, overhead: 1, changeCost: 2, spreadEvery: 999 },
    pool: 999, touched: {}, log: [],
    focusId: 0, mourning: null, pendingFocusChoice: null, ended: false, routes: {},
    ...overrides,
  };
}

describe("kinshipDistance", () => {
  test("self is 0", () => expect(kinshipDistance(0, 0, branches)).toBe(0));
  test("parent<->child is 1", () => {
    expect(kinshipDistance(0, 1, branches)).toBe(1);
    expect(kinshipDistance(1, 0, branches)).toBe(1);
  });
  test("siblings (via shared parent) are 2", () => expect(kinshipDistance(1, 2, branches)).toBe(2));
  test("grandparent<->grandchild is 2", () => expect(kinshipDistance(0, 3, branches)).toBe(2));
  test("uncle<->nephew (2 and 3) is 3", () => expect(kinshipDistance(2, 3, branches)).toBe(3));
});

describe("blendDistance", () => {
  test("self is 0", () => expect(blendDistance(branches[0], branches[0], branches)).toBe(0));
  // kinship dominance (decision §9.11): at EQUAL intelligibility, a kin-close branch
  // (2, sibling of 1, kin distance 2 from 0) must score closer than a kin-distant one
  // (3, grandchild via 1, kin distance 2... so extend the tree one more generation to
  // get genuinely unequal kin distance at matched intelligibility) — W_KIN > W_INT
  // means the kinship term dominates whenever kin distance differs.
  test("kinship dominance: closer kin scores lower than more-distant kin at equal intelligibility", () => {
    // 4 is a great-grandchild via 1 -> 3 -> 4 (kin distance 3 from 0), same divergent
    // lex as 2 (kin distance 1 from 0) — isolates the kinship term's effect.
    const extended: Record<number, Branch> = { ...branches, 2: { ...branches[2], lex: DIVERGENT_LEX }, 4: mkBranch(4, 3, 3, DIVERGENT_LEX) };
    const closerKin = blendDistance(extended[0], extended[2], extended);
    const fartherKin = blendDistance(extended[0], extended[4], extended);
    expect(closerKin).toBeLessThan(fartherKin);
  });
  test("kinship dominance: a sibling beats a stranger with no shared root even at identical intelligibility", () => {
    // reachMult/heirCandidates treat an unreachable kin path (disconnected trees, which
    // never occurs in real play — every branch descends from the single world root) as
    // maximally distant rather than throwing; sanity-pin that behaviour here.
    const stranger = mkBranch(9, null, 0); // no path back into `branches` at all
    const withStranger: Record<number, Branch> = { ...branches, 9: stranger };
    const sibling = blendDistance(branches[0], branches[2], branches);
    const distant = blendDistance(withStranger[0], withStranger[9], withStranger);
    expect(sibling).toBeLessThan(distant);
    expect(distant).toBe(Infinity);
  });
  test("increases with tree distance at fixed intelligibility", () => {
    const parent = blendDistance(branches[0], branches[1], branches);
    const grandchild = blendDistance(branches[0], branches[3], branches);
    expect(grandchild).toBeGreaterThan(parent);
  });
});

describe("reachMult", () => {
  test("self is always 1 with no mourning active", () => {
    const s = baseState({ focusId: 0 });
    expect(reachMult(s, 0)).toBe(1);
  });
  test("kin costs more than self", () => {
    const s = baseState({ focusId: 0 });
    expect(reachMult(s, 3)).toBeGreaterThan(1);
  });
  test("REACH_CAP binds on a very distant target", () => {
    const far: Record<number, Branch> = { ...branches, 5: mkBranch(5, 3, 10, DIVERGENT_LEX) };
    const s = baseState({ branches: far, focusId: 0 });
    expect(reachMult(s, 5)).toBeLessThanOrEqual(REACH_CAP * 1 + 1e-9);
  });
  test("mourning stacks as an extra multiplier and expires", () => {
    const active = baseState({ focusId: 0, turn: 2, mourning: { untilTurn: 5, mult: 2 } });
    const expired = baseState({ focusId: 0, turn: 5, mourning: { untilTurn: 5, mult: 2 } });
    expect(reachMult(active, 3)).toBeCloseTo(reachMult(expired, 3) * 2, 5);
  });
});

describe("heirCandidates", () => {
  test("ranks by ascending blendDistance, excludes the deceased, caps at 3", () => {
    const s = baseState();
    const cands = heirCandidates(branches[0], s);
    expect(cands.every((c) => c.id !== 0)).toBe(true);
    expect(cands.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < cands.length; i++) expect(cands[i].blendDistance).toBeGreaterThanOrEqual(cands[i - 1].blendDistance);
  });
  test("drops candidates beyond HEIR_CUT", () => {
    const far: Record<number, Branch> = { ...branches, 5: mkBranch(5, 3, 20, DIVERGENT_LEX) };
    const s = baseState({ branches: far });
    const cands = heirCandidates(far[0], s);
    expect(cands.every((c) => c.blendDistance <= HEIR_CUT)).toBe(true);
  });
  test("empty living-kin set yields no candidates (silence-only)", () => {
    const lone: Record<number, Branch> = { 0: mkBranch(0, null, 0) };
    const s = baseState({ branches: lone });
    expect(heirCandidates(lone[0], s)).toEqual([]);
  });
  test("mourning penalty is monotone in distance", () => {
    const s = baseState();
    const cands = heirCandidates(branches[0], s);
    for (let i = 1; i < cands.length; i++) expect(cands[i].mourningMult).toBeGreaterThanOrEqual(cands[i - 1].mourningMult);
  });
});

describe("cost-cap contract (mirrors the game.svelte.ts call-site formula)", () => {
  test("min(COST_CAP * base, base * reachMult) never exceeds COST_CAP * base", () => {
    const far: Record<number, Branch> = { ...branches, 5: mkBranch(5, 3, 30, DIVERGENT_LEX) };
    const s = baseState({ branches: far, focusId: 0, mourning: { untilTurn: 100, mult: 3 } });
    const base = 2;
    const cost = Math.min(COST_CAP * base, base * reachMult(s, 5));
    expect(cost).toBeLessThanOrEqual(COST_CAP * base + 1e-9);
  });
});

// 2STK.3 §3 — drift momentum: a decaying per-category multiplier, player-weighted
// accrual (drift at half), feeding driftRule's weighted pick (see phonology.test.ts
// for the selection-bias side of the contract).
describe("momentumMult", () => {
  test("an absent category reads as 1", () => expect(momentumMult(branches[0], "lenition")).toBe(1));
  test("a present category reads its stored value", () => {
    const b: Branch = { ...branches[0], momentum: { lenition: 1.6 } };
    expect(momentumMult(b, "lenition")).toBe(1.6);
  });
});

describe("bumpMomentum", () => {
  test("full weight (player-applied) adds MOMENTUM_GAIN", () => {
    const b = bumpMomentum(branches[0], "deletion", true);
    expect(momentumMult(b, "deletion")).toBeCloseTo(1 + MOMENTUM_GAIN, 5);
  });
  test("half weight (autonomous drift) adds half MOMENTUM_GAIN", () => {
    const b = bumpMomentum(branches[0], "deletion", false);
    expect(momentumMult(b, "deletion")).toBeCloseTo(1 + MOMENTUM_GAIN / 2, 5);
  });
  test("caps at MOMENTUM_CAP under repeated full-weight bumps", () => {
    let b = branches[0];
    for (let i = 0; i < 50; i++) b = bumpMomentum(b, "deletion", true);
    expect(momentumMult(b, "deletion")).toBe(MOMENTUM_CAP);
  });
  test("bumping one category leaves other categories and other branches untouched", () => {
    const b = bumpMomentum(branches[0], "deletion", true);
    expect(momentumMult(b, "lenition")).toBe(1);
    expect(momentumMult(branches[1], "deletion")).toBe(1); // original object, not mutated
  });
});

describe("decayMomentum", () => {
  test("decays a present category toward 1 by MOMENTUM_DECAY", () => {
    const b: Branch = { ...branches[0], momentum: { vowelShift: 1.6 } };
    const decayed = decayMomentum(b);
    expect(momentumMult(decayed, "vowelShift")).toBeCloseTo(1.6 - MOMENTUM_DECAY, 5);
  });
  test("never decays below 1 and drops the key once it reaches baseline", () => {
    const b: Branch = { ...branches[0], momentum: { vowelShift: 1 + MOMENTUM_DECAY / 2 } };
    const decayed = decayMomentum(b);
    expect(momentumMult(decayed, "vowelShift")).toBe(1);
    expect(decayed.momentum.vowelShift).toBeUndefined();
  });
  test("a branch with no momentum decays to an empty record without throwing", () => {
    expect(() => decayMomentum(branches[0])).not.toThrow();
    expect(decayMomentum(branches[0]).momentum).toEqual({});
  });
  test("repeated decay from cap eventually returns to exactly 1 (converges, never oscillates)", () => {
    let b: Branch = { ...branches[0], momentum: { epenthesis: MOMENTUM_CAP } };
    for (let i = 0; i < 50; i++) b = decayMomentum(b);
    expect(momentumMult(b, "epenthesis")).toBe(1);
  });
});
