import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";
import { syllabify, syllableCount, SONORITY, stressPosition, stressMap } from "./syllable";
import type { StressMode, StressRule } from "./syllable";
import { BY_ID } from "./phonology";

const isV = (id: string) => BY_ID[id]?.type === "V";

describe("syllabify", () => {
  test("CV → 1 syllable", () => {
    expect(syllabify(["t", "a"])).toEqual([{ onset: ["t"], nucleus: "a", coda: [] }]);
  });

  test("CVCV → CV·CV", () => {
    expect(syllabify(["t", "a", "t", "a"])).toEqual([
      { onset: ["t"], nucleus: "a", coda: [] },
      { onset: ["t"], nucleus: "a", coda: [] },
    ]);
  });

  test("rising-sonority cluster (stop→liquid) goes wholly to the following onset: ta.pra not tap.ra", () => {
    // p (stop, 1) < r (liquid, 4): sonority rises toward the second nucleus
    expect(syllabify(["t", "a", "p", "r", "a"])).toEqual([
      { onset: ["t"], nucleus: "a", coda: [] },
      { onset: ["p", "r"], nucleus: "a", coda: [] },
    ]);
  });

  test("falling-sonority cluster (liquid→stop) splits across the boundary: al.ka", () => {
    // l (liquid, 4) > k (stop, 1): sonority falls, so l stays in the first coda
    expect(syllabify(["a", "l", "k", "a"])).toEqual([
      { onset: [], nucleus: "a", coda: ["l"] },
      { onset: ["k"], nucleus: "a", coda: [] },
    ]);
  });

  test("vowel-initial word → empty onset", () => {
    expect(syllabify(["a", "t", "a"])[0].onset).toEqual([]);
  });

  test("word-final consonant run → all coda", () => {
    expect(syllabify(["t", "a", "p", "t"])).toEqual([
      { onset: ["t"], nucleus: "a", coda: ["p", "t"] },
    ]);
  });

  test("no-vowel input → one onset-only syllable with a null nucleus", () => {
    expect(syllabify(["s", "t"])).toEqual([{ onset: ["s", "t"], nucleus: null, coda: [] }]);
  });

  test("empty word → one syllable, no segments, null nucleus", () => {
    expect(syllabify([])).toEqual([{ onset: [], nucleus: null, coda: [] }]);
  });
});

describe("syllableCount", () => {
  test("agrees with syllabify(...).length", () => {
    const w = ["t", "a", "p", "r", "a"];
    expect(syllableCount(w)).toBe(syllabify(w).length);
  });

  test("no-vowel word still counts as one syllable", () => {
    expect(syllableCount(["s", "t"])).toBe(1);
  });
});

describe("SONORITY", () => {
  test("the standard five-step manner hierarchy, strictly increasing", () => {
    expect(SONORITY).toEqual({ stop: 1, fric: 2, nasal: 3, liquid: 4, glide: 5 });
  });
});

// §6: purity — no hashRand call anywhere in the module. Read the source rather than
// mocking rng.ts, since the invariant under test is "never imports it", not "never calls
// the specific export" — a source-string check catches both.
describe("purity", () => {
  test("syllable.ts contains no hashRand call and no rng.ts import", () => {
    const src = readFileSync(new URL("./syllable.ts", import.meta.url), "utf8");
    expect(src).not.toContain("hashRand");
    expect(src).not.toContain("./rng");
  });
});

// 1ENG.30 (1eng-24 spike §4/§5) — stress substrate.
describe("stressPosition", () => {
  const MODES: StressMode[] = ["initial", "final", "penult", "antepenult"];
  const rule = (mode: StressMode, weightSensitive = false): StressRule => ({ mode, weightSensitive });

  // CV.CV.CV.CV — every syllable light, no coda/long/diph anywhere, so weightSensitive
  // never engages regardless of mode. Golden table: 4 modes x 1-4 syllables.
  const MONO = syllabify(["t", "a"]);
  const DI = syllabify(["t", "a", "t", "a"]);
  const TRI = syllabify(["t", "a", "t", "a", "t", "a"]);
  const QUAD = syllabify(["t", "a", "t", "a", "t", "a", "t", "a"]);

  test("monosyllable -> 0 under every mode (the one word shape that can't lose its vowel)", () => {
    MODES.forEach((mode) => expect(stressPosition(MONO, rule(mode))).toBe(0));
  });

  test("nucleus === null -> -1 (reachable only via applyRuleToAffix's lifted floor)", () => {
    const vowelless = syllabify(["s", "t"]);
    MODES.forEach((mode) => expect(stressPosition(vowelless, rule(mode))).toBe(-1));
  });

  test("golden table: mode x syllable count (all light, weightSensitive irrelevant)", () => {
    // [initial, final, penult, antepenult]
    expect(MODES.map((m) => stressPosition(DI, rule(m)))).toEqual([0, 1, 0, 0]);
    expect(MODES.map((m) => stressPosition(TRI, rule(m)))).toEqual([0, 2, 1, 0]);
    expect(MODES.map((m) => stressPosition(QUAD, rule(m)))).toEqual([0, 3, 2, 1]);
  });

  test("disyllable + antepenult -> 0 (no antepenult exists; clamps to initial)", () => {
    expect(stressPosition(DI, rule("antepenult"))).toBe(0);
  });

  test("weight-sensitive penult: heavy penult (coda) keeps the penult", () => {
    // ta.pta split at TRI-length: [tap][ta] is the syllabify(["t","a","p","t","a"]) case.
    const sylls = syllabify(["t", "a", "p", "t", "a"]);
    expect(sylls[0].coda).toEqual(["p"]); // heavy via coda
    expect(stressPosition(sylls, rule("penult", true))).toBe(0); // penult IS index 0 here
  });

  test("weight-sensitive penult: heavy penult (long vowel) keeps the penult", () => {
    const sylls = syllabify(["t", "aː", "t", "a"]);
    expect(stressPosition(sylls, rule("penult", true))).toBe(0);
  });

  test("weight-sensitive penult: heavy penult (diphthong) keeps the penult", () => {
    const sylls = syllabify(["t", "ie", "t", "a"]);
    expect(stressPosition(sylls, rule("penult", true))).toBe(0);
  });

  test("weight-sensitive penult: light penult falls back to the antepenult, clamped on a disyllable", () => {
    expect(stressPosition(DI, rule("penult", true))).toBe(0); // disyllable clamps to 0
    expect(stressPosition(TRI, rule("penult", true))).toBe(0); // light penult (index 1) -> antepenult (index 0)
  });

  test("weightSensitive only modifies penult placement — it is not a fifth mode", () => {
    // initial/final/antepenult ignore weightSensitive entirely, even with a heavy syllable present.
    const sylls = syllabify(["t", "a", "p", "t", "a"]); // heavy syllable at index 0
    expect(stressPosition(sylls, rule("initial", true))).toBe(0);
    expect(stressPosition(sylls, rule("final", true))).toBe(1);
    expect(stressPosition(sylls, rule("antepenult", true))).toBe(0);
  });
});

