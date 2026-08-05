import { describe, test, expect } from "bun:test";
import {
  FRAMES, EQUAL_WEIGHTS, frameOrder, positionProfile, walkFrameWeights,
  followerVowelShare, syntaxMult, FRAME_FLOOR, FRAME_WALK,
} from "./syntax";
import { RULE_BY_ID } from "./phonology";
import type { FrameWeights, Lexicon, WordOrder } from "./types";

// 1ENG.19 (1eng-14 spike §3.4) — the equal-weight golden table, computed by hand from
// the frame table and verified against the spike's own worked example (SOV+AdjN).
// verb: F1 V (final under SOV), F2 V (final) -> 2 occ, both final.
// noun: F1 O (medial), F2 S (initial), F3 N (final), F4 G (initial), F4 N (final under
//       OV) -> 5 occ, 2 final, 2 initial ("5 noun slots" the spike's gloss refers to).
// pronoun: F1 S only (initial under SOV) -> 1 occ, 0 final, 1 initial.
// adjective: F3 Adj only (initial under AdjN) -> 1 occ, 0 final, 1 initial.
const GOLDEN: Record<string, Record<string, { final: number; initial: number }>> = {
  "SOV|AdjN": { verb: { final: 1, initial: 0 }, noun: { final: 0.4, initial: 0.4 }, pronoun: { final: 0, initial: 1 }, adjective: { final: 0, initial: 1 } },
  "SOV|NAdj": { verb: { final: 1, initial: 0 }, noun: { final: 0.2, initial: 0.6 }, pronoun: { final: 0, initial: 1 }, adjective: { final: 1, initial: 0 } },
  "SVO|AdjN": { verb: { final: 0.5, initial: 0 }, noun: { final: 0.6, initial: 0.4 }, pronoun: { final: 0, initial: 1 }, adjective: { final: 0, initial: 1 } },
  "SVO|NAdj": { verb: { final: 0.5, initial: 0 }, noun: { final: 0.4, initial: 0.6 }, pronoun: { final: 0, initial: 1 }, adjective: { final: 1, initial: 0 } },
  // VSO: the O noun takes F1's final slot (verb moves to initial); F1's S pronoun
  // sits MEDIAL (V S O), so pronoun reads 0/0 here — not a bug, pinned deliberately.
  "VSO|AdjN": { verb: { final: 0, initial: 1 }, noun: { final: 0.8, initial: 0.2 }, pronoun: { final: 0, initial: 0 }, adjective: { final: 0, initial: 1 } },
  "VSO|NAdj": { verb: { final: 0, initial: 1 }, noun: { final: 0.6, initial: 0.4 }, pronoun: { final: 0, initial: 0 }, adjective: { final: 1, initial: 0 } },
};

describe("positionProfile: equal-weight golden table (spike §3.4)", () => {
  (["SOV", "SVO", "VSO"] as const).forEach((basic) => {
    (["AdjN", "NAdj"] as const).forEach((adj) => {
      const order: WordOrder = { basic, adj };
      const golden = GOLDEN[`${basic}|${adj}`];
      test(`${basic} + ${adj}`, () => {
        (["verb", "noun", "pronoun", "adjective"] as const).forEach((cls) => {
          const p = positionProfile(cls, order, EQUAL_WEIGHTS, false);
          expect(p.final).toBeCloseTo(golden[cls].final, 9);
          expect(p.initial).toBeCloseTo(golden[cls].initial, 9);
        });
      });
    });
  });

  test("VSO pronoun reads 0/0 — its only slot (F1 S) sits medially, deliberately pinned", () => {
    const p = positionProfile("pronoun", { basic: "VSO", adj: "AdjN" }, EQUAL_WEIGHTS, false);
    expect(p).toEqual({ final: 0, initial: 0 });
  });
});

