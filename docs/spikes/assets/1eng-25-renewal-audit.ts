// WHY does renewal lose? Audit the actual per-turn flow of segments.
// Track, over a real run: how often each rule fires, and its net segment delta.
import { freshState } from "/Users/jasonwarren/Code/creations/the-tongue/src/lib/engine/world";
import { resolveGeneration } from "/Users/jasonwarren/Code/creations/the-tongue/src/lib/engine/generation";
import { leavesOf } from "/Users/jasonwarren/Code/creations/the-tongue/src/lib/engine/tree";
import { RULES, applyRuleToLex, BY_ID } from "/Users/jasonwarren/Code/creations/the-tongue/src/lib/engine/phonology";
const isV = (id: string) => BY_ID[id]?.type === "V";
const segs = (lex: any) => lex.reduce((a: number, e: any) => a + e.word.length, 0);
const nuc  = (lex: any) => lex.reduce((a: number, e: any) => a + e.word.filter(isV).length, 0);

// Which rules can FIRE as words shrink? Measure firing eligibility by turn.
console.log("rule eligibility (share of branch-turns where the rule CAN fire at all):");
const eligible: Record<string, number> = {}; let bt = 0;
for (let s = 1; s <= 20; s++) {
  let st = freshState(s);
  for (let t = 0; t < 60; t++) {
    st = resolveGeneration(st);
    leavesOf(st.branches).forEach(L => {
      bt++;
      RULES.forEach(r => { if (applyRuleToLex(L.lex, r).fires > 0) eligible[r.id] = (eligible[r.id] ?? 0) + 1; });
    });
  }
}
RULES.map(r => ({ id: r.id, w: r.w, cat: r.category, pct: 100*(eligible[r.id] ?? 0)/bt }))
  .sort((a,b) => b.pct - a.pct)
  .forEach(r => {
    const grows = ["epenth","paragoge","break"].includes(r.id);
    console.log(`  ${r.id.padEnd(14)} w=${String(r.w).padEnd(4)} ${r.cat.padEnd(13)} eligible ${r.pct.toFixed(0).padStart(3)}% ${grows?"  <-- RENEWAL":""}`);
  });

// net segment flow, weighted by eligibility x weight
console.log("\nweighted drift pressure (eligibility% x rule weight), renewal vs erosion:");
let ren = 0, ero = 0;
RULES.forEach(r => {
  const pressure = ((eligible[r.id] ?? 0)/bt) * r.w;
  if (["epenth","paragoge","break"].includes(r.id)) ren += pressure; else ero += pressure;
});
console.log(`  renewal pressure: ${ren.toFixed(2)}`);
console.log(`  erosion pressure: ${ero.toFixed(2)}`);
console.log(`  ratio erosion:renewal = ${(ero/ren).toFixed(2)}:1`);
