// 1ENG.25 claim check: "a rule that inserts/deletes a segment must not desync a cached
// syllabification". How often does a rule application actually change syllable COUNT
// or boundaries? That sets the cost of caching vs recomputing.
import { freshState } from "../../../src/lib/engine/world";
import { RULES, applyRuleToWord, BY_ID, formOf } from "../../../src/lib/engine/phonology";
const isV = (id: string) => BY_ID[id]?.type === "V";
const nuclei = (w: string[]) => w.filter(isV).length;

let applications = 0, changedLen = 0, changedNuclei = 0;
const byRule: Record<string, { fires: number; lenΔ: number; nucΔ: number }> = {};
for (let s = 1; s <= 40; s++) {
  const st = freshState(s);
  st.world.lex.forEach(e => {
    RULES.forEach(r => {
      const out = applyRuleToWord(e.word, r);
      if (!out.changed) return;
      applications++;
      byRule[r.id] = byRule[r.id] ?? { fires: 0, lenΔ: 0, nucΔ: 0 };
      byRule[r.id].fires++;
      if (out.ids.length !== e.word.length) { changedLen++; byRule[r.id].lenΔ++; }
      if (nuclei(out.ids) !== nuclei(e.word)) { changedNuclei++; byRule[r.id].nucΔ++; }
    });
  });
}
console.log(`rule applications that changed a word: ${applications}`);
console.log(`  changed word LENGTH (segment count):  ${changedLen} (${(100*changedLen/applications).toFixed(0)}%)`);
console.log(`  changed NUCLEUS count (syllable count): ${changedNuclei} (${(100*changedNuclei/applications).toFixed(0)}%)`);
console.log("\nper-rule (fires / length-changing / syllable-count-changing):");
Object.entries(byRule).sort((a,b)=>b[1].fires-a[1].fires).forEach(([id,v]) =>
  console.log(`  ${id.padEnd(14)} ${String(v.fires).padStart(5)}  len${String(v.lenΔ).padStart(5)}  syl${String(v.nucΔ).padStart(5)}${v.nucΔ?"  <-- resyllabifies":""}`));
