<script lang="ts">
  import type { HistoryEntry } from "$lib/engine/types";
  let { history, splitIndex }: { history: HistoryEntry[]; splitIndex: number } = $props();
</script>

{#if history.length}
  <div>
    <h2 class="text-xs uppercase tracking-wide text-muted mb-2">Sound-change chronology</h2>
    <ol class="space-y-1">
      {#each history as h, i}
        {#if i === splitIndex && splitIndex > 0}<li class="text-muted my-1" style="font-size:10px">── split ──</li>{/if}
        <li class="text-xs flex gap-2 items-baseline">
          <span class="text-muted tabular-nums">{i + 1}.</span>
          <span class={i < splitIndex ? "text-muted" : h.drift ? "text-muted italic" : "text-fg"}>
            {#if h.drift}<span class="text-warn not-italic mr-1">⤳</span>{/if}{h.name}
          </span>
          <span class="font-mono text-muted">{h.note}</span>
        </li>
      {/each}
    </ol>
  </div>
{/if}
