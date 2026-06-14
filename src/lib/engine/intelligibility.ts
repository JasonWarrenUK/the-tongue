import type { Lexicon } from "./types";

function lev(a: string[], b: string[]): number {
  const m = a.length, n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    const c = a[i - 1] === b[j - 1] ? 0 : 1;
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
  }
  return d[m][n];
}
// proxy: normalised edit distance over the shared concept skeleton, not a real comprehension test
export function intelligibility(lexA: Lexicon, lexB: Lexicon): number {
  const mapB = Object.fromEntries(lexB.map((e) => [e.concept, e.word]));
  let s = 0, n = 0;
  lexA.forEach((e) => {
    const wb = mapB[e.concept]; if (!wb) return;
    const mx = Math.max(e.word.length, wb.length) || 1;
    s += 1 - lev(e.word, wb) / mx; n++;
  });
  return n ? s / n : 1;
}
