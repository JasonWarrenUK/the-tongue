import { hashRand } from "./rng";
import { intelligibility } from "./intelligibility";
import { BY_ID } from "./phonology";
import type { Anchor, Branch, Inventory, Lexicon } from "./types";

// 1ENG.10 naming subsystem. Three independent pieces:
//   - genStem: phonotactic branch-name generation (replaces NAME_POOL)
//   - blendStems: phonaesthetic Proto-<blend> morphology
//   - eraLabels: pure, render-time perspective-collapse over a branch's anchor chain
// Nothing here mutates state or is called from resolveGeneration except to freeze an
// Anchor; all display naming is computed on demand from Branch data, never stored.

// --- stem generation -------------------------------------------------------

// A branch has no stored Inventory of its own (only the world does) — derive one from
// its current lexicon so a fresh sibling's name is drawn from the sounds it actually
// speaks, including whatever renewal/erosion structure it has accrued.
export function inventoryOf(lex: Lexicon): Inventory {
  const ids = new Set<string>();
  lex.forEach((e) => e.word.forEach((id) => ids.add(id)));
  const vowels: string[] = [], consonants: string[] = [];
  ids.forEach((id) => {
    const p = BY_ID[id]; if (!p) return;
    (p.type === "V" ? vowels : consonants).push(id);
  });
  // backstop: an empty lexicon (null-guard fracture, 1ENG.9 §d) yields an empty
  // inventory — fall back to a minimal CV pair so genStem never starves.
  return { vowels: vowels.length ? vowels : ["a"], consonants: consonants.length ? consonants : ["t"] };
}

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

export interface EraBucket { anchors: Anchor[]; label: "old" | "middle" | "late" | "tip" }
export type CollapsePolicy = (anchors: Anchor[]) => EraBucket[];

// Historically-different-language cutoff, shared with the Proto-qualification check —
// same order of magnitude as the app's existing "different language" framing.
export const STAGE_CUT = 0.5;
// Fine-grained rename cutoff: an anchor freezes whenever drift since the last anchor
// (or birth) crosses this. Frequent by design (~6-10+ anchors over a long game) — the
// collapse policy, not the freeze rate, is what keeps the *displayed* names legible.
export const RENAME_CUT = 0.85;

// Event-density collapse: prefer high-driftFromPrev anchors as bucket boundaries (a
// sharp ancient shift stays resolved, cf. Middle Egyptian being finely named despite
// being millennia old) rather than pure distance-from-tip. Logarithmic distance is only
// the fallback spacing when drift is roughly uniform. Anchors are oldest-first; the
// living tip is not itself an anchor (it's the branch's current lex).
export const eventDensityPolicy: CollapsePolicy = (anchors) => {
  if (!anchors.length) return [];
  // Rank anchors by driftFromPrev (discontinuity strength) descending; keep the top
  // log2(n)+1 as bucket boundaries, always keeping the oldest and newest so the chain
  // still spans from root to tip.
  const keep = Math.max(1, Math.ceil(Math.log2(anchors.length + 1)));
  const ranked = anchors.map((a, i) => ({ a, i })).sort((x, y) => y.a.driftFromPrev - x.a.driftFromPrev);
  const boundaryIdx = new Set(ranked.slice(0, keep).map((r) => r.i));
  boundaryIdx.add(0); boundaryIdx.add(anchors.length - 1);
  const cuts = [...boundaryIdx].sort((x, y) => x - y);

  const buckets: EraBucket[] = [];
  cuts.forEach((cut, bi) => {
    const start = bi === 0 ? 0 : cuts[bi - 1] + 1;
    buckets.push({ anchors: anchors.slice(start, cut + 1), label: "old" }); // label assigned below
  });
  // relabel by position: oldest bucket -> old, newest -> late (liveness decided by caller), between -> middle
  buckets.forEach((b, i) => { b.label = i === 0 ? "old" : i === buckets.length - 1 ? "late" : "middle"; });
  return buckets;
};

export interface EraName { text: string; bucket: EraBucket["label"] | "tip" }

// Tree context needed to resolve Proto-vs-Old and Late-vs-Modern, both of which depend
// on facts the branch itself doesn't carry (whether it still has a living descendant,
// whether it's the shared root of multiple now-mutually-unintelligible lineages).
export interface EraContext {
  alive: boolean; // does this lineage have a living tip (itself or a descendant)?
  protoBlend: string | null; // pre-resolved "Proto-Xo-Y" if this node qualifies (see protoBlendFor)
}

// eraLabels: the perspective-collapse entrypoint. Returns the ordered display names for
// a branch's history, oldest -> newest, ending with the live tip's name (bare stem) if
// `ctx.alive`. Pure function of (branch, ctx, policy) — safe to call every render.
export function eraLabels(branch: Branch, ctx: EraContext, policy: CollapsePolicy = eventDensityPolicy): EraName[] {
  // A branch is always born with one implicit birth anchor (generation.ts/world.ts).
  // A living lineage that hasn't renamed SINCE birth has no named stages yet — it's
  // still just itself, shown bare — so the birth-only anchor is not display-worthy on
  // its own. A dead lineage with only a birth anchor (fractured, then died out before
  // ever renaming) still surfaces it as its one and only named stage.
  const named = ctx.alive ? branch.anchors.slice(1) : branch.anchors;
  const buckets = policy(named);
  // "frequent renames" (1ENG.10 pace decision) means a lineage often accrues several
  // middle buckets — a plain "Middle X" repeated verbatim for each is indistinguishable
  // in the full chronology, so disambiguate with an ordinal once there's more than one.
  // A bucket is "middle" unless it's the oldest (Old/Proto) or, for a dead lineage, the
  // newest (Late) — a living lineage's newest named bucket is still "middle" (the tip
  // itself, appended after this map, is what carries "Modern"/bare).
  const middleCount = buckets.reduce((n, b, i) => n + (i > 0 && !(b.label === "late" && !ctx.alive) ? 1 : 0), 0);
  let middleSeen = 0;
  const out: EraName[] = buckets.map((b, i) => {
    const isOldest = i === 0;
    if (isOldest && ctx.protoBlend) return { text: ctx.protoBlend, bucket: "old" };
    if (isOldest) return { text: `Old ${branch.name}`, bucket: "old" };
    if (b.label === "late" && !ctx.alive) return { text: `Late ${branch.name}`, bucket: "late" };
    middleSeen++;
    const ordinal = middleCount > 1 ? ` (${middleSeen}/${middleCount})` : "";
    return { text: `Middle ${branch.name}${ordinal}`, bucket: "middle" };
  });
  if (ctx.alive) out.push({ text: branch.name, bucket: "tip" });
  return out;
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
