import { mulberry32 } from "./rng";
import { genInventory, genTemplate, genLexicon } from "./lexicon";
import { genRegions } from "./geography";
import { genStem } from "./naming";
import type { CompoundOrder, FrameWeights, GameState, Settings, World, WordOrder } from "./types";

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
  return { seed, inv, tmpl, lex, ...geo, compoundOrder, wordOrder: { basic, adj } };
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
  // divergence is walkFrameWeights' job, not genesis's. proDrop hardcoded false — no
  // draw, since nothing licenses it until 1ENG.20 (a roll would be dead stream burn).
  const frameWeights: FrameWeights = [1, 1, 1, 1];
  const root = { id: 0, name: genStem(world.inv, seed, 0), parentId: null, depth: 0, splitIndex: 0, history: [], lex: world.lex, territory: [world.start], pressure: 0, anchors: [{ lex: world.lex, turn: 0, historyIndex: 0, driftFromPrev: 0 }], assimilationPressure: 0, collisionPressure: {}, momentum: {}, wordOrder: { ...world.wordOrder }, frameWeights, proDrop: false };
  // 2STK.2: the root is the self at world start; no mourning, no queued focus
  // decision, run not yet ended. 2STK.5: no trade routes open yet.
  return { world, branches: { 0: root }, rootId: 0, selectedId: 0, nextId: 1, turn: 1, settings: { ...DEFAULTS }, pool: DEFAULTS.pool, touched: {}, log: [], focusId: 0, mourning: null, pendingFocusChoice: null, ended: false, routes: {} };
}
