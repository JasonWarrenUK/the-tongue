<script lang="ts">
  import { intelligibility } from "$lib/engine/intelligibility";
  import { routeKey } from "$lib/engine/contact";
  import type { Branch } from "$lib/engine/types";
  let { leaves, displayNames, openRoutes }:
    { leaves: Branch[]; displayNames: Record<number, string>; openRoutes: Set<string> } = $props();
  const ls = $derived(leaves.slice().sort((a, b) => a.id - b.id));
  const colour = (v: number) =>
    v >= 0.7 ? "var(--color-positive)" : v >= 0.4 ? "var(--color-accent)" : "var(--color-warn)";
</script>

{#if leaves.length < 2}
  <p class="text-muted text-xs">As the family fractures, mutual intelligibility between living languages appears here.</p>
{:else}
  <div class="overflow-x-auto">
    <table class="text-xs border-collapse">
      <thead><tr><th class="p-1"></th>{#each ls as b}<th class="p-1 text-muted font-normal">{displayNames[b.id] ?? b.name}</th>{/each}</tr></thead>
      <tbody>
        {#each ls as a}
          <tr>
            <td class="p-1 text-muted pr-2">{displayNames[a.id] ?? a.name}</td>
            {#each ls as b}
              {#if a.id === b.id}
                <td class="p-1 text-center text-muted">—</td>
              {:else}
                {@const v = intelligibility(a.lex, b.lex)}
                {@const open = openRoutes.has(routeKey(a.id, b.id))}
                <!-- 2STK.5: ⇄ marks an open trade route on this border, matching
                     HistoryList's borrow glyph — borrowing can only fire here. -->
                <td class="p-1 text-center tabular-nums font-medium" style="color:{colour(v)}"
                    title={open ? "trade route open — borrowing can fire on this border" : "no trade route — borrowing is closed on this border"}>
                  {Math.round(v * 100)}{#if open}<span class="text-positive">⇄</span>{/if}
                </td>
              {/if}
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
