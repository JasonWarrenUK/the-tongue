import { describe, test, expect } from "bun:test";
import { driftRule, biasedMult, firingRules } from "./phonology";
import { hashRand } from "./rng";
import type { Lexicon } from "./types";

// Mixed lexicon: some words end in a mid vowel (fires both apoc [deletion] and
// raise [vowelShift]), some end in a consonant (fires finalC [deletion]) — so
// both a contact-favoured and the isolation-favoured category are firing
// candidates for every roll, letting the bias tilt the outcome.
const MIXED_LEX: Lexicon = [
  { concept: "a", word: ["t", "a", "p", "e"] },   // ends in mid vowel "e" → apoc + raise
  { concept: "b", word: ["k", "o"] },               // ends in mid vowel "o" → apoc + raise
  { concept: "c", word: ["m", "a", "t"] },          // ends in consonant "t" → finalC
  { concept: "d", word: ["s", "i", "n"] },          // ends in consonant "n" → finalC
];

describe("biasedMult", () => {
  test("fully isolated (iso=1): deletion 0.5, vowelShift 1.7", () => {
    expect(biasedMult("deletion", 1)).toBeCloseTo(0.5, 5);
    expect(biasedMult("lenition", 1)).toBeCloseTo(0.51, 5);
    expect(biasedMult("assimilation", 1)).toBeCloseTo(0.72, 5);
    expect(biasedMult("vowelShift", 1)).toBeCloseTo(1.7, 5);
  });

  test("fully open (iso=0): deletion 1.7, vowelShift 0.5", () => {
    expect(biasedMult("deletion", 0)).toBeCloseTo(1.7, 5);
    expect(biasedMult("lenition", 0)).toBeCloseTo(1.49, 5);
    expect(biasedMult("assimilation", 0)).toBeCloseTo(1.28, 5);
    expect(biasedMult("vowelShift", 0)).toBeCloseTo(0.5, 5);
  });

  test("neutral (iso=0.5): every multiplier is 1.0", () => {
    expect(biasedMult("deletion", 0.5)).toBeCloseTo(1, 5);
    expect(biasedMult("lenition", 0.5)).toBeCloseTo(1, 5);
    expect(biasedMult("assimilation", 0.5)).toBeCloseTo(1, 5);
    expect(biasedMult("vowelShift", 0.5)).toBeCloseTo(1, 5);
  });

  test("multiplier never zeroes a rule or exceeds the 0.5-2.0 band", () => {
    for (const iso of [0, 0.25, 0.5, 0.75, 1]) {
      for (const c of ["deletion", "lenition", "assimilation", "vowelShift"] as const) {
        const m = biasedMult(c, iso);
        expect(m).toBeGreaterThanOrEqual(0.5);
        expect(m).toBeLessThanOrEqual(2);
      }
    }
  });
});

describe("driftRule bias", () => {
  const seed = 42, branchId = 3, sweep = 200;

  function categoryTally(iso: number): Record<string, number> {
    const tally: Record<string, number> = {};
    for (let turn = 0; turn < sweep; turn++) {
      const rule = driftRule(MIXED_LEX, seed, turn, branchId, iso);
      if (!rule) continue;
      tally[rule.category] = (tally[rule.category] || 0) + 1;
    }
    return tally;
  }

  test("isolated branch selects vowelShift more often than an open branch", () => {
    const isolated = categoryTally(1);
    const open = categoryTally(0);
    expect(isolated.vowelShift ?? 0).toBeGreaterThan(open.vowelShift ?? 0);
  });

  test("open branch selects deletion more often than an isolated branch", () => {
    const isolated = categoryTally(1);
    const open = categoryTally(0);
    expect(open.deletion ?? 0).toBeGreaterThan(isolated.deletion ?? 0);
  });

  test("neutral iso=0.5 reproduces the pre-2GEO.2 unbiased selection (regression guard)", () => {
    // Reimplements the old (pre-bias) driftRule roll directly against raw rule.w,
    // to confirm biasedMult(_, 0.5) === 1 leaves every roll unchanged.
    function unbiasedDriftRule(lex: Lexicon, s: number, t: number, b: number) {
      const firing = firingRules(lex);
      if (!firing.length) return null;
      const total = firing.reduce((a, x) => a + x.rule.w, 0);
      let roll = hashRand(s + 7, t * 131 + 17, b * 911 + 3) * total;
      for (const x of firing) { roll -= x.rule.w; if (roll <= 0) return x.rule; }
      return firing[firing.length - 1].rule;
    }
    for (let turn = 0; turn < 20; turn++) {
      const neutral = driftRule(MIXED_LEX, seed, turn, branchId, 0.5);
      const unbiased = unbiasedDriftRule(MIXED_LEX, seed, turn, branchId);
      expect(neutral?.id).toBe(unbiased?.id);
    }
  });

  test("determinism: same (seed,turn,branch,iso) → identical rule across repeated calls", () => {
    const a = driftRule(MIXED_LEX, seed, 5, branchId, 0.73);
    const b = driftRule(MIXED_LEX, seed, 5, branchId, 0.73);
    const c = driftRule(MIXED_LEX, seed, 5, branchId, 0.73);
    expect(a?.id).toBe(b?.id);
    expect(b?.id).toBe(c?.id);
  });
});
