import { hashRand } from "./rng";
import { pairContact, dominantTerrain } from "./geography";
import { borrowableConcepts, CONCEPTS } from "./lexicon";
import { stepToward } from "./phonology";
import { formSimilarity } from "./intelligibility";
import type { Branch, Edge } from "./types";

// 2GEO.4/2GEO.5 — the one convergent force in an otherwise all-divergent turn loop.
// Directional per ordered pair (A,B) = "A borrows from B": eligibility gates on B's
// terrain salience, selection picks the most-divergent eligible concept, contact
// throttles both whether it fires this turn and whether it copies faithfully or
// adapts. See docs/spikes/2geo-4-neighbour-contact-borrowing.md for the full contract.

export const BORROW_RATE = 0.5;          // per-turn per-pair base probability scalar
export const BORROW_FAITHFUL_CUT = 0.5;  // contact share at/above which loans copy whole

// Resolve one directional borrow A←B for this turn. Returns the concept borrowed and A's
// new form, or null if it does not fire / is a no-op (already identical / no eligible concept).
export function resolveBorrow(
  A: Branch, B: Branch, edges: Edge[], owner: Record<number, number>,
  seed: number, turn: number,
): { concept: string; word: string[]; faithful: boolean } | null {
  const contact = pairContact(A.id, B.id, A.territory, edges, owner);
  // fresh salt triple, distinct from drift (seed+7/turn*131+17/branchId*911+3), spread
  // (seed/turn*7+1/branchId*13+5) and salience (seed+13/turn*151+29/branchId*733+i).
  // A.id*r + B.id is asymmetric so fires(A,B) and fires(B,A) roll independently.
  const roll = hashRand(seed + 19, turn * 181 + 41, A.id * 1009 + B.id);
  if (roll >= BORROW_RATE * contact) return null;

  const lenderTerrain = dominantTerrain(B.id, B.territory, edges, owner);
  const eligible = borrowableConcepts(lenderTerrain);
  if (!eligible.length) return null;

  const mapA = Object.fromEntries(A.lex.map((e) => [e.concept, e.word]));
  const mapB = Object.fromEntries(B.lex.map((e) => [e.concept, e.word]));

  let selected: string | null = null, bestSim = Infinity;
  // iterate in CONCEPTS order so ties resolve to the lowest CONCEPTS index deterministically
  CONCEPTS.forEach((concept) => {
    if (!eligible.includes(concept)) return;
    const wa = mapA[concept], wb = mapB[concept];
    if (!wa || !wb) return;
    const sim = formSimilarity(wa, wb);
    if (sim < bestSim) { bestSim = sim; selected = concept; }
  });
  if (selected === null || bestSim === Infinity) return null;
  if (bestSim === 1) return null; // already identical on every eligible concept — no-op

  const wa = mapA[selected]!, wb = mapB[selected]!;
  const faithful = contact >= BORROW_FAITHFUL_CUT;
  const word = faithful ? [...wb] : stepToward(wa, wb);
  return { concept: selected, word, faithful };
}
