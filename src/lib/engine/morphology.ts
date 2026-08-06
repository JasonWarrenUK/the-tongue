import { hashRand } from "./rng";
import { CONCEPT_CLASS } from "./lexicon";
import { clip } from "./collision";
import { BY_ID, PHONES, applyRuleToAffix } from "./phonology";
import { syntaxMult } from "./syntax";
import type { AffixState, HistoryEntry, Lexicon, ParadigmCell, Phone, Rule, WordOrder, FrameWeights } from "./types";

// 1ENG.20 — the inflectional paradigm model (1eng-15 spike, amended: the original
// segment-shedding clock was replaced by pure rule-based affix drift). A branch's
// grammar is four marked cells (past tense; 1sg/2/1pl agreement), each born as a clip
// of its pathway source word's current form, eroding under the SAME drift rule the
// branch's lexicon receives each turn (tickParadigm), dying when eroded to nothing,
// and renewing periphrastically before re-fusing as a fresh affix. nonpast and third
// person are deliberately bare (no cell): the verified concept set has no source
// pathway for either.

// Dead-cell wait before the new periphrastic marker appears (spike §3.3/§3.5). Floor
// of the full cycle is RENEWAL_TURNS + FUSE_TURNS = 10 turns plus however long erosion
// itself takes; 2SIM.1 measures the rest. First-pass tuning, same ledger treatment as
// SYNTAX_STRENGTH.
export const RENEWAL_TURNS = 6;
// Periphrastic wait before fusion into a fresh affix (spike §3.3/§3.5).
export const FUSE_TURNS = 4;
// Each marked cell's grammaticalisation source concept (spike §3.2's table). Lowercase
// "i" — the shipped pronoun concept in lexicon.ts's CLASS_MEMBERS.pronoun, not "I".
export const PATHWAY: Record<ParadigmCell, string> = { past: "finish", p1sg: "i", p2: "you", p1pl: "we" };
const CELLS: ParadigmCell[] = ["past", "p1sg", "p2", "p1pl"];

// The branch state this module reads — a structural subset of Branch, mirroring
// syntax.ts's BranchSyntax so a whole Branch and a bare test literal both pass, and
// types.ts never imports back from here.
export interface BranchMorphology { wordOrder: WordOrder; frameWeights: FrameWeights; proDrop: boolean }

// OV branches suffix; VO branches suffix on a seeded weighted roll, prefix otherwise
// (spike §3.3 Placement). Shared by seedParadigm (genesis) and tickParadigm (fusion).
const VO_SUFFIX_ROLL = 0.5; // no attestation either direction pulls this off 0.5 — first-pass tuning
function placeFor(order: WordOrder, seed: number, branchId: number, cellIdx: number, turn: number): boolean {
  if (order.basic === "SOV") return true; // OV: always suffix
  // Salt (seed+41, turn*269+61, branchId*641+cellIdx): first coordinate disjoint from
  // every registered family (spread/genStem: seed, drift: seed+7, salience: seed+13,
  // borrow: seed+19, contact: seed+23, syntax gate: seed+29, frame walk: seed+31,
  // reanalysis: seed+37) — the one new draw the spike specifies (VO placement roll at
  // fusion time; genesis reuses the same function for its own placement decision).
  return hashRand(seed + 41, turn * 269 + 61, branchId * 641 + cellIdx) < VO_SUFFIX_ROLL;
}

// Majority stem-final phone across the branch's verb stems for a suffix, majority
// stem-initial for a prefix (spike §3.4) — the environment applyRuleToAffix's injected
// edge represents. Ties broken by phone-table order (PHONES' declaration order, the
// same tie-break convention `pick`/SUBSTRATE_ORDER use elsewhere). Computed live, never
// cached, so a branch whose verbs erode to vowel-final stems starts exposing its
// suffixes to intervocalic lenition. Returns null when there are no verb stems to read
// (an empty class — fixtures/edge cases) or every stem is empty.
export function affixContext(lex: Lexicon, edge: "suffix" | "prefix"): Phone | null {
  const stems = lex.filter((e) => CONCEPT_CLASS[e.concept] === "verb" && e.word.length > 0);
  if (!stems.length) return null;
  const tally = new Map<string, number>();
  stems.forEach((e) => {
    const id = edge === "suffix" ? e.word[e.word.length - 1] : e.word[0];
    tally.set(id, (tally.get(id) ?? 0) + 1);
  });
  let best: string | null = null, bestCount = -1;
  PHONES.forEach((p) => {
    const count = tally.get(p.id) ?? 0;
    if (count > bestCount) { bestCount = count; best = p.id; }
  });
  return best === null ? null : BY_ID[best as string];
}

