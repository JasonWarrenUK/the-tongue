import { describe, test, expect } from "bun:test";
import { resolveBorrow, BORROW_RATE, BORROW_FAITHFUL_CUT } from "./borrowing";
import { formSimilarity } from "./intelligibility";
import { CONCEPTS } from "./lexicon";
import type { Branch, Edge, Lexicon } from "./types";

// Two water-terrain-adjacent branches, A (id 0, territory [0]) and B (id 1, territory
// [1]), sharing a single passable border edge — contact(A,B) = 1 (A's entire border is
// B). "fish" is water-salient (core, 0.5) and eligible; the pair diverges maximally on
// it (A's "fish" vs B's completely different form). A shares "eye" (never salient, thus
// never eligible) so an always-present, never-borrowable control concept exists too.
function mkBranch(id: number, territory: number[], lex: Lexicon): Branch {
  return {
    id, name: `Branch${id}`, parentId: null, depth: 0, splitIndex: 0, history: [],
    lex, territory, pressure: 0, anchors: [], assimilationPressure: 0,
  };
}

const LEX_A: Lexicon = [
  { concept: "fish", word: ["t", "a", "p"] },
  { concept: "eye", word: ["k", "o"] },
];
const LEX_B: Lexicon = [
  { concept: "fish", word: ["m", "u", "s"] }, // maximally divergent from A's "tap"
  { concept: "eye", word: ["k", "o"] },        // identical — never eligible anyway
];

// waterEdges: a single passable border edge between region 0 (A) and region 1 (B).
const waterEdges: Edge[] = [{ a: 0, b: 1, passable: true, cost: 1, name: "water" }];
const waterOwner = { 0: 0, 1: 1 };

