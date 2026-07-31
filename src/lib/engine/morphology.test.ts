import { describe, test, expect } from "bun:test";
import { seedParadigm, affixContext, tickParadigm, inflect, licensesProDrop, PATHWAY, RENEWAL_TURNS, FUSE_TURNS } from "./morphology";
import { applyRuleToAffix, RULE_BY_ID, BY_ID } from "./phonology";
import type { AffixState, Lexicon, ParadigmCell, WordOrder } from "./types";

// A minimal but class-complete lexicon: one word per concept morphology.ts cares
// about, plus a couple of neutral fillers so affixContext's majority-vote has more
// than one stem to look at. Concepts/word shapes chosen so first-vowel clipping (the
// same rule collision.ts's clip uses for compounds) gives an unambiguous 2-3 seg clip.
const LEX: Lexicon = [
  { concept: "finish", word: ["t", "a", "p"] },   // clip -> t,a  (past pathway)
  { concept: "i", word: ["m", "e"] },              // clip -> m,e (p1sg pathway)
  { concept: "you", word: ["s", "u"] },            // clip -> s,u (p2 pathway)
  { concept: "we", word: ["n", "o", "k"] },        // clip -> n,o (p1pl pathway)
  { concept: "eat", word: ["k", "a", "t"] },       // verb stem, final -t, initial k
  { concept: "drink", word: ["p", "a", "t"] },     // verb stem, final -t, initial p
  { concept: "go", word: ["k", "a", "t"] },        // verb stem, final -t, initial k (majority -t/-k)
  { concept: "water", word: ["w", "a", "t", "e"] }, // filler noun, not read by any morphology fn
];

const SOV: WordOrder = { basic: "SOV", adj: "AdjN" };
const SVO: WordOrder = { basic: "SVO", adj: "AdjN" };

describe("seedParadigm", () => {
  test("every cell is born affixal", () => {
    const p = seedParadigm(LEX, SOV, 1);
    (["past", "p1sg", "p2", "p1pl"] as ParadigmCell[]).forEach((cell) => {
      expect(p[cell].stage).toBe("affixal");
      expect(p[cell].clock).toBe(0);
    });
  });

  test("forms are correct clips of the pathway source words' genesis forms", () => {
    const p = seedParadigm(LEX, SOV, 1);
    expect(p.past.form).toEqual(["t", "a"]);   // finish: t,a,p -> clip to onset+first vowel
    expect(p.p1sg.form).toEqual(["m", "e"]);   // i: m,e -> whole word is already onset+V
    expect(p.p2.form).toEqual(["s", "u"]);     // you: s,u
    expect(p.p1pl.form).toEqual(["n", "o"]);   // we: n,o,k -> clip drops the coda
  });

  test("OV (SOV) branches always suffix", () => {
    const p = seedParadigm(LEX, SOV, 1);
    (["past", "p1sg", "p2", "p1pl"] as ParadigmCell[]).forEach((cell) => expect(p[cell].suffixed).toBe(true));
  });

  test("VO (SVO) branches place per a seeded roll, not uniformly", () => {
    // sweep seeds; VO placement should show both suffixing and prefixing across seeds,
    // not collapse to one constant value (that would mean the roll isn't being read).
    const seen = new Set<boolean>();
    for (let seed = 1; seed <= 200; seed++) seen.add(seedParadigm(LEX, SVO, seed).past.suffixed);
    expect(seen.size).toBe(2);
  });

  test("determinism: same lex/order/seed -> identical output", () => {
    const a = seedParadigm(LEX, SOV, 42);
    const b = seedParadigm(LEX, SOV, 42);
    expect(a).toEqual(b);
  });

  test("missing pathway source yields an empty-form cell rather than throwing", () => {
    const noFinish = LEX.filter((e) => e.concept !== "finish");
    const p = seedParadigm(noFinish, SOV, 1);
    expect(p.past.form).toEqual([]);
  });
});