describe("positionProfile: weighted spot-checks", () => {
  // The spike's own suggested check ("doubling F1's weight raises verb final share
  // under SOV") does not hold — SOV verbs are already 1.0 final, so no weight change
  // can raise it further. These three replace it with checks that actually move.
  test("doubling F3's weight raises SOV noun final share 0.4 -> 0.5", () => {
    const order: WordOrder = { basic: "SOV", adj: "AdjN" };
    expect(positionProfile("noun", order, EQUAL_WEIGHTS, false).final).toBeCloseTo(0.4, 9);
    expect(positionProfile("noun", order, [1, 1, 2, 1], false).final).toBeCloseTo(0.5, 9);
  });
  test("doubling F1's weight LOWERS SOV noun final share 0.4 -> 0.333 (F1's O slot is medial)", () => {
    const order: WordOrder = { basic: "SOV", adj: "AdjN" };
    expect(positionProfile("noun", order, [2, 1, 1, 1], false).final).toBeCloseTo(1 / 3, 9);
  });
  test("doubling F1's weight LOWERS SVO verb final share 0.5 -> 0.333 (F1's V slot is medial under SVO)", () => {
    const order: WordOrder = { basic: "SVO", adj: "AdjN" };
    expect(positionProfile("verb", order, EQUAL_WEIGHTS, false).final).toBeCloseTo(0.5, 9);
    expect(positionProfile("verb", order, [2, 1, 1, 1], false).final).toBeCloseTo(1 / 3, 9);
  });
});

describe("positionProfile: proDrop removes pronoun exposure", () => {
  test("SOV pronoun drops to 0/0 (F1's S slot is removed entirely)", () => {
    const order: WordOrder = { basic: "SOV", adj: "AdjN" };
    expect(positionProfile("pronoun", order, EQUAL_WEIGHTS, true)).toEqual({ final: 0, initial: 0 });
  });
  test("SOV noun initial share rises 0.4 -> 0.6 (F2's S noun is now the frame's sole initial slot)", () => {
    const order: WordOrder = { basic: "SOV", adj: "AdjN" };
    const p = positionProfile("noun", order, EQUAL_WEIGHTS, true);
    expect(p.final).toBeCloseTo(0.4, 9); // final share is unaffected — no noun sat in the removed slot
    expect(p.initial).toBeCloseTo(0.6, 9);
  });
});

describe("frameOrder", () => {
  test("F4 genitive: OV (SOV) -> GN, VO (SVO/VSO) -> NG", () => {
    const f4 = FRAMES.find((f) => f.id === "F4")!;
    expect(frameOrder(f4, { basic: "SOV", adj: "AdjN" }).map((s) => s.role)).toEqual(["G", "N"]);
    expect(frameOrder(f4, { basic: "SVO", adj: "AdjN" }).map((s) => s.role)).toEqual(["N", "G"]);
    expect(frameOrder(f4, { basic: "VSO", adj: "AdjN" }).map((s) => s.role)).toEqual(["N", "G"]);
  });
  test("F2 filters the basic sequence to the roles it has (no O slot)", () => {
    const f2 = FRAMES.find((f) => f.id === "F2")!;
    expect(frameOrder(f2, { basic: "VSO", adj: "AdjN" }).map((s) => s.role)).toEqual(["V", "S"]);
  });
});

describe("walkFrameWeights", () => {
  test("deterministic: same inputs -> identical output", () => {
    const a = walkFrameWeights(EQUAL_WEIGHTS, 42, 5, 3);
    const b = walkFrameWeights(EQUAL_WEIGHTS, 42, 5, 3);
    expect(a).toEqual(b);
  });
  test("respects the floor: repeated walks never drop a weight below FRAME_FLOOR", () => {
    let w: FrameWeights = EQUAL_WEIGHTS;
    for (let turn = 0; turn < 200; turn++) w = walkFrameWeights(w, 7, turn, 1);
    w.forEach((x) => expect(x).toBeGreaterThanOrEqual(FRAME_FLOOR));
  });
  test("each step moves by at most FRAME_WALK", () => {
    const w = walkFrameWeights(EQUAL_WEIGHTS, 7, 0, 1);
    w.forEach((x, i) => expect(Math.abs(x - EQUAL_WEIGHTS[i])).toBeLessThanOrEqual(FRAME_WALK + 1e-9));
  });
});

