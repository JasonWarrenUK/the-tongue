import type { Adjacency, Branch, FreeRegion, Region, Edge, Settings } from "./types";

// branch helpers re-exported from tree to avoid a cycle are imported where needed
import { leavesOf } from "./tree";

export function pickTerrain(rng: () => number): { name: string; passable: boolean; cost: number } {
  const r = rng();
  if (r < 0.55) return { name: "plain", passable: true, cost: 1 };
  if (r < 0.75) return { name: "hill", passable: true, cost: 2 };
  if (r < 0.9) return { name: "mountain", passable: false, cost: 3 };
  return { name: "water", passable: false, cost: 3 };
}
export function genRegions(rng: () => number): { regions: Region[]; edges: Edge[]; adj: Adjacency; start: number } {
  const cols = 4, rows = 3;
  const regions: Region[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
    regions.push({ id: r * cols + c, x: (c + 0.5 + (rng() - 0.5) * 0.45) / cols, y: (r + 0.5 + (rng() - 0.5) * 0.45) / rows });
  const edges: Edge[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const id = r * cols + c;
    if (c < cols - 1) { const t = pickTerrain(rng); edges.push({ a: id, b: id + 1, ...t }); }
    if (r < rows - 1) { const t = pickTerrain(rng); edges.push({ a: id, b: id + cols, ...t }); }
  }
  const adj: Adjacency = {}; regions.forEach((r) => (adj[r.id] = []));
  edges.forEach((e) => { adj[e.a].push({ to: e.b, passable: e.passable, cost: e.cost }); adj[e.b].push({ to: e.a, passable: e.passable, cost: e.cost }); });
  let start = regions[0], best = 9;
  regions.forEach((r) => { const d = (r.x - 0.5) ** 2 + (r.y - 0.5) ** 2; if (d < best) { best = d; start = r; } });
  return { regions, edges, adj, start: start.id };
}

export function ownerMap(branches: Record<number, Branch>): Record<number, number> {
  const o: Record<number, number> = {};
  leavesOf(branches).forEach((L) => L.territory.forEach((r) => (o[r] = L.id)));
  return o;
}
export function freeAdjacentFor(b: Branch, adj: Adjacency, owner: Record<number, number>): FreeRegion[] {
  const map: Record<number, FreeRegion> = {};
  b.territory.forEach((rid) => adj[rid].forEach((e) => {
    if (owner[e.to] !== undefined) return;
    if (!map[e.to]) map[e.to] = { region: e.to, cost: e.cost, passable: e.passable };
    else { map[e.to].cost = Math.min(map[e.to].cost, e.cost); map[e.to].passable = map[e.to].passable || e.passable; }
  }));
  return Object.values(map);
}
export function passableComponents(territory: number[], adj: Adjacency): number[][] {
  const set = new Set(territory), seen = new Set<number>(), comps: number[][] = [];
  territory.forEach((r) => {
    if (seen.has(r)) return;
    const comp: number[] = [], stack = [r]; seen.add(r);
    while (stack.length) {
      const c = stack.pop()!; comp.push(c);
      adj[c].forEach((e) => { if (e.passable && set.has(e.to) && !seen.has(e.to)) { seen.add(e.to); stack.push(e.to); } });
    }
    comps.push(comp);
  });
  return comps;
}
export function basePool(branches: Record<number, Branch>, settings: Settings): number {
  const tot = leavesOf(branches).reduce((a, L) => a + Math.max(1, L.territory.length), 0);
  return settings.pool + settings.growth * (tot - 1);
}
export function overheadFor(branch: Branch, settings: Settings): number {
  return settings.overhead + Math.max(0, branch.territory.length - 1);
}