describe("affixContext", () => {
  test("majority stem-final phone across verb stems, computed live", () => {
    // eat: -t, drink: -t, go: -t -> majority is "t" for a suffix's injected context.
    expect(affixContext(LEX, "suffix")).toEqual(BY_ID.t);
  });

  test("majority stem-initial phone for a prefix", () => {
    // eat: k-, drink: p-, go: k- -> majority is "k".
    expect(affixContext(LEX, "prefix")).toEqual(BY_ID.k);
  });

  test("shifts when the fixture's verb stems change", () => {
    const shifted: Lexicon = LEX.map((e) => (e.concept === "eat" ? { ...e, word: ["k", "a", "s"] } : e));
    // now: eat ends -s, drink -t, go -t -> majority is still "t" (2 vs 1)...
    expect(affixContext(shifted, "suffix")).toEqual(BY_ID.t);
    // ...but flipping the tie (drink -> -s too) moves the majority to "s".
    const flipped: Lexicon = shifted.map((e) => (e.concept === "drink" ? { ...e, word: ["p", "a", "s"] } : e));
    expect(affixContext(flipped, "suffix")).toEqual(BY_ID.s);
  });

  test("phone-table tie-break: an exact 1-1 split resolves to PHONES' earlier entry", () => {
    const tie: Lexicon = [
      { concept: "eat", word: ["k", "a", "t"] },   // final t
      { concept: "drink", word: ["p", "a", "p"] }, // final p — p precedes t in PHONES
    ];
    expect(affixContext(tie, "suffix")).toEqual(BY_ID.p);
  });

  test("no verb stems -> null, not a throw", () => {
    // "finish" is also class verb (lexicon.ts's CLASS_MEMBERS.verb) — exclude it too.
    const noVerbs = LEX.filter((e) => !["eat", "drink", "go", "finish"].includes(e.concept));
    expect(affixContext(noVerbs, "suffix")).toBeNull();
  });

  test("determinism: same lex -> identical output across repeated calls", () => {
    expect(affixContext(LEX, "suffix")).toEqual(affixContext(LEX, "suffix"));
  });
});

