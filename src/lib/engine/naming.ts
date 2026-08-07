import { hashRand } from "./rng";
import { intelligibility } from "./intelligibility";
import { BY_ID } from "./phonology";
import { leavesOf, isLeaf } from "./tree";
import type { Branch, Inventory } from "./types";

// 1ENG.10 naming subsystem. Three independent pieces:
//   - genStem: phonotactic branch-name generation (replaces NAME_POOL)
//   - blendStems: phonaesthetic Proto-<blend> morphology
//   - eraLabels: pure, render-time perspective-collapse over a branch's anchor chain
// Nothing here mutates state or is called from resolveGeneration except to freeze an
// Anchor; all display naming is computed on demand from Branch data, never stored.

// --- stem generation -------------------------------------------------------

// 1ENG.26: inventoryOf moved to phonology.ts (1eng-23 spike §4.1) — an inventory is a
// phonological fact, not a naming one. genStem below still takes an Inventory param;
// its caller (generation.ts, at fracture birth) now imports inventoryOf from there.

const SONORANT_MANNERS = new Set(["nasal", "liquid", "glide"]);
const isSonorant = (id: string) => { const p = BY_ID[id]; return !!p && p.type === "C" && SONORANT_MANNERS.has(p.manner ?? ""); };

// Deterministic cursor over hashRand — reads as a sequence of draws seeded off
// (seed, branchId), same replay contract as the rest of the engine (driftRule etc.).
function cursor(seed: number, branchId: number) {
  let i = 0;
  return () => hashRand(seed, branchId * 733 + i++, branchId * 197 + 11);
}
function pickAt<T>(arr: T[], roll: number): T { return arr[Math.floor(roll * arr.length)] ?? arr[0]; }

// Name-flavoured syllable: onset preferred (names read stronger with one), nucleus from
// the branch's vowels, coda only from sonorants so names end softly (Aenic, Boran, not
// a stop-final cluster) — matches the feel of the retired NAME_POOL.
function genSyllable(inv: Inventory, draw: () => number): string {
  let s = "";
  if (draw() < 0.85) s += BY_ID[pickAt(inv.consonants, draw())]?.g ?? "";
  s += BY_ID[pickAt(inv.vowels, draw())]?.g ?? "a";
  return s;
}

// genStem: 2-3 syllables, deterministic off (seed, branchId), title-cased. The final
// syllable prefers a sonorant coda so the stem reads as a plausible name rather than a
// bare CV word.
export function genStem(inv: Inventory, seed: number, branchId: number): string {
  const draw = cursor(seed, branchId);
  const n = draw() < 0.5 ? 2 : 3;
  let w = "";
  for (let i = 0; i < n; i++) w += genSyllable(inv, draw);
  const sonorants = inv.consonants.filter(isSonorant);
  if (sonorants.length && draw() < 0.6) w += BY_ID[pickAt(sonorants, draw())]?.g ?? "";
  return w.charAt(0).toUpperCase() + w.slice(1);
}

// --- proto-blend morphology -------------------------------------------------

// Strip a trailing vowel or common name suffix (-ic/-an/-or/-en) off the leading
// element and join with a linking -o-; keep the trailing element as-is (its existing
// -ic/-an ending reads adjectival already). Regular by design — won't reproduce every
// real-world irregularity (Sino-, Indo-) but stays deterministic and always well-formed.
const NAME_SUFFIX = /(ic|an|or|en)$/i;
function blendHead(stem: string): string {
  const core = stem.replace(NAME_SUFFIX, "").replace(/[aeiouAEIOU]$/, "");
  return core || stem;
}
export function blendStems(a: string, b: string): string {
  return `Proto-${blendHead(a)}o-${b}`;
}

// --- perspective-collapse (render-time era naming) --------------------------

// 1ENG.22: a scalar-only projection of an Anchor, carrying its true index back into
// `branch.anchors` (anchorIndex) so a stage built from marks can still recover its
// frozen lexicon on demand. The collapse (below) never needs to read `Anchor.lex` at
// all — reading it reactively from game.svelte.ts is what turned a few MB of retained
// snapshots into hundreds of MB of Svelte proxy overhead (measured; see 1ENG.22 spike
// notes). Keeping the policy scalar-only is what makes eraStages safe to call every
// render without touching lexicon data.
export interface AnchorMark { historyIndex: number; driftFromPrev: number; anchorIndex: number }
export interface EraBucket { marks: AnchorMark[]; label: "old" | "middle" | "late" | "tip" }
export type CollapsePolicy = (marks: AnchorMark[]) => EraBucket[];