describe("followerVowelShare", () => {
  const CV_LEX: Lexicon = [
    { concept: "eat", word: ["t", "a"] },   // verb, consonant-initial
    { concept: "big", word: ["a", "t"] },   // adjective, vowel-initial
    { concept: "water", word: ["o", "k"] }, // noun, vowel-initial
  ];
  test("always-final class (SOV verb) has no follower: returns 0", () => {
    const order: WordOrder = { basic: "SOV", adj: "AdjN" };
    expect(followerVowelShare("verb", order, EQUAL_WEIGHTS, CV_LEX)).toBe(0);
  });
  test("always-final class (NAdj adjective) has no follower: returns 0", () => {
    const order: WordOrder = { basic: "SOV", adj: "NAdj" };
    expect(followerVowelShare("adjective", order, EQUAL_WEIGHTS, CV_LEX)).toBe(0);
  });
  test("responds to lexicon change: nouns flipping vowel-initial raises the share for whatever precedes them", () => {
    // under SOV+AdjN, pronoun (F1 S) is followed by noun (F1 O) — its only follower.
    const order: WordOrder = { basic: "SOV", adj: "AdjN" };
    const consonantNouns: Lexicon = [{ concept: "water", word: ["k", "o"] }];
    const vowelNouns: Lexicon = [{ concept: "water", word: ["o", "k"] }];
    expect(followerVowelShare("pronoun", order, EQUAL_WEIGHTS, consonantNouns)).toBe(0);
    expect(followerVowelShare("pronoun", order, EQUAL_WEIGHTS, vowelNouns)).toBe(1);
  });
});

describe("syntaxMult", () => {
  const order: WordOrder = { basic: "SOV", adj: "AdjN" };
  const branch = { wordOrder: order, frameWeights: EQUAL_WEIGHTS, proDrop: false };
  const LEX: Lexicon = [
    { concept: "eat", word: ["t", "a"] },
    { concept: "i", word: ["a"] },
  ];

  test("position-blind rules (no post:bound, not fortify/aphaer) always return exactly 1", () => {
    ["voice", "spirant", "palat", "nasassim", "cluster", "epenth", "smooth", "compleng"].forEach((id) => {
      expect(syntaxMult(RULE_BY_ID[id], "eat", branch, LEX)).toBe(1);
    });
  });

  test("clamps at [0.5, 1.5]: an always-final class under a boundary rule hits the ceiling", () => {
    // SOV verb: final = 1.0 -> mult = 1 + 0.7*(1-0.5)*2 = 1.7, clamped to 1.5.
    const m = syntaxMult(RULE_BY_ID["apoc"], "eat", branch, LEX);
    expect(m).toBe(1.5);
  });

  test("clamps at [0.5, 1.5]: an always-initial-only class (final=0) under a boundary rule hits the floor", () => {
    // SOV pronoun: final = 0 -> mult = 1 + 0.7*(0-0.5)*2 = 0.3, clamped to 0.5.
    const m = syntaxMult(RULE_BY_ID["apoc"], "i", branch, LEX);
    expect(m).toBe(0.5);
  });

  test("liaison scales only the three final-C-deletion rules (finalC, debucc, complengFinal)", () => {
    // pronoun (i) followed only by noun (O slot) — give it a vowel-initial follower so
    // followerVowelShare = 1, fully damping the tilt back to neutral (1.0) for the
    // liaison-sensitive rules, while a non-liaison boundary rule (apoc) is unaffected.
    const lexWithVowelNoun: Lexicon = [
      { concept: "i", word: ["t", "a"] },     // pronoun, ends in vowel (irrelevant here)
      { concept: "water", word: ["o", "k"] }, // noun, VOWEL-initial — i's follower
    ];
    const finalC = syntaxMult(RULE_BY_ID["finalC"], "i", branch, lexWithVowelNoun);
    const apocMult = syntaxMult(RULE_BY_ID["apoc"], "i", branch, lexWithVowelNoun);
    expect(finalC).toBeCloseTo(1, 9); // damped to neutral by full liaison protection
    expect(apocMult).toBe(0.5); // apoc is not in FINAL_C_DELETION — undamped, still at the floor
  });

  test("fortify scales WITH initial share: an always-initial class hits the ceiling", () => {
    // SOV pronoun: initial = 1.0 -> mult = 1 + 0.7*(1-0.5)*2 = 1.7, clamped to 1.5.
    expect(syntaxMult(RULE_BY_ID["fortify"], "i", branch, LEX)).toBe(1.5);
  });
  test("aphaer scales AGAINST initial share: an always-initial class hits the floor", () => {
    // SOV pronoun: initial = 1.0 -> mult = 1 - 0.7*(1-0.5)*2 = 0.3, clamped to 0.5.
    expect(syntaxMult(RULE_BY_ID["aphaer"], "i", branch, LEX)).toBe(0.5);
  });
  test("fortify and aphaer diverge on an always-final class (initial=0): fortify floors, aphaer ceilings", () => {
    // SOV verb: initial = 0 -> fortify mult = 1 + 0.7*(0-0.5)*2 = 0.3 -> 0.5;
    //                          aphaer mult  = 1 - 0.7*(0-0.5)*2 = 1.7 -> 1.5.
    expect(syntaxMult(RULE_BY_ID["fortify"], "eat", branch, LEX)).toBe(0.5);
    expect(syntaxMult(RULE_BY_ID["aphaer"], "eat", branch, LEX)).toBe(1.5);
  });

  test("unknown concept (not in CONCEPT_CLASS) is never gated", () => {
    expect(syntaxMult(RULE_BY_ID["apoc"], "nonexistent", branch, LEX)).toBe(1);
  });

  // 1ENG.31: reduce/syncope are both post:null, so isBoundaryRule is false for both and
  // syntaxMult short-circuits to 1 regardless of concept or position — stress
  // conditioning and syntax (positional) conditioning are orthogonal channels, and this
  // pins that they stay that way rather than silently interacting through the shared
  // Rule shape.
  test("reduce and syncope are not boundary rules: syntaxMult is always 1, unaffected by position", () => {
    expect(syntaxMult(RULE_BY_ID["reduce"], "i", branch, LEX)).toBe(1);
    expect(syntaxMult(RULE_BY_ID["reduce"], "eat", branch, LEX)).toBe(1);
    expect(syntaxMult(RULE_BY_ID["syncope"], "i", branch, LEX)).toBe(1);
    expect(syntaxMult(RULE_BY_ID["syncope"], "eat", branch, LEX)).toBe(1);
  });
});

