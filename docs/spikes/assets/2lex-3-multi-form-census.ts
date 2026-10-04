/// <reference types="bun-types" />
/**
 * 2LEX.3 empirical census: how much multi-form material would autonomous play
 * generate, per source? Evidence for the multi-form discussion tasks (2LEX.3,
 * 2LEX.7, 4PHON.3), measured before any of them decides on a data shape:
 *
 *   1. doublets (2GEO.4 §7): every Borrowing event is a native form a doublet model
 *      would KEEP rather than overwrite. Reports events/game and how different the
 *      overwritten native form was from the loan (a near-identical loan makes a
 *      pointless doublet).
 *   2. coordinate compounds (2LEX.1 §7): every Disambiguation repair is a moment a
 *      stored synonym could have been compounded instead of a clipped modifier.
 *   3. liaison alternants (1ENG.14 §9): for every consonant-final word on a living
 *      branch, the follower-class vowel-initial share (syntax.ts followerVowelShare).
 *      A share near 0 or 1 means one alternant wins outright and storing both is
 *      wasted; an intermediate share is where two forms would both be heard.
 *
 * Extends the 2GEO.10 harness pattern (same seeds, same horizon) rather than
 * rebuilding branch instrumentation. Run: bun docs/spikes/assets/2lex-3-multi-form-census.ts
 */
import { freshState } from "../../../src/lib/engine/world";
import { resolveGeneration } from "../../../src/lib/engine/generation";
import { leavesOf } from "../../../src/lib/engine/tree";
import { formSimilarity } from "../../../src/lib/engine/intelligibility";
import { followerVowelShare } from "../../../src/lib/engine/syntax";
import { CONCEPT_CLASS } from "../../../src/lib/engine/lexicon";
import { BY_ID, inventoryOf } from "../../../src/lib/engine/phonology";
import { genStem } from "../../../src/lib/engine/naming";
import { routeOpen } from "../../../src/lib/engine/contact";
import { ownerMap, freeAdjacentFor, FRACTURE_COOLDOWN } from "../../../src/lib/engine/geography";
import { reachMult, COST_CAP } from "../../../src/lib/engine/stakes";
import type { GameState } from "../../../src/lib/engine/types";

// WIDE=1 sweeps seeds 1..60 instead of the 2GEO.10 dozen. SPLIT=<turn> forces a
// family into existence: autonomous fracture is unreachable on the current grid (the
// 2GEO.10 finding, reconfirmed here at 0/60 seeds), so without it Borrowing can never
// fire and section 1 measures nothing. At that turn the largest living branch is cut per
// SPLIT_AXIS (below) and one part re-homed on a newborn sibling, a crude stand-in for
// the fracture 2GEO.9's map work is meant to make reachable.
const SEEDS = process.env.WIDE ? Array.from({ length: 60 }, (_, i) => i + 1) : [1985, 7, 42, 1066, 2024, 31337, 555, 90210, 12, 777, 8081, 60309];
const TURNS = 150;
// SPLIT takes a comma list of turns ("30" or "30,60"); each split cuts the LARGEST
// living branch, so a second split lands on whoever has grown most. SPLIT_AXIS picks
// the geometry: "x" (median x-cut, long shared border), "y" (median y-cut) or "corner"
// (the ~20% of territory furthest from the centroid, short border).
// BOT=greedy|bold replaces surgery with a scripted player acting through the same
// path game.svelte.ts expandInto uses: each turn it selects the living branches in
// rotation and buys the cheapest affordable free region ("greedy") or, when one is
// affordable, a region reachable only across impassable terrain ("bold", which is the
// only way a player can disconnect territory and so trigger a real fracture).
const SPLITS = process.env.SPLIT ? process.env.SPLIT.split(",").map(Number) : [];
const AXIS = (process.env.SPLIT_AXIS ?? "x") as "x" | "y" | "corner";
const BOT = process.env.BOT as "greedy" | "bold" | undefined;