// Historically-different-language cutoff, shared with the Proto-qualification check —
// same order of magnitude as the app's existing "different language" framing.
export const STAGE_CUT = 0.5;
// Fine-grained rename cutoff: an anchor freezes whenever drift since the last anchor
// (or birth) crosses this. Frequent by design — the collapse policy, not the freeze
// rate, is what keeps the *displayed* names legible. Measured (2geo-10 spike census,
// single-branch autonomous play): ~48 anchors at 150 turns (mean gap ~3.1 turns), ~84
// at 300 — roughly 5x this comment's original "~6-10+ over a long game" estimate.
export const RENAME_CUT = 0.85;

// Event-density collapse: prefer high-driftFromPrev anchors as bucket boundaries (a
// sharp ancient shift stays resolved, cf. Middle Egyptian being finely named despite
// being millennia old) rather than pure distance-from-tip. Logarithmic distance is only
// the fallback spacing when drift is roughly uniform. Anchors are oldest-first; the
// living tip is not itself an anchor (it's the branch's current lex).
//
// 1ENG.22: boundary membership here is deliberately NOT pruned or cached across calls —
// `keep = ceil(log2(n+1))` and each anchor's rank-by-driftFromPrev both grow as anchors
// accrue, and the forced newest-index boundary moves every time a new anchor lands.
// Neither side dominates, so which anchors surface as boundaries is non-monotonic: an
// anchor that is not currently a boundary can become one again later (verified: a
// randomised sweep over 2000 synthetic anchor chains found anchors resurfacing as
// boundaries well after dropping out, and the union of ever-surfaced indices over a
// full run is 100% of anchors). That rules out "drop the lex of anchors that aren't
// boundaries right now" as a safe pruning strategy — see AnchorMark's comment for what
// actually fixes the heap cost instead.
export const eventDensityPolicy: CollapsePolicy = (marks) => {
  if (!marks.length) return [];
  // Rank anchors by driftFromPrev (discontinuity strength) descending; keep the top
  // log2(n)+1 as bucket boundaries, always keeping the oldest and newest so the chain
  // still spans from root to tip.
  const keep = Math.max(1, Math.ceil(Math.log2(marks.length + 1)));
  const ranked = marks.map((a, i) => ({ a, i })).sort((x, y) => y.a.driftFromPrev - x.a.driftFromPrev);
  const boundaryIdx = new Set(ranked.slice(0, keep).map((r) => r.i));
  boundaryIdx.add(0); boundaryIdx.add(marks.length - 1);
  const cuts = [...boundaryIdx].sort((x, y) => x - y);

  const buckets: EraBucket[] = [];
  cuts.forEach((cut, bi) => {
    const start = bi === 0 ? 0 : cuts[bi - 1] + 1;
    buckets.push({ marks: marks.slice(start, cut + 1), label: "old" }); // label assigned below
  });
  // relabel by position: oldest bucket -> old, newest -> late (liveness decided by caller), between -> middle
  buckets.forEach((b, i) => { b.label = i === 0 ? "old" : i === buckets.length - 1 ? "late" : "middle"; });
  return buckets;
};

export interface EraName { text: string; bucket: EraBucket["label"] | "tip" }
// 2NAR.x family-tree fix: eraLabels' entries widened with the historyIndex range each
// stage "owns" on the branch's own history timeline — the range a fracturing child's
// splitIndex is compared against to find which specific era-node it forked from
// (generation.ts sets both Branch.splitIndex and Anchor.historyIndex from the same
// `parent.history.length` counter, so the two are directly comparable). loIndex is
// inclusive, hiIndex exclusive; the terminal stage (living tip, or a dead lineage's
// Late stage) owns everything after its lower bound, hence +Infinity.
//
// 1ENG.22 era-viewer: anchorIndex is the true index into `branch.anchors` of this
// stage's frozen snapshot — null for the living tip, which has no anchor (it's the
// branch's current lex). This is the one link a UI needs to recover the era's lexicon
// on demand; nothing else here ever reads Anchor.lex.
export interface EraStage extends EraName { loIndex: number; hiIndex: number; anchorIndex: number | null }

