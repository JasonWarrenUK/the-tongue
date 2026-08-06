import { hashRand } from "./rng";
import { CONCEPT_CLASS } from "./lexicon";
import { BY_ID } from "./phonology";
import type { ConceptClass } from "./lexicon";
import type { FrameWeights, Lexicon, Rule, WordOrder } from "./types";

// 1ENG.19 — the grammar substrate: four phrase frames, per-branch word order and
// frame-usage weights, and the position statistics sound change is conditioned on.
// See 1eng-14 spike §3.2 (frames), §3.4 (profiles), §4.1-4.3 (the mechanic). Pure
// throughout except walkFrameWeights' one seeded draw; every statistic is recomputed
// from stored parameters, never cached, so a branch that flips order (generation.ts
// fracture-birth reanalysis) gets its whole erosion physiognomy recomputed for free.
export type { FrameWeights } from "./types";

export const SYNTAX_STRENGTH = 0.7;       // tuning constant, deliberately the same shape as BIAS_STRENGTH
export const FRAME_WALK = 0.02;           // per-turn step of the seeded frame-weight walk
export const ORDER_INNOVATE_RATE = 0.08;  // stage A: per-birth chance of a one-axis reanalysis flip
export const ORDER_TURNS = 6;             // stage B (1ENG.21): sustained turns before an order event
export const ORDER_CONTACT_CUT = 0.6;     // stage B (1ENG.21): pairContact floor for the contact driver

// §3.2 names a floor without a value ("clamped to a floor so no frame never
// vanishes"). 0.1 against a genesis weight of 1.0 takes ~45 consecutive negative
// walk steps to reach (FRAME_WALK = 0.02), so it is a genuine backstop, not a
// routinely-hit clamp — first-pass tuning, same ledger treatment as SYNTAX_STRENGTH.
export const FRAME_FLOOR = 0.1;

// 1ENG.21 (1eng-14 spike §5, decision 5) — the six logical S/O/V orders, though
// WordOrder.basic only ever holds three (SOV/SVO/VSO). Stored/computed over all six so
// swapDistance means the real permutohedron rather than an ad hoc three-value line, and
// a future task admitting OSV/OVS/VOS to WordOrder needs no change here.
export type BasicOrder = "SOV" | "SVO" | "VSO" | "VOS" | "OSV" | "OVS";

// Swap distance: the minimum number of adjacent-constituent transpositions needed to
// turn one S/O/V order into another (Ferrer-i-Cancho et al., "Swap distance
// minimization shapes the order of subject, object and verb in languages of the world",
// arXiv 2604.26726 — the established metric for this exact question). Computed via BFS
// over the permutohedron (adjacent orders = one transposition apart) rather than
// hardcoded, so the six-order table is derived, not guessed, and needs no maintenance
// if WordOrder ever grows to admit the other three. Pinned as a golden against the
// paper's own stated distances: from SOV, 1 to SVO/OSV, 2 to VSO/OVS, 3 to VOS.
function adjacentOrders(o: BasicOrder): BasicOrder[] {
  const chars = o.split("");
  const out: BasicOrder[] = [];
  for (let i = 0; i < chars.length - 1; i++) {
    const swapped = [...chars];
    [swapped[i], swapped[i + 1]] = [swapped[i + 1], swapped[i]];
    out.push(swapped.join("") as BasicOrder);
  }
  return out;
}
export function swapDistance(a: BasicOrder, b: BasicOrder): number {
  if (a === b) return 0;
  const dist = new Map<BasicOrder, number>([[a, 0]]);
  const queue: BasicOrder[] = [a];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    const d = dist.get(cur)!;
    for (const next of adjacentOrders(cur)) {
      if (dist.has(next)) continue;
      dist.set(next, d + 1);
      if (next === b) return d + 1;
      queue.push(next);
    }
  }
  return dist.get(b)!; // the permutohedron is fully connected: any permutation is reachable by adjacent swaps
}
// One swap along a shortest path from `from` toward `to` — the contact driver's "one
// step toward the neighbour's order" (spike §5), disambiguated per decision 5. Among
// our three admitted values (SOV/SVO/VSO) the swap graph is the line SOV-SVO-VSO, which
// independently matches the diachronic finding that SOV drift passes through SVO before
// (if ever) reaching VSO — so `to` unreachable from `from` in one step lands on SVO.
export function stepOrderToward(from: BasicOrder, to: BasicOrder): BasicOrder {
  if (from === to) return from;
  const candidates = adjacentOrders(from).filter((o) => swapDistance(o, to) < swapDistance(from, to));
  return candidates[0] ?? from;
}
// generation.ts's contact driver only ever holds WordOrder["basic"] values (the three
// this engine actually admits), not the full six-order BasicOrder swapDistance is
// computed over. Among just {SOV,SVO,VSO} the swap graph is the closed line
// SOV-SVO-VSO (each is one swap from the other two's midpoint), so a step from one
// provably lands back within the three — this narrows that guarantee into the type
// system rather than asserting it at the call site. Throws if it somehow doesn't
// (a change to ALL_ORDERS's graph shape, or a caller passing a value outside the
// three, would be a real bug worth surfacing loudly, not silently coercing).
export function stepWordOrderToward(from: WordOrder["basic"], to: WordOrder["basic"]): WordOrder["basic"] {
  const stepped = stepOrderToward(from, to);
  if (stepped === "SOV" || stepped === "SVO" || stepped === "VSO") return stepped;
  throw new Error(`stepWordOrderToward: stepped outside {SOV,SVO,VSO} to ${stepped} — swap-graph invariant broken`);
}

