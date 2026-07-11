import { describe, test, expect } from "bun:test";
import { driftRule, biasedMult, firingRules, applyRuleToLex, applyRuleToWord, RULE_BY_ID, MAX_LEN } from "./phonology";
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

describe("applyRuleToLex salience gating (2GEO.3)", () => {
  const apoc = RULE_BY_ID.apoc; // vowel → ∅ / _ # — fires on any word ending in a vowel
  // "stone" is core-salient (0.5) for mountain terrain; "unrelated" has no
  // salience entry for mountain (0) — see SALIENCE_CORE/SECONDARY in lexicon.ts.
  // Words carry a second vowel so deletion leaves at least one vowel behind
  // (applyRuleToWord rejects a change that would zero out all vowels).
  const LEX: Lexicon = [
    { concept: "stone", word: ["m", "a", "t", "a"] },
    { concept: "unrelated", word: ["t", "i", "p", "a"] },
  ];
  const seed = 99, branchId = 4;

  test("no salience context: behaviour is unchanged from pre-2GEO.3 (both words drift)", () => {
    const { lex, fires } = applyRuleToLex(LEX, apoc);
    expect(fires).toBe(2);
    expect(lex[0].word).toEqual(["m", "a", "t"]);
    expect(lex[1].word).toEqual(["t", "i", "p"]);
  });

  test("non-salient concept (retention 0) is never blocked: matches ungated output every turn", () => {
    for (let turn = 0; turn < 50; turn++) {
      const gated = applyRuleToLex(LEX, apoc, { terrain: "mountain", seed, turn, branchId });
      const ungated = applyRuleToLex(LEX, apoc);
      expect(gated.lex[1].word).toEqual(ungated.lex[1].word);
    }
  });

  test("salient concept drifts strictly less often than a non-salient concept over a turn sweep", () => {
    let stoneChanged = 0, unrelatedChanged = 0;
    const sweep = 300;
    for (let turn = 0; turn < sweep; turn++) {
      const { lex } = applyRuleToLex(LEX, apoc, { terrain: "mountain", seed, turn, branchId });
      if (lex[0].word.length < LEX[0].word.length) stoneChanged++;
      if (lex[1].word.length < LEX[1].word.length) unrelatedChanged++;
    }
    expect(unrelatedChanged).toBe(sweep); // retention 0 — always drifts
    expect(stoneChanged).toBeLessThan(unrelatedChanged); // retention 0.5 — blocked roughly half the time
    expect(stoneChanged).toBeGreaterThan(0); // not fully frozen
  });

  test("determinism: same salience context → identical output across repeated calls", () => {
    const ctx = { terrain: "mountain" as const, seed, turn: 12, branchId };
    const a = applyRuleToLex(LEX, apoc, ctx);
    const b = applyRuleToLex(LEX, apoc, ctx);
    expect(a.lex).toEqual(b.lex);
    expect(a.fires).toBe(b.fires);
  });

  test("firingRules selection stays terrain-agnostic (fires count matches ungated form)", () => {
    // firingRules internally calls applyRuleToLex without a salience context —
    // confirms drift-rule selection weighting is unaffected by 2GEO.3.
    const firing = firingRules(LEX);
    const apocEntry = firing.find((f) => f.rule.id === "apoc");
    expect(apocEntry?.fires).toBe(2);
  });
});