// Tree context needed to resolve Proto-vs-Old and Late-vs-Modern, both of which depend
// on facts the branch itself doesn't carry (whether it still has a living descendant,
// whether it's the shared root of multiple now-mutually-unintelligible lineages).
export interface EraContext {
  alive: boolean; // does this lineage have a living tip (itself or a descendant)?
  protoBlend: string | null; // pre-resolved "Proto-Xo-Y" if this node qualifies (see protoBlendFor)
}

// eraStages: the perspective-collapse entrypoint. Returns the ordered display stages for
// a branch's history, oldest -> newest, ending with the live tip's stage (bare stem) if
// `ctx.alive`, each carrying the historyIndex range it owns. Pure function of (branch,
// ctx, policy) — safe to call every render. eraLabels (below) is a thin projection of
// this for callers that only need the text/bucket, not the attachment ranges.
export function eraStages(branch: Branch, ctx: EraContext, policy: CollapsePolicy = eventDensityPolicy): EraStage[] {
  // A branch is always born with one implicit birth anchor (generation.ts/world.ts).
  // A living lineage that hasn't renamed SINCE birth has no named stages yet — it's
  // still just itself, shown bare — so the birth-only anchor is not display-worthy on
  // its own. A dead lineage with only a birth anchor (fractured, then died out before
  // ever renaming) still surfaces it as its one and only named stage.
  //
  // sliceOffset tracks how far `named`'s indices are shifted from `branch.anchors`'
  // real indices (1 when alive, since slice(1) drops the birth anchor; 0 when dead) —
  // this is the only place that offset is known, so anchorIndex below is computed here
  // rather than trying to recover it from a bucket after the fact.
  const sliceOffset = ctx.alive ? 1 : 0;
  const named = branch.anchors.slice(sliceOffset);
  const marks: AnchorMark[] = named.map((a, i) => ({ historyIndex: a.historyIndex, driftFromPrev: a.driftFromPrev, anchorIndex: i + sliceOffset }));
  const buckets = policy(marks);
  // "frequent renames" (1ENG.10 pace decision) means a lineage often accrues several
  // middle buckets — a plain "Middle X" repeated verbatim for each is indistinguishable
  // in the full chronology, so disambiguate with an ordinal once there's more than one.
  // A bucket is "middle" unless it's the oldest (Old/Proto) or, for a dead lineage, the
  // newest (Late) — a living lineage's newest named bucket is still "middle" (the tip
  // itself, appended after this map, is what carries "Modern"/bare).
  const middleCount = buckets.reduce((n, b, i) => n + (i > 0 && !(b.label === "late" && !ctx.alive) ? 1 : 0), 0);
  let middleSeen = 0;
  // An anchor freezing at historyIndex H snapshots the era that ENDED at H, so a
  // bucket owns history from the previous bucket's last anchor up to (exclusive) its
  // own last anchor — track the running upper bound so consecutive stages partition
  // the index line contiguously and exhaustively (attachStageIndex relies on this).
  let prevHi = 0;
  const out: EraStage[] = buckets.map((b, i) => {
    const isOldest = i === 0;
    // The birth anchor is sliced off `named` above (for a living branch), so the
    // oldest bucket's range must still start at 0 so a child that split before any
    // anchor had even frozen falls inside the "Old" stage rather than under-shooting it.
    const loIndex = isOldest ? 0 : prevHi;
    // A living branch's last bucket hands over to the tip stage (appended below) at
    // its own last-anchor historyIndex; only a dead lineage's last bucket (no tip
    // follows) owns everything onward, hence +Infinity.
    const isLastBucket = i === buckets.length - 1;
    const lastMark = b.marks[b.marks.length - 1];
    const hiIndex = isLastBucket && !ctx.alive ? Infinity : lastMark.historyIndex;
    const anchorIndex = lastMark.anchorIndex;
    prevHi = hiIndex;
    if (isOldest && ctx.protoBlend) return { text: ctx.protoBlend, bucket: "old", loIndex, hiIndex, anchorIndex };
    if (isOldest) return { text: `Old ${branch.name}`, bucket: "old", loIndex, hiIndex, anchorIndex };
    if (b.label === "late" && !ctx.alive) return { text: `Late ${branch.name}`, bucket: "late", loIndex, hiIndex, anchorIndex };
    middleSeen++;
    const ordinal = middleCount > 1 ? ` (${middleSeen}/${middleCount})` : "";
    return { text: `Middle ${branch.name}${ordinal}`, bucket: "middle", loIndex, hiIndex, anchorIndex };
  });
  if (ctx.alive) {
    const loIndex = out.length ? out[out.length - 1].hiIndex : 0;
    out.push({ text: branch.name, bucket: "tip", loIndex, hiIndex: Infinity, anchorIndex: null });
  }
  return out;
}

