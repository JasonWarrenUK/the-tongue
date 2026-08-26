<script lang="ts">
  import { intelligibility } from "$lib/engine/intelligibility";
  import { routeKey } from "$lib/engine/contact";
  import type { Branch } from "$lib/engine/types";
  let { leaves, displayNames, openRoutes }:
    { leaves: Branch[]; displayNames: Record<number, string>; openRoutes: Set<string> } = $props();
  const ls = $derived(leaves.slice().sort((a, b) => a.id - b.id));
  const colour = (v: number) =>
    v >= 0.7 ? "var(--color-accent)" : v >= 0.4 ? "var(--color-caution)" : "var(--color-warn)";
</script>

{#if leaves.length < 2}
  <p class="text-text-muted text-xs">As the family fractures, mutual intelligibility between living languages appears here.</p>
{:else}
  <div class="overflow-x-auto">
    <table class="text-[13px] border-collapse w-full">
      <thead><tr><th class="p-2"></th>{#each ls as b}<th class="p-2 text-text-muted font-medium text-center text-xs">{displayNames[b.id] ?? b.name}</th>{/each}</tr></thead>
      <tbody>
        {#each ls as a}
          <tr>
            <td class="p-2 text-text whitespace-nowrap">{displayNames[a.id] ?? a.name}</td>
            {#each ls as b}
              {#if a.id === b.id}
                <td class="p-2 text-center text-text-faint">—</td>
              {:else}
                {@const v = intelligibility(a.lex, b.lex)}
                {@const open = openRoutes.has(routeKey(a.id, b.id))}
                <!-- 2STK.5: ⇄ marks an open trade route on this border, matching
                     HistoryList's borrow glyph — borrowing can only fire here. -->
                <td class="p-2 text-center tabular-nums font-mono" style="color:{colour(v)}"
                    title={open ? "trade route open — borrowing can fire on this border" : "no trade route — borrowing is closed on this border"}>
                  {Math.round(v * 100)}{#if open}<span class="text-accent">⇄</span>{/if}
                </td>
              {/if}
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <p class="mt-3.5 text-[11px] text-text-muted">Normalised edit distance across the shared concept list. <span class="text-accent">⇄</span> marks an open trade route — borrowing can fire on that border only.</p>
{/if}