// Genesis paradigm (spike §3.3 "Genesis"): every marked cell born affixal, pre-fused as
// if grammaticalisation happened in prehistory — mirrors 1ENG.12 seeding diphthongs and
// long vowels into starting inventories, so erosion has something to chew from turn 0.
// An affix's form is the pathway source's CURRENT (here: genesis) form, clipped by the
// same onset-plus-first-vowel rule 2LEX.1 uses for compound modifiers (collision.ts's
// clip, reused rather than re-implemented). Placement follows the branch's word order
// via placeFor, with cellIdx = CELLS' fixed table order and turn=0 (genesis).
export function seedParadigm(lex: Lexicon, order: WordOrder, seed: number): Record<ParadigmCell, AffixState> {
  const out = {} as Record<ParadigmCell, AffixState>;
  CELLS.forEach((cell, cellIdx) => {
    const source = lex.find((e) => e.concept === PATHWAY[cell]);
    const form = source ? clip(source.word) : [];
    out[cell] = { stage: "affixal", form, suffixed: placeFor(order, seed, 0, cellIdx, 0), clock: 0 };
  });
  return out;
}

// The 1ENG.14 syntax gate composing onto affix erosion (spike §3.4: "a suffix is
// verb-final material, so under SOV its boundary rules run at up to 1.5x"). A suffix
// inherits the VERB class's position profile (it IS verb-final material); a prefix
// inherits it too, since fortify/aphaer are the only pre:bound rules and both are
// position-scaled by INITIAL share, which is also read off the concept's class. "eat"
// stands in for "a verb" — the profile is per-class, not per-concept, so any verb
// concept reads the same profile. One-sided block roll, exactly phonology.ts's
// applyRuleToLex convention (m>1 is a no-op; m<1 becomes a block probability), on its
// own fresh salt (registered in placeFor's comment above) so it can never collide with
// the lexicon's own per-word gate roll (which is keyed on word index, not affix cell).
function gatedErode(
  form: string[], rule: Rule, edge: "suffix" | "prefix", ctx: Phone | null,
  branch: BranchMorphology, lex: Lexicon, seed: number, turn: number, branchId: number, cellIdx: number,
): string[] {
  const m = syntaxMult(rule, "eat", branch, lex);
  if (m < 1) {
    // same first coordinate (seed+41) as placeFor's placement roll, distinguished by a
    // different (b,c) shape (turn*271+67, branchId*643+cellIdx) — the two draws serve
    // different purposes (placement vs. erosion-block) but neither risks colliding with
    // the other or with any other registered family.
    const roll = hashRand(seed + 41, turn * 271 + 67, branchId * 643 + cellIdx);
    if (roll < 1 - m) return form; // blocked this turn
  }
  return applyRuleToAffix(form, rule, edge, ctx);
}

