import { describe, test, expect } from "bun:test";
import { readFileSync } from "fs";
import { syllabify, syllableCount, SONORITY } from "./syllable";
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
