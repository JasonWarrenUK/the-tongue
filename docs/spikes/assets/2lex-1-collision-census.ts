/**
 * 2LEX.1 empirical census: how often do homophone collisions land during
 * autonomous play, which concept pairs collide, and do they self-heal?
 *
 * Runs resolveGeneration for TURNS turns across SEEDS seeds with no player
 * input (pure autonomous drift), tracking per-(branch, conceptPair) collision
 * episodes: birth turn, death turn (form divergence or branch death) or
 * persistence to horizon.
 */
import { freshState } from "../../../src/lib/engine/world";
import { resolveGeneration } from "../../../src/lib/engine/generation";
import { formOf } from "../../../src/lib/engine/phonology";
import { leavesOf } from "../../../src/lib/engine/tree";
import type { GameState, Branch } from "../../../src/lib/engine/types";

const SEEDS = [1985, 7, 42, 1066, 2024, 31337, 555, 90210, 12, 777, 8081, 60309];
const TURNS = 150;

interface Episode {
  seed: number; branchId: number; a: string; b: string;
  born: number; died: number | null; // died = turn collision cleared; null = alive at horizon or branch death
  endedBy: "diverged" | "branchDeath" | "horizon";
}

const episodes: Episode[] = [];
const pairCounts = new Map<string, number>(); // conceptA|conceptB -> episode count

function collidingPairs(b: Branch): Set<string> {
  const byForm = new Map<string, string[]>();
  for (const e of b.lex) {
    const f = formOf(e.word);
    byForm.set(f, [...(byForm.get(f) ?? []), e.concept]);
  }
  const pairs = new Set<string>();
  for (const group of byForm.values()) {
    if (group.length < 2) continue;
    const sorted = [...group].sort();
    for (let i = 0; i < sorted.length; i++)
      for (let j = i + 1; j < sorted.length; j++)
        pairs.add(`${sorted[i]}|${sorted[j]}`);
  }
  return pairs;
}

let totalBranchTurns = 0;
let branchTurnsWithCollision = 0;
let startCollisions = 0;

for (const seed of SEEDS) {
  let s: GameState = freshState(seed);
  // open: live episodes keyed branchId|a|b
  const open = new Map<string, Episode>();

  // measure collisions present at world gen
  startCollisions += collidingPairs(Object.values(s.branches)[0]).size;

  for (let t = 0; t < TURNS; t++) {
    s = resolveGeneration(s);
    const leaves = leavesOf(s.branches);
    const liveLeafIds = new Set(leaves.map((l) => l.id));

    // close episodes on dead branches
    for (const [key, ep] of open) {
      if (!liveLeafIds.has(ep.branchId)) {
        ep.died = s.turn; ep.endedBy = "branchDeath";
        episodes.push(ep); open.delete(key);
      }
    }

    for (const L of leaves) {
      totalBranchTurns++;
      const now = collidingPairs(L);
      if (now.size > 0) branchTurnsWithCollision++;

      // new episodes
      for (const pair of now) {
        const key = `${L.id}|${pair}`;
        if (!open.has(key)) {
          const [a, b] = pair.split("|");
          open.set(key, { seed, branchId: L.id, a, b, born: s.turn, died: null, endedBy: "horizon" });
          pairCounts.set(pair, (pairCounts.get(pair) ?? 0) + 1);
        }
      }
      // episodes that healed (form diverged again)
      for (const [key, ep] of open) {
        if (ep.branchId !== L.id) continue;
        if (!now.has(`${ep.a}|${ep.b}`)) {
          ep.died = s.turn; ep.endedBy = "diverged";
          episodes.push(ep); open.delete(key);
        }
      }
    }
  }
  for (const ep of open.values()) episodes.push(ep); // horizon survivors
}

const landed = episodes.length;
const healed = episodes.filter((e) => e.endedBy === "diverged");
const atHorizon = episodes.filter((e) => e.endedBy === "horizon");
const byDeath = episodes.filter((e) => e.endedBy === "branchDeath");
const durations = healed.map((e) => e.died! - e.born);
const mean = (xs: number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : NaN);
const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s2 = [...xs].sort((a, b) => a - b);
  return s2[Math.floor(s2.length / 2)];
};

console.log(`seeds=${SEEDS.length} turns=${TURNS}`);
console.log(`collisions in freshly generated worlds: ${startCollisions}`);
console.log(`branch-turns observed: ${totalBranchTurns}`);
console.log(`branch-turns with >=1 live collision: ${branchTurnsWithCollision} (${((100 * branchTurnsWithCollision) / totalBranchTurns).toFixed(1)}%)`);
console.log(`collision episodes landed: ${landed}`);
console.log(`  healed by later drift:  ${healed.length} (${((100 * healed.length) / landed).toFixed(1)}%)  mean ${mean(durations).toFixed(1)} / median ${median(durations)} turns to heal`);
console.log(`  alive at 150-turn horizon: ${atHorizon.length} (${((100 * atHorizon.length) / landed).toFixed(1)}%)`);
console.log(`  ended by branch death:  ${byDeath.length}`);
const persistLong = healed.filter((e) => e.died! - e.born >= 10).length;
console.log(`  healed episodes lasting >=10 turns: ${persistLong}`);
console.log(`\ntop colliding concept pairs:`);
[...pairCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)
  .forEach(([pair, n]) => console.log(`  ${pair.padEnd(20)} ${n}`));

// ── 2LEX.1 severity model: same-field chronic share under the draft grouping ──
const FIELDS: Record<string, string[]> = {
  landscape: ["stone", "hill", "river", "path", "snow", "water"],
  flora: ["tree", "leaf", "root", "seed"],
  fauna: ["fish", "bird", "dog", "wolf"],
  body: ["hand", "eye", "ear", "tooth", "bone", "blood", "skin", "meat"],
  sky: ["sun", "moon", "star", "sky", "rain", "wind", "day", "night"],
  hearth: ["house", "fire"],
};
const fieldOf = new Map<string, string>();
for (const [f, cs] of Object.entries(FIELDS)) for (const c of cs) fieldOf.set(c, f);
const uncovered = episodes.filter((e) => !fieldOf.has(e.a) || !fieldOf.has(e.b));
console.log(`\nconcepts uncovered by field table: ${uncovered.length ? "SOME MISSING" : "none (all 32 covered)"}`);

const sameField = episodes.filter((e) => fieldOf.get(e.a) === fieldOf.get(e.b));
console.log(`same-field episodes: ${sameField.length} / ${episodes.length} (${((100 * sameField.length) / episodes.length).toFixed(1)}%)`);
for (const N of [4, 6, 8]) {
  // episodes that would trigger autonomous repair: same-field AND survived >= N turns
  const fired = sameField.filter((e) => (e.died ?? TURNS) - e.born >= N);
  console.log(`  COLLISION_TURNS=${N}: ${fired.length} autonomous repairs across ${SEEDS.length} games (${(fired.length / SEEDS.length).toFixed(1)} per 150-turn game)`);
}
const chronicSame = sameField.filter((e) => e.endedBy === "horizon").length;
console.log(`same-field chronic (never healed): ${chronicSame}`);
