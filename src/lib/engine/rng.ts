export function mulberry32(a: number): () => number {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const pick = <T>(arr: T[], rng: () => number): T => arr[Math.floor(rng() * arr.length)];

// deterministic hash → [0,1): autonomous drift / passive spread replay identically per seed+turn
export function hashRand(a: number, b: number, c: number): number {
  let h = 2166136261 >>> 0;
  [a, b, c].forEach((n) => { h ^= n >>> 0; h = Math.imul(h, 16777619); });
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
