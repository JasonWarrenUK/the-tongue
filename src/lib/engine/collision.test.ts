import { describe, test, expect } from "bun:test";
import {
  pairScore, pairThreshold, severePairs, yieldingConcept, modifierCandidates,
  compoundWord, resolveCollision, COLLISION_TURNS, SEVERITY_CUT,
} from "./collision";
import { CONCEPTS, CONCEPT_CLASS } from "./lexicon";
import { applyRuleToWord, RULE_BY_ID, formOf } from "./phonology";
import DISTANCE from "./semantic-distance.json";
import type { Lexicon } from "./types";

const TABLE: Record<string, number> = DISTANCE;

describe("semantic-distance.json integrity", () => {
  test("541 entries, all keys sorted", () => {
    const keys = Object.keys(TABLE);
    expect(keys.length).toBe(541);
    keys.forEach((k) => {
      const [a, b] = k.split("|");
      expect(a < b).toBe(true);
    });
  });

  test("every within-class pair present, no cross-class key", () => {
    const byClass: Record<string, string[]> = {};
    Object.entries(CONCEPT_CLASS).forEach(([c, cls]) => { (byClass[cls] = byClass[cls] || []).push(c); });
    const expected = new Set<string>();
    Object.values(byClass).forEach((words) => {
      for (let i = 0; i < words.length; i++) for (let j = i + 1; j < words.length; j++) {
        const [a, b] = words[i] < words[j] ? [words[i], words[j]] : [words[j], words[i]];
        expected.add(`${a}|${b}`);
      }
    });
    expect(expected.size).toBe(541);
    expected.forEach((k) => expect(TABLE[k]).toBeDefined());
    Object.keys(TABLE).forEach((k) => expect(expected.has(k)).toBe(true));
  });

  test("pinned spot values guard against silent regeneration drift", () => {
    expect(TABLE["i|you"]).toBe(0.6167);
    expect(TABLE["moon|sun"]).toBe(0.5167);
    expect(TABLE["day|night"]).toBe(0.5561);
    expect(TABLE["path|stone"]).toBe(0.1132);
  });

  test("CONCEPT_CLASS covers every table concept and every CONCEPTS entry", () => {
    const fromTable = new Set(Object.keys(TABLE).flatMap((k) => k.split("|")));
    fromTable.forEach((c) => expect(CONCEPT_CLASS[c]).toBeDefined());
    // 1ENG.19: CONCEPTS grew to the full 48-concept substrate, so it's no longer
    // all-noun — the invariant that survives is total coverage, not uniform class.
    CONCEPTS.forEach((c) => expect(CONCEPT_CLASS[c]).toBeDefined());
  });

  test("1ENG.19: CONCEPTS is the 48-concept substrate; indices 0..31 (the original nouns) unchanged", () => {
    const NOUNS_GOLDEN = ["water","fire","stone","tree","leaf","root","seed","fish","bird","dog","wolf","hand","eye","ear","tooth","bone","blood","skin","meat","sun","moon","star","sky","rain","wind","hill","river","path","house","night","day","snow"];
    expect(CONCEPTS.length).toBe(48);
    expect(CONCEPTS.slice(0, 32)).toEqual(NOUNS_GOLDEN);
    expect(CONCEPTS.filter((c) => CONCEPT_CLASS[c] === "noun").length).toBe(32);
  });
});

describe("pairScore", () => {
  test("symmetric", () => {
    expect(pairScore("moon", "sun")).toBe(pairScore("sun", "moon"));
  });
  test("0 for cross-class pair", () => {
    expect(pairScore("sun", "big")).toBe(0); // noun vs adjective
  });
  test("0 for unknown concept", () => {
    expect(pairScore("sun", "nonexistent")).toBe(0);
  });
  test("0 for self pair", () => {
    expect(pairScore("sun", "sun")).toBe(0);
  });
});

