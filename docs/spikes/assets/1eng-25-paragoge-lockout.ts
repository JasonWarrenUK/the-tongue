// Weight tuning caps out at 1.35 syll/word. Find the STRUCTURAL constraint.
// Hypothesis: rules apply LEXICON-WIDE and to EVERY match in a word. paragoge appends
// ONE vowel to every C-final word; apoc deletes the final vowel of every V-final word.
// But `break` (99% eligible) converts final V -> diphthong, which BLOCKS paragoge
// (needs C-final) and feeds `smooth`. Check the actual final-segment ecology.
import { freshState } from "/Users/jasonwarren/Code/creations/the-tongue/src/lib/engine/world";
import { resolveGeneration } from "/Users/jasonwarren/Code/creations/the-tongue/src/lib/engine/generation";
import { leavesOf } from "/Users/jasonwarren/Code/creations/the-tongue/src/lib/engine/tree";
import { BY_ID, RULES, applyRuleToWord } from "/Users/jasonwarren/Code/creations/the-tongue/src/lib/engine/phonology";
const isV = (id: string) => BY_ID[id]?.type === "V";

// what does paragoge actually DO to a CV word? and what does the cycle look like?
console.log("trace: one CV word through repeated single-rule applications");
const trace = (start: string[], ruleIds: string[]) => {
  let w = start;
  const steps: string[] = [w.join("")];
  ruleIds.forEach(id => { const r = RULES.find(x => x.id === id)!; w = applyRuleToWord(w, r).ids; steps.push(`${id}->${w.join("")}`); });
  return steps.join("  ");
};
console.log("  " + trace(["t","a"], ["paragoge","paragoge","apoc"]));
console.log("  " + trace(["t","a","k"], ["paragoge","apoc","apoc"]));
console.log("  " + trace(["t","a"], ["break","smooth","break"]));

// KEY: does paragoge fire on a V-final word? (it needs match=isC, post=bound)
console.log("\nparagoge on 'ta' (V-final):", applyRuleToWord(["t","a"], RULES.find(r=>r.id==="paragoge")!).ids.join(""));
console.log("paragoge on 'tak' (C-final):", applyRuleToWord(["t","a","k"], RULES.find(r=>r.id==="paragoge")!).ids.join(""));

// final-segment ecology over time: what share of words are V-final vs C-final?
console.log("\nfinal-segment ecology (share of words ending in V):");
for (const turns of [0, 10, 40, 80]) {
  let vFinal = 0, n = 0;
  for (let s = 1; s <= 30; s++) {
    let st = freshState(s);
    for (let t = 0; t < turns; t++) st = resolveGeneration(st);
    leavesOf(st.branches).forEach(L => L.lex.forEach(e => { n++; if (isV(e.word[e.word.length-1])) vFinal++; }));
  }
  console.log(`  turn ${String(turns).padStart(3)}: ${(100*vFinal/n).toFixed(0)}% V-final  (paragoge can only fire on the other ${(100-100*vFinal/n).toFixed(0)}%)`);
}
