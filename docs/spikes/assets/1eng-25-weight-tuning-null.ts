// Test correctives against the real engine by mutating RULES in place.
// Target: mean syllables/word should STABILISE around 1.8-2.2 (genesis is 1.51,
// real languages sit ~2-3), not converge to 1.05. Also want intervocalic CC > 0.
import { freshState } from "../../../src/lib/engine/world";
import { resolveGeneration } from "../../../src/lib/engine/generation";
import { leavesOf } from "../../../src/lib/engine/tree";
import { RULES, BY_ID } from "../../../src/lib/engine/phonology";
const isV = (id: string) => BY_ID[id]?.type === "V";
const R = (id: string) => RULES.find(r => r.id === id)!;
const ORIG = Object.fromEntries(RULES.map(r => [r.id, r.w]));
const reset = () => RULES.forEach(r => { r.w = ORIG[r.id]; });

function measure(label: string) {
  let nuc = 0, n = 0, inter = 0, len = 0;
  for (let s = 1; s <= 30; s++) {
    let st = freshState(s);
    for (let t = 0; t < 80; t++) st = resolveGeneration(st);
    leavesOf(st.branches).forEach(L => L.lex.forEach(e => {
      n++; len += e.word.length; nuc += e.word.filter(isV).length;
      for (let i=1;i<e.word.length-2;i++) if(isV(e.word[i-1])&&!isV(e.word[i])&&!isV(e.word[i+1])&&isV(e.word[i+2])) inter++;
    }));
  }
  console.log(`  ${label.padEnd(46)} syll/word ${(nuc/n).toFixed(2)}  len ${(len/n).toFixed(2)}  intervocalic-CC ${inter}`);
}

console.log("target: syll/word ~1.8-2.2 (genesis 1.51), intervocalic-CC > 0\n");
reset(); measure("A. baseline (shipped weights)");

reset(); R("paragoge").w = 4; measure("B. paragoge 1.5 -> 4");
reset(); R("apoc").w = 1.5; measure("C. apoc 3 -> 1.5");
reset(); R("paragoge").w = 3; R("apoc").w = 1.5; measure("D. paragoge->3, apoc->1.5");
reset(); R("paragoge").w = 3; R("apoc").w = 1.5; R("finalC").w = 1; R("complengFinal").w = 1;
  measure("E. D + finalC/complengFinal -> 1");
reset(); R("epenth").w = 6; measure("F. epenth 2 -> 6 (won't help: 3% eligible)");
reset(); R("paragoge").w = 5; R("apoc").w = 1; R("finalC").w = 1; R("complengFinal").w = 1; R("aphaer").w = 0.5;
  measure("G. aggressive: all final-erosion down, paragoge up");
reset();
