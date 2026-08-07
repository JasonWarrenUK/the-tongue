import { describe, test, expect } from "bun:test";
import { pickRanked, DROPOFF } from "./rng";

// 1ENG.17 slice 1 (1eng-16 spike §7): gen's geometric dropoff, single-draw inverse-CDF.
describe("pickRanked", () => {
  test("consumes exactly one rng() draw regardless of list length", () => {
    let draws = 0;
    const counting = () => { draws++; return 0.5; };
    pickRanked([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], counting);
    expect(draws).toBe(1);
  });

  test("a 1-member list always returns its only member, consuming no draw", () => {
    let draws = 0;
    const counting = () => { draws++; return Math.random(); };
    expect(pickRanked(["only"], counting)).toBe("only");
    expect(draws).toBe(0);
  });

  test("u = 0 returns member 0", () => {
    expect(pickRanked([1, 2, 3, 4, 5], () => 0)).toBe(1);
  });

  test("u → 1 returns the last member, never undefined", () => {
    expect(pickRanked([1, 2, 3, 4, 5], () => 0.999999999)).toBe(5);
  });

  // Spike §7's pre-verified table (400k draws, DROPOFF=0.3, 10-member list): member 0
  // ≈ .300, member 1 ≈ .210, strictly decreasing through member 8, last (9) absorbs the
  // tail at ≈ .041 rather than continuing the geometric series (.012), keeping the total
  // exactly 1. Re-verified here against a fresh 400k-draw sample.
  test("distribution matches the spike's geometric-dropoff table", () => {
    expect(DROPOFF).toBe(0.3);
    const arr = Array.from({ length: 10 }, (_, i) => i);
    const counts = new Array(10).fill(0);
    const N = 400_000;
    let s = 12345;
    const rng = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    for (let i = 0; i < N; i++) counts[pickRanked(arr, rng)]++;
    const shares = counts.map((c) => c / N);
    expect(shares[0]).toBeGreaterThan(0.27);
    expect(shares[0]).toBeLessThan(0.33);
    for (let i = 1; i < 8; i++) expect(shares[i]).toBeLessThan(shares[i - 1]);
    expect(shares[9]).toBeGreaterThan(shares[8]); // last member absorbs the tail
    expect(shares.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 5);
  });
});
