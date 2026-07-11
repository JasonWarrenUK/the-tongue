import type { Branch } from "./types";

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