describe("stressMap", () => {
  test("one entry per segment index, isStressed matches stressPosition, round-trips the word", () => {
    const w = ["t", "a", "p", "t", "a"]; // ta.pta — heavy penult at syllable 0
    const rule: StressRule = { mode: "final", weightSensitive: false };
    const map = stressMap(w, rule);
    expect(map.length).toBe(w.length);
    // final mode -> syllable 1 (the last) is stressed: indices 3,4 (t,a of syllable 1)
    expect(map.map((c) => c?.isStressed)).toEqual([false, false, false, true, true]);
    expect(map.map((c) => c?.syllIdx)).toEqual([0, 0, 0, 1, 1]);
    expect(map.every((c) => c?.syllCount === 2)).toBe(true);
  });

  test("role is correct across onset/nucleus/coda", () => {
    const w = ["t", "a", "p"]; // one syllable: onset t, nucleus a, coda p
    const map = stressMap(w, { mode: "initial", weightSensitive: false });
    expect(map.map((c) => c?.role)).toEqual(["onset", "nucleus", "coda"]);
  });

  test("weight is heavy for the coda syllable, light for the open one", () => {
    const w = ["t", "a", "p", "t", "a"]; // ta.pta
    const map = stressMap(w, { mode: "initial", weightSensitive: false });
    expect(map[0]?.weight).toBe("heavy"); // t (syll 0, has coda)
    expect(map[3]?.weight).toBe("light"); // t (syll 1, no coda)
  });

  test("a wholly vowelless word maps every segment to isStressed:false (stressPosition -1 matches no index)", () => {
    const map = stressMap(["s", "t"], { mode: "initial", weightSensitive: false });
    expect(map.every((c) => c?.isStressed === false)).toBe(true);
  });
});

// §6: purity pin on the stress additions — same source-string idiom as syllabify's own
// purity test above.
describe("1ENG.30 purity", () => {
  test("stress additions draw no hashRand — every value is a pure function of the word/rule", () => {
    const src = readFileSync(new URL("./syllable.ts", import.meta.url), "utf8");
    expect(src).not.toContain("hashRand");
    expect(src).not.toContain("./rng");
  });
});

// §6: syllableCount agrees with the naive nucleus count for 1000 real engine words, plus
// a round-trip check the spike doesn't ask for but that the count check alone can't catch
// (a boundary bug that drops or duplicates a segment while leaving the nucleus count
// untouched). Drives the real engine like univerbation.test.ts's integration test does,
// via dynamic import to avoid a top-level cycle.
describe("integration: syllabify against real engine output", () => {
  test("syllableCount matches the naive nucleus count, and onset+nucleus+coda round-trips the word, over 1000+ real words", async () => {
    const { freshState } = await import("./world");
    const { resolveGeneration } = await import("./generation");
    const { leavesOf } = await import("./tree");

    const words: string[][] = [];
    for (let seed = 1; words.length < 1000; seed++) {
      let st = freshState(seed);
      for (let t = 0; t < 40; t++) st = resolveGeneration(st);
      leavesOf(st.branches).forEach((b) => b.lex.forEach((e) => words.push(e.word)));
    }

    expect(words.length).toBeGreaterThanOrEqual(1000);

    for (const w of words) {
      const sylls = syllabify(w);
      expect(syllableCount(w)).toBe(sylls.length);
      expect(sylls.length).toBe(w.filter(isV).length || 1);

      const rebuilt = sylls.flatMap((s) => [...s.onset, ...(s.nucleus === null ? [] : [s.nucleus]), ...s.coda]);
      expect(rebuilt).toEqual(w);
    }
  });
});
