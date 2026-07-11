import type { Adjacency, Branch, FreeRegion, Region, Edge, Settings, Terrain } from "./types";

// branch helpers re-exported from tree to avoid a cycle are imported where needed
import { leavesOf } from "./tree";

export function pickTerrain(rng: () => number): { name: Terrain; passable: boolean; cost: number } {
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

const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

// isolationScore ∈ [0,1]: 1 = walled/isolated, 0 = open, 0.5 = interior/neutral.
// Border edges (contact with other leaf branches) carry the primary weight;
// impassable internal terrain nudges the score up as a secondary signal.
export function isolationScore(
  branchId: number, territory: number[], edges: Edge[], owner: Record<number, number>
): number {
  if (territory.length === 0) return 0.5; // no owned regions — neutral, matches the "no border edges" case
  let passableBorder = 0, impassableBorder = 0, passableInternal = 0, impassableInternal = 0;
  edges.forEach((e) => {
    const aOwned = owner[e.a] === branchId, bOwned = owner[e.b] === branchId;
    if (!aOwned && !bOwned) return;
    if (aOwned && bOwned) { if (e.passable) passableInternal++; else impassableInternal++; return; }
    // exactly one endpoint owned by this branch — border edge only if the other side has a different leaf owner
    const otherOwner = aOwned ? owner[e.b] : owner[e.a];
    if (otherOwner === undefined || otherOwner === branchId) return;
    if (e.passable) passableBorder++; else impassableBorder++;
  });
  const borderTotal = passableBorder + impassableBorder;
  const isolation = borderTotal === 0 ? 0.5 : impassableBorder / borderTotal;
  const internalTotal = passableInternal + impassableInternal;
  const internalIsolation = internalTotal === 0 ? 0 : impassableInternal / internalTotal;
  return clamp01(0.75 * isolation + 0.25 * internalIsolation);
}

const IMPASSABILITY_RANK: Record<Terrain, number> = { plain: 0, hill: 1, mountain: 2, water: 3 };

// Plurality terrain across a branch's internal + border edges; ties favour the
// more impassable terrain (rugged terrain is the more salient daily reference).
export function dominantTerrain(
  branchId: number, territory: number[], edges: Edge[], owner: Record<number, number>
): Terrain {
  if (territory.length === 0) return "plain"; // no owned regions — no terrain signal to read
  const counts: Record<Terrain, number> = { plain: 0, hill: 0, mountain: 0, water: 0 };
  edges.forEach((e) => {
    const aOwned = owner[e.a] === branchId, bOwned = owner[e.b] === branchId;
    if (!aOwned && !bOwned) return;
    if (e.name) counts[e.name]++;
  });
  let best: Terrain = "plain";
  (Object.keys(counts) as Terrain[]).forEach((t) => {
    if (counts[t] > counts[best]) best = t;
    else if (counts[t] === counts[best] && IMPASSABILITY_RANK[t] > IMPASSABILITY_RANK[best]) best = t;
  });
  return best;
}