describe("resolveBorrow", () => {
  test("high contact (>= BORROW_FAITHFUL_CUT) yields a faithful whole-copy of B's form", () => {
    const A = mkBranch(0, [0], LEX_A), B = mkBranch(1, [1], LEX_B);
    // seed/turn probed to land a roll well under BORROW_RATE * contact(=1) = 0.5
    const res = resolveBorrow(A, B, waterEdges, waterOwner, 3, 0);
    expect(res).not.toBeNull();
    expect(res!.faithful).toBe(true);
    expect(res!.word).toEqual(LEX_B.find((e) => e.concept === "fish")!.word);
    expect(res!.concept).toBe("fish");
  });

  test("low contact (< BORROW_FAITHFUL_CUT) yields a single-edit-step result, not a faithful copy", () => {
    // Give A three border edges, only one of which reaches B (id 1) — contact(A,B) = 1/3.
    const edges: Edge[] = [
      { a: 0, b: 1, passable: true, cost: 1, name: "water" },
      { a: 0, b: 2, passable: true, cost: 1, name: "water" },
      { a: 0, b: 3, passable: true, cost: 1, name: "water" },
    ];
    const owner = { 0: 0, 1: 1, 2: 2, 3: 3 };
    const A = mkBranch(0, [0], LEX_A), B = mkBranch(1, [1], LEX_B);
    // seed/turn probed to land a roll well under BORROW_RATE * contact(=1/3) ≈ 0.167
    const res = resolveBorrow(A, B, edges, owner, 2, 5);
    expect(res).not.toBeNull();
    expect(res!.faithful).toBe(false);
    const wa = LEX_A.find((e) => e.concept === "fish")!.word;
    const wb = LEX_B.find((e) => e.concept === "fish")!.word;
    expect(res!.word).not.toEqual(wb); // not a whole copy
    expect(formSimilarity(res!.word, wb)).toBeGreaterThan(formSimilarity(wa, wb)); // strictly closer
  });

  test("already-identical eligible set → null (no-op, no log-worthy event)", () => {
    const IDENTICAL_B: Lexicon = LEX_A.map((e) => ({ concept: e.concept, word: [...e.word] }));
    const A = mkBranch(0, [0], LEX_A), B = mkBranch(1, [1], IDENTICAL_B);
    const res = resolveBorrow(A, B, waterEdges, waterOwner, 3, 0);
    expect(res).toBeNull();
  });

  test("no eligible concept (lender's dominant terrain has zero-salience overlap with shared concepts) → null", () => {
    // Both branches only share "eye", which has zero salience under every terrain.
    const lexA: Lexicon = [{ concept: "eye", word: ["k", "o"] }];
    const lexB: Lexicon = [{ concept: "eye", word: ["p", "u"] }];
    const A = mkBranch(0, [0], lexA), B = mkBranch(1, [1], lexB);
    const res = resolveBorrow(A, B, waterEdges, waterOwner, 3, 0);
    expect(res).toBeNull();
  });

  test("does not fire when the roll lands above BORROW_RATE * contact", () => {
    const A = mkBranch(0, [0], LEX_A), B = mkBranch(1, [1], LEX_B);
    // seed=9,turn=0 probed to roll ~0.993, far above BORROW_RATE*contact(=1)=0.5
    const res = resolveBorrow(A, B, waterEdges, waterOwner, 9, 0);
    expect(res).toBeNull();
  });

  test("selects the eligible concept with the lowest formSimilarity (most-divergent)", () => {
    // Both "fish" and "river" are water-salient; make "river" the more divergent pair.
    const lexA: Lexicon = [
      { concept: "fish", word: ["t", "a"] },   // close to B's "ta" — sim high
      { concept: "river", word: ["k", "o"] },  // far from B's "zus" — sim low
    ];
    const lexB: Lexicon = [
      { concept: "fish", word: ["t", "a"] },
      { concept: "river", word: ["z", "u", "s"] },
    ];
    const A = mkBranch(0, [0], lexA), B = mkBranch(1, [1], lexB);
    const res = resolveBorrow(A, B, waterEdges, waterOwner, 3, 0);
    expect(res).not.toBeNull();
    expect(res!.concept).toBe("river");
  });

  test("ties resolve to the lowest CONCEPTS index deterministically", () => {
    // "fish" and "river" both water-salient, and pinned to identical similarity (both
    // fully divergent, sim=0). CONCEPTS lists "fish" before "river".
    const lexA: Lexicon = [
      { concept: "fish", word: ["t", "a"] },
      { concept: "river", word: ["k", "o"] },
    ];
    const lexB: Lexicon = [
      { concept: "fish", word: ["z", "u"] },
      { concept: "river", word: ["m", "e"] },
    ];
    expect(CONCEPTS.indexOf("fish")).toBeLessThan(CONCEPTS.indexOf("river"));
    const A = mkBranch(0, [0], lexA), B = mkBranch(1, [1], lexB);
    const res = resolveBorrow(A, B, waterEdges, waterOwner, 3, 0);
    expect(res!.concept).toBe("fish");
  });

  describe("determinism", () => {
    test("same seed+turn+pair → identical result", () => {
      const A = mkBranch(0, [0], LEX_A), B = mkBranch(1, [1], LEX_B);
      const r1 = resolveBorrow(A, B, waterEdges, waterOwner, 3, 0);
      const r2 = resolveBorrow(A, B, waterEdges, waterOwner, 3, 0);
      expect(r1).toEqual(r2);
    });

    test("borrowing's salt draws a different value than drift/spread/salience at the same (turn, branch)", async () => {
      const { hashRand } = await import("./rng");
      const seed = 3, turn = 0, id = 0;
      const borrowRoll = hashRand(seed + 19, turn * 181 + 41, id * 1009 + 1);
      const driftRoll = hashRand(seed + 7, turn * 131 + 17, id * 911 + 3);
      const spreadRoll = hashRand(seed, turn * 7 + 1, id * 13 + 5);
      const salienceRoll = hashRand(seed + 13, turn * 151 + 29, id * 733 + 0);
      expect(borrowRoll).not.toBeCloseTo(driftRoll, 5);
      expect(borrowRoll).not.toBeCloseTo(spreadRoll, 5);
      expect(borrowRoll).not.toBeCloseTo(salienceRoll, 5);
    });
  });

  test("constants are the tuned first-pass values from the spike", () => {
    expect(BORROW_RATE).toBe(0.5);
    expect(BORROW_FAITHFUL_CUT).toBe(0.5);
  });
});
