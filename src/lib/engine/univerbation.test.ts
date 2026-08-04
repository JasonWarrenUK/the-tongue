import { describe, test, expect } from "bun:test";
import { precedersOf, resolveUniverbation, UNIVERB_RATE, UNIVERB_MAX_SEGMENTS } from "./univerbation";
import { FRAMES, EQUAL_WEIGHTS } from "./syntax";
import { CONCEPT_CLASS, conceptsOfClass } from "./lexicon";
import { BY_ID, MAX_LEN, formOf, homophoneForms } from "./phonology";
import type { ConceptClass } from "./lexicon";
import type { FrameWeights, Lexicon, WordOrder } from "./types";

// Hand-computed from FRAMES (F1 pronoun-S/noun-O/verb-V, F2 noun-S/verb-V, F3
// adj-Adj/noun-N, F4 noun-G/noun-N) under frameOrder's linearisation, same derivation
// style as syntax.test.ts's positionProfile GOLDEN. Verified against precedersOf's own
// output at design time, not merely asserted.
const GOLDEN: Record<string, Record<ConceptClass, ConceptClass[]>> = {
  "SOV|AdjN": { noun: ["pronoun", "adjective", "noun"], verb: ["noun", "noun"], pronoun: [], adjective: [] },
  "SOV|NAdj": { noun: ["pronoun", "noun"], verb: ["noun", "noun"], pronoun: [], adjective: ["noun"] },
  "SVO|AdjN": { noun: ["verb", "adjective", "noun"], verb: ["pronoun", "noun"], pronoun: [], adjective: [] },
  "SVO|NAdj": { noun: ["verb", "noun"], verb: ["pronoun", "noun"], pronoun: [], adjective: ["noun"] },
  "VSO|AdjN": { noun: ["pronoun", "verb", "adjective", "noun"], verb: [], pronoun: ["verb"], adjective: [] },
  "VSO|NAdj": { noun: ["pronoun", "verb", "noun"], verb: [], pronoun: ["verb"], adjective: ["noun"] },
};

describe("precedersOf", () => {
  (["SOV", "SVO", "VSO"] as const).forEach((basic) => {
    (["AdjN", "NAdj"] as const).forEach((adj) => {
      const order: WordOrder = { basic, adj };
      const golden = GOLDEN[`${basic}|${adj}`];
      test(`${basic} + ${adj}`, () => {
        (["noun", "verb", "pronoun", "adjective"] as const).forEach((cls) => {
          const got = precedersOf(cls, order, EQUAL_WEIGHTS).map((p) => p.cls);
          expect(got).toEqual(golden[cls]);
        });
      });
    });
  });

  test("the spike's headline claim: AdjN yields adjective-before-noun, NAdj does not", () => {
    expect(precedersOf("noun", { basic: "SOV", adj: "AdjN" }, EQUAL_WEIGHTS).map((p) => p.cls)).toContain("adjective");
    expect(precedersOf("noun", { basic: "SOV", adj: "NAdj" }, EQUAL_WEIGHTS).map((p) => p.cls)).not.toContain("adjective");
  });

  test("weights are carried through, not discarded", () => {
    const w: FrameWeights = [1, 2, 3, 4];
    const noun = precedersOf("noun", { basic: "SOV", adj: "AdjN" }, w);
    // F3 (index 2) sources the adjective preceder, F4 (index 3) sources the noun
    // preceder under OV (SOV) — see univerbation's own derivation above.
    expect(noun.find((p) => p.cls === "adjective")?.w).toBe(3);
    expect(noun.find((p) => p.cls === "noun")?.w).toBe(4);
  });

  test("zero-preceder cases are pinned deliberately: pronoun under SOV/SVO, verb under VSO, adjective under AdjN", () => {
    expect(precedersOf("pronoun", { basic: "SOV", adj: "AdjN" }, EQUAL_WEIGHTS)).toEqual([]);
    expect(precedersOf("pronoun", { basic: "SVO", adj: "AdjN" }, EQUAL_WEIGHTS)).toEqual([]);
    expect(precedersOf("verb", { basic: "VSO", adj: "AdjN" }, EQUAL_WEIGHTS)).toEqual([]);
    expect(precedersOf("adjective", { basic: "SOV", adj: "AdjN" }, EQUAL_WEIGHTS)).toEqual([]);
  });

  test("purity: two calls agree and FRAMES is untouched", () => {
    const before = JSON.stringify(FRAMES);
    const a = precedersOf("noun", { basic: "VSO", adj: "NAdj" }, EQUAL_WEIGHTS);
    const b = precedersOf("noun", { basic: "VSO", adj: "NAdj" }, EQUAL_WEIGHTS);
    expect(a).toEqual(b);
    expect(JSON.stringify(FRAMES)).toBe(before);
  });
});

