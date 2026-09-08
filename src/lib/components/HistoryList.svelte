<script lang="ts">
  import type { HistoryEntry } from "$lib/engine/types";
  let { history, splitIndex }: { history: HistoryEntry[]; splitIndex: number } = $props();
</script>

{#if history.length}
  <div>
    <div class="flex items-baseline justify-between mb-2">
      <span class="text-[11px] tracking-[0.1em] uppercase text-text-faint">Chronology</span>
      <span class="text-[11px] text-text-faint"><span class="text-warn">⤳</span> drift · <span class="text-accent">⇄</span> borrowed</span>
    </div>
    <ol class="flex flex-col overflow-y-auto max-h-[300px] max-md:max-h-none">
      {#each history as h, i}
        {#if i === splitIndex && splitIndex > 0}<li class="text-text-faint my-1 text-[10px]">── split ──</li>{/if}
        <li class="flex gap-2.5 items-baseline py-1.5 border-b" style="border-color:#ece5d8">
          <span class="font-mono text-[11px] text-text-fainter tabular-nums w-4.5 shrink-0">{i + 1}.</span>
          <span class="flex-1 min-w-0">
            <span class="block text-xs {i < splitIndex ? 'text-text-muted' : h.drift || h.borrow ? 'text-text-muted italic' : 'text-text'}">
              {#if h.drift}<span class="text-warn not-italic mr-1">⤳</span>{:else if h.borrow}<span class="text-accent not-italic mr-1">⇄</span>{/if}{h.name}
            </span>
            <span class="block font-mono text-[10px] text-text-faint">{h.note}</span>
          </span>
        </li>
      {/each}
    </ol>
  </div>
{/if}
