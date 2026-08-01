// 1ENG.23 fork test: can a DERIVED inventory (diffed turn-over-turn) name the event,
// or does naming it require STORED state?
//
// Key question: an allophone. If /k/ -> /x/ only before front vowels (palat), the
// derived inventory sees {k, x} both present — indistinguishable from a world where
// /k/ and /x/ were always separate phonemes. Complementary distribution is the ONLY
// thing that separates "allophone" from "phoneme", and it is computable from the
// lexicon. Test whether it's computable CHEAPLY and RELIABLY.
import { freshState } from "/Users/jasonwarren/Code/creations/the-tongue/src/lib/engine/world";
import { resolveGeneration } from "/Users/jasonwarren/Code/creations/the-tongue/src/lib/engine/generation";
import { leavesOf } from "/Users/jasonwarren/Code/creations/the-tongue/src/lib/engine/tree";
import { BY_ID } from "/Users/jasonwarren/Code/creations/the-tongue/src/lib/engine/phonology";
import type { Lexicon } from "/Users/jasonwarren/Code/creations/the-tongue/src/lib/engine/types";

// minimal-pair test: do X and Y ever contrast in the SAME environment?
// If never, they are in complementary distribution => allophones of one phoneme.
function contrastive(lex: Lexicon, x: string, y: string): { contrast: boolean; envX: number; envY: number } {
  const env = (w: string[], i: number) => `${i > 0 ? w[i-1] : "#"}_${i < w.length-1 ? w[i+1] : "#"}`;
  const ex = new Set<string>(), ey = new Set<string>();
  lex.forEach(e => e.word.forEach((p, i) => {
    if (p === x) ex.add(env(e.word, i));
    if (p === y) ey.add(env(e.word, i));
  }));
  const shared = [...ex].some(v => ey.has(v));
  return { contrast: shared, envX: ex.size, envY: ey.size };
}

const TURNS = 120;
let allophonic = 0, contrastivePairs = 0, tested = 0;
const examples: string[] = [];
for (let s = 1; s <= 30; s++) {
  let st = freshState(s);
  for (let t = 0; t < TURNS; t++) st = resolveGeneration(st);
  leavesOf(st.branches).forEach(L => {
    const ids = [...new Set(L.lex.flatMap(e => e.word))];
    // check every same-type pair that plausibly arose by conditioned change
    for (let i = 0; i < ids.length; i++) for (let j = i+1; j < ids.length; j++) {
      const a = BY_ID[ids[i]], b = BY_ID[ids[j]];
      if (!a || !b || a.type !== b.type) continue;
      const r = contrastive(L.lex, ids[i], ids[j]);
      if (r.envX < 2 || r.envY < 2) continue; // too rare to judge
      tested++;
      if (r.contrast) contrastivePairs++;
      else {
        allophonic++;
        if (examples.length < 6) examples.push(`  seed ${s} ${L.name}: /${ids[i]}/ vs /${ids[j]} / complementary (${r.envX} vs ${r.envY} envs, no overlap)`);
      }
    }
  });
}
console.log(`pairs tested (both phones in >=2 environments): ${tested}`);
console.log(`  contrastive (share an environment => 2 phonemes): ${contrastivePairs} (${(100*contrastivePairs/tested).toFixed(0)}%)`);
console.log(`  complementary (=> allophones of 1 phoneme):       ${allophonic} (${(100*allophonic/tested).toFixed(0)}%)`);
console.log("\nexamples of derived-allophone verdicts:");
examples.forEach(e => console.log(e));