function forceSplit(s: GameState): GameState {
  const target = [...leavesOf(s.branches)].sort((a, b) => b.territory.length - a.territory.length || a.id - b.id)[0];
  if (!target || target.territory.length < 2) return s;
  const R = s.world.regions;
  let keep: number[], cut: number[];
  if (AXIS === "corner") {
    const cx = target.territory.reduce((a, r) => a + R[r].x, 0) / target.territory.length;
    const cy = target.territory.reduce((a, r) => a + R[r].y, 0) / target.territory.length;
    const far = [...target.territory].sort((a, b) => Math.hypot(R[b].x - cx, R[b].y - cy) - Math.hypot(R[a].x - cx, R[a].y - cy));
    cut = far.slice(0, Math.max(1, Math.round(far.length * 0.2)));
    keep = target.territory.filter((r) => !cut.includes(r));
  } else {
    const vs = target.territory.map((r) => R[r][AXIS]).sort((a, b) => a - b);
    const m = vs[Math.floor(vs.length / 2)];
    keep = target.territory.filter((r) => R[r][AXIS] < m);
    cut = target.territory.filter((r) => R[r][AXIS] >= m);
  }
  if (!keep.length || !cut.length) return s;
  const id = s.nextId;
  const lex = target.lex.map((e) => ({ ...e, word: [...e.word] }));
  return { ...s, nextId: id + 1, branches: { ...s.branches,
    [target.id]: { ...target, territory: keep },
    [id]: { ...target, id, name: genStem(inventoryOf(target.lex), s.world.seed, id), parentId: target.id, depth: target.depth + 1, territory: cut, lex,
      anchors: [{ lex, turn: s.turn, historyIndex: target.history.length, driftFromPrev: 0 }], fractureCooldown: FRACTURE_COOLDOWN } } };
}

function botTurn(s: GameState, t: number): GameState {
  const leaves = leavesOf(s.branches);
  if (!leaves.length) return s;
  const b = s.branches[leaves[t % leaves.length].id];
  for (;;) {
    const owner = ownerMap(s.branches);
    const cur = s.branches[b.id];
    const price = (c: number) => Math.ceil(Math.min(COST_CAP * c, c * reachMult(s, cur.id)));
    const free = freeAdjacentFor(cur, s.world.adj, owner).filter((f) => price(f.cost) <= s.pool);
    if (!free.length) return s;
    const walled = free.filter((f) => !f.passable);
    const pick = (BOT === "bold" && walled.length ? walled : free).sort((a, c) => price(a.cost) - price(c.cost) || a.region - c.region)[0];
    s = { ...s, pool: s.pool - price(pick.cost), branches: { ...s.branches, [cur.id]: { ...cur, territory: [...cur.territory, pick.region] } } };
  }
}

let borrows = 0, repairs = 0, univerbations = 0, branchTurns = 0;
const loanSims: number[] = [];
const reborrowGaps: number[] = [];
const lastBorrow: Record<string, number> = {};
// candidate DOUBLET_TURNS: a faithful loan lives this long as a doublet unless a
// second faithful borrow reinforces (promotes) it first
const DOUBLET_TURNS = Number(process.env.DOUBLET_TURNS ?? 12);
const lastFaithful: Record<string, number> = {};
let faithful = 0, reinforced = 0, repairWithDoublet = 0;
let unresolved = 0, expiredOpen = 0, expiredClosed = 0, expiredDead = 0;
let pending: { a: number; lender: number; due: number }[] = [];
const perSeed: { seed: number; borrows: number; repairs: number; univerbations: number; maxLiving: number }[] = [];
const shareBuckets = { zero: 0, low: 0, mid: 0, high: 0 }; // 0 | (0,.2) | [.2,.8] | (.8,1]
let consonantFinal = 0, wordTurns = 0, fractures = 0;

