<script lang="ts">
  import { isLeaf, branchColor } from "$lib/engine/tree";
  import type { Branch } from "$lib/engine/types";
  import type { EraLayout } from "$lib/engine/tree";
  let { branches, selectedId, focusId, touched, eraGraph, onselect }:
    { branches: Record<number, Branch>; selectedId: number; focusId: number;
      touched: Record<number, boolean>; eraGraph: EraLayout; onselect: (id: number) => void } = $props();

  const COL = 120, ROW = 62, NW = 104, NH = 36;
  // "Middle Ʒakaʒin (1/6)" overflows any node wide enough to tile — the ordinal is
  // secondary info, so it renders on the small sub-line ("middle 1/6") instead.
  const ORDINAL = / \((\d+\/\d+)\)$/;
  const titleOf = (text: string) => text.replace(ORDINAL, "");
  const subOf = (text: string, bucket: string) => {
    const ord = ORDINAL.exec(text)?.[1];
    return ord ? `${bucket} ${ord}` : bucket;
  };
  const W = $derived(eraGraph.cols * COL);
  const H = $derived(eraGraph.rows * ROW);
  const cx = (key: string) => eraGraph.pos[key].col * COL + COL / 2;
  const cy = (key: string) => eraGraph.pos[key].row * ROW + 10;
  // Orthogonal elbow: drop from the parent node, run horizontally in the inter-row
  // gap, drop into the child — long straight diagonals across a wide family read as
  // clutter once branches fork from different eras.
  const edgePath = (e: { from: string; to: string }) => {
    const x1 = cx(e.from), y1 = cy(e.from) + NH, x2 = cx(e.to), y2 = cy(e.to);
    return `M${x1} ${y1} V${(y1 + y2) / 2} H${x2} V${y2}`;
  };
</script>

<div class="overflow-auto" style="max-height:60vh">
  <svg width={W} height={H} style="min-width:100%">
    {#each eraGraph.edges as e (e.from + "->" + e.to)}
      <path d={edgePath(e)} fill="none" stroke="var(--color-border)" stroke-width="1.5" />
    {/each}
    {#each eraGraph.nodes as node (node.key)}
      {@const leaf = isLeaf(branches, node.branchId)}
      {@const selected = node.isTerminal && node.branchId === selectedId}
      {@const clickable = leaf}
      <g transform={`translate(${cx(node.key) - NW / 2}, ${cy(node.key)})`} role="button" tabindex="0"
        onclick={() => onselect(node.branchId)}
        onkeydown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onselect(node.branchId); } }}
        style="cursor:{clickable ? 'pointer' : 'default'}">
        <rect width={NW} height={NH} rx="6" fill={selected ? "var(--color-surface-2)" : "var(--color-surface)"}
          stroke={selected ? "var(--color-accent)" : leaf ? "var(--color-muted)" : "var(--color-border)"} stroke-width={selected ? 2 : 1.5} />
        {#if node.isTerminal && leaf}<rect x="6" y={NH - 7} width={NW - 12} height="3" rx="1.5" fill={branchColor(node.branchId)} />{/if}
        <text x={NW / 2} y="15" text-anchor="middle" fill={selected ? "var(--color-accent)" : leaf ? "var(--color-fg)" : "var(--color-muted)"} font-size="12" font-weight="600">{titleOf(node.stage.text)}</text>
        <text x={NW / 2} y="27" text-anchor="middle" fill="var(--color-muted)" font-size="9">{node.isTerminal ? (leaf ? `${branches[node.branchId].history.length} chg` : "ancestor") : subOf(node.stage.text, node.stage.bucket)}</text>
        <!-- decorations (touched, focal self) are properties of the branch's CURRENT
             turn state, not of a frozen past era — render only on the terminal node. -->
        {#if node.isTerminal && leaf && touched[node.branchId]}<circle cx={NW - 8} cy="8" r="3.5" fill="var(--color-accent)" />{/if}
        {#if node.isTerminal && node.branchId === focusId}<circle cx="8" cy="8" r="3.5" fill="var(--color-positive)" />{/if}
      </g>
    {/each}
  </svg>
</div>
