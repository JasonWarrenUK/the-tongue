import { describe, test, expect } from "bun:test";
import { formSimilarity, intelligibility } from "./intelligibility";
import type { Lexicon } from "./types";

describe("formSimilarity", () => {
  test("identical forms → 1", () => {
    expect(formSimilarity(["t", "a", "p"], ["t", "a", "p"])).toBe(1);
  });

  test("wholly disjoint same-length forms → 0", () => {
    expect(formSimilarity(["t", "a", "p"], ["k", "o", "s"])).toBe(0);
  });

  test("partial overlap gives a value strictly between 0 and 1", () => {
    const sim = formSimilarity(["t", "a", "p"], ["t", "a", "s"]);
    expect(sim).toBeGreaterThan(0);
    expect(sim).toBeLessThan(1);
  });

  test("both-empty forms → 1 (the || 1 fallback avoids a div-by-zero)", () => {
    expect(formSimilarity([], [])).toBe(1);
  });
});

describe("intelligibility (refactor parity guard)", () => {
  test("byte-identical output for a fixed lexicon pair, including an all-empty-forms concept", () => {
    const lexA: Lexicon = [
      { concept: "water", word: ["w", "a", "t", "e", "r"] },
      { concept: "fire", word: ["f", "i", "r"] },
      { concept: "empty", word: [] },
    ];
    const lexB: Lexicon = [
      { concept: "water", word: ["w", "a", "t", "e", "r"] },
      { concept: "fire", word: ["h", "i", "r"] },
      { concept: "empty", word: [] },
    ];
    // pinned regression value: (1 + 2/3 + 1) / 3
    expect(intelligibility(lexA, lexB)).toBeCloseTo((1 + 2 / 3 + 1) / 3, 5);
  });

  test("intelligibility is the mean of formSimilarity over shared concepts", () => {
    const lexA: Lexicon = [
      { concept: "a", word: ["t", "a"] },
      { concept: "b", word: ["k", "o"] },
    ];
    const lexB: Lexicon = [
      { concept: "a", word: ["t", "a"] },
      { concept: "b", word: ["k", "u"] },
    ];
    const expected = (formSimilarity(["t", "a"], ["t", "a"]) + formSimilarity(["k", "o"], ["k", "u"])) / 2;
    expect(intelligibility(lexA, lexB)).toBeCloseTo(expected, 5);
  });

  test("no shared concepts → 1 (vacuous full intelligibility)", () => {
    const lexA: Lexicon = [{ concept: "a", word: ["t", "a"] }];
    const lexB: Lexicon = [{ concept: "b", word: ["k", "o"] }];
    expect(intelligibility(lexA, lexB)).toBe(1);
  });
});
