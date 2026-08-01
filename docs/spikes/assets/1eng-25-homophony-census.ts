// Reframe: is monosyllabic convergence a BUG, or is it Sinitic? Real languages that
// eroded to monosyllables responded with compounding + tone. Our engine has 2LEX.2's
// collision repair, which IS compounding. Is it firing at the floor, and does the
// homophony load look like a language under real pressure?
import { freshState } from "../../../src/lib/engine/world";
import { resolveGeneration } from "../../../src/lib/engine/generation";
import { leavesOf } from "../../../src/lib/engine/tree";
import { collisionPairs, homophoneForms, formOf, BY_ID } from "../../../src/lib/engine/phonology";
import { severePairs } from "../../../src/lib/engine/collision";
const isV = (id: string) => BY_ID[id]?.type === "V";

console.log("homophony + repair activity as the corpus hits the floor:");
for (const turns of [0, 10, 40, 80, 150]) {
  let pairs = 0, homo = 0, severe = 0, n = 0, repairs = 0, syll = 0, words = 0;
  for (let s = 1; s <= 25; s++) {
    let st = freshState(s);
    let rep = 0;
    for (let t = 0; t < turns; t++) {
      st = resolveGeneration(st);
      rep += st.log.filter(l => l.includes("disambiguated")).length;
    }
    leavesOf(st.branches).forEach(L => {
      n++; pairs += collisionPairs(L.lex); homo += homophoneForms(L.lex).size;
      severe += severePairs(L.lex).length;
      L.lex.forEach(e => { words++; syll += e.word.filter(isV).length; });
    });
    repairs += rep;
  }
  console.log(`  turn ${String(turns).padStart(3)}: syll/word ${(syll/words).toFixed(2)}  collisionPairs/branch ${(pairs/n).toFixed(1)}  homophone-forms ${(homo/n).toFixed(1)}  severe-pairs ${(severe/n).toFixed(1)}  cumulative repairs ${repairs}`);
}
// what does the repair actually produce? does it lengthen?
console.log("\ndoes collision repair lengthen words? (compound = 2 clipped stems)");
let st = freshState(3);
const before = new Map(st.world.lex.map(e => [e.concept, e.word.length]));
for (let t = 0; t < 80; t++) st = resolveGeneration(st);
leavesOf(st.branches).slice(0,1).forEach(L => {
  const longer = L.lex.filter(e => e.word.length > (before.get(e.concept) ?? 0));
  console.log(`  branch ${L.name}: ${longer.length}/48 concepts are LONGER than genesis`);
  longer.slice(0,6).forEach(e => console.log(`    ${e.concept}: ${before.get(e.concept)} -> ${e.word.length} segs (${formOf(e.word)})`));
});
