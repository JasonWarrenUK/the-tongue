import { describe, test, expect } from "bun:test";
import { CONCEPTS, CONCEPT_CLASS, salienceRetention, borrowableConcepts, genInventory, genLexicon, genTemplate } from "./lexicon";
import { mulberry32 } from "./rng";
import type { Terrain } from "./types";

const TERRAINS: Terrain[] = ["plain", "hill", "mountain", "water"];
const NOUNS_GOLDEN = ["water","fire","stone","tree","leaf","root","seed","fish","bird","dog","wolf","hand","eye","ear","tooth","bone","blood","skin","meat","sun","moon","star","sky","rain","wind","hill","river","path","house","night","day","snow"];

// 1ENG.19: CONCEPTS grew from the 32 original nouns to the full 48-concept substrate
// (nouns + verbs + pronouns + adjectives). The regression pin the spike §7 testing
// block asks for: indices 0..31 unchanged, exactly 32 nouns, total class coverage.
describe("1ENG.19: CONCEPTS is the 48-concept substrate", () => {
  test("CONCEPTS has 48 entries", () => expect(CONCEPTS.length).toBe(48));
  test("indices 0..31 are unchanged from the pre-1ENG.19 noun list", () => {
    expect(CONCEPTS.slice(0, 32)).toEqual(NOUNS_GOLDEN);
  });
  test("CONCEPT_CLASS covers every CONCEPTS entry", () => {
    CONCEPTS.forEach((c) => expect(CONCEPT_CLASS[c]).toBeDefined());
  });
  test("exactly 32 nouns, 9 verbs, 3 pronouns, 4 adjectives", () => {
    const counts: Record<string, number> = { noun: 0, verb: 0, pronoun: 0, adjective: 0 };
    CONCEPTS.forEach((c) => { counts[CONCEPT_CLASS[c]]++; });
    expect(counts).toEqual({ noun: 32, verb: 9, pronoun: 3, adjective: 4 });
  });
});

describe("salienceRetention", () => {
  test("core-salient concept returns 0.5", () => {
    expect(salienceRetention("stone", "mountain")).toBe(0.5);
    expect(salienceRetention("fish", "water")).toBe(0.5);
  });

  test("secondary-salient concept returns 0.25", () => {
    expect(salienceRetention("snow", "mountain")).toBe(0.25);
    expect(salienceRetention("path", "plain")).toBe(0.25);
  });

  test("environment-neutral basics stay flat (0) on every terrain", () => {
    const basics = ["sun", "moon", "fire", "dog", "day", "night", "house", "eye", "ear", "hand", "tooth", "blood", "skin", "meat"];
    for (const concept of basics) {
      for (const terrain of TERRAINS) {
        expect(salienceRetention(concept, terrain)).toBe(0);
      }
    }
  });

  test("a concept salient on one terrain is not salient on an unrelated one", () => {
    expect(salienceRetention("snow", "plain")).toBe(0);
    expect(salienceRetention("fish", "mountain")).toBe(0);
  });

  test("hill mirrors mountain", () => {
    for (const concept of CONCEPTS) {
      expect(salienceRetention(concept, "hill")).toBe(salienceRetention(concept, "mountain"));
    }
  });

  test("every concept/terrain pair stays in {0, 0.25, 0.5}, always < 1", () => {
    for (const concept of CONCEPTS) {
      for (const terrain of TERRAINS) {
        const r = salienceRetention(concept, terrain);
        expect([0, 0.25, 0.5]).toContain(r);
        expect(r).toBeLessThan(1);
      }
    }
  });
});

describe("borrowableConcepts", () => {
  test("water terrain includes fish, river, water", () => {
    const b = borrowableConcepts("water");
    expect(b).toContain("fish");
    expect(b).toContain("river");
    expect(b).toContain("water");
  });

  test("environment-neutral basics are excluded under every terrain", () => {
    const basics = ["eye", "tooth", "sun", "ear", "hand"];
    for (const terrain of TERRAINS) {
      const b = borrowableConcepts(terrain);
      for (const concept of basics) expect(b).not.toContain(concept);
    }
  });

  test("every returned concept has non-zero salience retention on that terrain", () => {
    for (const terrain of TERRAINS) {
      for (const concept of borrowableConcepts(terrain)) {
        expect(salienceRetention(concept, terrain)).toBeGreaterThan(0);
      }
    }
  });

  test("hill mirrors mountain (same salience source)", () => {
    expect(borrowableConcepts("hill").sort()).toEqual(borrowableConcepts("mountain").sort());
  });

  // 1ENG.19 (spike §3.1): the new verb/pronoun/adjective concepts carry zero terrain
  // salience, so borrowability falls out unchanged — verbs and pronouns are never
  // borrowable, matching Tadmor's basic-vocabulary borrowability hierarchy.
  test("every borrowable concept, on every terrain, is a noun", () => {
    for (const terrain of TERRAINS) {
      for (const concept of borrowableConcepts(terrain)) {
        expect(CONCEPT_CLASS[concept]).toBe("noun");
      }
    }
  });
});

// 1ENG.17 slice 1 (decision 1, plan §"Decisions taken"): genInventory's consonant list
// used to be built by PUSH order, so index 7+ was whichever optional gate happened to
// pass first for a given seed — not a frequency rank. Stabilised to a fixed typological
// rank (CONSONANT_RANK) filtered by the same gates, so pickRanked's dropoff means what
// it claims: earlier index = more typologically core.
describe("1ENG.17: genInventory consonant order is seed-stable", () => {
  const CANONICAL = ["p", "t", "k", "m", "n", "s", "l", "b", "d", "g", "r", "h", "f", "ʃ", "j", "w", "ŋ", "z"];

  test("consonants are always a subsequence of the canonical typological rank, for many seeds", () => {
    for (let seed = 1; seed <= 60; seed++) {
      const cons = genInventory(mulberry32(seed)).consonants;
      let cursor = -1;
      for (const c of cons) {
        const idx = CANONICAL.indexOf(c);
        expect(idx).toBeGreaterThan(cursor); // strictly increasing rank position
        cursor = idx;
      }
    }
  });

  test("the seven core consonants are always present and lead the array", () => {
    const core = ["p", "t", "k", "m", "n", "s", "l"];
    for (let seed = 1; seed <= 20; seed++) {
      const cons = genInventory(mulberry32(seed)).consonants;
      expect(cons.slice(0, 7)).toEqual(core);
    }
  });
});

// 1ENG.17 slice 1: naturalism assertion (spike §7) — for a seed whose inventory holds
// both /t/ (typologically core, high index-rank priority) and /ŋ/ (marked, low
// priority), pickRanked's dropoff should make /t/ strictly more common across the
// 48-word lexicon.
describe("1ENG.17: frequency-ranked selection produces naturalistic skew", () => {
  test("/t/ appears strictly more often than /ŋ/ across the lexicon (seed 4)", () => {
    const rng = mulberry32(4);
    const inv = genInventory(rng);
    expect(inv.consonants).toContain("t");
    expect(inv.consonants).toContain("ŋ");
    const t = genTemplate(rng);
    const lex = genLexicon(rng, inv, t);
    const tCount = lex.filter((e) => e.word.includes("t")).length;
    const ngCount = lex.filter((e) => e.word.includes("ŋ")).length;
    expect(tCount).toBeGreaterThan(ngCount);
  });
});