// 1ENG.12 — widening applyRuleToWord to a 1->N transducer (1eng-11 spike §3).
describe("applyRuleToWord backward compatibility (1ENG.12 regression goldens)", () => {
  test("voice: [a,p,a] -> [a,b,a]", () => {
    const r = applyRuleToWord(["a", "p", "a"], RULE_BY_ID.voice);
    expect(r).toEqual({ ids: ["a", "b", "a"], changed: true });
  });
  test("apoc: [t,a,p,e] -> [t,a,p]", () => {
    const r = applyRuleToWord(["t", "a", "p", "e"], RULE_BY_ID.apoc);
    expect(r).toEqual({ ids: ["t", "a", "p"], changed: true });
  });
  test("cluster: [a,p,t,a] -> [a,t,a]", () => {
    const r = applyRuleToWord(["a", "p", "t", "a"], RULE_BY_ID.cluster);
    expect(r).toEqual({ ids: ["a", "t", "a"], changed: true });
  });
  test("apoc on [p,a]: guard refuses (would zero the only vowel) -> unchanged", () => {
    const r = applyRuleToWord(["p", "a"], RULE_BY_ID.apoc);
    expect(r).toEqual({ ids: ["p", "a"], changed: false });
  });
  test("every original 9 rules still resolve through the self-seg path unchanged", () => {
    const ORIGINAL_IDS = ["voice", "spirant", "devoice", "apoc", "finalC", "palat", "debucc", "raise", "nasassim", "cluster"];
    for (const id of ORIGINAL_IDS) expect(RULE_BY_ID[id]).toBeDefined();
  });
});

describe("epenth / break (renewal rules)", () => {
  // break is unconditioned (fires on any word-final vowel, not only a pre-existing
  // mid vowel after hiatus) — this is what lets renewal bootstrap from a fully-eroded
  // CV/V floor, where no cluster or hiatus survives for epenth/the old break to exploit.
  test("break: [a,e] -> [a,ie] (front V word-finally)", () => {
    const r = applyRuleToWord(["a", "e"], RULE_BY_ID.break);
    expect(r).toEqual({ ids: ["a", "ie"], changed: true });
  });
  test("break: [a,o] -> [a,uo] (back V word-finally)", () => {
    const r = applyRuleToWord(["a", "o"], RULE_BY_ID.break);
    expect(r).toEqual({ ids: ["a", "uo"], changed: true });
  });
  test("break fires on a bare single-vowel word (the ossification floor)", () => {
    const r = applyRuleToWord(["a"], RULE_BY_ID.break);
    expect(r).toEqual({ ids: ["ie"], changed: true }); // "a" is a front (non-back) vowel
  });
  test("break does not fire on a non-final vowel", () => {
    const r = applyRuleToWord(["e", "t"], RULE_BY_ID.break);
    expect(r).toEqual({ ids: ["e", "t"], changed: false });
  });
  test("epenth: [a,t,r,a] -> [a,t,i,r,a] (cluster broken)", () => {
    const r = applyRuleToWord(["a", "t", "r", "a"], RULE_BY_ID.epenth);
    expect(r).toEqual({ ids: ["a", "t", "i", "r", "a"], changed: true });
  });
  test("epenth does not fire without a cluster", () => {
    const r = applyRuleToWord(["a", "t", "a"], RULE_BY_ID.epenth);
    expect(r).toEqual({ ids: ["a", "t", "a"], changed: false });
  });
  // paragoge — the other bootstrap mechanism: unconditioned word-final vowel
  // epenthesis after a consonant, firing even without a pre-existing cluster.
  test("paragoge: [m,a,t] -> [m,a,t,i] (consonant-final word gains a final vowel)", () => {
    const r = applyRuleToWord(["m", "a", "t"], RULE_BY_ID.paragoge);
    expect(r).toEqual({ ids: ["m", "a", "t", "i"], changed: true });
  });
  test("paragoge fires on the bare [C]V ossification floor's consonant-final sibling", () => {
    const r = applyRuleToWord(["m"], RULE_BY_ID.paragoge);
    expect(r.changed).toBe(true);
    expect(r.ids[r.ids.length - 1]).toBe("i");
  });
  test("paragoge does not fire on a vowel-final word", () => {
    const r = applyRuleToWord(["m", "a"], RULE_BY_ID.paragoge);
    expect(r).toEqual({ ids: ["m", "a"], changed: false });
  });
});