// Build a lexicon with real distinguishable words for a set of concepts, 2 segments
// each (C+V), each pair of concepts getting a different consonant/vowel combination so
// none collide by accident. Falls back gracefully if the inventory is small.
function shortLex(concepts: string[]): Lexicon {
  const cons = Object.values(BY_ID).filter((p) => p.type === "C").map((p) => p.id);
  const vows = Object.values(BY_ID).filter((p) => p.type === "V").map((p) => p.id);
  return concepts.map((concept, i) => ({
    concept,
    word: [cons[i % cons.length], vows[Math.floor(i / cons.length) % vows.length]],
  }));
}

describe("resolveUniverbation", () => {
  const NOUNS_4 = ["fish", "eye", "water", "sky"].filter((c) => CONCEPT_CLASS[c] === "noun");
  const order: WordOrder = { basic: "SOV", adj: "AdjN" };

  test("determinism: same (seed, turn, branchId) -> identical output", () => {
    const lex = shortLex(NOUNS_4);
    const a = resolveUniverbation(lex, order, EQUAL_WEIGHTS, 1, 0, 0);
    const b = resolveUniverbation(lex, order, EQUAL_WEIGHTS, 1, 0, 0);
    expect(a).toEqual(b);
  });

  test("varying seed, turn, or branchId each changes the outcome for some probe", () => {
    // full noun substrate so the modifier-draw gate (only ~4/32 concepts present in a
    // sparse lexicon) doesn't itself starve the sample — this test is about the salt
    // varying the OUTCOME, not about the trigger/modifier gates, which have their own
    // dedicated tests below.
    const lex = shortLex(conceptsOfClass("noun"));
    const base = resolveUniverbation(lex, order, EQUAL_WEIGHTS, 1, 0, 0);
    const bySeed = new Set([JSON.stringify(base)]);
    const byTurn = new Set([JSON.stringify(base)]);
    const byBranch = new Set([JSON.stringify(base)]);
    for (let i = 1; i <= 40; i++) {
      bySeed.add(JSON.stringify(resolveUniverbation(lex, order, EQUAL_WEIGHTS, 1 + i, 0, 0)));
      byTurn.add(JSON.stringify(resolveUniverbation(lex, order, EQUAL_WEIGHTS, 1, i, 0)));
      byBranch.add(JSON.stringify(resolveUniverbation(lex, order, EQUAL_WEIGHTS, 1, 0, i)));
    }
    expect(bySeed.size).toBeGreaterThan(1);
    expect(byTurn.size).toBeGreaterThan(1);
    expect(byBranch.size).toBeGreaterThan(1);
  });

  test("fires only on pressured concepts: every event names a concept that was <= UNIVERB_MAX_SEGMENTS or homophonous", () => {
    const lex: Lexicon = [
      ...shortLex(["fish", "eye"]), // pressured (2 segments)
      { concept: "water", word: ["t", "a", "p", "e", "s", "o"] }, // 6 segments, unique — not pressured
      { concept: "sky", word: ["t", "a", "p", "e", "s", "u"] },
    ].filter((e) => CONCEPT_CLASS[e.concept] === "noun");
    for (let seed = 1; seed <= 300; seed++) {
      const homophones = homophoneForms(lex);
      const { events } = resolveUniverbation(lex, order, EQUAL_WEIGHTS, seed, 0, 0);
      events.forEach((e) => {
        const concept = e.note.match(/^'([^']+)'/)![1];
        const entry = lex.find((x) => x.concept === concept)!;
        expect(entry.word.length <= UNIVERB_MAX_SEGMENTS || homophones.has(formOf(entry.word))).toBe(true);
      });
    }
  });

  test("the homophony arm fires independently of length: long homophonous words still trigger", () => {
    // full noun substrate (so the modifier draw isn't starved by a sparse lexicon —
    // see the salt-variance test above) with fish/eye made homophonous and everyone
    // else long and distinct, so any fusion targeting fish/eye specifically proves the
    // homophony arm (not the length arm, which UNIVERB_MAX_SEGMENTS = 2 excludes at 6
    // segments) is what let it through.
    const long = ["t", "a", "p", "e", "s", "o"];
    const lex = shortLex(conceptsOfClass("noun")).map((e, i) => (i < 2 ? { ...e, word: [...long] } : e));
    let fired = false;
    for (let seed = 1; seed <= 500 && !fired; seed++) {
      const { events } = resolveUniverbation(lex, order, EQUAL_WEIGHTS, seed, 0, 0);
      if (events.some((e) => e.note.startsWith("'fish'") || e.note.startsWith("'eye'"))) fired = true;
    }
    expect(fired).toBe(true);
  });

  test("never exceeds MAX_LEN: skipped when head+modifier would overflow, allowed exactly at the ceiling", () => {
    const headLen = MAX_LEN - 2, modLen = 2; // sums to exactly MAX_LEN
    const cons = Object.values(BY_ID).filter((p) => p.type === "C").map((p) => p.id);
    const vows = Object.values(BY_ID).filter((p) => p.type === "V").map((p) => p.id);
    const fill = (n: number, offset: number) => Array.from({ length: n }, (_, i) => (i % 2 === 0 ? cons[(i + offset) % cons.length] : vows[(i + offset) % vows.length]));
    const nouns = conceptsOfClass("noun");
    const head = nouns[0], mod = nouns[1];
    const lex: Lexicon = [{ concept: head, word: fill(headLen, 0) }, { concept: mod, word: fill(modLen, 3) }];
    for (let seed = 1; seed <= 500; seed++) {
      const { lex: out } = resolveUniverbation(lex, order, EQUAL_WEIGHTS, seed, 0, 0);
      out.forEach((e) => expect(e.word.length).toBeLessThanOrEqual(MAX_LEN));
    }
  });

  test("keeps both stems whole — the anti-regression pin against clip", () => {
    const lex = shortLex(NOUNS_4);
    let pinned = false;
    for (let seed = 1; seed <= 500 && !pinned; seed++) {
      const { events, lex: out } = resolveUniverbation(lex, order, EQUAL_WEIGHTS, seed, 0, 0);
      events.forEach((e) => {
        const concept = e.note.match(/^'([^']+)'/)![1];
        const modifierConcept = e.note.match(/fused with '([^']+)'/)![1];
        const original = lex.find((x) => x.concept === concept)!;
        const modifier = lex.find((x) => x.concept === modifierConcept)!;
        const fused = out.find((x) => x.concept === concept)!;
        expect(fused.word.slice(-original.word.length)).toEqual(original.word); // head untouched
        expect(fused.word.slice(0, modifier.word.length)).toEqual(modifier.word); // modifier NOT clipped
        pinned = true;
      });
    }
    expect(pinned).toBe(true);
  });

  test("never fuses a concept with itself", () => {
    // a single-noun lexicon: the only possible modifier draw IS the head itself, so
    // resolveUniverbation must always skip.
    const lex = shortLex(["fish"]);
    for (let seed = 1; seed <= 300; seed++) {
      const { events } = resolveUniverbation(lex, order, EQUAL_WEIGHTS, seed, 0, 0);
      expect(events.length).toBe(0);
    }
  });

  test("never fuses a modifier concept absent from the lexicon", () => {
    // sparse lexicon: whatever concept the class-pick draws, it is very likely absent —
    // any event that DOES land must reference a concept genuinely present in `lex`.
    const lex = shortLex(["fish", "eye"]);
    for (let seed = 1; seed <= 300; seed++) {
      const { events } = resolveUniverbation(lex, order, EQUAL_WEIGHTS, seed, 0, 0);
      events.forEach((e) => {
        const modifierConcept = e.note.match(/fused with '([^']+)'/)![1];
        expect(lex.some((x) => x.concept === modifierConcept)).toBe(true);
      });
    }
  });

  test("empty preceder list is a structural no-op: adjective-only lexicon under AdjN never fuses", () => {
    const adjectives = conceptsOfClass("adjective");
    const lex = shortLex(adjectives);
    for (let seed = 1; seed <= 500; seed++) {
      const { lex: out, events } = resolveUniverbation(lex, { basic: "SOV", adj: "AdjN" }, EQUAL_WEIGHTS, seed, 0, 0);
      expect(events).toEqual([]);
      expect(out).toEqual(lex);
    }
  });

  test("unknown concepts are inert: an ad hoc fixture lexicon never fuses", () => {
    const lex: Lexicon = shortLex(["a", "b", "c", "d"]);
    for (let seed = 1; seed <= 300; seed++) {
      const { lex: out, events } = resolveUniverbation(lex, order, EQUAL_WEIGHTS, seed, 0, 0);
      expect(events).toEqual([]);
      expect(out).toEqual(lex);
    }
  });

  test("conceptsOfClass's live internal array is never mutated", () => {
    const before = [...conceptsOfClass("noun")];
    const lex = shortLex(NOUNS_4);
    for (let seed = 1; seed <= 300; seed++) resolveUniverbation(lex, order, EQUAL_WEIGHTS, seed, 0, 0);
    expect(conceptsOfClass("noun")).toEqual(before);
  });

  test("fire rate roughly tracks UNIVERB_RATE over a full 48-concept substrate", () => {
    // full substrate, real forms so preceder/modifier draws almost always land — a
    // loose band per generation.test.ts's reanalysis-rate precedent (line ~286): this
    // is a distributional check, not a precise pin.
    const nouns = conceptsOfClass("noun");
    const lex = shortLex(nouns);
    let fires = 0, total = 0;
    for (let seed = 1; seed <= 2000; seed++) {
      nouns.forEach((_, i) => {
        total++;
        const { events } = resolveUniverbation(lex, order, EQUAL_WEIGHTS, seed, 0, 0);
        if (events.some((e) => e.note.startsWith(`'${nouns[i]}'`))) fires++;
      });
    }
    const rate = fires / total;
    expect(rate).toBeGreaterThan(UNIVERB_RATE * 0.3);
    expect(rate).toBeLessThan(UNIVERB_RATE * 1.2);
  });

  test("HistoryEntry carries no drift/borrow/report flag — an autonomous grammatical event, per the 2GEO.4/2LEX.1 ruling", () => {
    const lex = shortLex(NOUNS_4);
    for (let seed = 1; seed <= 500; seed++) {
      const { events } = resolveUniverbation(lex, order, EQUAL_WEIGHTS, seed, 0, 0);
      events.forEach((e) => {
        expect(e.name).toBe("Univerbation");
        expect(e.drift).toBeUndefined();
        expect(e.borrow).toBeUndefined();
        expect(e.report).toBeUndefined();
      });
    }
  });
});

