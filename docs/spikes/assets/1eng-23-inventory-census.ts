// 1ENG.23 evidence: does a branch's LIVE inventory actually diverge from World.inv?
// If it barely moves, the whole spike is theatre. Measure it.
import { freshState } from "/Users/jasonwarren/Code/creations/the-tongue/src/lib/engine/world";
import { resolveGeneration } from "/Users/jasonwarren/Code/creations/the-tongue/src/lib/engine/generation";
import { inventoryOf } from "/Users/jasonwarren/Code/creations/the-tongue/src/lib/engine/naming";
import { leavesOf } from "/Users/jasonwarren/Code/creations/the-tongue/src/lib/engine/tree";

const TURNS = 120, SEEDS = 40;
let lostTot = 0, gainedTot = 0, branchTurns = 0;
const lossHist: number[] = [], gainHist: number[] = [];
let genesisNominallyGone = 0, sampleShown = 0;

for (let s = 1; s <= SEEDS; s++) {
  let st = freshState(s);
  const gen = new Set([...st.world.inv.vowels, ...st.world.inv.consonants]);
  for (let t = 0; t < TURNS; t++) st = resolveGeneration(st);
  leavesOf(st.branches).forEach((L) => {
    const live = inventoryOf(L.lex);
    const liveSet = new Set([...live.vowels, ...live.consonants]);
    const lost = [...gen].filter((p) => !liveSet.has(p));
    const gained = [...liveSet].filter((p) => !gen.has(p));
    lostTot += lost.length; gainedTot += gained.length; branchTurns++;
    lossHist.push(lost.length); gainHist.push(gained.length);
    if (lost.length) genesisNominallyGone++;
    if (sampleShown < 3 && lost.length) {
      console.log(`  seed ${s} branch ${L.name}: genesis=${gen.size} live=${liveSet.size} LOST=[${lost.join(",")}] GAINED=[${gained.join(",")}]`);
      sampleShown++;
    }
  });
}
const mean = (a: number[]) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2);
console.log(`\n${SEEDS} seeds x ${TURNS} turns, ${branchTurns} surviving branches measured`);
console.log(`mean phonemes LOST vs genesis inventory:   ${mean(lossHist)}  (max ${Math.max(...lossHist)})`);
console.log(`mean phonemes GAINED vs genesis inventory: ${mean(gainHist)}  (max ${Math.max(...gainHist)})`);
console.log(`branches with >=1 genesis phoneme fully gone: ${genesisNominallyGone}/${branchTurns} (${(100*genesisNominallyGone/branchTurns).toFixed(0)}%)`);
