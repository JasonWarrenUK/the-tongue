import type { Branch } from "./types";

export const NAME_POOL = ["Aenic","Boran","Cael","Doran","Eshk","Fenn","Garr","Hroth","Ivar","Joss","Karn","Lorn","Morr","Nys","Orin","Pell","Quor","Rhun","Syl","Tovr","Ulm","Vesk","Wyrr","Xan"];

export const childrenOf = (br: Record<number, Branch>, id: number) =>
  Object.values(br).filter((b) => b.parentId === id);
export const isLeaf = (br: Record<number, Branch>, id: number) =>
  !Object.values(br).some((b) => b.parentId === id);
export const leavesOf = (br: Record<number, Branch>) =>
  Object.values(br).filter((b) => isLeaf(br, b.id));
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