export interface Slot { class: ConceptClass; role: string }
export interface Frame { id: string; slots: Slot[] }

// F1..F4 per spike §3.2. `slots` is stored in a CANONICAL role order, never a linear
// one — frameOrder is the only thing that linearises, so the frames themselves carry
// no word-order assumption. No recursion, no embedding, no agreement slots (1ENG.20
// adds those to F1/F2); the smallest model where every class has a position.
export const FRAMES: Frame[] = [
  { id: "F1", slots: [{ class: "pronoun", role: "S" }, { class: "noun", role: "O" }, { class: "verb", role: "V" }] },
  { id: "F2", slots: [{ class: "noun", role: "S" }, { class: "verb", role: "V" }] },
  { id: "F3", slots: [{ class: "adjective", role: "Adj" }, { class: "noun", role: "N" }] },
  { id: "F4", slots: [{ class: "noun", role: "G" }, { class: "noun", role: "N" }] },
];
export const EQUAL_WEIGHTS: FrameWeights = [1, 1, 1, 1]; // genesis seed + the §3.4 audit reference

// Clause role sequences for the three basic orders. F2 filters this to the roles it
// has (no O slot), so one table drives both clause frames.
const BASIC_SEQ: Record<WordOrder["basic"], string[]> = {
  SOV: ["S", "O", "V"], SVO: ["S", "V", "O"], VSO: ["V", "S", "O"],
};
// Verb-object order, the Greenbergian axis the genitive derives from (spike §3.2):
// OV -> GN, VO -> NG. SVO and VSO are both VO.
const isOV = (order: WordOrder): boolean => order.basic === "SOV";

// Linearise one frame under a branch's order. proDrop drops F1's subject pronoun
// before ordering (spike §3.5) — the whole slot leaves the frame, so the remaining
// two slots take the initial/final positions between them.
export function frameOrder(frame: Frame, order: WordOrder, proDrop = false): Slot[] {
  const slots = frame.id === "F1" && proDrop ? frame.slots.filter((s) => s.role !== "S") : frame.slots;
  if (frame.id === "F1" || frame.id === "F2") {
    return BASIC_SEQ[order.basic].map((r) => slots.find((s) => s.role === r)).filter((s): s is Slot => !!s);
  }
  const [a, b] = slots;
  if (frame.id === "F3") return order.adj === "AdjN" ? [a, b] : [b, a];
  return isOV(order) ? [a, b] : [b, a]; // F4: G,N canonical -> GN under OV, NG under VO
}

// Every (frame index, linearised slots) pair for one order — the shared spine of
// positionProfile and followerVowelShare, so the two statistics can never disagree
// about what an utterance looks like.
const linearised = (order: WordOrder, proDrop: boolean): { i: number; slots: Slot[] }[] =>
  FRAMES.map((f, i) => ({ i, slots: frameOrder(f, order, proDrop) }));

