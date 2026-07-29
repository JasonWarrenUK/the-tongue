import { mulberry32 } from "./rng";
import { genInventory, genTemplate, genLexicon } from "./lexicon";
import { genRegions } from "./geography";
import { genStem } from "./naming";
import type { CompoundOrder, GameState, Settings, World } from "./types";

export const DEFAULTS: Settings = { pool: 8, growth: 2, overhead: 3, changeCost: 2, spreadEvery: 3 };

export function makeWorld(seed: number): World {
  const rng = mulberry32(seed);
  const inv = genInventory(rng);
  const tmpl = genTemplate(rng);
  const lex = genLexicon(rng, inv, tmpl);
  const geo = genRegions(rng);
  // 2LEX.2 (2lex-1 spike §3.4): per-world compound headedness. Drawn LAST so every
  // pre-2LEX.2 seeded world keeps byte-identical inventory/template/lexicon/geography —
  // mulberry32 is a linear stream, so any earlier position would shift every downstream
  // draw and invalidate existing goldens.
  const compoundOrder: CompoundOrder = rng() < 0.5 ? "modFirst" : "headFirst";
  return { seed, inv, tmpl, lex, ...geo, compoundOrder };
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
  const root = { id: 0, name: genStem(world.inv, seed, 0), parentId: null, depth: 0, splitIndex: 0, history: [], lex: world.lex, territory: [world.start], pressure: 0, anchors: [{ lex: world.lex, turn: 0, historyIndex: 0, driftFromPrev: 0 }], assimilationPressure: 0, collisionPressure: {}, momentum: {} };
  // 2STK.2: the root is the self at world start; no mourning, no queued focus
  // decision, run not yet ended. 2STK.5: no trade routes open yet.
  return { world, branches: { 0: root }, rootId: 0, selectedId: 0, nextId: 1, turn: 1, settings: { ...DEFAULTS }, pool: DEFAULTS.pool, touched: {}, log: [], focusId: 0, mourning: null, pendingFocusChoice: null, ended: false, routes: {} };
}
