import { mulberry32 } from "./rng";
import { genInventory, genTemplate, genLexicon } from "./lexicon";
import { genRegions } from "./geography";
import { genStem } from "./naming";
import { seedParadigm, licensesProDrop } from "./morphology";
import type { CompoundOrder, FrameWeights, GameState, Settings, World, WordOrder } from "./types";
import type { StressMode } from "./syllable";

export const DEFAULTS: Settings = { pool: 8, growth: 2, overhead: 3, changeCost: 2, spreadEvery: 3 };

export function makeWorld(seed: number): World {
  const rng = mulberry32(seed);
  const inv = genInventory(rng);
  const tmpl = genTemplate(rng);
  // 1ENG.19: CONCEPTS grew 32 -> 48, so this now draws ~69 more mulberry32 values than
  // before — every downstream draw (geography, compoundOrder, wordOrder) shifts, and
  // every seed's map changes. Unavoidable short of pre-forking the RNG stream; no test
  // asserts world-gen output (freshState/makeWorld are hand-bypassed everywhere), so
  // nothing fails, but a given seed no longer reproduces its pre-1ENG.19 world.
  const lex = genLexicon(rng, inv, tmpl);
  const geo = genRegions(rng);
  // 2LEX.2 (2lex-1 spike §3.4): per-world compound headedness. Drawn LAST so every
  // pre-2LEX.2 seeded world keeps byte-identical inventory/template/lexicon/geography —
  // mulberry32 is a linear stream, so any earlier position would shift every downstream
  // draw and invalidate existing goldens. That protection is already void this release
  // (see the genLexicon note above), but the tail-append convention is kept regardless
  // so the NEXT trait added after this one is still free.
  const compoundOrder: CompoundOrder = rng() < 0.5 ? "modFirst" : "headFirst";
  // 1ENG.19 (spike §3.3): the root's word order — basic reflects the attested skew
  // among order-dominant languages (WALS 81A: SOV/SVO dominate, VSO a distant third),
  // renormalised 45/45/10 over the three orders this engine models; adj is
  // independent (Dryer: no reliable correlation with basic), so 50/50. Two draws, in
  // that order, at the tail of the stream. First-pass tuning, ledgered as such.
  const basicRoll = rng();
  const basic: WordOrder["basic"] = basicRoll < 0.45 ? "SOV" : basicRoll < 0.9 ? "SVO" : "VSO";
  const adj: WordOrder["adj"] = rng() < 0.5 ? "AdjN" : "NAdj";
  // 1ENG.30 (1eng-24 spike §4): stress placement, tail-appended after wordOrder's adj
  // draw — the tail-append convention above is load-bearing; drawing earlier shifts
  // every downstream draw and changes every seed's world. Mode weights follow WALS 14A's
  // attested skew (initial/penultimate dominate fixed-stress systems, final is a real
  // minority pattern, antepenultimate genuinely rare) — first-pass tuning, ledgered as
  // such: 14A (fixed position) and 15A (weight-sensitive) sample disjoint populations,
  // so no single table licenses a four-way split. 2SIM.1 owns the re-fit.
  const sRoll = rng();
  const mode: StressMode = sRoll < 0.35 ? "initial" : sRoll < 0.65 ? "penult" : sRoll < 0.90 ? "final" : "antepenult";
  // Weight-sensitivity is rarer than fixed placement, and the spike's §1.3 measures it
  // as narrowly below the "live lever" threshold on this corpus — drawn low, ledgered
  // as flavour.
  const weightSensitive = rng() < 0.2;
  return { seed, inv, tmpl, lex, ...geo, compoundOrder, wordOrder: { basic, adj }, stressRule: { mode, weightSensitive } };
}
export function freshState(seed: number): GameState {
  const world = makeWorld(seed);
  // 1ENG.10: the root's name is phonotactic like every other branch (genStem), not a
  // literal "Proto" placeholder — that string previously only ever surfaced as a leaf
  // label, but now that dead ancestors render era-prefixed names (naming.ts eraLabels),
  // a literal "Proto" collides with the real Proto-<blend> vocabulary ("Late Proto").
  // Every branch is also born with an implicit birth anchor so the rename check always
  // has a most-recent anchor to compare drift against (see generation.ts).
  // 2STK.3: no drift history yet, so momentum starts empty (every category reads 1).
  // 1ENG.19: the root inherits the world's genesis order (same pattern as world.lex ->
  // root.lex, just above). frameWeights seeded FLAT, no draw — §3.4's audit-by-hand
  // reference table is stated at equal weights, so a fresh world reproduces it exactly;
  // divergence is walkFrameWeights' job, not genesis's.
  // 1ENG.20 (1eng-15 spike §3.3 "Genesis"): the root's paradigm seeds affixal, pre-fused
  // from the SOURCE WORDS' genesis forms, as if grammaticalisation happened in
  // prehistory (mirrors 1ENG.12 seeding diphthongs/long vowels into starting
  // inventories). No new mulberry32 draw: the spike's only seeded draw is the VO
  // placement roll, and that happens at fusion time via a hashRand, not here. proDrop
  // is no longer hardcoded false — it's licensed the moment >=2 of the 3 agreement
  // cells are alive, and the root is born with all three affixal, so it starts licensed.
  const frameWeights: FrameWeights = [1, 1, 1, 1];
  const paradigm = seedParadigm(world.lex, world.wordOrder, seed);
  const root = { id: 0, name: genStem(world.inv, seed, 0), parentId: null, depth: 0, splitIndex: 0, history: [], lex: world.lex, territory: [world.start], pressure: 0, anchors: [{ lex: world.lex, turn: 0, historyIndex: 0, driftFromPrev: 0 }], assimilationPressure: 0, collisionPressure: {}, momentum: {}, wordOrder: { ...world.wordOrder }, stressRule: { ...world.stressRule }, frameWeights, proDrop: licensesProDrop(paradigm), paradigm, orderPressure: 0, orderContactPressure: {}, fractureCooldown: 0 };
  // 2STK.2: the root is the self at world start; no mourning, no queued focus
  // decision, run not yet ended. 2STK.5: no trade routes open yet.
  return { world, branches: { 0: root }, rootId: 0, selectedId: 0, nextId: 1, turn: 1, settings: { ...DEFAULTS }, pool: DEFAULTS.pool, touched: {}, appliedRules: {}, log: [], focusId: 0, mourning: null, pendingFocusChoice: null, ended: false, routes: {} };
}
