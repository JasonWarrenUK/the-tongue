import { hashRand } from "./rng";
import { driftRule, applyRuleToLex } from "./phonology";
import { ownerMap, freeAdjacentFor, passableComponents, basePool, isolationScore, dominantTerrain } from "./geography";
import { leavesOf, isLeaf, childrenOf } from "./tree";
import { inventoryOf, genStem, RENAME_CUT } from "./naming";
import { intelligibility } from "./intelligibility";
import type { Anchor, Branch, GameState, HistoryEntry, Lexicon } from "./types";

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

  // 2. divergence-threshold rename (1ENG.10): every branch is born with one implicit
  //    anchor (its birth lexicon — seeded in world.ts/freshState and at fracture birth
  //    below), so there is always a most-recent anchor to compare the live lexicon
  //    against. Once that comparison's intelligibility drops below RENAME_CUT, freeze
  //    a new Anchor. This never mints a branch id — only fracture does — the lineage
  //    just accrues a marker in its own anchor chain, which naming.ts's render-time
  //    collapse turns into the Old/Middle/Late/Proto- display names. Frequent by
  //    design; legibility is the collapse's job, not the freeze rate's.
  leavesOf(branches).forEach((L) => {
    const b = branches[L.id];
    const last = b.anchors[b.anchors.length - 1];
    if (!last) return; // defensive: every branch should have a birth anchor
    const intel = intelligibility(b.lex, last.lex);
    if (intel < RENAME_CUT) {
      const anchor: Anchor = { lex: b.lex, turn, historyIndex: b.history.length, driftFromPrev: 1 - intel };
      branches[L.id] = { ...b, anchors: [...b.anchors, anchor] };
      log.push(`${b.name} entered a new era`);
    }
  });

  // 3. passive expansion (prefer passable; cross a barrier only when boxed in)
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

  // 4. fracture any territory no longer joined by passable terrain (1ENG.10:
  //    lineage-continuation). The parent's lineage CONTINUES on its largest surviving
  //    component (ties -> lowest region id) — same id, name, history, anchors. Only
  //    the OTHER component(s) spin off as new siblings, each with a fresh phonotactic
  //    stem (naming.ts genStem, drawn from the parent's own inventory) and the 1ENG.9
  //    birth-divergence drift step. The continuing parent gets no birth-divergence:
  //    it's the same language, mid-sentence, not a new one.
  let nextId = s.nextId;

  // one birth drift step for a freshly-copied sibling lexicon; null rule (unreachable
  // backstop, 1eng-11 spike §6) leaves the sibling an exact parent copy, never throws.
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
    if (comps.length > 1) {
      const parent = branches[L.id];
      // largest component continues the parent lineage; ties -> lowest region id.
      const ranked = [...comps].sort((a, b) => b.length - a.length || Math.min(...a) - Math.min(...b));
      const [main, ...rest] = ranked;
      const names: string[] = [];
      const born: number[] = [];
      rest.forEach((comp) => {
        const id = nextId++;
        const name = genStem(inventoryOf(parent.lex), seed, id); names.push(name); born.push(id);
        const startLex = parent.lex.map((e) => ({ concept: e.concept, word: [...e.word] }));
        // birth anchor: the sibling's starting lexicon, so subsequent rename checks
        // measure drift from the moment it became its own lineage, not the parent's.
        branches[id] = { id, name, parentId: parent.id, depth: parent.depth + 1, splitIndex: parent.history.length, history: [...parent.history], lex: startLex, territory: comp, pressure: 0, anchors: [{ lex: startLex, turn, historyIndex: parent.history.length, driftFromPrev: 0 }] };
      });
      branches[L.id] = { ...parent, territory: main };
      // parent keeps its component; siblings own theirs — ownerMap reflects the
      // post-split ownership (incl. any earlier parent's split committed this same
      // generation).
      const owner2 = ownerMap(branches);
      born.forEach((id) => {
        const child = branches[id];
        const { lex, entry } = divergeAtBirth(child.lex, id, child.territory, owner2);
        branches[id] = { ...child, lex, history: entry ? [...child.history, entry] : child.history };
      });
      if (names.length) log.push(`${parent.name} fractured → ${names.join(", ")}`);
    }
  });

  let selectedId = s.selectedId;
  if (!isLeaf(branches, selectedId)) { const kids = childrenOf(branches, selectedId); if (kids.length) selectedId = kids[0].id; }
  return { ...s, branches, nextId, turn: turn + 1, pool: basePool(branches, s.settings), touched: {}, selectedId, log };
}
