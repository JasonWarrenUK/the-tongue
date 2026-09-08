<script lang="ts">
  import { isLeaf, branchColor } from "$lib/engine/tree";
  import type { Branch } from "$lib/engine/types";
  import type { EraLayout } from "$lib/engine/tree";
  // 1ENG.22 era-viewer: viewing (null = live tip) lets an earlier era render as
  // selected in its own right, distinct from the live selectedId. onselect now passes
  // the stage index too, so a click on a non-terminal node can be told apart from a
  // click on the branch's current tip.
  let { branches, selectedId, focusId, touched, eraGraph, viewing, onselect }:
    { branches: Record<number, Branch>; selectedId: number; focusId: number;
      touched: Record<number, boolean>; eraGraph: EraLayout;
      viewing: { branchId: number; stageIndex: number } | null;
      onselect: (id: number, stageIndex: number) => void } = $props();

  const COL = 130, ROW = 66, NW = 110, NH = 40;
  // "Middle Ʒakaʒin (1/6)" overflows any node wide enough to tile — the ordinal is
  // secondary info, so it renders on the small sub-line ("middle 1/6") instead.
  const ORDINAL = / \((\d+\/\d+)\)$/;
  const titleOf = (text: string) => text.replace(ORDINAL, "");
  const subOf = (text: string, bucket: string) => {
    const ord = ORDINAL.exec(text)?.[1];
    return ord ? `${bucket} ${ord}` : bucket;
  };
  // 1ENG.26: phonemic-event entries (Merger/Split/Loss/Gain) carry `report: true` and
  // describe a change another entry already recorded this turn — exclude them so this
  // count keeps meaning "sound changes applied", not "sound changes plus their retelling".
  const changeCount = (branchId: number) => branches[branchId].history.filter((h) => !h.report).length;
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

<div class="overflow-auto max-h-[330px] max-md:max-h-none">
  <svg width={W} height={H} style="min-width:100%">
    {#each eraGraph.edges as e (e.from + "->" + e.to)}
      <path d={edgePath(e)} fill="none" stroke="var(--color-border-strong)" stroke-width="1.5" />
    {/each}
    {#each eraGraph.nodes as node (node.key)}
      {@const leaf = isLeaf(branches, node.branchId)}
      {@const selected = viewing
        ? node.branchId === viewing.branchId && node.stageIndex === viewing.stageIndex
        : node.isTerminal && node.branchId === selectedId}
      <!-- an earlier era of a DEAD lineage is inspectable too — "you can see it existed
           but not how it differed" is the whole complaint this fixes, so clickability
           can't stay gated on `leaf` (aliveness) alone. -->
      {@const clickable = leaf || node.stage.anchorIndex !== null}
      <g transform={`translate(${cx(node.key) - NW / 2}, ${cy(node.key)})`} role="button" tabindex="0"
        onclick={() => onselect(node.branchId, node.stageIndex)}
        onkeydown={(ev) => { if (ev.key === "Enter" || ev.key === " ") { ev.preventDefault(); onselect(node.branchId, node.stageIndex); } }}
        style="cursor:{clickable ? 'pointer' : 'default'}">
        <rect width={NW} height={NH} rx="7" fill={selected ? "var(--color-accent-bg-strong)" : "var(--color-surface)"}
          stroke={selected ? "var(--color-accent)" : leaf ? "#c9c0ac" : "var(--color-border)"} stroke-width={selected ? 2 : 1.4} />
        {#if node.isTerminal && leaf}<rect x="7" y={NH - 8} width={NW - 14} height="3" rx="1.5" fill={branchColor(node.branchId)} />{/if}
        <text x={NW / 2} y="17" text-anchor="middle" fill={selected ? "var(--color-accent)" : leaf ? "var(--color-text)" : "var(--color-text-faint)"} font-family="var(--font-sans)" font-size="11" font-weight="600">{titleOf(node.stage.text)}</text>
        <text x={NW / 2} y="28" text-anchor="middle" fill="var(--color-text-faint)" font-family="var(--font-mono)" font-size="9">{node.isTerminal ? (leaf ? `${changeCount(node.branchId)} chg` : "ancestor") : subOf(node.stage.text, node.stage.bucket)}</text>
        <!-- decorations (touched, focal self) are properties of the branch's CURRENT
             turn state, not of a frozen past era — render only on the terminal node. -->
        {#if node.isTerminal && leaf && touched[node.branchId]}<circle cx={NW - 9} cy="9" r="3.5" fill="var(--color-barrier)" />{/if}
        {#if node.isTerminal && node.branchId === focusId}<circle cx="9" cy="9" r="3.5" fill="var(--color-accent)" />{/if}
      </g>
    {/each}
  </svg>
</div>
