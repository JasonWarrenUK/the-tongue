// 1ENG.25 fork test: do the two candidate algorithms actually disagree?
//   A) sonority-based onset maximisation (universal, template-blind)
//   B) template-driven parse (uses the branch's World.tmpl: onset req/opt, coda none/opt, clusters)
// If they agree ~always, the fork is fake and we take the cheaper one.
import { freshState } from "/Users/jasonwarren/Code/creations/the-tongue/src/lib/engine/world";
import { resolveGeneration } from "/Users/jasonwarren/Code/creations/the-tongue/src/lib/engine/generation";
import { leavesOf } from "/Users/jasonwarren/Code/creations/the-tongue/src/lib/engine/tree";
import { BY_ID, formOf } from "/Users/jasonwarren/Code/creations/the-tongue/src/lib/engine/phonology";
import type { Template } from "/Users/jasonwarren/Code/creations/the-tongue/src/lib/engine/types";

const isV = (id: string) => BY_ID[id]?.type === "V";
// sonority scale (low=obstruent .. high=vowel), the standard hierarchy
const SON: Record<string, number> = { stop: 1, fric: 2, nasal: 3, liquid: 4, glide: 5 };
const son = (id: string) => { const p = BY_ID[id]; return !p ? 0 : p.type === "V" ? 6 : (SON[p.manner ?? ""] ?? 1); };

// A) onset maximisation: every consonant that CAN be an onset, is one.
// Legal onset cluster = strictly rising sonority toward the nucleus.
function syllabifyOnsetMax(w: string[]): string[][] {
  const nuclei: number[] = []; w.forEach((p, i) => { if (isV(p)) nuclei.push(i); });
  if (!nuclei.length) return [w];
  const out: string[][] = [];
  let start = 0;
  for (let n = 0; n < nuclei.length; n++) {
    const nuc = nuclei[n];
    const nextNuc = nuclei[n + 1];
    let end: number;
    if (nextNuc === undefined) end = w.length;
    else {
      // consonants between this nucleus and the next: assign max legal cluster to next onset
      let c = nuc + 1;
      const between = nextNuc - nuc - 1;
      let onsetStart = nextNuc;
      for (let k = nextNuc - 1; k > nuc; k--) {
        if (son(w[k]) < son(w[onsetStart]) || isV(w[onsetStart])) onsetStart = k; else break;
      }
      end = onsetStart;
    }
    out.push(w.slice(start, end)); start = end;
  }
  return out;
}
// B) template-driven: coda only if template allows, clusters only if template allows
function syllabifyTemplate(w: string[], t: Template): string[][] {
  const nuclei: number[] = []; w.forEach((p, i) => { if (isV(p)) nuclei.push(i); });
  if (!nuclei.length) return [w];
  const out: string[][] = []; let start = 0;
  for (let n = 0; n < nuclei.length; n++) {
    const nuc = nuclei[n], nextNuc = nuclei[n + 1];
    let end: number;
    if (nextNuc === undefined) end = w.length;
    else {
      const between = nextNuc - nuc - 1;
      if (between === 0) end = nextNuc;
      else if (t.coda === "none") end = nuc + 1;          // no coda: all Cs are next onset
      else if (between === 1) end = nuc + 1;               // one C: onset of next (universal)
      else end = t.clusters ? nuc + 1 : nuc + 1 + (between - 1); // clusters -> all to onset; else split
    }
    out.push(w.slice(start, end)); start = end;
  }
  return out;
}
const key = (s: string[][]) => s.map(x => x.join("")).join("·");

let same = 0, diff = 0; const examples: string[] = [];
for (let s = 1; s <= 30; s++) {
  let st = freshState(s);
  const tmpl = st.world.tmpl;
  for (let t = 0; t < 60; t++) st = resolveGeneration(st);
  leavesOf(st.branches).forEach(L => L.lex.forEach(e => {
    const a = key(syllabifyOnsetMax(e.word)), b = key(syllabifyTemplate(e.word, tmpl));
    if (a === b) same++; else { diff++; if (examples.length < 8) examples.push(`  ${formOf(e.word)} [${tmpl.label}]  onsetMax=${a}  template=${b}`); }
  }));
}
console.log(`words compared: ${same + diff}`);
console.log(`  identical parse: ${same} (${(100*same/(same+diff)).toFixed(1)}%)`);
console.log(`  divergent parse: ${diff} (${(100*diff/(same+diff)).toFixed(1)}%)`);
console.log("\ndivergence examples:"); examples.forEach(e => console.log(e));
