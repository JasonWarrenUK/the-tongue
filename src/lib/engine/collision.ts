import { CONCEPT_CLASS, SUBSTRATE_ORDER, salienceRetention } from "./lexicon";
import { formOf, BY_ID } from "./phonology";
import DISTANCE from "./semantic-distance.json";
import type { CompoundOrder, Lexicon, Terrain } from "./types";

// 2LEX.2 — homophone-collision resolution (2lex-1 spike). Autonomous drift creates
// collisions constantly (98.1% of branch-turns carry one); most self-heal, but a 13%
// chronic tail never does. This module is selective twice over: severity (this class
// gate + graded relatedness) decides which collisions matter, and a per-branch grace
// period (generation.ts step 1.5) decides which persistent ones get repaired.
// No RNG anywhere here — every choice is a deterministic argmin/argmax over already-
// seeded state, so seeded replay is preserved by construction.

// semantic-distance.json is generated (ConceptNet Numberbatch cosine relatedness over
// the 48-concept substrate's within-class pairs) — never hand-edit; regenerate only via
// docs/spikes/assets/2lex-1-semantic-distance-gen.ts. Its inferred literal type rejects
// arbitrary string indexing, hence the widening below.
const TABLE: Record<string, number> = DISTANCE;

export const COLLISION_TURNS = 6;   // base grace period; census-tuned (spike §3.2)
export const SEVERITY_CUT = 0.2;    // relatedness floor; below it a pair is tolerated forever (spike §3.1)

// Relatedness score for a pair, order-independent; 0 for cross-class, unknown, or
// self pairs (never in the table, so the class gate is redundant-but-cheap here too).
export function pairScore(a: string, b: string): number {
  const [x, y] = a < b ? [a, b] : [b, a];
  return TABLE[`${x}|${y}`] ?? 0;
}

// Distance-scaled grace period: closer pairs repair sooner. Floor of 2 keeps even the
// most catastrophic pair from repairing the turn it lands (spike §3.2).
export function pairThreshold(a: string, b: string): number {
  return Math.max(2, Math.round(COLLISION_TURNS * (1 - pairScore(a, b))));
}

// Colliding same-class pairs scoring >= SEVERITY_CUT, each sorted, list sorted (stable
// regardless of `lex`'s own ordering, since generation.ts/game.svelte.ts key repair
// state off this list). Reuses formOf's grouping so severity tracks exactly the same
// "same form" notion the existing UI homophone dots use.
export function severePairs(lex: Lexicon): [string, string][] {
  const byForm: Record<string, string[]> = {};
  lex.forEach((e) => { const f = formOf(e.word); (byForm[f] = byForm[f] || []).push(e.concept); });
  const out: [string, string][] = [];
  Object.values(byForm).forEach((group) => {
    for (let i = 0; i < group.length; i++) for (let j = i + 1; j < group.length; j++) {
      const [a, b] = group[i] < group[j] ? [group[i], group[j]] : [group[j], group[i]];
      // tier 1: the class gate — cross-category minimal pairs are disambiguated by
      // syntax and tolerated indefinitely (Wedel et al. 2013, spike §3.1).
      if (CONCEPT_CLASS[a] === undefined || CONCEPT_CLASS[a] !== CONCEPT_CLASS[b]) continue;
      if (pairScore(a, b) < SEVERITY_CUT) continue; // tier 2: graded relatedness
      out.push([a, b]);
    }
  });
  return out.sort((p, q) => p[0].localeCompare(q[0]) || p[1].localeCompare(q[1]));
}

// Which of the pair yields (is compounded): salience is the engine's Zipf-frequency
// proxy (Wedel: similar-frequency pairs drive avoidance hardest) — higher retention
// under `terrain` keeps the short form. Tie (both zero, or equal): the lower substrate
// index keeps, so the higher index yields (spike §3.3).
export function yieldingConcept(pair: [string, string], terrain: Terrain): string {
  const [a, b] = pair;
  const ra = salienceRetention(a, terrain), rb = salienceRetention(b, terrain);
  if (ra !== rb) return ra > rb ? b : a;
  return SUBSTRATE_ORDER.indexOf(a) < SUBSTRATE_ORDER.indexOf(b) ? b : a;
}

