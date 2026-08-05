// 1ENG.24 census: does the roadmap's stress task have anything to work with, and does
// a whole-word stress gate (1eng-25 §5.3's original design) actually condition
// anything? Five arms, 25 seeds, over living leaves' lexicons at each turn horizon.
//
// Arm 1 re-measures 1eng-25 §3's "95% monosyllabic, stress inert" finding post-1ENG.27
// (univerbation) and post-1ENG.28 (syllabify). Arms 2-3 test whether a per-word gate in
// applyRuleToLex (mirroring the salience/syntax gates) can express stress-conditioned
// erosion at all. Arms 4-5 decide whether weight-sensitive (Latin) placement is a live
// lever or ledgered flavour, under both the coda-only heavy test 1eng-25 §7 proposed and
// the honest one (coda OR long vowel OR diphthong) this spike uses instead.
import { freshState } from "../../../src/lib/engine/world";
import { resolveGeneration } from "../../../src/lib/engine/generation";
import { leavesOf } from "../../../src/lib/engine/tree";
import { RULES, BY_ID } from "../../../src/lib/engine/phonology";
import { syllabify, type Syllable } from "../../../src/lib/engine/syllable";

const SEEDS = 25;
const TURNS = [0, 10, 40, 80, 150];

type StressMode = "initial" | "final" | "penult" | "antepenult";
const MODES: StressMode[] = ["initial", "final", "penult", "antepenult"];

// Plain (non-weight-sensitive) placement — the four fixed modes the roadmap names.
function stressPosition(sylls: Syllable[], mode: StressMode): number {
  const n = sylls.length;
  if (n === 0) return -1;
  if (n === 1) return sylls[0].nucleus === null ? -1 : 0;
  switch (mode) {
    case "initial": return 0;
    case "final": return n - 1;
    case "penult": return n - 2;
    case "antepenult": return Math.max(0, n - 3);
  }
}

const isHeavyCodaOnly = (s: Syllable) => s.coda.length > 0;
const isHeavyHonest = (s: Syllable) => {
  if (s.coda.length > 0) return true;
  if (s.nucleus === null) return false;
  const nuc = BY_ID[s.nucleus];
  return !!nuc?.long || !!nuc?.diph;
};

// Weight-sensitive placement: penult if heavy, else antepenult (the Latin rule).
function weightSensitivePosition(sylls: Syllable[], heavy: (s: Syllable) => boolean): number {
  const n = sylls.length;
  if (n === 0) return -1;
  if (n === 1) return sylls[0].nucleus === null ? -1 : 0;
  const penult = n - 2;
  return heavy(sylls[penult]) ? penult : Math.max(0, n - 3);
}

function collectWords(seed: number, turns: number): string[][] {
  let st = freshState(seed);
  for (let t = 0; t < turns; t++) st = resolveGeneration(st);
  const words: string[][] = [];
  leavesOf(st.branches).forEach((b) => b.lex.forEach((e) => words.push(e.word)));
  return words;
}

console.log("=== Arm 1: syllable-count distribution (re-measures 1eng-25 §3 post-1ENG.27) ===");
for (const turns of TURNS) {
  let n = 0, totalSyll = 0;
  const hist: Record<number, number> = {};
  for (let s = 1; s <= SEEDS; s++) {
    for (const w of collectWords(s, turns)) {
      const c = syllabify(w).length;
      n++; totalSyll += c;
      hist[c] = (hist[c] ?? 0) + 1;
    }
  }
  const ge2 = Object.entries(hist).filter(([k]) => Number(k) >= 2).reduce((a, [, v]) => a + v, 0);
  const ge3 = Object.entries(hist).filter(([k]) => Number(k) >= 3).reduce((a, [, v]) => a + v, 0);
  const histStr = Object.entries(hist).sort((a, b) => Number(a[0]) - Number(b[0])).map(([k, v]) => `${k}:${v}`).join(" ");
  console.log(`  turn ${String(turns).padStart(3)}  n=${n}  mean syll/word ${(totalSyll / n).toFixed(2)}  ≥2syll ${(100 * ge2 / n).toFixed(1)}%  ≥3syll ${(100 * ge3 / n).toFixed(1)}%  | ${histStr}`);
}

