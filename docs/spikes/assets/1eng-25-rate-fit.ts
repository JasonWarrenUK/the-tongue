// Fit the rate, and check STABILITY (is it an equilibrium or still climbing at t=80?).
import { freshState } from "/Users/jasonwarren/Code/creations/the-tongue/src/lib/engine/world";
import { resolveGeneration } from "/Users/jasonwarren/Code/creations/the-tongue/src/lib/engine/generation";
import { leavesOf } from "/Users/jasonwarren/Code/creations/the-tongue/src/lib/engine/tree";
import { BY_ID, MAX_LEN } from "/Users/jasonwarren/Code/creations/the-tongue/src/lib/engine/phonology";
import { hashRand } from "/Users/jasonwarren/Code/creations/the-tongue/src/lib/engine/rng";
const isV = (id: string) => BY_ID[id]?.type === "V";
function suffixSyllable(w: string[], donor: string[]): string[] | null {
  if (w.length >= MAX_LEN - 1) return null;
  const firstV = donor.findIndex(isV); if (firstV < 0) return null;
  return [...w, ...donor.slice(0, firstV + 1)];
}
function run(rate: number, turns: number) {
  let nuc = 0, n = 0, inter = 0, len = 0;
  for (let s = 1; s <= 25; s++) {
    let st = freshState(s);
    for (let t = 0; t < turns; t++) {
      st = resolveGeneration(st);
      if (rate > 0) {
        const b: any = {};
        Object.values(st.branches).forEach((br: any) => {
          b[br.id] = { ...br, lex: br.lex.map((e: any, i: number) => {
            if (hashRand(st.world.seed + 101, t * 313 + 11, br.id * 421 + i) >= rate) return e;
            const out = suffixSyllable(e.word, br.lex[(i + 7) % br.lex.length].word);
            return out ? { ...e, word: out } : e;
          })};
        });
        st = { ...st, branches: b };
      }
    }
    leavesOf(st.branches).forEach(L => L.lex.forEach(e => {
      n++; len += e.word.length; nuc += e.word.filter(isV).length;
      for (let i=1;i<e.word.length-2;i++) if(isV(e.word[i-1])&&!isV(e.word[i])&&!isV(e.word[i+1])&&isV(e.word[i+2])) inter++;
    }));
  }
  return { syll: nuc/n, len: len/n, inter };
}
console.log("rate fit at 80 turns (target syll/word 1.8-2.2):");
[0.005, 0.01, 0.02, 0.03, 0.05].forEach(r => {
  const m = run(r, 80);
  console.log(`  rate ${String(r).padEnd(6)} syll/word ${m.syll.toFixed(2)}  len ${m.len.toFixed(2)}  intervocalic-CC ${m.inter}`);
});
console.log("\nstability check at the fitted rate (is it an equilibrium?):");
[20, 40, 80, 150, 250].forEach(t => {
  const m = run(0.02, t);
  console.log(`  turn ${String(t).padStart(3)}: syll/word ${m.syll.toFixed(2)}  len ${m.len.toFixed(2)}  intervocalic-CC ${m.inter}`);
});