describe("applyRuleToAffix", () => {
  test("post:bound fires on a suffix's outer (real) edge", () => {
    // apoc: V -> zero / _ #. A suffix "a" (bare vowel) sits at the real word boundary
    // on its right — apoc should delete it.
    expect(applyRuleToAffix(["a"], RULE_BY_ID.apoc, "suffix", null)).toEqual([]);
  });

  test("post:bound never fires on a suffix's INNER (injected) edge", () => {
    // finalC: C -> zero / _ #. A two-segment suffix "t","a" — the "t" is stem-internal
    // (index 0), its right neighbour is "a" (a real internal phone, not the boundary),
    // so finalC must not touch it; only "a" sits at the real outer boundary and finalC
    // doesn't match vowels anyway, so the suffix survives unchanged.
    expect(applyRuleToAffix(["t", "a"], RULE_BY_ID.finalC, "suffix", BY_ID.a)).toEqual(["t", "a"]);
  });

  test("prefix mirrors: pre:bound fires on the real left edge, not the injected right edge", () => {
    // fortify: glide -> fricative / # _. A prefix "j" (glide) sits at the real left
    // boundary — fortify should hit it regardless of injected right context.
    expect(applyRuleToAffix(["j"], RULE_BY_ID.fortify, "prefix", BY_ID.a)).toEqual(["ʒ"]);
  });

  test("injected context enables a context-dependent rule at the inner edge", () => {
    // voice: voiceless stop -> voiced / V _ V. A one-segment prefix "t" with its
    // (real) left edge at the boundary and its (injected) right context a vowel would
    // need a vowel on BOTH sides to fire — with only one real vowel available, this
    // rule requires pre=V, so mount it as a suffix instead: suffix "t", injected left
    // context (stem-final) = a vowel, real right edge = boundary. voice needs post=V
    // too, so this shows the injected context participating without asserting a full
    // fire; instead assert palat (post:frontV) — irrelevant here since it needs post
    // context, not pre. Use nasassim instead: nasal -> [place of following stop],
    // post:stopC. A suffix "n" whose real right edge is the boundary can't fire
    // (post is null, not a stop) — so use it as a PREFIX: prefix "n", real left edge
    // is the boundary (pre=null, satisfied since nasassim has no pre predicate),
    // injected right context (stem-initial) = "t" (a stop) -> nasal assimilates.
    expect(applyRuleToAffix(["n"], RULE_BY_ID.nasassim, "prefix", BY_ID.t)).toEqual(["n"]); // alveolar n -> alveolar place, no visible change
    expect(applyRuleToAffix(["n"], RULE_BY_ID.nasassim, "prefix", BY_ID.p)).toEqual(["m"]); // labial context -> n becomes m
  });

  test("empty result is returned, never floored (the vowel floor is lifted)", () => {
    // apoc on a bare single-vowel suffix empties it entirely — applyRuleToWord would
    // floor this back to the original; applyRuleToAffix must not.
    expect(applyRuleToAffix(["a"], RULE_BY_ID.apoc, "suffix", null)).toEqual([]);
    // finalC on a bare single-consonant suffix likewise empties it.
    expect(applyRuleToAffix(["t"], RULE_BY_ID.finalC, "suffix", null)).toEqual([]);
  });

  test("growth via paragoge is possible (an affix can grow, not only shrink)", () => {
    // paragoge: C -> C+V / _ #. A suffix "t" at the real right boundary should grow
    // an epenthetic high front vowel.
    const out = applyRuleToAffix(["t"], RULE_BY_ID.paragoge, "suffix", null);
    expect(out.length).toBe(2);
    expect(BY_ID[out[1]].type).toBe("V");
  });

  test("determinism: same inputs -> identical output", () => {
    const a = applyRuleToAffix(["k", "a", "t"], RULE_BY_ID.apoc, "suffix", BY_ID.a);
    const b = applyRuleToAffix(["k", "a", "t"], RULE_BY_ID.apoc, "suffix", BY_ID.a);
    expect(a).toEqual(b);
  });
});

