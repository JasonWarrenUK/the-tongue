import { describe, test, expect } from "bun:test";
import { CONCEPTS, salienceRetention } from "./lexicon";
import type { Terrain } from "./types";

const TERRAINS: Terrain[] = ["plain", "hill", "mountain", "water"];

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