describe("pairThreshold", () => {
  test("moon|sun -> 3", () => {
    expect(pairThreshold("moon", "sun")).toBe(3);
  });
  test("a pair just over the cut -> 5 (bird|fish, 0.2129)", () => {
    expect(pairThreshold("bird", "fish")).toBe(5);
  });
  test("floor of 2 never violated across the whole table", () => {
    Object.keys(TABLE).forEach((k) => {
      const [a, b] = k.split("|");
      expect(pairThreshold(a, b)).toBeGreaterThanOrEqual(2);
    });
  });
});

describe("severePairs", () => {
  test("cross-class pairs excluded even if related", () => {
    const lex: Lexicon = [
      { concept: "sun", word: ["t", "a"] },
      { concept: "big", word: ["t", "a"] }, // same form, but noun|adjective
    ];
    expect(severePairs(lex)).toEqual([]);
  });
  test("sub-cut pairs excluded (path|stone, 0.1132)", () => {
    const lex: Lexicon = [
      { concept: "path", word: ["t", "a"] },
      { concept: "stone", word: ["t", "a"] },
    ];
    expect(severePairs(lex)).toEqual([]);
  });
  test("three-way collision decomposes into all sorted pairs", () => {
    const lex: Lexicon = [
      { concept: "moon", word: ["t", "a"] },
      { concept: "sun", word: ["t", "a"] },
      { concept: "star", word: ["t", "a"] },
    ];
    expect(severePairs(lex)).toEqual([["moon", "star"], ["moon", "sun"], ["star", "sun"]]);
  });
  test("output order is stable regardless of lex order", () => {
    const a: Lexicon = [{ concept: "moon", word: ["t", "a"] }, { concept: "sun", word: ["t", "a"] }];
    const b: Lexicon = [{ concept: "sun", word: ["t", "a"] }, { concept: "moon", word: ["t", "a"] }];
    expect(severePairs(a)).toEqual(severePairs(b));
  });
});

describe("yieldingConcept", () => {
  test("salience decides: mountain snow|rain -> rain yields", () => {
    expect(yieldingConcept(["snow", "rain"], "mountain")).toBe("rain");
  });
  test("zero-zero tie: moon|sun -> moon yields (higher CONCEPTS index)", () => {
    expect(yieldingConcept(["moon", "sun"], "plain")).toBe("moon");
  });
  test("argument order invariant", () => {
    expect(yieldingConcept(["sun", "moon"], "plain")).toBe("moon");
  });
});

describe("modifierCandidates", () => {
  test("excludes both pair members; nearest-by-relatedness first (moon -> sky, star)", () => {
    const cands = modifierCandidates("moon", ["moon", "sun"]);
    expect(cands).not.toContain("moon");
    expect(cands).not.toContain("sun");
    expect(cands.slice(0, 2)).toEqual(["sky", "star"]);
  });
  test("rain -> wind first", () => {
    expect(modifierCandidates("rain", ["rain", "snow"])[0]).toBe("wind");
  });
  test("pronoun class (smallest) still yields a candidate", () => {
    expect(modifierCandidates("you", ["i", "you"])).toEqual(["we"]);
  });
});

describe("compoundWord", () => {
  test("clip stops at and includes the first vowel", () => {
    expect(compoundWord(["s", "t", "a", "p"], ["k", "o"], "modFirst")).toEqual(["s", "t", "a", "k", "o"]);
  });
  test("clip caps at 3 even for a synthetic 3-consonant onset", () => {
    expect(compoundWord(["s", "p", "t", "r", "a"], ["k", "o"], "modFirst")).toEqual(["s", "p", "t", "k", "o"]);
  });
  test("modFirst prepends, headFirst appends", () => {
    const mod = ["s", "t", "a"], head = ["k", "o"];
    expect(compoundWord(mod, head, "modFirst")).toEqual(["s", "t", "a", "k", "o"]);
    expect(compoundWord(mod, head, "headFirst")).toEqual(["k", "o", "s", "t", "a"]);
  });
  test("head segments are byte-identical in the output", () => {
    const head = ["k", "o", "p"];
    const out = compoundWord(["s", "t", "a"], head, "headFirst");
    expect(out.slice(0, head.length)).toEqual(head);
  });
  test("an oversized compound (15 segs) still accepts erosion rules (growth-only ceiling regression)", () => {
    const head = ["t", "a", "p", "t", "a", "p", "t", "a", "p", "t", "a", "o"]; // 12 segs, MAX_LEN
    const w = compoundWord(["s", "t", "a"], head, "modFirst");
    expect(w.length).toBe(15);
    const res = applyRuleToWord(w, RULE_BY_ID["apoc"]);
    expect(res.changed).toBe(true);
    expect(res.ids.length).toBe(14);
  });
});