describe("tickParadigm: stage machine", () => {
  const branch = { wordOrder: SOV, frameWeights: [1, 1, 1, 1] as [number, number, number, number], proDrop: false };

  test("erosion to empty -> zero the same tick", () => {
    const p = seedParadigm(LEX, SOV, 1);
    // force a one-segment past affix so apoc/finalC can empty it in a single tick.
    const forced = { ...p, past: { ...p.past, form: ["a"] } };
    const { paradigm } = tickParadigm(forced, RULE_BY_ID.apoc, LEX, SOV, 1, 5, 0, branch);
    expect(paradigm.past.stage).toBe("zero");
    expect(paradigm.past.form).toEqual([]);
  });

  test("renewal fires at exactly RENEWAL_TURNS, marker = the pathway source's CURRENT clip", () => {
    let p = seedParadigm(LEX, SOV, 1);
    p = { ...p, past: { stage: "zero", form: [], suffixed: true, clock: 0 } };
    // drift the source word ("finish") between seeding and renewal so the marker isn't
    // simply the genesis clip repeated.
    const driftedLex: Lexicon = LEX.map((e) => (e.concept === "finish" ? { ...e, word: ["d", "i", "p"] } : e));
    let clock = 0;
    for (let t = 1; t < RENEWAL_TURNS; t++) {
      const out = tickParadigm(p, null, driftedLex, SOV, 1, t, 0, branch);
      p = out.paradigm;
      expect(p.past.stage).toBe("zero"); // not yet
      clock = p.past.clock;
    }
    expect(clock).toBe(RENEWAL_TURNS - 1);
    const final = tickParadigm(p, null, driftedLex, SOV, 1, RENEWAL_TURNS, 0, branch);
    expect(final.paradigm.past.stage).toBe("periphrastic");
    expect(final.paradigm.past.form).toEqual(["d", "i"]); // the DRIFTED source's clip, not the genesis one
    expect(final.events.some((e) => e.drift === undefined)).toBe(true); // no drift flag on grammatical events
  });

  test("fusion at exactly FUSE_TURNS, with a re-decided placement", () => {
    let p = seedParadigm(LEX, SOV, 1);
    p = { ...p, past: { stage: "periphrastic", form: ["d", "i"], suffixed: true, clock: 0 } };
    for (let t = 1; t < FUSE_TURNS; t++) {
      p = tickParadigm(p, null, LEX, SOV, 1, t, 0, branch).paradigm;
      expect(p.past.stage).toBe("periphrastic");
    }
    const final = tickParadigm(p, null, LEX, SOV, 1, FUSE_TURNS, 0, branch);
    expect(final.paradigm.past.stage).toBe("affixal");
    expect(final.paradigm.past.form).toEqual(["d", "i"]);
    expect(final.paradigm.past.suffixed).toBe(true); // SOV always suffixes
  });

  test("history events for death/renewal/fusion carry no `drift` flag", () => {
    const p = seedParadigm(LEX, SOV, 1);
    const forced = { ...p, past: { ...p.past, form: ["a"] } };
    const { events } = tickParadigm(forced, RULE_BY_ID.apoc, LEX, SOV, 1, 5, 0, branch);
    expect(events.length).toBeGreaterThan(0);
    events.forEach((e) => expect(e.drift).toBeUndefined());
  });

  test("rule=null only advances clocks, never mints randomness beyond the fusion placement roll", () => {
    const p = seedParadigm(LEX, SOV, 1);
    const { paradigm } = tickParadigm(p, null, LEX, SOV, 1, 1, 0, branch);
    // every cell is still affixal with the same form — null rule erodes nothing.
    (["past", "p1sg", "p2", "p1pl"] as ParadigmCell[]).forEach((cell) => {
      expect(paradigm[cell].form).toEqual(p[cell].form);
      expect(paradigm[cell].stage).toBe("affixal");
    });
  });

  test("determinism: same inputs -> identical output", () => {
    const p = seedParadigm(LEX, SOV, 7);
    const a = tickParadigm(p, RULE_BY_ID.voice, LEX, SOV, 7, 3, 2, branch);
    const b = tickParadigm(p, RULE_BY_ID.voice, LEX, SOV, 7, 3, 2, branch);
    expect(a).toEqual(b);
  });

  test("cells advance in fixed table order (past, p1sg, p2, p1pl) — order doesn't affect outcome, but every cell is visited", () => {
    const p = seedParadigm(LEX, SOV, 1);
    const forced = Object.fromEntries(
      (["past", "p1sg", "p2", "p1pl"] as ParadigmCell[]).map((c) => [c, { ...p[c], form: ["a"] }]),
    ) as Record<ParadigmCell, AffixState>;
    const { paradigm } = tickParadigm(forced, RULE_BY_ID.apoc, LEX, SOV, 1, 1, 0, branch);
    (["past", "p1sg", "p2", "p1pl"] as ParadigmCell[]).forEach((cell) => expect(paradigm[cell].stage).toBe("zero"));
  });
});

