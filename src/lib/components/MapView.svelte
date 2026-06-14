<script lang="ts">
  import { ownerMap, freeAdjacentFor } from "$lib/engine/geography";
  import { isLeaf, branchColor } from "$lib/engine/tree";
  import type { Branch, FreeRegion, World } from "$lib/engine/types";
  let { world, branches, selectedId, pool, onselect, onexpand }:
    { world: World; branches: Record<number, Branch>; selectedId: number; pool: number;
      onselect: (id: number) => void; onexpand: (region: number) => void } = $props();

  const W = 360, H = 240, R = 12;
  const pos = $derived(Object.fromEntries(world.regions.map((r) => [r.id, { x: r.x * W, y: r.y * H }])));
  const owner = $derived(ownerMap(branches));
  const expandable = $derived.by<Record<number, FreeRegion>>(() => {
    const sel = branches[selectedId]; const m: Record<number, FreeRegion> = {};
    if (sel && isLeaf(branches, selectedId)) freeAdjacentFor(sel, world.adj, owner).forEach((f) => (m[f.region] = f));
    return m;
  });
</script>

<div class="overflow-x-auto">
  <svg viewBox={`0 0 ${W} ${H}`} width="100%" style="max-height:30vh">
    {#each world.edges as e, i}
      <line x1={pos[e.a].x} y1={pos[e.a].y} x2={pos[e.b].x} y2={pos[e.b].y}
        stroke={e.passable ? "var(--color-border)" : "var(--color-barrier)"} stroke-width="2" stroke-dasharray={e.passable ? "0" : "4 3"} />
    {/each}
    {#each world.regions as r}
      {@const own = owner[r.id]}
      {@const exp = expandable[r.id]}
      {@const isSel = own === selectedId}
      {@const afford = exp && exp.cost <= pool}
      {@const clickable = own !== undefined || (exp && afford)}
      <g transform={`translate(${pos[r.id].x},${pos[r.id].y})`} style="cursor:{clickable ? 'pointer' : 'default'}"
        role="button" tabindex="0"
        onclick={() => { if (own !== undefined) onselect(own); else if (exp && afford) onexpand(r.id); }}>
        <circle r={R} fill={own !== undefined ? branchColor(own) : "var(--color-surface-2)"}
          stroke={isSel ? "var(--color-accent)" : exp ? (afford ? "var(--color-accent)" : "var(--color-muted)") : "var(--color-bg)"}
          stroke-width={isSel ? 3 : exp ? 2 : 1} stroke-dasharray={exp ? "3 2" : "0"}
          opacity={own === undefined && !exp ? 0.5 : 1} />
        {#if own !== undefined}<text text-anchor="middle" dy="3.5" font-size="10" font-weight="700" fill="var(--color-on-accent)">{branches[own].name[0]}</text>{/if}
        {#if exp}<text text-anchor="middle" dy="3.5" font-size="9" fill={afford ? "var(--color-accent)" : "var(--color-muted)"}>+{exp.cost}</text>{/if}
      </g>
    {/each}
  </svg>
  <div class="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-muted" style="font-size:10px">
    <span>— passable</span><span style="color:var(--color-barrier)">– – barrier</span>
    <span class="text-muted">tap your land to select · tap a glowing region to expand</span>
  </div>
</div>