// Ranked modifier candidates: same-class concepts by relatedness to `yielding` (the
// distance table again), nearest first, excluding both pair members; ties by lower
// substrate index. The catfish/dogfish pattern stated properly: real disambiguating
// modifiers are semantic neighbours of the head (spike §3.3). Enumerates the full
// substrate order, not just CONCEPTS' 32 nouns, so the verb/pronoun/adjective classes
// (inert until 1ENG.19 grows CONCEPTS) still yield correct candidates once reachable.
export function modifierCandidates(yielding: string, pair: [string, string]): string[] {
  const cls = CONCEPT_CLASS[yielding];
  return SUBSTRATE_ORDER
    .filter((c) => CONCEPT_CLASS[c] === cls && c !== pair[0] && c !== pair[1])
    .sort((x, y) => pairScore(yielding, y) - pairScore(yielding, x) || SUBSTRATE_ORDER.indexOf(x) - SUBSTRATE_ORDER.indexOf(y));
}

// Clip a modifier to its onset-plus-first-vowel prefix (<=3 segs under the widest
// template, (C)(C)V(C)); a diphthong/long vowel is one Phone so it doesn't inflate the
// count. Capped explicitly rather than merely assumed, since a renewal rule (epenthesis)
// could in principle stack extra initial consonants. Exported for morphology.ts
// (1ENG.20): the spike names this exact rule ("the same first-vowel-prefix rule 2LEX.1
// uses for compound modifiers") for minting affixes from their pathway source words —
// one clipping concept across the engine, not a second implementation.
export function clip(modifier: string[]): string[] {
  const v = modifier.findIndex((id) => BY_ID[id].type === "V");
  return v < 0 ? modifier.slice(0, 3) : modifier.slice(0, Math.min(v + 1, 3));
}

// Join modifier (clipped) and head per the world's compound-headedness trait. The head
// is untouched, so the result always keeps its vowels (never a vowelless word). May
// transiently exceed MAX_LEN (worst case 3+12=15 segs) — deliberate and safe: the
// applyRuleToWord growth ceiling (phonology.ts) only blocks growth, so erosion rules
// still grind an oversized compound down (spike §3.3). Note stepToward's hard MAX_LEN
// floor means a borrow can't lengthen an already-oversized word further — benign.
export function compoundWord(modifier: string[], head: string[], order: CompoundOrder): string[] {
  const m = clip(modifier);
  return order === "modFirst" ? [...m, ...head] : [...head, ...m];
}

// Resolve one autonomous repair for a branch's severe pair: yielding concept + new
// word for it. Pure; no RNG. `lender` is the 2GEO.5-gated borrowing arm (spike §3.5):
// if the caller (generation.ts, which already holds edges/owner/routes) found a
// passable neighbour whose form for the yielding concept differs from the colliding
// form, pass it here and it is adopted whole (the Gilliéron replacement pattern)
// instead of compounding. Compounding is the fallback whenever no such neighbour
// exists (isolated branches, lone survivors, all neighbours sharing the eroded form).
export function resolveCollision(
  pair: [string, string], lex: Lexicon, terrain: Terrain, order: CompoundOrder,
  lender?: { name: string; word: string[] } | null,
): { concept: string; word: string[]; modifier: string } {
  const concept = yieldingConcept(pair, terrain);
  const byConcept = Object.fromEntries(lex.map((e) => [e.concept, e.word]));
  const head = byConcept[concept];
  if (lender && formOf(lender.word) !== formOf(head)) {
    return { concept, word: [...lender.word], modifier: lender.name };
  }
  // every other form in the lexicon, to detect a repair that merely relocates the
  // clash onto a third concept (spike §3.3's repair-made-collision guard).
  const taken = new Set(lex.filter((e) => e.concept !== concept).map((e) => formOf(e.word)));
  const ranked = modifierCandidates(concept, pair).filter((c) => byConcept[c]);
  let fallback: { word: string[]; modifier: string } | null = null;
  for (const modifier of ranked) {
    const word = compoundWord(byConcept[modifier], head, order);
    if (!fallback) fallback = { word, modifier };
    if (!taken.has(formOf(word))) return { concept, word, modifier };
  }
  // every candidate collides: take the top-ranked one anyway. Bounded, deterministic.
  return { concept, word: fallback!.word, modifier: fallback!.modifier };
}