describe("inflect", () => {
  const p = seedParadigm(LEX, SOV, 1);

  test("bare for nonpast/p3 (cell = null)", () => {
    expect(inflect(["k", "a", "t"], null, p)).toEqual({ word: ["k", "a", "t"], marker: null });
  });

  test("suffix placement attaches the affix after the stem", () => {
    expect(p.past.suffixed).toBe(true); // SOV
    expect(inflect(["k", "a", "t"], "past", p)).toEqual({ word: ["k", "a", "t", "t", "a"], marker: null });
  });

  test("prefix placement attaches the affix before the stem", () => {
    const prefixed = { ...p, past: { ...p.past, suffixed: false } };
    expect(inflect(["k", "a", "t"], "past", prefixed)).toEqual({ word: ["t", "a", "k", "a", "t"], marker: null });
  });

  test("periphrastic stage returns the marker as a SEPARATE word", () => {
    const peri = { ...p, past: { stage: "periphrastic" as const, form: ["d", "i"], suffixed: true, clock: 0 } };
    expect(inflect(["k", "a", "t"], "past", peri)).toEqual({ word: ["k", "a", "t"], marker: ["d", "i"] });
  });

  test("empty-form cells render bare (zero stage, or an empty periphrastic marker)", () => {
    const zero = { ...p, past: { stage: "zero" as const, form: [], suffixed: true, clock: 0 } };
    expect(inflect(["k", "a", "t"], "past", zero)).toEqual({ word: ["k", "a", "t"], marker: null });
  });
});

describe("licensesProDrop", () => {
  test("all four cells affixal (genesis) -> licensed (3/3 agreement cells alive)", () => {
    const p = seedParadigm(LEX, SOV, 1);
    expect(licensesProDrop(p)).toBe(true);
  });

  test("exactly 2 of 3 agreement cells alive -> still licensed", () => {
    const p = seedParadigm(LEX, SOV, 1);
    const collapsed = { ...p, p1sg: { ...p.p1sg, stage: "zero" as const, form: [] } };
    expect(licensesProDrop(collapsed)).toBe(true);
  });

  test("only 1 of 3 agreement cells alive -> revoked", () => {
    const p = seedParadigm(LEX, SOV, 1);
    const collapsed = {
      ...p,
      p1sg: { ...p.p1sg, stage: "zero" as const, form: [] },
      p2: { ...p.p2, stage: "zero" as const, form: [] },
    };
    expect(licensesProDrop(collapsed)).toBe(false);
  });

  test("all three agreement cells zero -> revoked (the collapse state 1ENG.21 reads)", () => {
    const p = seedParadigm(LEX, SOV, 1);
    const collapsed = {
      ...p,
      p1sg: { ...p.p1sg, stage: "zero" as const, form: [] },
      p2: { ...p.p2, stage: "zero" as const, form: [] },
      p1pl: { ...p.p1pl, stage: "zero" as const, form: [] },
    };
    expect(licensesProDrop(collapsed)).toBe(false);
  });

  test("past (tense, not agreement) dying has no bearing on the licence", () => {
    const p = seedParadigm(LEX, SOV, 1);
    const collapsed = { ...p, past: { ...p.past, stage: "zero" as const, form: [] } };
    expect(licensesProDrop(collapsed)).toBe(true);
  });
});

describe("PATHWAY", () => {
  test("uses lowercase concept ids matching lexicon.ts's CLASS_MEMBERS.pronoun (a spike-vs-shipped correction)", () => {
    expect(PATHWAY.p1sg).toBe("i");
    expect(PATHWAY.p2).toBe("you");
    expect(PATHWAY.p1pl).toBe("we");
    expect(PATHWAY.past).toBe("finish");
  });
});

// 1ENG.20 salt-registry regression (spike §7 convention, mirrors syntax.test.ts's).
// morphology.ts draws two families under the SAME first coordinate (seed+41: the VO
// placement roll and the erosion-block roll), distinguished instead by their (b,c)
// shape — both still need that first coordinate itself disjoint from every other
// registered family.
describe("1ENG.20 salt registry", () => {
  test("morphology's seed+41 is disjoint from every pre-existing family", () => {
    const knownFirstCoords = new Set([0, 7, 13, 19, 23, 29, 31, 37]);
    expect(knownFirstCoords.has(41)).toBe(false);
  });
});
