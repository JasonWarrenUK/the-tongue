<script lang="ts">
  import { layoutTree, isLeaf, branchColor } from "$lib/engine/tree";
  import type { Branch } from "$lib/engine/types";
  let { branches, rootId, selectedId, touched, displayNames, onselect }:
    { branches: Record<number, Branch>; rootId: number; selectedId: number;
      touched: Record<number, boolean>; displayNames: Record<number, string>; onselect: (id: number) => void } = $props();

  const COL = 96, ROW = 62, NW = 78, NH = 36;
  const pos = $derived(layoutTree(branches, rootId));
  const W = $derived((Math.ceil(Math.max(...Object.values(pos).map((p) => p.x))) + 1) * COL);
  const H = $derived((Math.max(...Object.values(pos).map((p) => p.depth)) + 1) * ROW);
  const cx = (id: number) => pos[id].x * COL + COL / 2;
  const cy = (id: number) => pos[id].depth * ROW + 10;
</script>

<div class="overflow-x-auto" style="max-height:30vh">
  <svg width={W} height={H} style="min-width:100%">
    {#each Object.values(branches) as b}
      {#if b.parentId !== null}
        <line x1={cx(b.parentId)} y1={cy(b.parentId) + NH} x2={cx(b.id)} y2={cy(b.id)} stroke="var(--color-border)" stroke-width="1.5" />
      {/if}
    {/each}
    {#each Object.values(branches) as b}
      {@const leaf = isLeaf(branches, b.id)}
      {@const selected = b.id === selectedId}
      <g transform={`translate(${cx(b.id) - NW / 2}, ${cy(b.id)})`} role="button" tabindex="0"
        onclick={() => onselect(b.id)} style="cursor:{leaf ? 'pointer' : 'default'}">
        <rect width={NW} height={NH} rx="6" fill={selected ? "var(--color-surface-2)" : "var(--color-surface)"}
          stroke={selected ? "var(--color-accent)" : leaf ? "var(--color-muted)" : "var(--color-border)"} stroke-width={selected ? 2 : 1.5} />
        {#if leaf}<rect x="6" y={NH - 7} width={NW - 12} height="3" rx="1.5" fill={branchColor(b.id)} />{/if}
        <text x={NW / 2} y="15" text-anchor="middle" fill={selected ? "var(--color-accent)" : leaf ? "var(--color-fg)" : "var(--color-muted)"} font-size="12" font-weight="600">{displayNames[b.id] ?? b.name}</text>
        <text x={NW / 2} y="27" text-anchor="middle" fill="var(--color-muted)" font-size="9">{leaf ? `${b.history.length} chg` : "ancestor"}</text>
        {#if leaf && touched[b.id]}<circle cx={NW - 8} cy="8" r="3.5" fill="var(--color-accent)" />{/if}
      </g>
    {/each}
  </svg>
</div>