// One branch-turn of paradigm evolution (spike §4): apply `rule` (whichever acted on
// this branch this turn — the drawn drift rule, the player's applied rule, or null when
// neither) to each affixal cell, then stage clocks in fixed order: death -> renewal ->
// fusion, cells in fixed table order. Erosion itself mints no randomness (the rule was
// already drawn); the only new draw is the VO placement roll at fusion. Death/renewal/
// fusion events carry no `drift` flag (2GEO.4/2LEX.1 ruling: grammatical events stay
// out of the sound-change accounting). Pure.
export function tickParadigm(
  paradigm: Record<ParadigmCell, AffixState>, rule: Rule | null, lex: Lexicon, order: WordOrder,
  seed: number, turn: number, branchId: number, branch: BranchMorphology,
): { paradigm: Record<ParadigmCell, AffixState>; events: HistoryEntry[] } {
  const events: HistoryEntry[] = [];
  const next = {} as Record<ParadigmCell, AffixState>;
  const suffixCtx = affixContext(lex, "suffix");
  const prefixCtx = affixContext(lex, "prefix");

  CELLS.forEach((cell, cellIdx) => {
    let st = paradigm[cell];

    // erosion: apply this turn's rule to affixal cells only.
    if (st.stage === "affixal" && rule) {
      const edge: "suffix" | "prefix" = st.suffixed ? "suffix" : "prefix";
      const ctx = st.suffixed ? suffixCtx : prefixCtx;
      const eroded = gatedErode(st.form, rule, edge, ctx, branch, lex, seed, turn, branchId, cellIdx);
      st = { ...st, form: eroded };
    }

    // death: an affixal cell eroded to nothing becomes zero the same tick.
    if (st.stage === "affixal" && st.form.length === 0) {
      st = { stage: "zero", form: [], suffixed: st.suffixed, clock: 0 };
      events.push({ name: `${cell} affix lost`, note: `the ${cell} marker eroded away` });
    } else if (st.stage === "affixal") {
      st = { ...st, clock: 0 }; // affixal cells carry no running clock
    }

    // renewal: a dead cell waits RENEWAL_TURNS, then the pathway source's CURRENT
    // (possibly drifted) clip appears as a periphrastic marker — a drifted source
    // yields a different marker than genesis would have (spike §5's own test list).
    if (st.stage === "zero") {
      const clock = st.clock + 1;
      if (clock >= RENEWAL_TURNS) {
        const source = lex.find((e) => e.concept === PATHWAY[cell]);
        const marker = source ? clip(source.word) : [];
        st = { stage: "periphrastic", form: marker, suffixed: st.suffixed, clock: 0 };
        events.push({ name: `${cell} periphrasis begins`, note: `a new marker for ${cell} emerges` });
      } else {
        st = { ...st, clock };
      }
    }

    // fusion: a periphrastic marker waits FUSE_TURNS, then fuses into a fresh affix —
    // placement re-decided per cell (spike §3.3: "persists until that cell's next
    // cycle"), turn passed through so replay of the same seed+turn+branch+cell always
    // re-derives the same placement roll.
    if (st.stage === "periphrastic") {
      const clock = st.clock + 1;
      if (clock >= FUSE_TURNS) {
        const suffixed = placeFor(order, seed, branchId, cellIdx, turn);
        st = { stage: "affixal", form: st.form, suffixed, clock: 0 };
        events.push({ name: `${cell} fuses`, note: `the word for '${PATHWAY[cell]}' became the mark of the ${cell}` });
      } else {
        st = { ...st, clock };
      }
    }

    next[cell] = st;
  });

  return { paradigm: next, events };
}

// Render one verb stem inflected for a cell (spike §5). cell=null is nonpast/third
// person, the unmarked base -> bare stem. affixal attaches the affix at its placement
// edge; periphrastic returns the marker as a SEPARATE word (the phrase panel renders
// both, side by side — the aller-future moment); an empty-form cell (zero, or an
// affixal cell that hasn't eroded... never actually empty while affixal, but the
// contract asks for it explicitly) renders bare.
export function inflect(
  stem: string[], cell: ParadigmCell | null, paradigm: Record<ParadigmCell, AffixState>,
): { word: string[]; marker: string[] | null } {
  if (cell === null) return { word: stem, marker: null };
  const st = paradigm[cell];
  if (st.stage === "periphrastic") return { word: stem, marker: st.form.length ? st.form : null };
  if (st.stage === "zero" || st.form.length === 0) return { word: stem, marker: null };
  return { word: st.suffixed ? [...stem, ...st.form] : [...st.form, ...stem], marker: null };
}

// Pro-drop licence (spike §3.2, amendment): at least 2 of the 3 agreement cells alive
// (not at zero stage). Revoked the same turn collapse starts (all three at zero
// simultaneously is the state 1ENG.21's rigidification driver reads).
export function licensesProDrop(paradigm: Record<ParadigmCell, AffixState>): boolean {
  const agreement: ParadigmCell[] = ["p1sg", "p2", "p1pl"];
  return agreement.filter((c) => paradigm[c].stage !== "zero").length >= 2;
}

// 1ENG.21 (1eng-14 spike §5, decision 4) — full agreement collapse: all three cells at
// zero, strictly STRONGER than !licensesProDrop (which already goes false at two dead
// cells). This is the state the rigidification driver reads, not the pro-drop licence
// boundary — by the time all three are dead, proDrop has already gone false via
// generation.ts's per-turn licensesProDrop recompute, so rigidification firing here
// never needs its own write to proDrop (see the ordering pin in generation.test.ts).
export function agreementCollapsed(paradigm: Record<ParadigmCell, AffixState>): boolean {
  const agreement: ParadigmCell[] = ["p1sg", "p2", "p1pl"];
  return agreement.every((c) => paradigm[c].stage === "zero");
}