for (const seed of SEEDS) {
  let s: GameState = freshState(seed);
  pending = [];
  let sb = 0, sr = 0, su = 0, maxLiving = 1;
  for (let t = 0; t < TURNS; t++) {
    if (SPLITS.includes(t)) s = forceSplit(s);
    if (BOT) s = botTurn(s, t);
    const before = s;
    s = resolveGeneration(s);
    // the bot can't answer a focus dialog; the focus stays put, which is the default
    if (s.pendingFocusChoice) s = { ...s, pendingFocusChoice: null };
    fractures += Object.keys(s.branches).length - Object.keys(before.branches).length;
    const living = leavesOf(s.branches);
    for (const p of pending.filter((q) => q.due === s.turn)) {
      const alive = s.branches[p.a]?.territory.length && s.branches[p.lender]?.territory.length;
      if (!alive) expiredDead++;
      else if (routeOpen(s.routes, p.a, p.lender, s.turn)) expiredOpen++;
      else expiredClosed++;
    }
    maxLiving = Math.max(maxLiving, living.length);
    living.forEach((b) => {
      branchTurns++;
      const prev = before.branches[b.id];
      // a fracture newborn copies its parent's history whole; only entries past the
      // pre-turn length are this turn's events (newborns contribute none, conservatively)
      const fresh = prev ? b.history.slice(prev.history.length) : [];
      fresh.forEach((h) => {
        if (h.name === "Borrowing") { // by name: 2LEX.4 adds a second borrow-flagged entry ("Loan adopted")
          sb++;
          const concept = /'([^']+)'/.exec(h.note)?.[1];
          const native = prev!.lex.find((e) => e.concept === concept)?.word;
          const loan = b.lex.find((e) => e.concept === concept)?.word;
          // approximation: the pre-turn native form, before this turn's step-1 drift
          if (native && loan) loanSims.push(formSimilarity(native, loan));
          // re-borrow gap: turns since this branch last borrowed this same concept
          // (sizes how fast an unbounded alts list would grow per concept)
          const key = `${seed}:${b.id}:${concept}`;
          if (lastBorrow[key] !== undefined) reborrowGaps.push(t - lastBorrow[key]);
          lastBorrow[key] = t;
          // faithful = the loan arrived whole: A's new form equals the lender's form. This is
          // string equality, not resolveBorrow's contact-based flag: a one-edit adapted loan (stepToward) also lands here
          const lenderName = / from (.+)$/.exec(h.note)?.[1];
          // names come from the note; exclude the borrower so a name clash can never
          // resolve the lender to the borrower itself
          const lender = Object.values(s.branches).find((x) => x.name === lenderName && x.id !== b.id);
          if (!lender) unresolved++;
          const lent = lender?.lex.find((e) => e.concept === concept)?.word;
          if (loan && lent && loan.join() === lent.join()) {
            faithful++;
            if (lastFaithful[key] !== undefined && t - lastFaithful[key] <= DOUBLET_TURNS) reinforced++;
            lastFaithful[key] = t;
            // the spike's expiry rule: at DOUBLET_TURNS the loan promotes iff the route
            // to its lender is still open. Schedule that check.
            pending.push({ a: b.id, lender: lender!.id, due: s.turn + DOUBLET_TURNS });
          }
        }
        if (h.name === "Disambiguation") {
          const yielding = /'([^']+)'/.exec(h.note)?.[1];
          const f = lastFaithful[`${seed}:${b.id}:${yielding}`];
          if (f !== undefined && t - f <= DOUBLET_TURNS) repairWithDoublet++;
        }
        if (h.name === "Disambiguation") sr++;
        if (h.name === "Univerbation") su++;
      });
      b.lex.forEach((e) => {
        wordTurns++;
        const last = e.word[e.word.length - 1];
        if (!last || BY_ID[last]?.type !== "C") return;
        consonantFinal++;
        const share = followerVowelShare(CONCEPT_CLASS[e.concept], b.wordOrder, b.frameWeights, b.lex);
        if (share === 0) shareBuckets.zero++;
        else if (share < 0.2) shareBuckets.low++;
        else if (share <= 0.8) shareBuckets.mid++;
        else shareBuckets.high++;
      });
    });
  }
  borrows += sb; repairs += sr; univerbations += su;
  perSeed.push({ seed, borrows: sb, repairs: sr, univerbations: su, maxLiving });
}