describe("smooth / shorten (erosion of the new renewal structure)", () => {
  test("smooth: [a,ie] -> [a,e] (front diphthong -> mid V)", () => {
    const r = applyRuleToWord(["a", "ie"], RULE_BY_ID.smooth);
    expect(r).toEqual({ ids: ["a", "e"], changed: true });
  });
  test("smooth: [a,uo] -> [a,o] (back diphthong -> mid V)", () => {
    const r = applyRuleToWord(["a", "uo"], RULE_BY_ID.smooth);
    expect(r).toEqual({ ids: ["a", "o"], changed: true });
  });
  // Seed-only diphthongs (lexicon.ts DIPHTHONGS) that `break` itself never produces —
  // smooth must key off each diphthong's own nucleus, not just offglide==="o", or these
  // silently monophthongise to the wrong vowel (regression: all four collapsed to "e").
  test("smooth: [a,ei] -> [a,e] (front nucleus -> mid V)", () => {
    const r = applyRuleToWord(["a", "ei"], RULE_BY_ID.smooth);
    expect(r).toEqual({ ids: ["a", "e"], changed: true });
  });
  test("smooth: [a,ou] -> [a,o] (back nucleus -> mid V)", () => {
    const r = applyRuleToWord(["a", "ou"], RULE_BY_ID.smooth);
    expect(r).toEqual({ ids: ["a", "o"], changed: true });
  });
  test("smooth: [a,au] -> [a,e] (front nucleus -> mid V)", () => {
    const r = applyRuleToWord(["a", "au"], RULE_BY_ID.smooth);
    expect(r).toEqual({ ids: ["a", "e"], changed: true });
  });
  test("smooth: [a,ai] -> [a,e] (front nucleus -> mid V)", () => {
    const r = applyRuleToWord(["a", "ai"], RULE_BY_ID.smooth);
    expect(r).toEqual({ ids: ["a", "e"], changed: true });
  });
  test("smooth does not fire on a monophthong", () => {
    const r = applyRuleToWord(["a", "e"], RULE_BY_ID.smooth);
    expect(r).toEqual({ ids: ["a", "e"], changed: false });
  });
  test("shorten: [a,aː] -> [a,a] word-finally", () => {
    const r = applyRuleToWord(["a", "aː"], RULE_BY_ID.shorten);
    expect(r).toEqual({ ids: ["a", "a"], changed: true });
  });
  test("shorten does not fire on a short vowel", () => {
    const r = applyRuleToWord(["a", "a"], RULE_BY_ID.shorten);
    expect(r).toEqual({ ids: ["a", "a"], changed: false });
  });
  test("shorten does not fire on a non-final long vowel", () => {
    const r = applyRuleToWord(["aː", "t", "a"], RULE_BY_ID.shorten);
    expect(r).toEqual({ ids: ["aː", "t", "a"], changed: false });
  });
});

describe("biasedMult epenthesis (1ENG.12)", () => {
  test("fully isolated (iso=1): epenthesis ~1.56", () => {
    expect(biasedMult("epenthesis", 1)).toBeCloseTo(1.56, 5);
  });
  test("fully open (iso=0): epenthesis clamps to 0.5", () => {
    expect(biasedMult("epenthesis", 0)).toBeCloseTo(0.5, 5);
  });
  test("neutral (iso=0.5): epenthesis is 1.0", () => {
    expect(biasedMult("epenthesis", 0.5)).toBeCloseTo(1, 5);
  });
  test("stays within the 0.5-2.0 band across the iso sweep", () => {
    for (const iso of [0, 0.25, 0.5, 0.75, 1]) {
      const m = biasedMult("epenthesis", iso);
      expect(m).toBeGreaterThanOrEqual(0.5);
      expect(m).toBeLessThanOrEqual(2);
    }
  });
});

