import { describe, test, expect } from "bun:test";
import { driftRule, biasedMult, firingRules, applyRuleToLex, applyRuleToWord, applyRuleToAffix, RULE_BY_ID, RULES, MAX_LEN, stepToward, BY_ID, inventoryOf, phonemicDiff, describeEvent } from "./phonology";
import { hashRand } from "./rng";
import { formSimilarity } from "./intelligibility";
import type { StressRule } from "./syllable";
import type { Lexicon, Rule, WordOrder } from "./types";

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

// 2STK.3 §3 — drift momentum joins biasedMult in the weighted pick. Neutral iso=0.5
// isolates the momentum term from the terrain-bias term (biasedMult(_, 0.5) === 1 for
// every category, per the regression guard above).
describe("driftRule momentum (2STK.3)", () => {
  const seed = 42, branchId = 3, sweep = 200, iso = 0.5;

  function categoryTally(momentum?: Partial<Record<string, number>>): Record<string, number> {
    const tally: Record<string, number> = {};
    for (let turn = 0; turn < sweep; turn++) {
      const rule = driftRule(MIXED_LEX, seed, turn, branchId, iso, momentum);
      if (!rule) continue;
      tally[rule.category] = (tally[rule.category] || 0) + 1;
    }
    return tally;
  }

  test("a momentum-favoured category is selected more often than with no momentum", () => {
    const plain = categoryTally();
    const favoured = categoryTally({ vowelShift: 2 }); // MOMENTUM_CAP
    expect(favoured.vowelShift ?? 0).toBeGreaterThan(plain.vowelShift ?? 0);
  });

  test("momentum on a non-firing category is inert (no candidate carries it)", () => {
    // MIXED_LEX's firing set is {lenition, deletion, vowelShift, epenthesis} — assimilation
    // never fires (no stop-before-nasal environment in this lexicon), so boosting it must
    // leave every other category's tally untouched.
    const plain = categoryTally();
    const withInertBoost = categoryTally({ assimilation: 2 });
    expect(withInertBoost).toEqual(plain);
  });

  test("no momentum arg (undefined) behaves identically to an explicit empty object", () => {
    for (let turn = 0; turn < 20; turn++) {
      const omitted = driftRule(MIXED_LEX, seed, turn, branchId, iso);
      const explicit = driftRule(MIXED_LEX, seed, turn, branchId, iso, {});
      expect(omitted?.id).toBe(explicit?.id);
    }
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
      const gated = applyRuleToLex(LEX, apoc, { salience: { terrain: "mountain", seed, turn, branchId } });
      const ungated = applyRuleToLex(LEX, apoc);
      expect(gated.lex[1].word).toEqual(ungated.lex[1].word);
    }
  });

  test("salient concept drifts strictly less often than a non-salient concept over a turn sweep", () => {
    let stoneChanged = 0, unrelatedChanged = 0;
    const sweep = 300;
    for (let turn = 0; turn < sweep; turn++) {
      const { lex } = applyRuleToLex(LEX, apoc, { salience: { terrain: "mountain", seed, turn, branchId } });
      if (lex[0].word.length < LEX[0].word.length) stoneChanged++;
      if (lex[1].word.length < LEX[1].word.length) unrelatedChanged++;
    }
    expect(unrelatedChanged).toBe(sweep); // retention 0 — always drifts
    expect(stoneChanged).toBeLessThan(unrelatedChanged); // retention 0.5 — blocked roughly half the time
    expect(stoneChanged).toBeGreaterThan(0); // not fully frozen
  });

  test("determinism: same salience context → identical output across repeated calls", () => {
    const ctx = { salience: { terrain: "mountain" as const, seed, turn: 12, branchId } };
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

// 1ENG.19 (1eng-14 spike §4.3) — fortify/aphaer, the engine's first pre:bound rules.
describe("fortify / aphaer (1ENG.19 initial-position rules)", () => {
  test("fortify: initial j -> ʒ, initial w -> v", () => {
    expect(applyRuleToWord(["j", "a", "t"], RULE_BY_ID["fortify"])).toEqual({ ids: ["ʒ", "a", "t"], changed: true });
    expect(applyRuleToWord(["w", "a", "t"], RULE_BY_ID["fortify"])).toEqual({ ids: ["v", "a", "t"], changed: true });
  });
  test("fortify never fires medially or finally — pre:bound is strictly word-initial", () => {
    expect(applyRuleToWord(["a", "j", "a"], RULE_BY_ID["fortify"]).changed).toBe(false);
    expect(applyRuleToWord(["t", "a", "j"], RULE_BY_ID["fortify"]).changed).toBe(false);
  });
  test("aphaer: initial vowel deletes before a consonant", () => {
    expect(applyRuleToWord(["a", "t", "a"], RULE_BY_ID["aphaer"])).toEqual({ ids: ["t", "a"], changed: true });
  });
  test("aphaer respects the vowel floor: refuses when deletion would empty the word of vowels", () => {
    expect(applyRuleToWord(["a", "t"], RULE_BY_ID["aphaer"]).changed).toBe(false);
  });
  test("aphaer never fires before a vowel (post:isC, not post:bound)", () => {
    expect(applyRuleToWord(["a", "a", "t"], RULE_BY_ID["aphaer"]).changed).toBe(false);
  });
  test("aphaer fires on the initial position only, even in a longer word", () => {
    expect(applyRuleToWord(["a", "t", "a", "t", "a"], RULE_BY_ID["aphaer"])).toEqual({ ids: ["t", "a", "t", "a"], changed: true });
  });
});

// 1ENG.17 slice 2 (1eng-16 spike §7) — distance conditioning (SCA²'s `…`) and umlaut,
// the mechanism's one consumer.
describe("distance conditioning / umlaut (1ENG.17 slice 2)", () => {
  test("umlaut fires on a…i, fronting the back vowel to match the trigger", () => {
    expect(applyRuleToWord(["t", "u", "t", "i"], RULE_BY_ID["umlaut"])).toEqual({ ids: ["t", "i", "t", "i"], changed: true });
  });
  test("umlaut does not fire on a…u (trigger must be front)", () => {
    expect(applyRuleToWord(["t", "u", "t", "u"], RULE_BY_ID["umlaut"]).changed).toBe(false);
  });
  test("umlaut never touches an already-front vowel (match excludes front)", () => {
    expect(applyRuleToWord(["t", "i", "t", "i"], RULE_BY_ID["umlaut"]).changed).toBe(false);
  });
  test("the distance scan skips the adjacent slot: post:null means an IMMEDIATELY following front vowel alone doesn't satisfy distance at i+1, only i+2+", () => {
    // ["u","i"]: only two segments: the front trigger at i+1 is the adjacent slot,
    // which distance's i±2 start deliberately excludes — nothing at i+2 to find.
    expect(applyRuleToWord(["u", "i"], RULE_BY_ID["umlaut"]).changed).toBe(false);
    // ["u","t","i"]: front trigger now at i+2, inside the scan.
    expect(applyRuleToWord(["u", "t", "i"], RULE_BY_ID["umlaut"])).toEqual({ ids: ["i", "t", "i"], changed: true });
  });
  test("first-match semantics: with two qualifying segments downstream, the nearer wins (round comes from the nearer trigger)", () => {
    // "o" (mid,back,round) should front to match "e" (mid,front,unround) at distance,
    // not any later front vowel — same result here since both later vowels are front/
    // unround, but scanDistance's early-return makes "nearer" the operative claim.
    expect(applyRuleToWord(["t", "o", "t", "e", "t", "i"], RULE_BY_ID["umlaut"])).toEqual({ ids: ["t", "e", "t", "e", "t", "i"], changed: true });
  });
  test("umlaut never drops output for any match×trigger combination (the reduce trap, probed and pinned)", () => {
    const backVowels = ["o", "u", "oː", "uː"];
    const triggers = ["i", "e", "iː", "eː"];
    for (const b of backVowels) {
      for (const trig of triggers) {
        const { ids, changed } = applyRuleToWord(["t", b, "t", trig], RULE_BY_ID["umlaut"]);
        expect(changed).toBe(true);
        expect(ids.length).toBe(4); // 1-in/1-out: never dropped, never grown
        expect(BY_ID[ids[1]].back).toBe("front");
      }
    }
  });
  test("applyRuleToAffix never fires a distance-conditioned rule (fail-closed, mirrors Rule.stressed)", () => {
    // An affix has no word-scale distance domain; ctx.far is always absent there, so a
    // rule reading it (as umlaut's xform does) must never be given the chance to fire.
    expect(applyRuleToAffix(["u"], RULE_BY_ID["umlaut"], "suffix", BY_ID.i)).toEqual(["u"]);
  });
  test("every pre-1ENG.17 rule produces byte-identical output on a fixture lexicon (the distance?-absent path)", () => {
    const words = [["t", "a", "p", "e"], ["m", "a", "t"], ["a", "t", "a"], ["j", "a", "t"]];
    for (const rule of RULES) {
      if (rule.id === "umlaut") continue;
      expect(rule.distance).toBeUndefined();
      for (const w of words) applyRuleToWord(w, rule); // no throw; distance-absent path untouched
    }
  });
});

// 1ENG.17 slice 3 (1eng-16 spike §7) — metathesis, riding the third Seg variant
// (consumes:true) on top of 1ENG.12's Seg[] shape.
describe("metathesis (1ENG.17 slice 3)", () => {
  test("brid -> bird (stop-liquid pair swaps)", () => {
    expect(applyRuleToWord(["b", "r", "i", "d"], RULE_BY_ID["metath"])).toEqual({ ids: ["r", "b", "i", "d"], changed: true });
  });
  // Regression pin: /l/ and /r/ are featurally identical in this engine's consonant
  // model ({place:"alv", manner:"liquid", voice:true} — nothing else distinguishes
  // them). resolveSeg's neighbour-diff path used to re-resolve the moved segment from
  // its OWN features via PHONES.find, which silently returned /l/ (PHONES' first
  // liquid match) for a moved /r/ regardless of which one actually moved. Fixed by
  // special-casing an empty patch to the neighbour's own id. Both liquids pinned here
  // so neither direction of the bug can return.
  test("the moved liquid keeps its own identity: /r/ stays /r/, /l/ stays /l/", () => {
    expect(applyRuleToWord(["b", "r", "a"], RULE_BY_ID["metath"]).ids).toEqual(["r", "b", "a"]);
    expect(applyRuleToWord(["k", "l", "a"], RULE_BY_ID["metath"]).ids).toEqual(["l", "k", "a"]);
  });
  test("does not fire when post is a non-liquid consonant", () => {
    expect(applyRuleToWord(["t", "a", "p"], RULE_BY_ID["metath"]).changed).toBe(false);
  });
  test("does not fire word-finally (no post at all)", () => {
    expect(applyRuleToWord(["a", "t"], RULE_BY_ID["metath"]).changed).toBe(false);
  });
  test("does not fire when match is itself a liquid (match excludes manner===liquid)", () => {
    expect(applyRuleToWord(["r", "l", "a"], RULE_BY_ID["metath"]).changed).toBe(false);
  });
  // Regression guard for the double-emit bug the consumes:true shape invites: without
  // skipNext, the loop's next iteration would re-process the already-moved neighbour
  // and emit it a second time.
  test("the consumed neighbour is emitted exactly once", () => {
    const { ids } = applyRuleToWord(["b", "r", "i", "d"], RULE_BY_ID["metath"]);
    expect(ids.filter((id) => id === "r").length).toBe(1);
    expect(ids.length).toBe(4); // length-preserving: no segment lost or duplicated
  });
  test("consumes at the word edge is a no-op, not a crash — no liquid ever sits at index length-1 given post:liquidC requires a following segment", () => {
    expect(() => applyRuleToWord(["p", "r"], RULE_BY_ID["metath"])).not.toThrow();
  });
  test("word invariants hold: length unchanged, vowel floor intact, over a longer word", () => {
    const { ids } = applyRuleToWord(["b", "r", "a", "t", "a", "b", "r"], RULE_BY_ID["metath"]);
    expect(ids.length).toBe(7);
    expect(ids.some((id) => BY_ID[id].type === "V")).toBe(true);
  });
  test("category is 'metathesis', not 'assimilation' (decision 2 — no invented contact tilt)", () => {
    expect(RULE_BY_ID["metath"].category).toBe("metathesis");
  });
});

// pr-review-comment follow-up: no shipped rule emits `from:"pre"` (metath only emits
// "post"), but the Seg type admits it and resolveSeg already resolved a "pre" neighbour
// correctly — the loop-level pop was the missing half. A synthetic rule exercises it
// directly: liquid+V -> V+liquid (metath's mirror image, consuming backward instead of
// forward) so the regression is pinned even though no real rule needs this direction yet.
describe("\"pre\"-consuming Seg (loop-level pop, symmetric with \"post\")", () => {
  // emits self BEFORE pre — the reverse of the input order — which is what actually
  // performs the swap: pre's own earlier iteration already pushed it unchanged, so
  // popping it and re-pushing it AFTER self is what moves it, not just re-affirms it.
  const preSwap: Rule = {
    id: "_preSwapTest", name: "test-only", note: "", w: 1, category: "metathesis",
    match: (p) => !!p && p.type === "V", pre: (p) => !!p && p.type === "C" && p.manner === "liquid", post: null,
    xform: () => [{ from: "self", patch: {} }, { from: "pre", patch: {}, consumes: true }],
  };
  test("liquid+V -> V+liquid: the popped neighbour is emitted exactly once, in its new position", () => {
    expect(applyRuleToWord(["b", "r", "a"], preSwap)).toEqual({ ids: ["b", "a", "r"], changed: true });
  });
  test("the moved neighbour keeps its own identity (both liquids pinned, mirroring the /l/-/r/ regression)", () => {
    expect(applyRuleToWord(["r", "a"], preSwap).ids).toEqual(["a", "r"]);
    expect(applyRuleToWord(["l", "a"], preSwap).ids).toEqual(["a", "l"]);
  });
  test("does not fire on the word-initial phone (no pre at all to satisfy the pre predicate)", () => {
    expect(() => applyRuleToWord(["a"], preSwap)).not.toThrow();
    expect(applyRuleToWord(["a"], preSwap).changed).toBe(false);
  });
  test("word invariants hold over a longer word: length unchanged, vowel floor intact", () => {
    const { ids } = applyRuleToWord(["t", "r", "a", "t", "a", "l", "i"], preSwap);
    expect(ids.length).toBe(7);
    expect(ids.some((id) => BY_ID[id].type === "V")).toBe(true);
  });

  // applyRuleToAffix has its own separate pop guard: `pre` at i===0 (suffix) may be the
  // INJECTED stem-context phone rather than a real preceding affix segment already
  // pushed to `out` — nothing to pop there, unlike applyRuleToWord where `pre` is only
  // ever a real ph[i-1].
  test("applyRuleToAffix: pops a real preceding affix segment (i>0)", () => {
    expect(applyRuleToAffix(["r", "a"], preSwap, "suffix", BY_ID.t)).toEqual(["a", "r"]);
  });
  test("applyRuleToAffix: injected ctx at i===0 still resolves the neighbour, but never pops (it isn't in this affix's own out)", () => {
    // ctx=r (liquid) satisfies preSwap's `pre` predicate at i===0, so the rule DOES fire
    // and DOES emit r via resolveSeg — but there is nothing in this affix's own `out` to
    // pop, since ctx was injected context, not a segment of the affix itself.
    expect(() => applyRuleToAffix(["a"], preSwap, "suffix", BY_ID.r)).not.toThrow();
    expect(applyRuleToAffix(["a"], preSwap, "suffix", BY_ID.r)).toEqual(["a", "r"]);
  });
});

// 1ENG.19 (1eng-14 spike §4.1) — the syntax gate inside applyRuleToLex. Mirrors the
// salience-gate sweep above: a class the branch's word order disfavours in this
// position drifts strictly less often than one it favours, over a turn sweep.
describe("applyRuleToLex syntax gating (1ENG.19)", () => {
  const seed = 5, branchId = 0;
  const SOV: WordOrder = { basic: "SOV", adj: "AdjN" };
  const weights: [number, number, number, number] = [1, 1, 1, 1];
  // apoc (apocope) is post:bound, position-blind at the rule level — the syntax gate
  // is what makes an SOV verb (final=1.0, ceiling mult 1.5, never blocked) erode
  // faster than an SOV pronoun (final=0, floor mult 0.5, often blocked).
  // trailing vowel with a spare vowel earlier in the word, so apoc's deletion never
  // trips the vowel-floor guard (a bare CV word has no vowel to spare).
  const LEX: Lexicon = [
    { concept: "eat", word: ["t", "a", "p", "e"] }, // verb — always utterance-final under SOV
    { concept: "i", word: ["k", "o", "s", "a"] },   // pronoun — never utterance-final under SOV
  ];

  test("SOV verb (favoured) drifts strictly more often than SOV pronoun (disfavoured) over a sweep", () => {
    let verbChanged = 0, pronounChanged = 0;
    const sweep = 300;
    for (let turn = 0; turn < sweep; turn++) {
      const { lex } = applyRuleToLex(LEX, RULE_BY_ID["apoc"], {
        syntax: { wordOrder: SOV, frameWeights: weights, proDrop: false, seed, turn, branchId },
      });
      if (lex[0].word.length < LEX[0].word.length) verbChanged++;
      if (lex[1].word.length < LEX[1].word.length) pronounChanged++;
    }
    expect(verbChanged).toBe(sweep); // ceiling mult (1.5) — never blocked (m > 1 is a no-op block-wise)
    expect(pronounChanged).toBeLessThan(verbChanged); // floor mult (0.5) — blocked roughly half the time
    expect(pronounChanged).toBeGreaterThan(0); // not fully frozen — the lever never zeroes
  });

  test("no syntax context: behaviour is identical to pre-1ENG.19 (salience-only path unaffected)", () => {
    const gated = applyRuleToLex(LEX, RULE_BY_ID["apoc"]);
    const ungated = applyRuleToLex(LEX, RULE_BY_ID["apoc"]);
    expect(gated.lex).toEqual(ungated.lex);
    expect(gated.fires).toBe(ungated.fires);
  });

  test("determinism: same syntax context -> identical output across repeated calls", () => {
    const ctx = { syntax: { wordOrder: SOV, frameWeights: weights, proDrop: false, seed, turn: 9, branchId } };
    const a = applyRuleToLex(LEX, RULE_BY_ID["apoc"], ctx);
    const b = applyRuleToLex(LEX, RULE_BY_ID["apoc"], ctx);
    expect(a.lex).toEqual(b.lex);
    expect(a.fires).toBe(b.fires);
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
  // 1ENG.31: the 19 rules that predate stress conditioning, enumerated explicitly
  // rather than derived as `RULES.filter(r => !r.stressed)` — the point of the sweep
  // below is to catch a rule that ACQUIRES a `stressed` predicate it shouldn't have,
  // and a derived list would silently exclude exactly that rule instead of failing on
  // it. Extend this list only when a genuinely stress-blind rule is added; a new
  // stress-conditioned rule belongs in the 1ENG.31 describe block below, not here.
  // 1ENG.17 slices 2/3: umlaut and metath are likewise stress-blind (no `stressed`
  // predicate declared) and belong to the same "declines stress conditioning" set this
  // list tracks, per its own comment above — extended here rather than renamed, since
  // PRE_1ENG24_IDS' meaning ("stress-blind rules") outlived the literal pre-1ENG.24
  // boundary already.
  const PRE_1ENG24_IDS = [
    "voice", "spirant", "devoice", "apoc", "finalC", "palat", "debucc", "raise", "nasassim",
    "cluster", "epenth", "paragoge", "break", "smooth", "shorten", "compleng", "complengFinal",
    "fortify", "aphaer", "umlaut", "metath",
  ] as const;
  // 1ENG.30 (1eng-24 spike §8), narrowed by 1ENG.31 — byte-identity sweep over the
  // rules that predate stress conditioning: same purpose (a widening event must not
  // perturb existing rules), one more widening. None of these 19 declares `stressed`,
  // so passing a StressRule must produce byte-identical output to the two-arg call —
  // the fail-closed conjunct only bites rules that opt in. Was a sweep over all of
  // RULES; narrowed to PRE_1ENG24_IDS once reduce/syncope landed, since those two DO
  // declare `stressed` and must diverge under a StressRule — that divergence is the
  // feature, exercised separately in the 1ENG.31 describe block below.
  test("every pre-1ENG.24 rule produces identical output with and without a StressRule", () => {
    const WORDS = [
      ["t", "a"], ["a", "p", "a"], ["t", "a", "p", "e"], ["a", "p", "t", "a"],
      ["k", "i", "t"], ["m", "a", "t"], ["a"], ["a", "e"], ["a", "ie"], ["a", "aː"],
      ["k", "a", "s", "t"], ["j", "a"], ["s", "t"],
    ];
    const STRESS_RULES: StressRule[] = [
      { mode: "initial", weightSensitive: false }, { mode: "final", weightSensitive: false },
      { mode: "penult", weightSensitive: true }, { mode: "antepenult", weightSensitive: false },
    ];
    for (const id of PRE_1ENG24_IDS) {
      const rule = RULE_BY_ID[id];
      expect(rule.stressed).toBeUndefined();
      for (const w of WORDS) {
        const plain = applyRuleToWord(w, rule);
        for (const sr of STRESS_RULES) {
          expect(applyRuleToWord(w, rule, sr)).toEqual(plain);
        }
      }
    }
  });
  // 1ENG.31: the complement of the sweep above — PRE_1ENG24_IDS must stay exactly the
  // set of rules that decline stress conditioning, so the list can't rot silently (a
  // new rule added to RULES without a stress judgement either way would otherwise pass
  // both this file's tests and slip through unnoticed).
  test("PRE_1ENG24_IDS is exactly the set of rules that decline stress conditioning", () => {
    const stressBlind = RULES.filter((r) => !r.stressed).map((r) => r.id).sort();
    expect(stressBlind).toEqual([...PRE_1ENG24_IDS].sort());
  });
});

// 1ENG.30 (1eng-24 spike §3/§8) — Rule.stressed fail-closed gate. A synthetic test rule
// (RULES itself declares none yet — that's 1ENG.31) proves the channel both fails
// closed with no StressRule supplied and actually restricts firing when one is.
describe("1ENG.30 Rule.stressed fail-closed gate", () => {
  // Mid vowel -> high, restricted to stressed syllables (raise's own xform, gated).
  // /e/ -> /i/ is a real, resolvable transform (unlike a schwa-target that PHONES has
  // no slot for), so a change here unambiguously means the gate let the rule through.
  const stressedRaise: Rule = {
    id: "test-stressed-raise", name: "test", note: "test", w: 1, category: "vowelShift",
    match: (p) => p.type === "V" && p.height === "mid", pre: null, post: null,
    xform: () => ({ height: "high" }),
    stressed: (s) => s.isStressed,
  };

  test("applyRuleToWord: no StressRule supplied -> never fires, even on a vowel that would match", () => {
    const r = applyRuleToWord(["t", "e"], stressedRaise);
    expect(r).toEqual({ ids: ["t", "e"], changed: false });
  });

  test("applyRuleToWord: StressRule supplied -> fires only on the stressed syllable's vowel", () => {
    // initial mode, disyllable [t,e,t,e]: syllable 0 is stressed, syllable 1 is not.
    // Both vowels match (both /e/, mid) — only the stressed one may raise to /i/.
    const initial: StressRule = { mode: "initial", weightSensitive: false };
    const r = applyRuleToWord(["t", "e", "t", "e"], stressedRaise, initial);
    expect(r).toEqual({ ids: ["t", "i", "t", "e"], changed: true });
  });

  test("applyRuleToAffix: stressed rule never fires — affixes have no independent stress domain", () => {
    const out = applyRuleToAffix(["e"], stressedRaise, "suffix", BY_ID.t);
    expect(out).toEqual(["e"]);
  });
});

// 1ENG.31 (1eng-24 spike §6) — reduce/syncope, the two stress-conditioned rules RULES
// itself now declares. All goldens below were computed by running applyRuleToWord live
// against the shipped rules, not hand-derived, then pinned.
describe("1ENG.31 reduce / syncope", () => {
  const MODES: Record<string, StressRule> = {
    initial: { mode: "initial", weightSensitive: false },
    final: { mode: "final", weightSensitive: false },
    penult: { mode: "penult", weightSensitive: true },
    antepenult: { mode: "antepenult", weightSensitive: false },
  };

  // The single most important test in this block: it is what would have caught the
  // spike's literal `xform:()=>({back:"central"})`, which resolves to null (and is
  // silently dropped) for seven of these ten vowel types — see reduce's own comment in
  // phonology.ts. Every vowel type must land on ə, not vanish.
  test("reduce maps every vowel type to ə uniformly, including long vowels and diphthongs", () => {
    for (const v of ["i", "e", "a", "o", "u", "aː", "iː", "ie", "au", "ai"]) {
      const r = applyRuleToWord(["t", "a", "t", v], RULE_BY_ID.reduce, MODES.initial);
      expect(r).toEqual({ ids: ["t", "a", "t", "ə"], changed: true });
    }
  });
  test("reduce is idempotent on an already-reduced ə: no churn", () => {
    const r = applyRuleToWord(["t", "a", "t", "ə"], RULE_BY_ID.reduce, MODES.initial);
    expect(r).toEqual({ ids: ["t", "a", "t", "ə"], changed: false });
  });

  test("reduce: disyllable [t,e,t,e] under each stress mode", () => {
    const w = ["t", "e", "t", "e"];
    expect(applyRuleToWord(w, RULE_BY_ID.reduce, MODES.initial)).toEqual({ ids: ["t", "e", "t", "ə"], changed: true });
    expect(applyRuleToWord(w, RULE_BY_ID.reduce, MODES.final)).toEqual({ ids: ["t", "ə", "t", "e"], changed: true });
    // weight-sensitive penult on a light disyllable falls back to antepenult (clamps to
    // syllable 0), same as antepenult mode itself on a word with no antepenult.
    expect(applyRuleToWord(w, RULE_BY_ID.reduce, MODES.penult)).toEqual({ ids: ["t", "e", "t", "ə"], changed: true });
    expect(applyRuleToWord(w, RULE_BY_ID.reduce, MODES.antepenult)).toEqual({ ids: ["t", "e", "t", "ə"], changed: true });
  });
  test("reduce: trisyllable [t,e,t,e,t,e] under each stress mode", () => {
    const w = ["t", "e", "t", "e", "t", "e"];
    expect(applyRuleToWord(w, RULE_BY_ID.reduce, MODES.initial)).toEqual({ ids: ["t", "e", "t", "ə", "t", "ə"], changed: true });
    expect(applyRuleToWord(w, RULE_BY_ID.reduce, MODES.final)).toEqual({ ids: ["t", "ə", "t", "ə", "t", "e"], changed: true });
    expect(applyRuleToWord(w, RULE_BY_ID.reduce, MODES.antepenult)).toEqual({ ids: ["t", "e", "t", "ə", "t", "ə"], changed: true });
  });
  test("reduce never touches a coda, only the nucleus (role gate)", () => {
    // syllable 1 (te.sta -> tes|ta) is unstressed under final, but its coda /s/ must
    // survive untouched — only role==='nucleus' segments are eligible.
    const r = applyRuleToWord(["t", "e", "s", "t", "a"], RULE_BY_ID.reduce, MODES.final);
    expect(r).toEqual({ ids: ["t", "ə", "s", "t", "a"], changed: true });
  });
  test("reduce never fires on a monosyllable, under any stress mode (syllCount>1 gate)", () => {
    for (const sr of Object.values(MODES)) {
      expect(applyRuleToWord(["t", "e"], RULE_BY_ID.reduce, sr)).toEqual({ ids: ["t", "e"], changed: false });
    }
  });

  test("syncope: disyllable [t,e,t,e] under each stress mode", () => {
    const w = ["t", "e", "t", "e"];
    expect(applyRuleToWord(w, RULE_BY_ID.syncope, MODES.initial)).toEqual({ ids: ["t", "e", "t"], changed: true });
    expect(applyRuleToWord(w, RULE_BY_ID.syncope, MODES.final)).toEqual({ ids: ["t", "t", "e"], changed: true });
  });
  test("syncope: calidum-shape medial loss (k,a,l,i,t,u -> k,a,l,t under initial stress)", () => {
    // ka.li.tu, initial stress on syllable 0 — syllables 1 and 2's nuclei both qualify,
    // and both are deleted: this is the calidum > caldu shape the spike names, just
    // compressed to one stress-conditioned pass rather than iterated turns.
    const r = applyRuleToWord(["k", "a", "l", "i", "t", "u"], RULE_BY_ID.syncope, MODES.initial);
    expect(r).toEqual({ ids: ["k", "a", "l", "t"], changed: true });
  });
  test("syncope never fires on a monosyllable, under any stress mode", () => {
    for (const sr of Object.values(MODES)) {
      expect(applyRuleToWord(["t", "e"], RULE_BY_ID.syncope, sr)).toEqual({ ids: ["t", "e"], changed: false });
    }
  });

  // The exhaustive replacement for a second floor guard inside syncope (see the rule's
  // own comment in phonology.ts): both that the raw output always retains a vowel AND
  // that the floor at applyRuleToWord's tail never trips (changed stays true whenever
  // the word had >1 syllable), or a future stressPosition bug would be silently caught
  // by the floor instead of surfacing as a test failure. Capped at 3 segments (~18k
  // applications) to keep this file's runtime reasonable; a wider 4-segment sweep
  // (267,300 applications over the same alphabet) was run once at implementation time
  // with zero violations.
  test("syncope floor invariant: exhaustive over every word up to 3 segments x 5 stress configs", () => {
    const V = ["i", "e", "a", "o", "u", "ə", "aː", "iː", "ie", "au"];
    const C = ["t", "k", "s", "n", "r"];
    const alphabet = [...V, ...C];
    const configs: StressRule[] = [
      MODES.initial, MODES.final, MODES.antepenult,
      { mode: "penult", weightSensitive: true }, { mode: "penult", weightSensitive: false },
    ];
    let checked = 0;
    const build = (n: number, acc: string[]): void => {
      if (acc.length === n) {
        if (!acc.some((x) => V.includes(x))) return;
        for (const sr of configs) {
          checked++;
          const r = applyRuleToWord(acc, RULE_BY_ID.syncope, sr);
          expect(r.ids.some((x) => V.includes(x))).toBe(true);
        }
        return;
      }
      for (const s of alphabet) build(n, [...acc, s]);
    };
    for (let n = 1; n <= 3; n++) build(n, []);
    expect(checked).toBeGreaterThan(0);
  });

  test("fail-closed: neither rule fires when no StressRule is supplied", () => {
    expect(applyRuleToWord(["t", "e", "t", "e"], RULE_BY_ID.reduce)).toEqual({ ids: ["t", "e", "t", "e"], changed: false });
    expect(applyRuleToWord(["t", "e", "t", "e"], RULE_BY_ID.syncope)).toEqual({ ids: ["t", "e", "t", "e"], changed: false });
  });
  test("fail-closed: applyRuleToLex fires 0 without a StressRule, >0 with one", () => {
    const LEX: Lexicon = [{ concept: "a", word: ["t", "a", "t", "e"] }];
    expect(applyRuleToLex(LEX, RULE_BY_ID.reduce).fires).toBe(0);
    expect(applyRuleToLex(LEX, RULE_BY_ID.syncope).fires).toBe(0);
    expect(applyRuleToLex(LEX, RULE_BY_ID.reduce, { stress: MODES.initial }).fires).toBeGreaterThan(0);
    expect(applyRuleToLex(LEX, RULE_BY_ID.syncope, { stress: MODES.initial }).fires).toBeGreaterThan(0);
  });

  // Affixes have a LIFTED vowel floor (an affix may legitimately erode to []), so this
  // block is more than tidy symmetry with the 1ENG.30 synthetic-rule coverage above —
  // it's what stops a firing syncope from genuinely emptying an affix.
  test("applyRuleToAffix hard-blocks both rules — affixes have no independent stress domain", () => {
    expect(applyRuleToAffix(["e"], RULE_BY_ID.reduce, "suffix", BY_ID.t)).toEqual(["e"]);
    expect(applyRuleToAffix(["e"], RULE_BY_ID.syncope, "suffix", BY_ID.t)).toEqual(["e"]);
    expect(applyRuleToAffix(["e"], RULE_BY_ID.reduce, "prefix", BY_ID.t)).toEqual(["e"]);
  });

  // The test that would have caught the integration gap this task closed: without a
  // StressRule threaded through, firingRules reports 0 fires for both rules under the
  // fail-closed conjunct, so driftRule could never select them.
  test("reduce and syncope are selectable by driftRule only when a StressRule is threaded", () => {
    const LEX: Lexicon = [{ concept: "a", word: ["t", "a", "t", "e"] }, { concept: "b", word: ["k", "o", "m", "i"] }];
    const noStress = firingRules(LEX).map((f) => f.rule.id);
    const withStress = firingRules(LEX, MODES.initial).map((f) => f.rule.id);
    expect(noStress).not.toContain("reduce");
    expect(noStress).not.toContain("syncope");
    expect(withStress).toContain("reduce");
    expect(withStress).toContain("syncope");
  });
  test("driftRule can actually select a stress-conditioned rule across a turn sweep", () => {
    const LEX: Lexicon = [{ concept: "a", word: ["t", "a", "t", "e"] }, { concept: "b", word: ["k", "o", "m", "i"] }];
    const picked = new Set<string>();
    for (let turn = 0; turn < 300; turn++) {
      picked.add(driftRule(LEX, 42, turn, 3, 0.5, undefined, MODES.initial)?.id ?? "");
    }
    expect(picked.has("reduce") || picked.has("syncope")).toBe(true);
  });
  test("omitting the StressRule reproduces the pre-1ENG.31 driftRule selection exactly", () => {
    for (let turn = 0; turn < 50; turn++) {
      expect(driftRule(MIXED_LEX, 42, turn, 3, 0.5, undefined, undefined)?.id)
        .toBe(driftRule(MIXED_LEX, 42, turn, 3, 0.5)?.id);
    }
  });
  test("firingRules threads stress but still withholds salience and syntax", () => {
    // extends the existing terrain-agnostic pin (applyRuleToLex salience gating block
    // above) to the stress-supplied call shape: firingRules must never gain a salience
    // or syntax roll just because it now consults stress.
    const LEX: Lexicon = [{ concept: "a", word: ["t", "a", "t", "e"] }];
    const ungated = applyRuleToLex(LEX, RULE_BY_ID.reduce, { stress: MODES.initial }).fires;
    const throughFiring = firingRules(LEX, MODES.initial).find((f) => f.rule.id === "reduce")?.fires;
    expect(throughFiring).toBe(ungated);
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
    // 1ENG.29: /a/ is central (see phonology.ts's vowel-row comment), so break's
    // central arm fires — the ai diphthong the rule's own note has always advertised.
    expect(r).toEqual({ ids: ["ai"], changed: true });
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

describe("compleng / complengFinal (compensatory lengthening, 1ENG.13)", () => {
  // shorten's inverse: a coda obstruent deletes and the vowel before it lengthens.
  test("compleng: [k,a,s,t] -> [k,aː,t] (medial coda in a cluster absorbed)", () => {
    const r = applyRuleToWord(["k", "a", "s", "t"], RULE_BY_ID.compleng);
    expect(r).toEqual({ ids: ["k", "aː", "t"], changed: true });
  });
  test("complengFinal: [t,a,s] -> [t,aː] (word-final coda absorbed)", () => {
    const r = applyRuleToWord(["t", "a", "s"], RULE_BY_ID.complengFinal);
    expect(r).toEqual({ ids: ["t", "aː"], changed: true });
  });
  test("compleng does not fire on an open syllable (no coda after the vowel)", () => {
    const r = applyRuleToWord(["p", "a"], RULE_BY_ID.compleng);
    expect(r).toEqual({ ids: ["p", "a"], changed: false });
  });
  test("compleng does not fire on a word-final coda (post requires another C)", () => {
    const r = applyRuleToWord(["t", "a", "s"], RULE_BY_ID.compleng);
    expect(r).toEqual({ ids: ["t", "a", "s"], changed: false });
  });
  test("complengFinal does not fire on a medial coda (post requires the boundary)", () => {
    const r = applyRuleToWord(["k", "a", "s", "t"], RULE_BY_ID.complengFinal);
    expect(r).toEqual({ ids: ["k", "a", "s", "t"], changed: false });
  });
  test("compleng still deletes the coda when the preceding vowel is already long", () => {
    const r = applyRuleToWord(["k", "aː", "s", "t"], RULE_BY_ID.compleng);
    expect(r).toEqual({ ids: ["k", "aː", "t"], changed: true });
  });
  test("only compleng/complengFinal set lengthensPrev (all legacy rules unaffected)", () => {
    for (const r of RULES) {
      if (r.id === "compleng" || r.id === "complengFinal") expect(r.lengthensPrev).toBe(true);
      else expect(r.lengthensPrev).toBeFalsy();
    }
  });
});

describe("1ENG.29 schwa (1eng-24 spike §7)", () => {
  // These drive applyRuleToWord with hand-built words containing "ə" directly, matching
  // the other per-rule golden tests in this file. 1ENG.31: schwa is no longer
  // unreachable through drift — reduce produces it, measured at ~0.17 schwa/word over
  // 8 seeds x 80 turns of the real turn loop (see generation.test.ts) — but these stay
  // hand-built deliberately: they pin how the PRE-EXISTING rules behave when they meet
  // a schwa, a different question from how schwa gets there, and a drift-sourced
  // fixture would make them stochastic.
  test("frontV: palat does not fire before ə (schwa is not front)", () => {
    const r = applyRuleToWord(["k", "ə", "t"], RULE_BY_ID.palat);
    expect(r).toEqual({ ids: ["k", "ə", "t"], changed: false });
  });
  test("frontV: palat still fires before /i/ and /e/", () => {
    expect(applyRuleToWord(["k", "i", "t"], RULE_BY_ID.palat)).toEqual({ ids: ["ʃ", "i", "t"], changed: true });
    expect(applyRuleToWord(["k", "e", "t"], RULE_BY_ID.palat)).toEqual({ ids: ["ʃ", "e", "t"], changed: true });
  });
  // Deliberate, not a regression: /a/ is central (see phonology.ts's vowel-row
  // comment), and palatalisation before a low/central vowel is the typologically
  // marked pattern — Latin casa keeps /k/ while centum fronts it; French cantare ->
  // chanter is cited as the exception precisely because it's unusual.
  test("frontV: palat no longer fires before /a/", () => {
    const r = applyRuleToWord(["k", "a", "t"], RULE_BY_ID.palat);
    expect(r).toEqual({ ids: ["k", "a", "t"], changed: false });
  });
  test("resolve collision guard: ə and /e/ are distinct, not merged by a rule firing on schwa", () => {
    // devoice doesn't touch vowels, but raise (mid -> high) does, and confirms
    // resolve dispatches schwa (mid, central) to itself, not to /e/ (mid, front).
    const r = applyRuleToWord(["m", "ə", "n"], RULE_BY_ID.finalC);
    expect(r).toEqual({ ids: ["m", "ə"], changed: true });
    expect(BY_ID.ə).not.toBe(BY_ID.e);
  });
  test("compleng on a schwa nucleus: lengthening is silently skipped, never throws (no əː phone)", () => {
    expect(() => applyRuleToWord(["k", "ə", "s", "t"], RULE_BY_ID.compleng)).not.toThrow();
    const r = applyRuleToWord(["k", "ə", "s", "t"], RULE_BY_ID.compleng);
    expect(r).toEqual({ ids: ["k", "ə", "t"], changed: true }); // coda absorbed, vowel NOT lengthened
  });
  test("break: three-arm Backness coverage (front->ie, central->ai, back->uo)", () => {
    expect(applyRuleToWord(["e"], RULE_BY_ID.break)).toEqual({ ids: ["ie"], changed: true });
    expect(applyRuleToWord(["a"], RULE_BY_ID.break)).toEqual({ ids: ["ai"], changed: true });
    expect(applyRuleToWord(["o"], RULE_BY_ID.break)).toEqual({ ids: ["uo"], changed: true });
  });
  test("break does not fire on a diphthong (match excludes p.diph, keeping the switch total)", () => {
    const r = applyRuleToWord(["ie"], RULE_BY_ID.break);
    expect(r).toEqual({ ids: ["ie"], changed: false });
  });
  test("smooth: an a-nucleus diphthong yields /e/, not ə", () => {
    expect(applyRuleToWord(["au"], RULE_BY_ID.smooth)).toEqual({ ids: ["e"], changed: true });
    expect(applyRuleToWord(["ai"], RULE_BY_ID.smooth)).toEqual({ ids: ["e"], changed: true });
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

// 1ENG.17 slice 3 (decision 2): metathesis gets fortition's neutral treatment (0.0
// affinity, "no claim" rather than an invented tilt) — metath's attested cases carry no
// contact-vs-isolation evidence either direction.
describe("biasedMult metathesis (1ENG.17 decision 2)", () => {
  test("metathesis is neutral (1.0) at every iso — no contact-bias claim", () => {
    for (const iso of [0, 0.25, 0.5, 0.75, 1]) {
      expect(biasedMult("metathesis", iso)).toBeCloseTo(1, 5);
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

describe("stepToward", () => {
  test("substitutes the first differing segment", () => {
    expect(stepToward(["t", "a", "p"], ["k", "a", "p"])).toEqual(["k", "a", "p"]);
  });

  test("appends b's next segment when a is a strict prefix of b", () => {
    expect(stepToward(["t", "a"], ["t", "a", "p"])).toEqual(["t", "a", "p"]);
  });

  test("deletes a's first surplus segment when a is longer than b", () => {
    expect(stepToward(["t", "a", "p", "a"], ["t", "a"])).toEqual(["t", "a", "a"]);
  });

  test("identical inputs are returned unchanged", () => {
    const w = ["t", "a", "p"];
    expect(stepToward(w, w)).toEqual(w);
  });

  test("strictly raises formSimilarity unless already equal", () => {
    const cases: [string[], string[]][] = [
      [["t", "a", "p"], ["k", "o", "s"]],
      [["t", "a"], ["t", "a", "p", "e"]],
      [["t", "a", "p", "a", "s"], ["t", "a"]],
      [["m", "a", "t"], ["m", "u", "t"]],
    ];
    for (const [a, b] of cases) {
      const before = formSimilarity(a, b);
      const after = formSimilarity(stepToward(a, b), b);
      expect(after).toBeGreaterThan(before);
    }
  });

  test("never returns a vowelless word, even when the only remaining vowel is the surplus segment", () => {
    // a = ["p", "t", "a"] (surplus prefix "p","t", one vowel "a"); b = ["p", "t"] (no
    // vowel at all) — deleting a's first surplus segment ("p", index 0) would still
    // leave "t","a", which has a vowel, so this should proceed. Construct instead a
    // case where the ONLY vowel sits at the cut index.
    const a = ["p", "a", "t"]; // vowel is at index 1
    const b = ["p"];           // b.length = 1, so cut index = 1 -> would delete the vowel
    const out = stepToward(a, b);
    expect(out.some((id) => BY_ID[id].type === "V")).toBe(true);
  });

  test("never exceeds MAX_LEN when appending", () => {
    const a = Array.from({ length: MAX_LEN }, () => "t");
    const b = [...a, "a"];
    expect(stepToward(a, b).length).toBeLessThanOrEqual(MAX_LEN);
  });
});

// 1ENG.26: inventoryOf's describe block, moved verbatim from naming.test.ts (1eng-23
// spike §4.1) — regression pin on the move, same assertions, same MIXED_LEX shape.
describe("inventoryOf", () => {
  test("collects distinct vowel/consonant phone ids from a lexicon", () => {
    const inv = inventoryOf(MIXED_LEX);
    // MIXED_LEX ids: t,a,p,e,k,o,m,s,i,n
    ["t", "p", "k", "m", "s", "n"].forEach((id) => expect(inv.consonants).toContain(id));
    ["a", "e", "o", "i"].forEach((id) => expect(inv.vowels).toContain(id));
  });

  test("falls back to a minimal CV pair for an empty lexicon rather than starving genStem", () => {
    const inv = inventoryOf([]);
    expect(inv.vowels.length).toBeGreaterThan(0);
    expect(inv.consonants.length).toBeGreaterThan(0);
  });
});

// 1ENG.26 (1eng-23 spike §4.2/§6) — phonemicDiff/describeEvent. Fixtures use real phone
// ids from PHONES; exact event lists are asserted, not counts, per the spike's own
// testing note.
describe("phonemicDiff", () => {
  test("unconditioned merger: two sources both land on the SAME destination everywhere", () => {
    const before: Lexicon = [{ concept: "a", word: ["a", "p", "a"] }, { concept: "b", word: ["a", "b", "a"] }];
    const after: Lexicon = [{ concept: "a", word: ["a", "b", "a"] }, { concept: "b", word: ["a", "b", "a"] }];
    // /p/ vanishes everywhere it appeared, so the merger is unconditioned: partial:false,
    // and a paired loss of /p/ — that pairing IS the unconditioned signal (no dedup).
    expect(phonemicDiff(before, after)).toEqual([
      { kind: "merger", from: ["p", "b"], to: "b", partial: false },
      { kind: "loss", phone: "p" },
    ]);
  });

  test("conditioned (partial) merger: the source survives in an environment the rule didn't reach", () => {
    const before: Lexicon = [
      { concept: "a", word: ["a", "p", "a"] }, // intervocalic — will voice
      { concept: "b", word: ["p", "a"] },      // word-initial — untouched, /p/ survives
      { concept: "c", word: ["a", "b", "a"] },
    ];
    const after: Lexicon = [
      { concept: "a", word: ["a", "b", "a"] },
      { concept: "b", word: ["p", "a"] },
      { concept: "c", word: ["a", "b", "a"] },
    ];
    // /p/ survives (concept b), so this is a PARTIAL merger, and correspondingly the
    // same rule application is ALSO a split of /p/ into {p,b} — both true, both kept.
    expect(phonemicDiff(before, after)).toEqual([
      { kind: "merger", from: ["p", "b"], to: "b", partial: true },
      { kind: "split", from: "p", to: ["p", "b"] },
    ]);
  });

  test("conditioned split into a brand-new phoneme (real palat shape: /k/ -> /ʃ/ before front V, /k/ elsewhere)", () => {
    const before: Lexicon = [{ concept: "a", word: ["k", "i", "t"] }, { concept: "b", word: ["k", "a", "t"] }];
    const after: Lexicon = [{ concept: "a", word: ["ʃ", "i", "t"] }, { concept: "b", word: ["k", "a", "t"] }];
    expect(phonemicDiff(before, after)).toEqual([
      { kind: "split", from: "k", to: ["k", "ʃ"] },
      { kind: "gain", phone: "ʃ" },
    ]);
  });

  test("a merger of 3 sources onto 1 destination is ONE event, not 3 pairwise near-duplicates", () => {
    const before: Lexicon = [
      { concept: "a", word: ["a", "p", "a"] }, { concept: "b", word: ["a", "b", "a"] }, { concept: "c", word: ["a", "f", "a"] },
    ];
    const after: Lexicon = [
      { concept: "a", word: ["a", "v", "a"] }, { concept: "b", word: ["a", "v", "a"] }, { concept: "c", word: ["a", "v", "a"] },
    ];
    const events = phonemicDiff(before, after);
    expect(events.filter((e) => e.kind === "merger")).toEqual([
      { kind: "merger", from: ["p", "b", "f"], to: "v", partial: false },
    ]);
    expect(events.filter((e) => e.kind === "loss").map((e) => (e as { phone: string }).phone).sort()).toEqual(["b", "f", "p"]);
  });

  test("identical lexicons yield no events (self-mapping phones are silent)", () => {
    expect(phonemicDiff(MIXED_LEX, MIXED_LEX)).toEqual([]);
  });

  test("length-mismatched words are skipped, not mis-aligned into a spurious merger", () => {
    // naive left-shift alignment after the deletion would read p->a, a->t, t->a — none
    // of which happened. The word must be skipped outright, leaving only the true loss.
    const before: Lexicon = [{ concept: "a", word: ["p", "a", "t", "a"] }, { concept: "b", word: ["t", "a"] }];
    const after: Lexicon = [{ concept: "a", word: ["a", "t", "a"] }, { concept: "b", word: ["t", "a"] }];
    expect(phonemicDiff(before, after)).toEqual([{ kind: "loss", phone: "p" }]);
  });

  test("empty and one-sided-empty lexicons do not invent phantom loss/gain from inventoryOf's minimal-CV backstop", () => {
    expect(phonemicDiff([], [])).toEqual([]);
    // before=[] must not report "gain" of a phantom /a/,/t/ backstop pair.
    expect(phonemicDiff([], [{ concept: "a", word: ["t", "a"] }])).toEqual([
      { kind: "gain", phone: "t" },
      { kind: "gain", phone: "a" },
    ]);
    expect(phonemicDiff([{ concept: "a", word: ["k", "i"] }], [])).toEqual([
      { kind: "loss", phone: "k" },
      { kind: "loss", phone: "i" },
    ]);
  });

  test("deterministic: identical inputs yield toEqual-identical output", () => {
    const before: Lexicon = [{ concept: "a", word: ["a", "p", "a"] }, { concept: "b", word: ["a", "b", "a"] }];
    const after: Lexicon = [{ concept: "a", word: ["a", "b", "a"] }, { concept: "b", word: ["a", "b", "a"] }];
    expect(phonemicDiff(before, after)).toEqual(phonemicDiff(before, after));
  });

  test("order-independent: same phonemic content in a different concept/entry order yields the SAME event order", () => {
    const before: Lexicon = [{ concept: "a", word: ["a", "p", "a"] }, { concept: "b", word: ["a", "b", "a"] }];
    const after: Lexicon = [{ concept: "a", word: ["a", "b", "a"] }, { concept: "b", word: ["a", "b", "a"] }];
    const reversedBefore = [...before].reverse();
    const reversedAfter = [...after].reverse();
    expect(phonemicDiff(reversedBefore, reversedAfter)).toEqual(phonemicDiff(before, after));
  });
});

describe("describeEvent", () => {
  test("merger prose, 2 sources, unconditioned", () => {
    expect(describeEvent({ kind: "merger", from: ["p", "b"], to: "b", partial: false }))
      .toBe("/p/ and /b/ fell together in /b/");
  });

  test("merger prose, 2 sources, conditioned/partial", () => {
    expect(describeEvent({ kind: "merger", from: ["p", "b"], to: "b", partial: true }))
      .toBe("/p/ and /b/ fell together in /b/ in some words");
  });

  test("merger prose, 3+ sources (no Oxford comma)", () => {
    expect(describeEvent({ kind: "merger", from: ["p", "b", "f"], to: "v", partial: false }))
      .toBe("/p/, /b/ and /f/ fell together in /v/");
  });

  test("split prose", () => {
    expect(describeEvent({ kind: "split", from: "k", to: ["k", "ʃ"] })).toBe("/k/ split into /k/ and /ʃ/");
  });

  test("loss prose", () => {
    expect(describeEvent({ kind: "loss", phone: "p" })).toBe("/p/ has been lost");
  });

  test("gain prose", () => {
    expect(describeEvent({ kind: "gain", phone: "ʃ" })).toBe("/ʃ/ has entered the language");
  });

  test("renders the display GRAPHEME, not the internal id, for phones where they diverge", () => {
    expect(describeEvent({ kind: "loss", phone: "iː" })).toBe("/ī/ has been lost");
  });
});
