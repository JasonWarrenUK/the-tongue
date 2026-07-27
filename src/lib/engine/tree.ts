import type { Branch } from "./types";
import type { EraStage } from "./naming";

export const childrenOf = (br: Record<number, Branch>, id: number) =>
  Object.values(br).filter((b) => b.parentId === id);
// 1ENG.10: "leaf" now means ALIVE (still owns territory / is actively simulated), not
// "childless". Before lineage-continuation these were the same thing — a fractured
// parent always had its territory emptied — but now the continuing parent keeps
// drifting/spreading/fracturing on its own territory while ALSO being the parent of
// the sibling(s) it spun off. Ownership of territory, not tree position, is what
// determines whether a branch still participates in the simulation.
export const isLeaf = (br: Record<number, Branch>, id: number) => (br[id]?.territory.length ?? 0) > 0;
export const leavesOf = (br: Record<number, Branch>) =>
  Object.values(br).filter((b) => isLeaf(br, b.id));
// 1ENG.10: is `id` equal to or a descendant of `ancestorId`? Used to collect an
// ancestor's living leaves for the Proto-blend naming check (naming.ts protoBlendFor).
export function descendsFrom(br: Record<number, Branch>, id: number, ancestorId: number): boolean {
  let cur: Branch | undefined = br[id];
  while (cur) { if (cur.id === ancestorId) return true; cur = cur.parentId === null ? undefined : br[cur.parentId]; }
  return false;
}
// 2STK.2: tree path length between two branches, for the kinship-dominant reach/
// succession metric (stakes.ts blendDistance). Walks both parentId chains up to
// their lowest common ancestor and sums the two leg lengths; `depth` is already
// carried on Branch (set at fracture birth) so no separate depth pass is needed.
export function kinshipDistance(aId: number, bId: number, br: Record<number, Branch>): number {
  if (aId === bId) return 0;
  const ancestors = new Map<number, number>(); // ancestor id -> depth-from-a
  let cur: Branch | undefined = br[aId]; let steps = 0;
  while (cur) { ancestors.set(cur.id, steps); cur = cur.parentId === null ? undefined : br[cur.parentId]; steps++; }
  cur = br[bId]; steps = 0;
  while (cur) {
    const aLeg = ancestors.get(cur.id);
    if (aLeg !== undefined) return aLeg + steps;
    cur = cur.parentId === null ? undefined : br[cur.parentId]; steps++;
  }
  return Infinity; // unreachable in a single tree; guards against disconnected fixtures
}

export const branchColor = (id: number) => `hsl(${(id * 61 + 25) % 360} 48% 56%)`;

export function layoutTree(br: Record<number, Branch>, rootId: number): Record<number, { x: number; depth: number }> {
  let nextX = 0; const pos: Record<number, { x: number; depth: number }> = {};
  function rec(id: number, depth: number): number {
    const kids = childrenOf(br, id).sort((a, b) => a.id - b.id);
    if (!kids.length) { pos[id] = { x: nextX++, depth }; return pos[id].x; }
    const xs = kids.map((k) => rec(k.id, depth + 1));
    pos[id] = { x: (Math.min(...xs) + Math.max(...xs)) / 2, depth };
    return pos[id].x;
  }
  rec(rootId, 0);
  return pos;
}

// 2NAR.x family-tree fix: era-node graph — one rendered node per era STAGE of a branch
// (naming.ts eraStages), not one node per branch id (layoutTree above). A branch's own
// stages stack in consecutive rows, oldest first; a fracturing child's chain starts one
// row below whichever of the PARENT's stages was current at the moment of the split
// (Branch.splitIndex and Anchor.historyIndex are set from the same `parent.history.length`
// counter at generation.ts, so a stage's [loIndex, hiIndex) range is directly comparable
// against a child's splitIndex — exactly one stage matches since ranges are contiguous
// and the terminal stage's hiIndex is +Infinity). This is what makes an early-forking
// daughter visually start higher up the tree than a late-forking one.
// Every branch owns a dedicated column, allocated between the two halves of its
// children (the mother line continues down the middle) — NOT the midpoint of its kids'
// columns, which would let the parent's post-fork stages land on the same (col, row)
// cells as a kid's chain the instant the parent renames after a fracture.
export interface EraNode { key: string; branchId: number; stageIndex: number; isTerminal: boolean; stage: EraStage }
export interface EraEdge { from: string; to: string }
export interface EraLayout {
  nodes: EraNode[]; edges: EraEdge[]; pos: Record<string, { col: number; row: number }>; cols: number; rows: number;
}

// Which of the parent's stages owns this child's fork point. Falls back to the last
// stage (defensive: ranges are contiguous and exhaustive by construction in eraStages,
// so this only triggers on malformed/empty input).
function attachStageIndex(parentStages: EraStage[], splitIndex: number): number {
  const i = parentStages.findIndex((s) => splitIndex >= s.loIndex && splitIndex < s.hiIndex);
  return i === -1 ? Math.max(0, parentStages.length - 1) : i;
}

export function buildEraLayout(
  branches: Record<number, Branch>, rootId: number, stagesByBranch: Record<number, EraStage[]>,
): EraLayout {
  const nodes: EraNode[] = [];
  const edges: EraEdge[] = [];
  const pos: Record<string, { col: number; row: number }> = {};
  let nextCol = 0, maxRow = 0;

  // rec returns this branch's own dedicated column, allocated mid-recursion so it
  // falls between the left and right halves of its children's subtrees.
  function rec(id: number, baseRow: number): number {
    const stages = stagesByBranch[id] ?? [];
    stages.forEach((stage, i) => {
      const key = `${id}:${i}`;
      const row = baseRow + i;
      maxRow = Math.max(maxRow, row);
      nodes.push({ key, branchId: id, stageIndex: i, isTerminal: i === stages.length - 1, stage });
      if (i > 0) edges.push({ from: `${id}:${i - 1}`, to: key });
    });

    // Chronological fan-out: children ordered by the stage they forked from (then by
    // splitIndex, then id), NOT by branch id — a branch born late but forked from an
    // early era must sit beside its era-mates, not beyond younger siblings' subtrees,
    // or its attach edge crosses the whole family (the "Old Ruram past Middle Talen"
    // layout complaint).
    const kids = childrenOf(branches, id)
      .map((k) => ({ k, stageIdx: stages.length ? attachStageIndex(stages, k.splitIndex) : 0 }))
      .sort((a, b) => a.stageIdx - b.stageIdx || a.k.splitIndex - b.k.splitIndex || a.k.id - b.k.id);
    const doKid = ({ k, stageIdx }: { k: Branch; stageIdx: number }) => {
      rec(k.id, baseRow + stageIdx + 1);
      if (stages.length) edges.push({ from: `${id}:${stageIdx}`, to: `${k.id}:0` });
    };
    const half = Math.floor(kids.length / 2);
    kids.slice(0, half).forEach(doKid);
    const col = nextCol++;
    kids.slice(half).forEach(doKid);
    stages.forEach((_, i) => (pos[`${id}:${i}`] = { col, row: baseRow + i }));
    return col;
  }
  rec(rootId, 0);

  return { nodes, edges, pos, cols: nextCol, rows: maxRow + 1 };
}
