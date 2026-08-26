<script lang="ts">
  import { formOf } from "$lib/engine/phonology";
  import type { Lexicon } from "$lib/engine/types";
  // fill: take the parent's free height (a `grow` Panel) instead of the 344px cap.
  let { lex, previewLex, curHomo, prevHomo, severeConcepts, pressureLabel, fill = false }:
    { lex: Lexicon; previewLex: Lexicon | null; curHomo: Set<string>; prevHomo: Set<string> | null;
      severeConcepts: Set<string>; pressureLabel: Record<string, string>; fill?: boolean } = $props();
</script>

<div class="shrink-0 grid grid-cols-2 px-4 py-2 border-b border-border-subtle text-[10px] tracking-[0.09em] uppercase text-text-faint">
  <span>concept</span><span>form</span>
</div>
<div class="overflow-y-auto {fill ? 'flex-1 min-h-0' : 'max-h-[344px] max-md:max-h-none'}">
  {#each lex as e, i}
    {@const before = formOf(e.word)}
    {@const after = previewLex ? formOf(previewLex[i].word) : before}
    {@const changed = !!previewLex && after !== before}
    {@const homo = previewLex ? prevHomo?.has(after) : curHomo.has(before)}
    {@const severe = !previewLex && severeConcepts.has(e.concept)}
    <div class="grid grid-cols-2 px-4 py-1.5 items-center border-b border-row {changed ? 'bg-accent-bg-strong' : i % 2 ? 'bg-row-alt' : ''}">
      <span class="text-[13px]">{e.concept}</span>
      <span class="font-mono text-sm flex items-center gap-1.5">
        {#if changed}
          <span class="text-text-faint line-through">{before}</span><span class="text-text-faint">→</span><span class="text-accent">{after}</span>
        {:else}
          <span class="text-text">{before}</span>
        {/if}
        {#if homo}
          {#if severe}
            <span class="text-warn text-xs" title={pressureLabel[e.concept] ?? "shares a form with another concept — repairing"}>●</span>
          {:else}
            <span class="text-text-faint text-xs" title="shares a form with another concept — tolerated">●</span>
          {/if}
        {/if}
      </span>
    </div>
  {/each}
</div>
