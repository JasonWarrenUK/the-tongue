import { mulberry32 } from "./rng";
import { genInventory, genTemplate, genLexicon } from "./lexicon";
import { genRegions } from "./geography";
import { genStem } from "./naming";
import type { GameState, Settings, World } from "./types";

export const DEFAULTS: Settings = { pool: 8, growth: 2, overhead: 3, changeCost: 2, spreadEvery: 3 };

export function makeWorld(seed: number): World {
  const rng = mulberry32(seed);
  const inv = genInventory(rng);
  const tmpl = genTemplate(rng);
  const lex = genLexicon(rng, inv, tmpl);
  const geo = genRegions(rng);
  return { seed, inv, tmpl, lex, ...geo };
}
export function freshState(seed: number): GameState {
  const world = makeWorld(seed);
  // 1ENG.10: the root's name is phonotactic like every other branch (genStem), not a
  // literal "Proto" placeholder — that string previously only ever surfaced as a leaf
  // label, but now that dead ancestors render era-prefixed names (naming.ts eraLabels),
  // a literal "Proto" collides with the real Proto-<blend> vocabulary ("Late Proto").
  // Every branch is also born with an implicit birth anchor so the rename check always
  // has a most-recent anchor to compare drift against (see generation.ts).
  const root = { id: 0, name: genStem(world.inv, seed, 0), parentId: null, depth: 0, splitIndex: 0, history: [], lex: world.lex, territory: [world.start], pressure: 0, anchors: [{ lex: world.lex, turn: 0, historyIndex: 0, driftFromPrev: 0 }] };
  return { world, branches: { 0: root }, rootId: 0, selectedId: 0, nextId: 1, turn: 1, settings: { ...DEFAULTS }, pool: DEFAULTS.pool, touched: {}, log: [] };
}
