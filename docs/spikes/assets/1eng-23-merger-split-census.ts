// 1ENG.23 evidence #2: distinguish the THREE phonemic events the spike must cover.
//   loss   — phoneme disappears from the lexicon entirely (unconditioned deletion)
//   merger — phoneme X's words now use Y, where Y already existed (contrast destroyed)
//   split  — one genesis phoneme's words now use 2+ distinct live phonemes
// Measured by tracking, per branch, where each genesis phoneme's TOKENS ended up.
import { freshState } from "/Users/jasonwarren/Code/creations/the-tongue/src/lib/engine/world";
import { resolveGeneration } from "/Users/jasonwarren/Code/creations/the-tongue/src/lib/engine/generation";
import { leavesOf } from "/Users/jasonwarren/Code/creations/the-tongue/src/lib/engine/tree";
import { RULES } from "/Users/jasonwarren/Code/creations/the-tongue/src/lib/engine/phonology";

// which rules are structurally capable of a MERGER (map a phone onto an existing one)?
// vs a SPLIT (one input -> context-dependent different outputs)?
const merging = RULES.filter(r => {
  // a rule whose xform is unconditioned on context produces one output per input:
  // if that output is another phone already in the inventory, it's a merger.
  return true;
});
console.log("RULES that are context-CONDITIONED (pre or post non-null) — split-capable:");
console.log("  " + RULES.filter(r => r.pre || r.post).map(r => r.id).join(", "));
console.log("RULES unconditioned (no pre, no post) — pure merger-capable:");
console.log("  " + (RULES.filter(r => !r.pre && !r.post).map(r => r.id).join(", ") || "(none)"));

// empirical: does a genesis phoneme's token set ever land on >1 live phoneme (split)
// or collapse onto a phoneme another genesis phoneme also uses (merger)?
const TURNS = 120, SEEDS = 30;
let splitCount = 0, mergerCount = 0, branches = 0;
for (let s = 1; s <= SEEDS; s++) {
  let st = freshState(s);
  // track per-branch: concept -> genesis word
  const genesisLex = new Map(st.world.lex.map(e => [e.concept, [...e.word]]));
  for (let t = 0; t < TURNS; t++) st = resolveGeneration(st);
  leavesOf(st.branches).forEach(L => {
    branches++;
    // align genesis word to live word positionally where lengths match — crude but
    // enough to detect "genesis /k/ became live /x/ here and live /k/ there".
    const dest = new Map<string, Set<string>>();
    L.lex.forEach(e => {
      const g = genesisLex.get(e.concept);
      if (!g || g.length !== e.word.length) return; // only unambiguous alignments
      g.forEach((gp, i) => {
        if (!dest.has(gp)) dest.set(gp, new Set());
        dest.get(gp)!.add(e.word[i]);
      });
    });
    let hasSplit = false;
    [...dest.values()].forEach(d => { if (d.size > 1) hasSplit = true; });
    if (hasSplit) splitCount++;
    // merger: two distinct genesis phonemes whose destination sets overlap
    const gp = [...dest.keys()];
    let hasMerger = false;
    for (let i = 0; i < gp.length; i++) for (let j = i + 1; j < gp.length; j++) {
      const a = dest.get(gp[i])!, b = dest.get(gp[j])!;
      if ([...a].some(x => b.has(x))) hasMerger = true;
    }
    if (hasMerger) mergerCount++;
  });
}
console.log(`\n${branches} branches over ${SEEDS} seeds x ${TURNS} turns (length-preserved alignments only):`);
console.log(`  branches showing a SPLIT  (1 genesis phoneme -> 2+ live): ${splitCount}/${branches} (${(100*splitCount/branches).toFixed(0)}%)`);
console.log(`  branches showing a MERGER (2 genesis phonemes overlap):   ${mergerCount}/${branches} (${(100*mergerCount/branches).toFixed(0)}%)`);
