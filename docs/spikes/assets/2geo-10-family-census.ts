/// <reference types="bun-types" />
/**
 * 2GEO.10 empirical census: does the family tree grow at all under autonomous
 * play, or does the current 10x8 grid percolate above the bond-percolation
 * threshold and lock every seed into a single immortal branch?
 *
 * Runs resolveGeneration for TURNS turns across SEEDS seeds with no player
 * input, reporting per-seed and aggregate: living branch count over time,
 * fracture/birth/assimilation-death counts, territory distribution, the
 * largest passable-connected-component size at genesis (the percolation
 * diagnostic), Proto--eligible dead ancestors, and intelligibility decay vs
 * birth anchor. Also reports the pairContact share distribution so a terrain
 * retune can be checked against ORDER_CONTACT_CUT (1ENG.21) without re-breaking it.
 *
 * Findings from this task (2geo-10-family-structure-reachability spike): at this
 * committed baseline, fracture is essentially never reachable autonomously (0/12
 * seeds here; 35/40 at a wider arbitrary sample) — that's a genesis map-connectivity
 * problem this census can diagnose (see the percolation section below) but can't fix
 * alone; 2GEO.9 (map-shape diversification) owns the actual fix. What THIS task
 * shipped is FRACTURE_COOLDOWN and STUCK_TURNS (geography.ts): when a map IS
 * fragmented enough for fracture to fire (by seed luck, or once 2GEO.9 lands), it no
 * longer cascades into unbounded branch-count runaway or permanently freezes a
 * walled-in branch. Re-run this script after any map-generation change to check both
 * reachability (has it improved?) and safety (does the cooldown still hold, i.e. does
 * no seed show >>8 fractures/150 turns from one branch's repeated re-splitting?).
 */
import { freshState } from "../../../src/lib/engine/world";
import { resolveGeneration } from "../../../src/lib/engine/generation";
import { passableComponents, ownerMap, pairContact } from "../../../src/lib/engine/geography";
import { leavesOf } from "../../../src/lib/engine/tree";
import { intelligibility } from "../../../src/lib/engine/intelligibility";
import { ORDER_CONTACT_CUT } from "../../../src/lib/engine/syntax";
import type { GameState } from "../../../src/lib/engine/types";

const SEEDS = [1985, 7, 42, 1066, 2024, 31337, 555, 90210, 12, 777, 8081, 60309];
const TURNS = 150;
const SNAPSHOT_TURNS = [25, 50, 100, 150];

interface SeedResult {
  seed: number;
  genesisLargestComponent: number;
  genesisRegionCount: number;
  fractures: number;
  deaths: number;
  livingAt: Record<number, number>;
  finalTerritory: number[]; // territory count per living branch at horizon
  anchorFreezes: number;
  pairContactShares: number[]; // all pairContact() values observed >0, sampled each turn
  intelVsBirthAnchor: { turn: number; intel: number }[]; // root branch, id 0, each turn while alive
}

function countLivingBranches(s: GameState): number {
  return leavesOf(s.branches).length;
}

const results: SeedResult[] = [];

for (const seed of SEEDS) {
  let s: GameState = freshState(seed);
  const comps = passableComponents(s.world.regions.map((r) => r.id), s.world.adj);
  const genesisLargestComponent = Math.max(...comps.map((c) => c.length));

  const branchIdsSeenAtStart = new Set(Object.keys(s.branches).map(Number));
  let fractures = 0;
  let deaths = 0;
  let anchorFreezes = 0;
  const startAnchors = s.branches[0].anchors.length;
  const livingAt: Record<number, number> = {};
  const pairContactShares: number[] = [];
  const intelVsBirthAnchor: { turn: number; intel: number }[] = [];
  const birthAnchorLex = s.branches[0].anchors[0].lex;

  for (let t = 0; t < TURNS; t++) {
    const beforeIds = new Set(Object.keys(s.branches).map(Number));
    const beforeLiving = new Set(leavesOf(s.branches).map((b) => b.id));
    s = resolveGeneration(s);
    const afterIds = new Set(Object.keys(s.branches).map(Number));
    const afterLiving = new Set(leavesOf(s.branches).map((b) => b.id));

    // new branch ids born this turn (fracture spin-offs)
    for (const id of afterIds) if (!beforeIds.has(id)) fractures++;
    // branches that were living and are no longer (assimilation death)
    for (const id of beforeLiving) if (!afterLiving.has(id)) deaths++;

    if (SNAPSHOT_TURNS.includes(t + 1)) livingAt[t + 1] = countLivingBranches(s);

    // sample pairContact shares across all live bordering pairs this turn
    const leaves = leavesOf(s.branches);
    const owner = ownerMap(s.branches);
    for (let i = 0; i < leaves.length; i++)
      for (let j = 0; j < leaves.length; j++) {
        if (i === j) continue;
        const share = pairContact(leaves[i].id, leaves[j].id, leaves[i].territory, s.world.edges, owner);
        if (share > 0) pairContactShares.push(share);
      }

    // intelligibility of the ROOT lineage vs its own birth anchor, while root still alive
    if (s.branches[0] && s.branches[0].territory.length > 0) {
      intelVsBirthAnchor.push({ turn: t + 1, intel: intelligibility(s.branches[0].lex, birthAnchorLex) });
    }
  }

  // anchor freezes: sum of (final anchors - birth anchors) across all branches ever seen,
  // including branches that later died (their anchor count is frozen at death).
  for (const id of new Set([...branchIdsSeenAtStart, ...Object.keys(s.branches).map(Number)])) {
    const b = s.branches[id];
    if (b) anchorFreezes += b.anchors.length - (id === 0 ? startAnchors : 1);
  }

  const finalLeaves = leavesOf(s.branches);
  results.push({
    seed, genesisLargestComponent, genesisRegionCount: s.world.regions.length,
    fractures, deaths, livingAt, finalTerritory: finalLeaves.map((b) => b.territory.length),
    anchorFreezes, pairContactShares, intelVsBirthAnchor,
  });
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, x) => a + x, 0) / xs.length : NaN);
const median = (xs: number[]) => {
  if (!xs.length) return NaN;
  const s2 = [...xs].sort((a, b) => a - b);
  return s2[Math.floor(s2.length / 2)];
};