export function eraLabels(branch: Branch, ctx: EraContext, policy: CollapsePolicy = eventDensityPolicy): EraName[] {
  return eraStages(branch, ctx, policy).map((s) => ({ text: s.text, bucket: s.bucket }));
}

// Convenience: the single name a UI node should show for a branch RIGHT NOW (its
// newest resolved bucket) — FamilyTree/IntelMatrix render one label per node, not the
// whole chronology (HistoryList already shows the turn-by-turn detail).
export function displayName(branch: Branch, ctx: EraContext, policy: CollapsePolicy = eventDensityPolicy): string {
  const labels = eraLabels(branch, ctx, policy);
  return labels[labels.length - 1]?.text ?? branch.name;
}

// --- Proto qualification + pole selection (E3/E4) ---------------------------

// A dead node qualifies for a Proto-blend name when it has >=2 descendant leaves that
// have themselves diverged past STAGE_CUT from each other (i.e. they're genuinely
// separate languages now, not just dialects of the same still-continuing lineage).
export function protoBlendFor(descendantLeaves: Branch[]): string | null {
  if (descendantLeaves.length < 2) return null;
  let bestPair: [Branch, Branch] | null = null, worstIntel = 1;
  for (let i = 0; i < descendantLeaves.length; i++) {
    for (let j = i + 1; j < descendantLeaves.length; j++) {
      const a = descendantLeaves[i], b = descendantLeaves[j];
      const intel = intelligibility(a.lex, b.lex);
      if (intel >= STAGE_CUT) continue; // not yet genuinely separate languages
      const size = (x: Branch) => x.territory.length;
      const worse = intel < worstIntel || (intel === worstIntel && bestPair && size(a) + size(b) > size(bestPair[0]) + size(bestPair[1]));
      if (worse) { worstIntel = intel; bestPair = [a, b]; }
    }
  }
  return bestPair ? blendStems(bestPair[0].name, bestPair[1].name) : null;
}

// 1ENG.22: eraContexts computes every branch's EraContext in a single whole-tree pass,
// replacing the three near-identical per-branch derivations that used to live in
// game.svelte.ts (displayNames/eraGraph/selEra), each of which called `leavesOf(branches)`
// and `descendsFrom` inside its own per-branch loop. The expensive part is protoBlendFor's
// O(leaves^2) intelligibility sweep, run once per DEAD branch — hoisting `leavesOf` out
// of that loop and replacing the `leavesOf().filter(descendsFrom)` scan (itself O(leaves)
// per branch, so O(branches * leaves) overall) with one upward parentId walk per leaf
// (each leaf pushes itself onto every ancestor's descendant list, O(leaves * depth)
// total) is what the measured ~2x comes from. protoBlendFor itself is reused unchanged —
// same tie-break, same export, same tests — so this is purely a fan-in of its inputs.
export function eraContexts(branches: Record<number, Branch>): Record<number, EraContext> {
  const leaves = leavesOf(branches);
  // descendant leaf-lists per branch id, built bottom-up so a leaf's own walk populates
  // every ancestor in one pass rather than each ancestor re-scanning every leaf.
  const descendantLeaves: Record<number, Branch[]> = {};
  Object.keys(branches).forEach((id) => (descendantLeaves[Number(id)] = []));
  leaves.forEach((leaf) => {
    let cur: Branch | undefined = leaf;
    while (cur) {
      descendantLeaves[cur.id].push(leaf);
      cur = cur.parentId === null ? undefined : branches[cur.parentId];
    }
  });
  const out: Record<number, EraContext> = {};
  Object.values(branches).forEach((b) => {
    const alive = isLeaf(branches, b.id);
    // protoBlendFor's own tie-break (worst intelligibility, then larger combined
    // territory) is preserved as long as candidates are considered in a stable order —
    // iterating in `leaves` order here matches what the old per-branch
    // `leavesOf(branches).filter(descendsFrom)` produced, since filter preserves the
    // source array's order.
    const protoBlend = alive ? null : protoBlendFor(descendantLeaves[b.id]);
    out[b.id] = { alive, protoBlend };
  });
  return out;
}
