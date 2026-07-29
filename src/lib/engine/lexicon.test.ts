import { describe, test, expect } from "bun:test";
import { CONCEPTS, CONCEPT_CLASS, salienceRetention, borrowableConcepts } from "./lexicon";
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