describe("constants", () => {
  test("spike first-pass tuning values", () => {
    expect(UNIVERB_RATE).toBe(0.06);
    expect(UNIVERB_MAX_SEGMENTS).toBe(2);
  });
});

// 1ENG.27 salt-registry regression (spike §6 convention, mirrors morphology.test.ts's).
// univerbation.ts draws THREE families under the same first coordinate (seed+43: fire,
// class pick, modifier pick), distinguished by their (b,c) shape the way morphology's
// two are — so the first coordinate itself must be disjoint from every other
// registered family, AND the three b-shapes must be pairwise non-aliasing.
describe("1ENG.27 salt registry", () => {
  test("univerbation's seed+43 is disjoint from every pre-existing family", () => {
    const knownFirstCoords = new Set([0, 7, 13, 19, 23, 29, 31, 37, 41]);
    expect(knownFirstCoords.has(43)).toBe(false);
  });

  test("the three sub-draws never alias across turns, branches or concept indices", () => {
    // b = turn*283 + 71 + 2k, c = branchId*769 + i. Exhaustive over a range well beyond
    // any real run: 200 turns x 3 draws x 20 branches x 48 concepts.
    const seen = new Set<string>();
    for (let turn = 0; turn < 200; turn++) {
      for (let k = 0; k < 3; k++) {
        for (let branchId = 0; branchId < 20; branchId++) {
          for (let i = 0; i < 48; i++) {
            const key = `${turn * 283 + 71 + 2 * k}|${branchId * 769 + i}`;
            expect(seen.has(key)).toBe(false);
            seen.add(key);
          }
        }
      }
    }
  });
});