// Weighted share of `cls`'s slot OCCURRENCES that are utterance-final / -initial
// (spike §3.4). The denominator counts a frame's weight once PER MATCHING SLOT, not
// once per frame — F4 contributes 2*w4 to the noun denominator, which is what gives
// the audit table's "5 noun slots" under equal weights (0.4/0.4 for SOV+AdjN,
// verified by hand against the spike's worked example). A class with no slots at all
// (pronoun under proDrop, or under VSO where F1's S sits medially) reads 0/0: never
// exposed, so never scaled — syntaxMult's clamp turns that into the gentle 0.5x floor.
export function positionProfile(
  cls: ConceptClass, order: WordOrder, weights: FrameWeights, proDrop: boolean,
): { final: number; initial: number } {
  let occ = 0, fin = 0, ini = 0;
  linearised(order, proDrop).forEach(({ i, slots }) =>
    slots.forEach((s, j) => {
      if (s.class !== cls) return;
      occ += weights[i];
      if (j === slots.length - 1) fin += weights[i];
      if (j === 0) ini += weights[i];
    }));
  return occ > 0 ? { final: fin / occ, initial: ini / occ } : { final: 0, initial: 0 };
}

// One seeded step of the frame-usage walk (spike §3.2): each weight moves by up to
// +/-FRAME_WALK and is floored, so no frame ever vanishes and two same-order branches
// diverge continuously in their profiles rather than sharing one of six frozen
// configurations — the critique pass's flatness fix. Not renormalised —
// positionProfile divides by its own total, so only the RATIOS matter, and
// renormalising every turn would add a second floor interaction (a floored weight
// then rescaled can drop back below the floor) for no behavioural gain.
//
// Salt (seed+31, turn*257+43, branchId*577+k): disjoint on the first coordinate from
// every registered family — spread/genStem use bare `seed`, drift seed+7, salience
// seed+13, borrow seed+19, contact seed+23, and (this task) the syntax gate seed+29,
// reanalysis seed+37, morphology's placement/erosion-gate rolls seed+41 (1ENG.20),
// univerbation's fire/class/modifier rolls seed+43 (1ENG.27) — so no (a,b,c) triple
// can coincide regardless of turn, branch or sub-index. 1ENG.24/1ENG.30 claims NO
// hashRand family: every stress draw is either a tail-appended mulberry32 rng() at
// genesis (world.ts, not hashRand) or fully pure (stressPosition/stressMap/
// Rule.stressed). 1ENG.21's contact-alignment driver (generation.ts step 3.75) claims
// seed+47 — the offset this comment previously reserved for exactly this task.
// seed+53 stays free for whichever task claims it next.
export function walkFrameWeights(weights: FrameWeights, seed: number, turn: number, branchId: number): FrameWeights {
  return weights.map((w, k) =>
    Math.max(FRAME_FLOOR, w + (hashRand(seed + 31, turn * 257 + 43, branchId * 577 + k) * 2 - 1) * FRAME_WALK),
  ) as FrameWeights;
}

// Share of a class's CURRENT forms that begin with a vowel. An empty class (a concept
// class with no live entries) reads 0 — no followers known to be vowel-initial means
// no protection, the conservative direction.
function vowelInitialShare(cls: ConceptClass, lex: Lexicon): number {
  const forms = lex.filter((e) => CONCEPT_CLASS[e.concept] === cls && e.word.length > 0);
  if (!forms.length) return 0;
  return forms.filter((e) => BY_ID[e.word[0]]?.type === "V").length / forms.length;
}

// The liaison statistic (spike §4.2). "Which class follows cls" is read off the same
// linearised frames: every non-final slot of class `cls` contributes its frame weight
// to whatever class sits immediately after it. A class that is ALWAYS utterance-final
// (SOV verbs, NAdj adjectives) has no such slot, so the total is 0 and the function
// returns 0 — no follower, no liaison, nothing to protect its codas. The vowel-initial
// share is read from the LIVE lexicon, so it shifts as forms drift: a branch whose
// nouns erode to vowel-initial forms starts protecting the final consonants of
// whatever precedes nouns. Deterministic, recomputed per turn, no stored alternants
// (the doublet model stays deferred — spike §9).
export function followerVowelShare(cls: ConceptClass, order: WordOrder, weights: FrameWeights, lex: Lexicon): number {
  const byFollower: Partial<Record<ConceptClass, number>> = {};
  let total = 0;
  linearised(order, false).forEach(({ i, slots }) =>
    slots.forEach((s, j) => {
      if (s.class !== cls || j === slots.length - 1) return;
      const next = slots[j + 1].class;
      byFollower[next] = (byFollower[next] ?? 0) + weights[i];
      total += weights[i];
    }));
  if (total === 0) return 0;
  return Object.entries(byFollower).reduce(
    (acc, [followerCls, w]) => acc + (w / total) * vowelInitialShare(followerCls as ConceptClass, lex), 0);
}