console.log(`seeds=${SEEDS.length} turns=${TURNS}`);
console.log(`\n== genesis percolation ==`);
results.forEach((r) => console.log(`  seed ${r.seed}: largest passable component ${r.genesisLargestComponent}/${r.genesisRegionCount}`));
console.log(`  mean largest component: ${mean(results.map((r) => r.genesisLargestComponent)).toFixed(1)} / ${results[0].genesisRegionCount}`);

console.log(`\n== living branches over time ==`);
for (const t of SNAPSHOT_TURNS) {
  const counts = results.map((r) => r.livingAt[t] ?? NaN);
  console.log(`  t=${t}: ${counts.join(", ")}  (mean ${mean(counts).toFixed(2)}, min ${Math.min(...counts)}, seeds with >=5: ${counts.filter((c) => c >= 5).length}/${SEEDS.length})`);
}

console.log(`\n== fracture / death totals per seed (150 turns) ==`);
results.forEach((r) => console.log(`  seed ${r.seed}: fractures=${r.fractures} deaths=${r.deaths}`));
console.log(`  fractures: mean ${mean(results.map((r) => r.fractures)).toFixed(2)}, seeds at 0: ${results.filter((r) => r.fractures === 0).length}/${SEEDS.length}`);
console.log(`  deaths: mean ${mean(results.map((r) => r.deaths)).toFixed(2)}, total: ${results.reduce((a, r) => a + r.deaths, 0)}`);

console.log(`\n== territory distribution at horizon ==`);
results.forEach((r) => console.log(`  seed ${r.seed}: ${r.finalTerritory.sort((a, b) => b - a).join(", ")}`));

console.log(`\n== anchor freezes (150 turns) ==`);
const allFreezes = results.map((r) => r.anchorFreezes);
console.log(`  mean ${mean(allFreezes).toFixed(1)}, median ${median(allFreezes)}, per seed: ${allFreezes.join(", ")}`);

console.log(`\n== pairContact share distribution (percolation retune must keep this alive) ==`);
const allShares = results.flatMap((r) => r.pairContactShares);
const aboveCut = allShares.filter((s) => s >= ORDER_CONTACT_CUT).length;
console.log(`  samples: ${allShares.length}, mean ${mean(allShares).toFixed(3)}, median ${median(allShares).toFixed(3)}`);
console.log(`  >= ORDER_CONTACT_CUT (${ORDER_CONTACT_CUT}): ${aboveCut} (${allShares.length ? ((100 * aboveCut) / allShares.length).toFixed(2) : "0.00"}%)`);

console.log(`\n== intelligibility vs birth anchor (root lineage) ==`);
const crossTurns: number[] = [];
for (const r of results) {
  const cross = r.intelVsBirthAnchor.find((p) => p.intel < 0.6);
  if (cross) crossTurns.push(cross.turn);
  const at = (t: number) => r.intelVsBirthAnchor.find((p) => p.turn === t)?.intel;
  console.log(`  seed ${r.seed}: t1=${at(1)?.toFixed(3)} t5=${at(5)?.toFixed(3)} t10=${at(10)?.toFixed(3)} t20=${at(20)?.toFixed(3)} t30=${at(30)?.toFixed(3)} crosses<0.6 at t=${cross?.turn ?? "never"}`);
}
console.log(`  median turn crossing below 0.60: ${median(crossTurns)}`);