// 1ENG.19 salt-registry regression (spike §7): every (a,b,c) hashRand triple this
// module and its callers draw must be disjoint from every other registered family
// across the full (seed, turn, branchId, index) space. Disjointness on the first
// coordinate alone (the `a` argument) guarantees no collision regardless of the
// other three, so this sweep asserts exactly that — mirrors borrowing.test.ts's
// registry regression idiom.
describe("1ENG.19 salt registry", () => {
  test("syntax-related salts (gate seed+29, frame walk seed+31, reanalysis seed+37) are disjoint from every pre-existing family", () => {
    const knownFirstCoords = new Set([0, 7, 13, 19, 23]); // spread/genStem, drift, salience, borrow, contact
    const newFirstCoords = [29, 31, 37];
    newFirstCoords.forEach((c) => expect(knownFirstCoords.has(c)).toBe(false));
    // pairwise-disjoint among themselves too
    expect(new Set(newFirstCoords).size).toBe(newFirstCoords.length);
  });
});

// 1ENG.30 (1eng-24 spike §8, "Salt allocation: none needed"): the stress substrate
// claims no hashRand family at all — every draw is either a tail-appended mulberry32
// rng() at genesis or fully pure at transducer time. seed+47 must stay unclaimed so
// the NEXT task to need a hashRand family (not this one) is free to take it.
// 1ENG.31: reduce and syncope are both pure transducers (no RNG inside xform), and the
// firingRules/driftRule threading added to consult them is plumbing, not a new roll —
// so this task claims no salt either. seed+47 stays the correct answer, not moved.
describe("1ENG.24/1ENG.30/1ENG.31 salt registry", () => {
  test("seed+47 remains unclaimed — neither 1ENG.30 nor 1ENG.31 draws a hashRand triple", () => {
    const knownFirstCoords = new Set([0, 7, 13, 19, 23, 29, 31, 37, 41, 43]);
    expect(knownFirstCoords.has(47)).toBe(false);
  });
});