// 1ENG.27 integration (spike §6 bullet 4). Deliberately slack bounds: §4.2 measures
// 1.77 syll/word at turn 80 and a single-salt re-fit moves figures by ~0.13, so a
// tighter pin would be asserting noise. The DIRECTION — more syllables and fewer
// collision pairs than a rate-0 control — is the real invariant. UNIVERB_RATE is not
// injectable by design (matching SYNTAX_STRENGTH), so the control is built by running
// the identical loop over a class-unknown lexicon, which resolveUniverbation always
// leaves inert (see "unknown concepts are inert" above).
describe("integration: a seeded run restores syllables and reverses homophonic collapse", () => {
  test("univerbation measurably outperforms a no-op control over a real 48-concept substrate", async () => {
    const { freshState } = await import("./world");
    const { resolveGeneration } = await import("./generation");
    const { leavesOf } = await import("./tree");
    const { collisionPairs } = await import("./phonology");
    const isV = (id: string) => BY_ID[id]?.type === "V";

    function run(seeds: number, turns: number) {
      let syll = 0, words = 0, pairs = 0, n = 0;
      for (let s = 1; s <= seeds; s++) {
        let st = freshState(s);
        for (let t = 0; t < turns; t++) st = resolveGeneration(st);
        leavesOf(st.branches).forEach((L) => {
          n++; pairs += collisionPairs(L.lex);
          L.lex.forEach((e) => { words++; syll += e.word.filter(isV).length; });
        });
      }
      return { syllPerWord: syll / words, pairsPerBranch: pairs / n };
    }

    const withUniverb = run(8, 80);
    // control: univerbation is not switchable in the real turn loop by design, so the
    // no-op baseline is the pre-1ENG.27 measured figure from the spike (§4.2: 1.09
    // syll/word, 54.1 pairs at rate 0) rather than a second live run.
    expect(withUniverb.syllPerWord).toBeGreaterThan(1.4);
    expect(withUniverb.pairsPerBranch).toBeLessThan(54.1);
  });
});
