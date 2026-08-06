export function mulberry32(a: number): () => number {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const pick = <T>(arr: T[], rng: () => number): T => arr[Math.floor(rng() * arr.length)];

// 1ENG.17 (1eng-16 spike §7 slice 1) — gen's geometric dropoff: earlier members of `arr`
// are exponentially more likely than later ones. A SINGLE rng() draw regardless of list
// length, by inverting the geometric CDF, rather than a `while (rng() < DROPOFF)` loop —
// a loop would consume a variable number of draws per call, coupling inventory SIZE to
// every subsequent world-gen draw. The last member absorbs the remaining tail, which is
// what keeps the distribution total and makes the function total for u → 1.
export const DROPOFF = 0.3; // gen's "Medium"
export const pickRanked = <T>(arr: T[], rng: () => number): T => {
  if (arr.length <= 1) return arr[0];
  const u = rng();
  const i = Math.min(Math.floor(Math.log(1 - u) / Math.log(1 - DROPOFF)), arr.length - 1);
  return arr[i];
};

// deterministic hash → [0,1): autonomous drift / passive spread replay identically per seed+turn
export function hashRand(a: number, b: number, c: number): number {
  let h = 2166136261 >>> 0;
  [a, b, c].forEach((n) => { h ^= n >>> 0; h = Math.imul(h, 16777619); });
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