// Rules whose environment is the word's END (post:bound) and whose effect is to
// DELETE a final consonant — the three the liaison statistic damps (spike §4.2). Kept
// as an explicit id set rather than inferred from rule shape: debucc deletes no
// segment at all (s -> h) yet is the canonical liaison-vulnerable lenition, and
// complengFinal's deletion is disguised as lengthening. Shape inference would get
// both wrong.
const FINAL_C_DELETION = new Set(["finalC", "debucc", "complengFinal"]);
// The two 1ENG.19 initial-position rules (spike §4.3), the engine's first pre:bound
// rules. fortify scales WITH initial share (strong positions strengthen), aphaer
// AGAINST it (initial vowels drop in connected speech, where the word leans on what
// precedes; an utterance-initial word is protected).
const INITIAL_RULES = new Set(["fortify", "aphaer"]);

// A rule is boundary-conditioned iff it declares post:bound. Read off the rule's own
// `post` predicate identity (true for null, false for a real phone) rather than an id
// list, so a future boundary rule is gated automatically and can't silently ship
// unconditioned. BY_ID.a is any real Phone; the second conjunct guards against a
// hypothetical future predicate that (unlike every current one) accepts both.
const isBoundaryRule = (rule: Rule): boolean => rule.post !== null && rule.post(null) && !rule.post(BY_ID.a);

// The branch state this module reads — a structural subset of Branch, so callers can
// pass a whole Branch and previews/fixtures can pass a bare literal. Deliberately not
// `Pick<Branch, ...>`: types.ts already owns WordOrder/FrameWeights and must not
// import back from here.
export interface BranchSyntax { wordOrder: WordOrder; frameWeights: FrameWeights; proDrop: boolean }

// The multiplier of §4.1/§4.2/§4.3 for one word under one rule. Position-blind rules
// return exactly 1 — the gate is a no-op for the rules that fire medially or
// unconditioned, so their behaviour is byte-identical to pre-1ENG.19.
//
//   post:bound                    mult = clamp(1 + S*(final - 0.5)*2, 0.5, 1.5)
//   post:bound + final-C deletion  ...that base, damped toward 1 by the liaison share:
//                                 mult = clamp(1 + S*(final - 0.5)*2*(1 - followerVowelShare), 0.5, 1.5)
//   fortify (pre:bound)            mult = clamp(1 + S*(initial - 0.5)*2, 0.5, 1.5)
//   aphaer  (pre:bound)            mult = clamp(1 - S*(initial - 0.5)*2, 0.5, 1.5)
//
// Liaison damps the TILT, not the finished multiplier: at followerVowelShare = 1 an
// SOV-verb coda deletion falls back to 1.0 (neutral) rather than to 0, keeping the
// same never-zeroing philosophy as biasedMult. Damping the finished multiplier
// instead would push an always-final class BELOW 1 — liaison protecting a coda so
// hard it erodes slower than a medial one, which is not what §4.2 claims. The clamp
// applies once, at the end, to whichever arm ran.
export function syntaxMult(rule: Rule, concept: string, branch: BranchSyntax, lex: Lexicon): number {
  const cls = CONCEPT_CLASS[concept];
  if (!cls) return 1; // unknown concept (a fixture's ad hoc lexicon) — never gated
  const { wordOrder: order, frameWeights: weights, proDrop } = branch;
  const clamp = (m: number) => Math.min(1.5, Math.max(0.5, m));
  if (INITIAL_RULES.has(rule.id)) {
    const { initial } = positionProfile(cls, order, weights, proDrop);
    const tilt = SYNTAX_STRENGTH * (initial - 0.5) * 2;
    return clamp(1 + (rule.id === "fortify" ? tilt : -tilt));
  }
  if (!isBoundaryRule(rule)) return 1;
  const { final } = positionProfile(cls, order, weights, proDrop);
  const damp = FINAL_C_DELETION.has(rule.id) ? 1 - followerVowelShare(cls, order, weights, lex) : 1;
  return clamp(1 + SYNTAX_STRENGTH * (final - 0.5) * 2 * damp);
}
