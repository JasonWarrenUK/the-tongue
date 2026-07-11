import { hashRand } from "./rng";
import { driftRule, applyRuleToLex } from "./phonology";
import { ownerMap, freeAdjacentFor, passableComponents, basePool, isolationScore, dominantTerrain } from "./geography";
import { leavesOf, isLeaf, childrenOf, NAME_POOL } from "./tree";
import type { Branch, GameState, HistoryEntry, Lexicon } from "./types";

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
    const terrain = dominantTerrain(L.id, L.territory, s.world.edges, owner);
    branches[L.id] = { ...branches[L.id], lex: applyRuleToLex(L.lex, rule, { terrain, seed, turn, branchId: L.id }).lex, history: [...branches[L.id].history, { name: rule.name, note: rule.note, drift: true }] };
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
  //    (1ENG.9) each child diverges from the parent AND its siblings at the moment
  //    of fracture: one drift step seeded off the child's own new id, computed
  //    against the POST-split owner map so isolation/terrain reflect the child's
  //    own component, not the parent's pre-split territory.
  let nextId = s.nextId, nameIdx = s.nameIdx;

  // one birth drift step for a freshly-copied child lexicon; null rule (unreachable
  // backstop, 1eng-11 spike §6) leaves the child an exact parent copy, never throws.
  const divergeAtBirth = (
    lex: Lexicon, childId: number, territory: number[], owner: Record<number, number>,
  ): { lex: Lexicon; entry: HistoryEntry | null } => {
    const iso = isolationScore(childId, territory, s.world.edges, owner);
    const rule = driftRule(lex, seed, turn, childId, iso);
    if (!rule) return { lex, entry: null };
    const terrain = dominantTerrain(childId, territory, s.world.edges, owner);
    const next = applyRuleToLex(lex, rule, { terrain, seed, turn, branchId: childId }).lex;
    return { lex: next, entry: { name: rule.name, note: `at fracture: ${rule.note}`, drift: true } };
  };

  leavesOf(branches).forEach((L) => {
    const comps = passableComponents(branches[L.id].territory, adj);
    if (comps.length > 1 && nameIdx + comps.length <= NAME_POOL.length) {
      const parent = branches[L.id];
      const names: string[] = [];
      const born: number[] = [];
      comps.forEach((comp) => {
        const id = nextId++; const name = NAME_POOL[nameIdx++]; names.push(name); born.push(id);
        branches[id] = { id, name, parentId: parent.id, depth: parent.depth + 1, splitIndex: parent.history.length, history: [...parent.history], lex: parent.lex.map((e) => ({ concept: e.concept, word: [...e.word] })), territory: comp, pressure: 0 };
      });
      branches[L.id] = { ...parent, territory: [] };
      // parent is now a non-leaf owning nothing; children own their components —
      // ownerMap reflects the post-split ownership (incl. any earlier parent's split
      // committed this same generation).
      const owner2 = ownerMap(branches);
      born.forEach((id) => {
        const child = branches[id];
        const { lex, entry } = divergeAtBirth(child.lex, id, child.territory, owner2);
        branches[id] = { ...child, lex, history: entry ? [...child.history, entry] : child.history };
      });
      log.push(`${parent.name} fractured → ${names.join(", ")}`);
    }
  });

  let selectedId = s.selectedId;
  if (!isLeaf(branches, selectedId)) { const kids = childrenOf(branches, selectedId); if (kids.length) selectedId = kids[0].id; }
  return { ...s, branches, nextId, nameIdx, turn: turn + 1, pool: basePool(branches, s.settings), touched: {}, selectedId, log };
}