console.log("\n=== Arm 2: per-rule stress-position audit (turn 80, mode=penult) ===");
console.log("For each rule, of the words it changes: does its target land in the stressed syllable?");
{
  const turns = 80;
  const byRule: Record<string, { changes: number; onMultisyll: number; hitsStressed: number }> = {};
  for (let s = 1; s <= SEEDS; s++) {
    let st = freshState(s);
    for (let t = 0; t < turns; t++) st = resolveGeneration(st);
    leavesOf(st.branches).forEach((b) => b.lex.forEach((e) => {
      const sylls = syllabify(e.word);
      const stressIdx = stressPosition(sylls, "penult");
      // map each segment index to its syllable index
      const segToSyll: number[] = [];
      sylls.forEach((syl, si) => {
        syl.onset.forEach(() => segToSyll.push(si));
        if (syl.nucleus !== null) segToSyll.push(si);
        syl.coda.forEach(() => segToSyll.push(si));
      });
      for (const r of RULES) {
        const idx = e.word.findIndex((id, i) => {
          const p = BY_ID[id]; if (!p) return false;
          const pre = i > 0 ? BY_ID[e.word[i - 1]] : null;
          const post = i < e.word.length - 1 ? BY_ID[e.word[i + 1]] : null;
          return r.match(p) && (r.pre ? r.pre(pre) : true) && (r.post ? r.post(post) : true);
        });
        if (idx === -1) continue;
        byRule[r.id] = byRule[r.id] ?? { changes: 0, onMultisyll: 0, hitsStressed: 0 };
        byRule[r.id].changes++;
        if (sylls.length < 2) continue;
        byRule[r.id].onMultisyll++;
        if (segToSyll[idx] === stressIdx) byRule[r.id].hitsStressed++;
      }
    }));
  }
  console.log("  rule            changes  onMultisyll  hitsStressed  hitsUnstressed  %stressed");
  Object.entries(byRule).sort((a, b) => b[1].changes - a[1].changes).forEach(([id, v]) => {
    const pct = v.onMultisyll ? (100 * v.hitsStressed / v.onMultisyll).toFixed(1) : "n/a";
    console.log(`  ${id.padEnd(15)} ${String(v.changes).padStart(7)}  ${String(v.onMultisyll).padStart(11)}  ${String(v.hitsStressed).padStart(12)}  ${String(v.onMultisyll - v.hitsStressed).padStart(14)}  ${pct}%`);
  });
}

console.log("\n=== Arm 3: final-syllable-stressed rate per stress mode (turn 80) — the degeneracy proof ===");
{
  const turns = 80;
  for (const mode of MODES) {
    let n = 0, finalStressed = 0;
    for (let s = 1; s <= SEEDS; s++) {
      for (const w of collectWords(s, turns)) {
        const sylls = syllabify(w);
        if (sylls.length < 2) continue;
        n++;
        if (stressPosition(sylls, mode) === sylls.length - 1) finalStressed++;
      }
    }
    console.log(`  mode=${mode.padEnd(11)} of ${n} multisyllables, final syllable stressed: ${(100 * finalStressed / n).toFixed(1)}%`);
  }
}

console.log("\n=== Arm 4: heavy-penult rate, coda-only vs honest test (turn 80) ===");
{
  const turns = 80;
  let poly = 0, heavyCoda = 0, heavyHonest = 0, fromCoda = 0, fromLong = 0, fromDiph = 0;
  for (let s = 1; s <= SEEDS; s++) {
    for (const w of collectWords(s, turns)) {
      const sylls = syllabify(w);
      if (sylls.length < 2) continue;
      poly++;
      const penult = sylls[sylls.length - 2];
      if (isHeavyCodaOnly(penult)) heavyCoda++;
      if (isHeavyHonest(penult)) heavyHonest++;
      if (penult.coda.length > 0) fromCoda++;
      const nuc = penult.nucleus !== null ? BY_ID[penult.nucleus] : undefined;
      if (nuc?.long) fromLong++;
      if (nuc?.diph) fromDiph++;
    }
  }
  console.log(`  polysyllables: ${poly}`);
  console.log(`  heavy penult, coda-only test:  ${heavyCoda} (${(100 * heavyCoda / poly).toFixed(2)}%)`);
  console.log(`  heavy penult, honest test:     ${heavyHonest} (${(100 * heavyHonest / poly).toFixed(2)}%)`);
  console.log(`    contribution — coda:  ${fromCoda} (${(100 * fromCoda / poly).toFixed(2)}%)`);
  console.log(`    contribution — long:  ${fromLong} (${(100 * fromLong / poly).toFixed(2)}%)`);
  console.log(`    contribution — diph:  ${fromDiph} (${(100 * fromDiph / poly).toFixed(2)}%)`);
  console.log(`  threshold for "live lever": ≥15% — honest test ${heavyHonest / poly >= 0.15 ? "PASSES" : "FAILS"}`);
}

console.log("\n=== Arm 5: weight-sensitive vs plain-penult divergence, ≥3-syllable words (turn 80) ===");
{
  const turns = 80;
  for (const [label, heavy] of [["coda-only", isHeavyCodaOnly], ["honest", isHeavyHonest]] as const) {
    let n = 0, diverge = 0;
    for (let s = 1; s <= SEEDS; s++) {
      for (const w of collectWords(s, turns)) {
        const sylls = syllabify(w);
        if (sylls.length < 3) continue;
        n++;
        const plain = stressPosition(sylls, "penult");
        const ws = weightSensitivePosition(sylls, heavy);
        if (plain !== ws) diverge++;
      }
    }
    console.log(`  ${label.padEnd(10)} test: of ${n} words with ≥3 syllables, weight-sensitive diverges from plain penult: ${(100 * diverge / n).toFixed(1)}%`);
  }
}
