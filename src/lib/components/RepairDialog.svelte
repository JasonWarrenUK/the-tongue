<script lang="ts">
  import { compoundWord } from "$lib/engine/collision";
  import { formOf } from "$lib/engine/phonology";
  import type { PendingRepair } from "$lib/game.svelte";
  import type { Lexicon, CompoundOrder } from "$lib/engine/types";
  let { pending, lex, order, cost, affordable, onrepair, ontolerate }:
    { pending: PendingRepair; lex: Lexicon; order: CompoundOrder; cost: number; affordable: boolean;
      onrepair: (modifier: string) => void; ontolerate: () => void } = $props();

  const byConcept = $derived(Object.fromEntries(lex.map((e) => [e.concept, e.word])));
  const head = $derived(byConcept[pending.yielding]);
  // the tail beyond the top 6 is all sub-0.1 relatedness (2lex-1 spike §5) — a 30-item
  // modal for the noun class is unusable, so only the meaningful candidates render.
  const shown = $derived(pending.candidates.slice(0, 6));
</script>

<div class="fixed inset-0 z-20 bg-bg/80 flex items-center justify-center p-4">
  <div class="bg-surface rounded-lg border border-border p-4 max-w-sm w-full space-y-3">
    <h2 class="text-accent font-medium">'{pending.pair[0]}' and '{pending.pair[1]}' are now one word</h2>
    <p class="text-muted text-xs">
      '{pending.yielding}' yields — choose a modifier to disambiguate, or gamble that drift heals it.
    </p>
    <div class="space-y-1.5">
      {#each shown as modifier (modifier)}
        {@const word = formOf(compoundWord(byConcept[modifier], head, order))}
        <button onclick={() => onrepair(modifier)} disabled={!affordable}
          class="w-full text-left px-3 py-2 rounded bg-surface-2 hover:bg-muted/20 text-fg disabled:opacity-40 disabled:cursor-not-allowed">
          <span class="font-mono font-medium text-xs">{word}</span>
          <span class="block text-muted text-xs">'{pending.yielding}' + '{modifier}' · costs {cost}</span>
        </button>
      {/each}
    </div>
    {#if !affordable}
      <p class="text-warn text-xs">not enough influence to repair now</p>
    {/if}
    <button onclick={ontolerate} class="w-full text-left px-3 py-2 rounded border border-warn/40 text-warn hover:bg-warn/10">
      <span class="font-medium text-xs">Tolerate</span>
      <span class="block text-xs opacity-80">free · the pair enters the pressure clock</span>
    </button>
  </div>
</div>
