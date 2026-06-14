import { mulberry32 } from "./rng";
import { genInventory, genTemplate, genLexicon } from "./lexicon";
import { genRegions } from "./geography";
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
  const root = { id: 0, name: "Proto", parentId: null, depth: 0, splitIndex: 0, history: [], lex: world.lex, territory: [world.start], pressure: 0 };
  return { world, branches: { 0: root }, rootId: 0, selectedId: 0, nextId: 1, nameIdx: 0, turn: 1, settings: { ...DEFAULTS }, pool: DEFAULTS.pool, touched: {}, log: [] };
}
