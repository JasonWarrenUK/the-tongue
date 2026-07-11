import { hashRand } from "./rng";
import { driftRule, applyRuleToLex } from "./phonology";
import { ownerMap, freeAdjacentFor, passableComponents, basePool, isolationScore } from "./geography";
import { leavesOf, isLeaf, childrenOf, NAME_POOL } from "./tree";
import type { Branch, GameState } from "./types";

// One generation resolves: autonomous drift → passive spread → geographic fracture → repool.
export function resolveGeneration(s: GameState): GameState {
  const seed = s.world.seed, turn = s.turn, adj = s.world.adj, log: string[] = [];
  const branches: Record<number, Branch> = {};
  Object.values(s.branches).forEach((b) => (branches[b.id] = { ...b, territory: [...b.territory], history: [...b.history] }));

  // 1. drift untouched leaves (terrain-biased: 2GEO.2 — see 2geo-1-terrain-sound-change spike)
  const owner = ownerMap(branches);
  leavesOf(branches).forEach((L) => {
    if (s.touched[L.id]) return;
    const iso = isolationScore(L.id, L.territory, s.world.edges, owner);
    const rule = driftRule(L.lex, seed, turn, L.id, iso); if (!rule) return;
    branches[L.id] = { ...branches[L.id], lex: applyRuleToLex(L.lex, rule).lex, history: [...branches[L.id].history, { name: rule.name, note: rule.note, drift: true }] };
    log.push(`${L.name} drifted (${rule.name.toLowerCase()})`);
  });

  // 2. passive expansion (prefer passable; cross a barrier only when boxed in)
  leavesOf(branches).forEach((L) => {
    const b = branches[L.id]; b.pressure = (b.pressure || 0) + 1;
    if (b.pressure >= s.settings.spreadEvery) {
      const free = freeAdjacentFor(b, adj, owner);
      if (free.length) {
        const passable = free.filter((f) => f.passable); const poolF = passable.length ? passable : free;
        const r = poolF[Math.floor(hashRand(seed, turn * 7 + 1, L.id * 13 + 5) * poolF.length)];
        b.territory.push(r.region); owner[r.region] = L.id; b.pressure = 0;
        log.push(`${L.name} spread`);
      }
    }
  });

  // 3. fracture any territory no longer joined by passable terrain
  let nextId = s.nextId, nameIdx = s.nameIdx;
  leavesOf(branches).forEach((L) => {
    const comps = passableComponents(branches[L.id].territory, adj);
    if (comps.length > 1 && nameIdx + comps.length <= NAME_POOL.length) {
      const parent = branches[L.id]; const names: string[] = [];
      comps.forEach((comp) => {
        const id = nextId++; const name = NAME_POOL[nameIdx++]; names.push(name);
        branches[id] = { id, name, parentId: parent.id, depth: parent.depth + 1, splitIndex: parent.history.length, history: [...parent.history], lex: parent.lex.map((e) => ({ concept: e.concept, word: [...e.word] })), territory: comp, pressure: 0 };
      });
      branches[L.id] = { ...parent, territory: [] };
      log.push(`${parent.name} fractured → ${names.join(", ")}`);
    }
  });

  let selectedId = s.selectedId;
  if (!isLeaf(branches, selectedId)) { const kids = childrenOf(branches, selectedId); if (kids.length) selectedId = kids[0].id; }
  return { ...s, branches, nextId, nameIdx, turn: turn + 1, pool: basePool(branches, s.settings), touched: {}, selectedId, log };
}
