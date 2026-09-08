<script lang="ts">
  import { ownerMap, freeAdjacentFor } from "$lib/engine/geography";
  import { isLeaf, branchColor } from "$lib/engine/tree";
  import type { Branch, FreeRegion, World } from "$lib/engine/types";
  import ZoomPan from "./ZoomPan.svelte";
  // radius/zoomable: the mobile shell passes a larger radius (touch targets) and
  // wraps the SVG in a pinch-zoom container; desktop leaves both at their defaults.
  let { world, branches, selectedId, pool, onselect, onexpand, radius = 6.2, zoomable = false }:
    { world: World; branches: Record<number, Branch>; selectedId: number; pool: number;
      onselect: (id: number) => void; onexpand: (region: number) => void; radius?: number; zoomable?: boolean } = $props();

  // 1ENG.21: W/H unchanged (viewBox), R shrunk 12->6 — genRegions grew 4x3 (12
  // regions) to 10x8 (80 regions), so nodes at the old radius would overlap heavily
  // in the same fixed viewBox.
  const W = 360, H = 240;
  const R = $derived(radius);
  const fs = $derived(radius > 7 ? 11 : 9);
  const pos = $derived(Object.fromEntries(world.regions.map((r) => [r.id, { x: r.x * W, y: r.y * H }])));
  const owner = $derived(ownerMap(branches));
  const expandable = $derived.by<Record<number, FreeRegion>>(() => {
    const sel = branches[selectedId]; const m: Record<number, FreeRegion> = {};
    if (sel && isLeaf(branches, selectedId)) freeAdjacentFor(sel, world.adj, owner).forEach((f) => (m[f.region] = f));
    return m;
  });
</script>

{#snippet map()}
  <svg viewBox={`0 0 ${W} ${H}`} width="100%" class="block">
    {#each world.edges as e, i}
      <line x1={pos[e.a].x} y1={pos[e.a].y} x2={pos[e.b].x} y2={pos[e.b].y}
        stroke={e.passable ? "var(--color-rule)" : "var(--color-barrier)"} stroke-width="1.5" stroke-dasharray={e.passable ? "0" : "4 3"} />
    {/each}
    {#each world.regions as r}
      {@const own = owner[r.id]}
      {@const exp = expandable[r.id]}
      {@const isSel = own === selectedId}
      {@const afford = exp && exp.cost <= pool}
      {@const clickable = own !== undefined || (exp && afford)}
      <g transform={`translate(${pos[r.id].x},${pos[r.id].y})`} style="cursor:{clickable ? 'pointer' : 'default'}"
        role="button" tabindex="0"
        onclick={() => { if (own !== undefined) onselect(own); else if (exp && afford) onexpand(r.id); }}
        onkeydown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); if (own !== undefined) onselect(own); else if (exp && afford) onexpand(r.id); } }}>
        <circle r={R} fill={own !== undefined ? branchColor(own) : "var(--color-region-empty)"}
          stroke={isSel ? "var(--color-accent)" : exp ? (afford ? "var(--color-accent)" : "var(--color-text-faint)") : "var(--color-bg)"}
          stroke-width={isSel ? 2.6 : exp ? 1.8 : 1} stroke-dasharray={exp ? "3 2" : "0"}
          opacity={own === undefined && !exp ? 0.7 : 1} />
        {#if own !== undefined}<text text-anchor="middle" dy={fs * 0.37} font-family="var(--font-mono)" font-size={fs} font-weight="600" fill="var(--color-bg)">{branches[own].name[0]}</text>{/if}
        {#if exp}<text text-anchor="middle" dy={fs * 0.37} font-family="var(--font-mono)" font-size={fs - 1} fill={afford ? "var(--color-accent)" : "var(--color-text-faint)"}>+{exp.cost}</text>{/if}
      </g>
    {/each}
  </svg>
{/snippet}

<div>
  {#if zoomable}<ZoomPan>{@render map()}</ZoomPan>{:else}{@render map()}{/if}
  <div class="flex flex-wrap gap-x-4 gap-y-1 mt-2.5 text-[11px] text-text-muted">
    <span class="inline-flex items-center gap-1.5"><span class="w-4 border-t border-rule"></span>passable</span>
    <span class="inline-flex items-center gap-1.5 text-barrier-text"><span class="w-4 border-t border-dashed border-barrier"></span>barrier</span>
    <span class="inline-flex items-center gap-1.5"><span class="w-2.75 h-2.75 rounded-full border border-dashed border-accent"></span>expandable · <span class="font-mono">+cost</span></span>
    {#if zoomable}<span class="text-text-faint">pinch to zoom · double-tap to reset</span>{/if}
  </div>
</div>
