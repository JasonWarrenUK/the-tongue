<script lang="ts">
  import { formOf } from "$lib/engine/phonology";
  import type { Lexicon } from "$lib/engine/types";
  let { lex, previewLex, curHomo, prevHomo }:
    { lex: Lexicon; previewLex: Lexicon | null; curHomo: Set<string>; prevHomo: Set<string> | null } = $props();
</script>

<div class="bg-surface rounded-lg overflow-hidden border border-border">
  <div class="grid grid-cols-2 text-xs text-muted px-3 py-2 border-b border-border"><span>concept</span><span>form</span></div>
  <div class="overflow-y-auto" style="max-height: 46vh">
    {#each lex as e, i}
      {@const before = formOf(e.word)}
      {@const after = previewLex ? formOf(previewLex[i].word) : before}
      {@const changed = !!previewLex && after !== before}
      {@const homo = previewLex ? prevHomo?.has(after) : curHomo.has(before)}
      <div class="grid grid-cols-2 px-3 py-1.5 items-center {changed ? 'bg-accent/10' : i % 2 ? 'bg-fg/5' : ''}">
        <span class="text-fg">{e.concept}</span>
        <span class="font-mono flex items-center gap-1.5">
          {#if changed}
            <span class="text-muted line-through">{before}</span><span class="text-muted">→</span><span class="text-accent">{after}</span>
          {:else}
            <span class="text-fg">{before}</span>
          {/if}
          {#if homo}<span class="text-warn text-xs" title="shares a form with another concept">●</span>{/if}
        </span>
      </div>
    {/each}
  </div>
</div>