const pct = (n: number, d: number) => `${((100 * n) / (d || 1)).toFixed(1)}%`;
const median = (xs: number[]) => { const a = [...xs].sort((p, q) => p - q); return a.length ? a[Math.floor(a.length / 2)] : NaN; };

console.log(`seeds=${SEEDS.length} turns=${TURNS} branch-turns=${branchTurns} engine fractures=${fractures}`);
if (process.env.SUMMARY) {
  const mid = pct(shareBuckets.mid, consonantFinal);
  console.log(`SUMMARY borrows/game=${(borrows / SEEDS.length).toFixed(1)} faithful=${pct(faithful, borrows)} promote=${pct(expiredOpen, expiredOpen + expiredClosed)} reborrow=${pct(reborrowGaps.length, borrows)} gap=${median(reborrowGaps)} repairsWithDoublet=${pct(repairWithDoublet, repairs)} liaisonMid=${mid} maxLiving=${Math.max(...perSeed.map((x) => x.maxLiving))} medLiving=${median(perSeed.map((x) => x.maxLiving))} fractures/game=${(fractures / SEEDS.length).toFixed(1)}`);
  process.exit(0);
}
console.table(perSeed);
console.log("\n1. doublet supply (Borrowing events)");
console.log(`  total ${borrows}, per game ${(borrows / SEEDS.length).toFixed(1)}, per branch-turn ${(borrows / branchTurns).toFixed(3)}`);
console.log(`  native-vs-loan similarity: median ${median(loanSims).toFixed(2)}, identical ${pct(loanSims.filter((x) => x === 1).length, loanSims.length)}, <=0.5 ${pct(loanSims.filter((x) => x <= 0.5).length, loanSims.length)}`);
console.log(`  distinct branch-concept pairs ${Object.keys(lastBorrow).length}; re-borrows ${reborrowGaps.length} (${pct(reborrowGaps.length, borrows)}), median gap ${median(reborrowGaps)} turns`);
console.log(`  faithful ${faithful} (${pct(faithful, borrows)}); reinforced within DOUBLET_TURNS=${DOUBLET_TURNS}: ${reinforced} (${pct(reinforced, faithful)} of faithful)`);
console.log(`  lender unresolved by name: ${unresolved}`);
console.log(`  at expiry: route open ${expiredOpen}, closed ${expiredClosed}, a party dead ${expiredDead} (promote rate ${pct(expiredOpen, expiredOpen + expiredClosed)})`);
console.log(`  repairs whose yielding concept held a live doublet: ${repairWithDoublet} (${pct(repairWithDoublet, repairs)} of repairs)`);
console.log("\n2. coordinate-compound opportunities (Disambiguation repairs)");
console.log(`  total ${repairs}, per game ${(repairs / SEEDS.length).toFixed(1)}; univerbations for comparison ${univerbations} (${(univerbations / SEEDS.length).toFixed(1)}/game)`);
console.log("\n3. liaison alternants (consonant-final words, follower vowel-initial share)");
console.log(`  consonant-final ${pct(consonantFinal, wordTurns)} of ${wordTurns} word-turns`);
console.log(`  share = 0      ${pct(shareBuckets.zero, consonantFinal)}  (always-final class: one form, no alternant)`);
console.log(`  share < 0.2    ${pct(shareBuckets.low, consonantFinal)}`);
console.log(`  0.2..0.8       ${pct(shareBuckets.mid, consonantFinal)}  (both alternants genuinely heard)`);
console.log(`  share > 0.8    ${pct(shareBuckets.high, consonantFinal)}`);
