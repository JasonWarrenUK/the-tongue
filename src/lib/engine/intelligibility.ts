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
// normalised edit-distance similarity of two forms ∈ [0,1]; 1 = identical. Factored
// out of intelligibility (2GEO.4 spike §5) so the borrowing mechanic (2GEO.5) can rank
// per-concept divergence without duplicating this metric.
export function formSimilarity(a: string[], b: string[]): number {
  const mx = Math.max(a.length, b.length) || 1;
  return 1 - lev(a, b) / mx;
}
// proxy: normalised edit distance over the shared concept skeleton, not a real comprehension test
export function intelligibility(lexA: Lexicon, lexB: Lexicon): number {
  const mapB = Object.fromEntries(lexB.map((e) => [e.concept, e.word]));
  let s = 0, n = 0;
  lexA.forEach((e) => {
    const wb = mapB[e.concept]; if (!wb) return;
    s += formSimilarity(e.word, wb); n++;
  });
  return n ? s / n : 1;
}
