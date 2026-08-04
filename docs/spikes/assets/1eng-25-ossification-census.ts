// Cluster extinction is overdetermined. Find the BINDING constraint by measuring
// word LENGTH over time — hypothesis: words erode to CV/CVCV, and a word that short
// simply has no room for an intervocalic cluster regardless of which rules fire.
import { freshState } from "../../../src/lib/engine/world";
import { resolveGeneration } from "../../../src/lib/engine/generation";
import { leavesOf } from "../../../src/lib/engine/tree";
import { BY_ID, formOf } from "../../../src/lib/engine/phonology";
const isV = (id: string) => BY_ID[id]?.type === "V";

console.log("word length + syllable count over time (30 seeds):");
for (const turns of [0, 5, 10, 20, 40, 60, 100]) {
  let len = 0, n = 0, nuc = 0, maxLen = 0;
  const shapes: Record<string, number> = {};
  for (let s = 1; s <= 30; s++) {
    let st = freshState(s);
    for (let t = 0; t < turns; t++) st = resolveGeneration(st);
    leavesOf(st.branches).forEach(L => L.lex.forEach(e => {
      len += e.word.length; n++; nuc += e.word.filter(isV).length;
      maxLen = Math.max(maxLen, e.word.length);
      const shape = e.word.map(p => isV(p) ? "V" : "C").join("");
      shapes[shape] = (shapes[shape] ?? 0) + 1;
    }));
  }
  const top = Object.entries(shapes).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([k,v])=>`${k}:${v}`).join(" ");
  console.log(`  turn ${String(turns).padStart(3)}  mean len ${(len/n).toFixed(2)}  mean syllables ${(nuc/n).toFixed(2)}  max len ${maxLen}  | top shapes: ${top}`);
}
console.log("\nAn intervocalic CC needs shape V C C V => min length 4 with 2 nuclei.");
