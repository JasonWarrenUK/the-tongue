// Corrected: univerbation applies PER CONCEPT (each word can independently acquire a
// fused partner), not one-per-branch-turn. This matches how real collocations fuse:
// many independently, each permanent. Fusion targets the words most under pressure
// (shortest / most homophonous), which is also the attested trigger.
import { freshState } from "../../../src/lib/engine/world";
import { resolveGeneration } from "../../../src/lib/engine/generation";
import { leavesOf } from "../../../src/lib/engine/tree";
import { BY_ID, MAX_LEN, collisionPairs, homophoneForms, formOf } from "../../../src/lib/engine/phonology";
import { FRAMES, frameOrder } from "../../../src/lib/engine/syntax";
import { CONCEPT_CLASS, conceptsOfClass, type ConceptClass } from "../../../src/lib/engine/lexicon";
import { hashRand } from "../../../src/lib/engine/rng";
import type { WordOrder, FrameWeights } from "../../../src/lib/engine/types";
const isV = (id: string) => BY_ID[id]?.type === "V";

// which classes may PRECEDE cls in this branch's grammar (the modifier position).
// Signature matches the §6 contract for src/lib/engine/univerbation.ts, so 1ENG.27
// inherits the real types rather than this prototype's shape.
function precedersOf(cls: ConceptClass, order: WordOrder, weights: FrameWeights): { c: ConceptClass; w: number }[] {
  const out: { c: ConceptClass; w: number }[] = [];
  FRAMES.forEach((f, i) => {
    const slots = frameOrder(f, order, false);
    for (let j = 0; j < slots.length - 1; j++)
      if (slots[j+1].class === cls) out.push({ c: slots[j].class, w: weights[i] });
  });
  return out;
}

function run(rate: number, turns: number, seeds = 25) {
  let syll = 0, words = 0, inter = 0, pairs = 0, homo = 0, n = 0, fusions = 0, maxLen = 0;
  for (let s = 1; s <= seeds; s++) {
    let st = freshState(s);
    for (let t = 0; t < turns; t++) {
      st = resolveGeneration(st);
      if (rate > 0) {
        const b: any = {};
        Object.values(st.branches).forEach((br: any) => {
          const homoForms = homophoneForms(br.lex);
          const lex = br.lex.map((e: any, i: number) => {
            // trigger: word is short AND (homophonous or just short) — pressure-driven
            const pressured = e.word.length <= 2 || homoForms.has(formOf(e.word));
            if (!pressured) return e;
            if (hashRand(st.world.seed + 43, t * 319 + 17, br.id * 433 + i) >= rate) return e;
            const pre = precedersOf(CONCEPT_CLASS[e.concept], br.wordOrder, br.frameWeights);
            if (!pre.length) return e;
            const totW = pre.reduce((x, c) => x + c.w, 0);
            let roll = hashRand(st.world.seed + 43, t * 319 + 17, br.id * 433 + i + 1000) * totW;
            let picked = pre[0];
            for (const c of pre) { roll -= c.w; if (roll <= 0) { picked = c; break; } }
            const list = conceptsOfClass(picked.c);
            const mi = Math.floor(hashRand(st.world.seed + 43, t * 319 + 17, br.id * 433 + i + 2000) * list.length);
            const M = br.lex.find((x: any) => x.concept === list[mi]);
            if (!M || M.concept === e.concept) return e;
            if (e.word.length + M.word.length > MAX_LEN) return e;
            fusions++;
            return { ...e, word: [...M.word, ...e.word] }; // modifier + head, both whole
          });
          b[br.id] = { ...br, lex };
        });
        st = { ...st, branches: b };
      }
    }
    leavesOf(st.branches).forEach(L => {
      n++; pairs += collisionPairs(L.lex); homo += homophoneForms(L.lex).size;
      L.lex.forEach(e => { words++; syll += e.word.filter(isV).length; maxLen = Math.max(maxLen, e.word.length);
        for (let i=1;i<e.word.length-2;i++) if(isV(e.word[i-1])&&!isV(e.word[i])&&!isV(e.word[i+1])&&isV(e.word[i+2])) inter++; });
    });
  }
  return { syll: syll/words, inter, pairs: pairs/n, homo: homo/n, fusions, maxLen };
}
console.log("per-concept pressure-triggered univerbation, 80 turns");
console.log("baseline: syll 1.09, collisionPairs 54.1, homophones 10.8, CC 1\n");
[0, 0.01, 0.02, 0.04, 0.08].forEach(r => {
  const m = run(r, 80);
  console.log(`  rate ${String(r).padEnd(5)} syll/word ${m.syll.toFixed(2)}  collisionPairs ${m.pairs.toFixed(1)}  homophones ${m.homo.toFixed(1)}  CC ${String(m.inter).padStart(4)}  fusions ${m.fusions}`);
});

console.log("\nstability of rate 0.06 over a long run (equilibrium check):");
[20, 40, 80, 150, 300].forEach(t => {
  const m = run(0.06, t, 20);
  console.log(`  turn ${String(t).padStart(3)}: syll/word ${m.syll.toFixed(2)}  collisionPairs ${m.pairs.toFixed(1)}  homophones ${m.homo.toFixed(1)}  CC ${String(m.inter).padStart(3)}  maxLen ${m.maxLen}`);
});