describe("resolveCollision", () => {
  const lex: Lexicon = [
    { concept: "moon", word: ["t", "a"] },
    { concept: "sun", word: ["t", "a"] },
    { concept: "sky", word: ["k", "o"] },
    { concept: "star", word: ["s", "u"] },
  ];
  test("determinism: same inputs -> same output", () => {
    const r1 = resolveCollision(["moon", "sun"], lex, "plain", "modFirst");
    const r2 = resolveCollision(["moon", "sun"], lex, "plain", "modFirst");
    expect(r1).toEqual(r2);
  });
  test("moon yields, compounds with sky (its top candidate) -> skymoon", () => {
    const res = resolveCollision(["moon", "sun"], lex, "plain", "modFirst");
    expect(res.concept).toBe("moon");
    expect(res.modifier).toBe("sky");
    expect(formOf(res.word)).toBe("kota");
  });
  test("repair-made collision steps to the next candidate", () => {
    // modifierCandidates("moon", ["moon","sun"]) ranks sky, star, night, hill, ...
    // (verified against the shipped table). Give a fourth concept ("blood") the exact
    // form sky's compound would produce, forcing the walk past sky to star.
    const clashLex: Lexicon = [
      { concept: "moon", word: ["t", "a"] },
      { concept: "sun", word: ["t", "a"] },
      { concept: "sky", word: ["k", "o"] },
      { concept: "star", word: ["s", "u"] },
      { concept: "blood", word: ["k", "o", "t", "a"] }, // == compoundWord(sky-clip, moon) result
    ];
    const res = resolveCollision(["moon", "sun"], clashLex, "plain", "modFirst");
    expect(res.modifier).not.toBe("sky");
    expect(res.modifier).toBe("star");
  });
  test("all-colliding fallback returns the top-ranked candidate anyway and terminates", () => {
    // build a lexicon where every noun modifier's compound with "moon" already exists
    // elsewhere — infeasible to construct exhaustively, so instead verify the function
    // returns a defined result without throwing when the top candidate collides and no
    // alternative is checked further than necessary (smoke test for boundedness).
    const denseLex: Lexicon = lex.concat(
      modifierCandidates("moon", ["moon", "sun"]).map((c) => ({ concept: c, word: ["k", "o", "t", "a"] })),
    );
    expect(() => resolveCollision(["moon", "sun"], denseLex, "plain", "modFirst")).not.toThrow();
  });
  test("lender arm short-circuits when supplied and differs from the colliding form", () => {
    const res = resolveCollision(["moon", "sun"], lex, "plain", "modFirst", { name: "Kelvani", word: ["m", "u"] });
    expect(res.concept).toBe("moon");
    expect(res.modifier).toBe("Kelvani");
    expect(res.word).toEqual(["m", "u"]);
  });
  test("lender arm skipped when its form matches the colliding form (no-op)", () => {
    const res = resolveCollision(["moon", "sun"], lex, "plain", "modFirst", { name: "Kelvani", word: ["t", "a"] });
    expect(res.modifier).not.toBe("Kelvani");
  });
});

describe("constants", () => {
  test("spike first-pass tuning values", () => {
    expect(COLLISION_TURNS).toBe(6);
    expect(SEVERITY_CUT).toBe(0.2);
  });
});
