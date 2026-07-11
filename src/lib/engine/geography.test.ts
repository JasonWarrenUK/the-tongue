import { describe, test, expect } from "bun:test";
import { isolationScore, dominantTerrain } from "./geography";
import * as fixtures from "../../../tests/fixtures/geography";

describe("isolationScore", () => {
  test("all-passable border → fully open (0)", () => {
    const { edges, owner } = fixtures.openBorder;
    expect(isolationScore(0, [0], edges, owner)).toBeCloseTo(0, 5);
  });

  test("all-impassable border, no internal edges → 0.75 (border-only isolation signal)", () => {
    const { edges, owner } = fixtures.walledBorder;
    expect(isolationScore(0, [0], edges, owner)).toBeCloseTo(0.75, 5);
  });

  test("all-impassable border AND internal terrain → fully isolated (~1)", () => {
    const { edges, owner } = fixtures.fullyWalled;
    expect(isolationScore(0, [0, 3], edges, owner)).toBeCloseTo(1, 5);
  });

  test("no border edges, no internal edges → 0.375 (neutral border signal, open internal default)", () => {
    const { edges, owner } = fixtures.noBorder;
    expect(isolationScore(0, [0], edges, owner)).toBeCloseTo(0.375, 5);
  });

  test("no owned territory → neutral (0.5)", () => {
    const { edges, owner } = fixtures.openBorder;
    expect(isolationScore(0, [], edges, owner)).toBe(0.5);
  });

  test("mixed border + impassable internal terrain nudges isolation upward", () => {
    const { edges, owner } = fixtures.mixed;
    // border: 1 passable + 1 impassable → isolation 0.5; internal: 1 impassable/1 → 1
    // score = 0.75*0.5 + 0.25*1 = 0.625, higher than the border-only 0.5
    expect(isolationScore(0, [0, 3], edges, owner)).toBeCloseTo(0.625, 5);
  });
});

describe("dominantTerrain", () => {
  test("plurality terrain wins", () => {
    const { edges, owner } = fixtures.terrainPlurality;
    expect(dominantTerrain(0, [0], edges, owner)).toBe("plain");
  });

  test("ties favour the more impassable terrain", () => {
    const { edges, owner } = fixtures.terrainTie;
    // one "hill" edge, one "mountain" edge — tied 1-1, mountain outranks hill
    expect(dominantTerrain(0, [0], edges, owner)).toBe("mountain");
  });

  test("no owned territory falls back to plain", () => {
    const { edges, owner } = fixtures.terrainTie;
    expect(dominantTerrain(0, [], edges, owner)).toBe("plain");
  });
});