describe("erosion<->renewal cycle (1ENG.12, 1eng-11 spike §4.5)", () => {
  const seed = 7, branchId = 1;
  // A lexicon that starts already fairly minimal, so the sweep exercises the
  // ossification edge the spike diagnosed (firingRules emptying out) rather
  // than just burning through the original 9 reductive rules first.
  const START: Lexicon = [
    { concept: "a", word: ["a", "t", "e"] },
    { concept: "b", word: ["m", "a", "t", "r", "a"] },
    { concept: "c", word: ["s", "i", "n"] },
    { concept: "d", word: ["k", "o"] },
  ];

  function sweep(iso: number, turns: number, useRenewal: boolean) {
    let lex = START;
    let nonNull = 0;
    const maxLenSeen: number[] = [];
    for (let turn = 0; turn < turns; turn++) {
      const rule = useRenewal
        ? driftRule(lex, seed, turn, branchId, iso)
        : (() => {
            // Renewal-disabled control: pick among firing rules restricted to the
            // original 9 reductive ids, to prove renewal is what prevents ossification.
            const ORIGINAL = new Set(["voice", "spirant", "devoice", "apoc", "finalC", "palat", "debucc", "raise", "nasassim", "cluster"]);
            const firing = firingRules(lex).filter((f) => ORIGINAL.has(f.rule.id));
            if (!firing.length) return null;
            const total = firing.reduce((a, x) => a + x.rule.w, 0);
            let roll = hashRand(seed + 7, turn * 131 + 17, branchId * 911 + 3) * total;
            for (const x of firing) { roll -= x.rule.w; if (roll <= 0) return x.rule; }
            return firing[firing.length - 1].rule;
          })();
      if (rule) {
        nonNull++;
        lex = applyRuleToLex(lex, rule).lex;
      }
      maxLenSeen.push(Math.max(...lex.map((e) => e.word.length)));
    }
    return { nonNull, lex, maxLenSeen };
  }

  test("with renewal, an isolated branch keeps drifting over 200 turns (>=95% non-null)", () => {
    const { nonNull } = sweep(1, 200, true);
    expect(nonNull / 200).toBeGreaterThanOrEqual(0.95);
  });

  test("renewal-disabled control ossifies (drops to all-null well before 200 turns)", () => {
    const { nonNull } = sweep(1, 200, false);
    expect(nonNull).toBeLessThan(200);
  });

  test("no unbounded growth: every word stays within MAX_LEN across a 200-turn sweep", () => {
    const { maxLenSeen } = sweep(1, 200, true);
    for (const len of maxLenSeen) expect(len).toBeLessThanOrEqual(MAX_LEN);
  });

  test("determinism: a full 50-turn transcript is byte-identical across two runs", () => {
    const a = sweep(0.8, 50, true);
    const b = sweep(0.8, 50, true);
    expect(a.lex).toEqual(b.lex);
    expect(a.nonNull).toBe(b.nonNull);
  });
});

describe("driftRule null guard (1ENG.12)", () => {
  // break (any word-final V) + paragoge (any word-final C) between them guarantee at
  // least one firing rule for every non-empty word: a word ends in either a vowel or
  // a consonant, never neither. So the "permanent ossification" state the original
  // spike worried about is no longer reachable for any real word — every minimal
  // lexicon the old 9-rule set would have frozen now has a live move.
  test("every single-phone word has at least one firing rule (no reachable dead end)", () => {
    for (const w of [["i"], ["a"], ["u"], ["m"], ["p"], ["t"]]) {
      expect(firingRules([{ concept: "x", word: w }]).length).toBeGreaterThan(0);
    }
  });
  test("a lexicon that would have ossified under the original 9-rule set now keeps drifting", () => {
    const LEX: Lexicon = [{ concept: "a", word: ["i"] }, { concept: "b", word: ["a"] }, { concept: "c", word: ["u"] }];
    expect(() => driftRule(LEX, 1, 1, 1, 0.5)).not.toThrow();
    expect(driftRule(LEX, 1, 1, 1, 0.5)).not.toBeNull();
  });
  // The guard itself (phonology.ts driftRule: `if (!firing.length) return null`) is
  // kept as a defensive backstop per the spike (§6) — it is no longer known to be
  // reachable, but a function computing over an emptied-out RULES array (e.g. a
  // future refactor) should still degrade to null rather than throw.
  test("driftRule never throws, even on a pathological empty ruleset input (regression safety)", () => {
    const EMPTY: Lexicon = [];
    expect(() => driftRule(EMPTY, 1, 1, 1, 0.5)).not.toThrow();
    expect(driftRule(EMPTY, 1, 1, 1, 0.5)).toBeNull();
  });
});
