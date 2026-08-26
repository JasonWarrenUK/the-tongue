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

<div class="fixed inset-0 z-20 flex items-center justify-center p-6" style="background:rgba(33,30,25,0.55)">
  <div class="w-full max-w-[436px] max-h-[90dvh] overflow-y-auto bg-surface border border-border-strong rounded-[10px] p-6" style="box-shadow:0 24px 60px rgba(33,30,25,0.28)">
    <h2 class="font-serif text-xl font-semibold m-0">'{pending.pair[0]}' and '{pending.pair[1]}' are now one word</h2>
    <p class="my-2 mb-4.5 text-sm text-text-muted">
      '{pending.yielding}' yields — choose a modifier to disambiguate, or gamble that drift heals it.
    </p>
    <div class="flex flex-col gap-2">
      {#each shown as modifier (modifier)}
        {@const word = formOf(compoundWord(byConcept[modifier], head, order))}
        <button onclick={() => onrepair(modifier)} disabled={!affordable}
          class="flex items-baseline justify-between gap-3 w-full text-left px-3.5 py-3 border border-border rounded-lg bg-bg hover:border-accent hover:bg-accent-bg-strong disabled:opacity-40 disabled:cursor-not-allowed">
          <span>
            <span class="block font-mono text-base font-medium">{word}</span>
            <span class="block text-xs text-text-muted">'{pending.yielding}' + '{modifier}'</span>
          </span>
          <span class="font-mono text-xs text-accent shrink-0">costs {cost}</span>
        </button>
      {/each}
    </div>
    {#if !affordable}
      <p class="text-warn text-xs mt-3">not enough influence to repair now</p>
    {/if}
    <button onclick={ontolerate}
      class="w-full text-left px-3.5 py-3 mt-2 border border-warn-border rounded-lg bg-warn-bg-2 hover:bg-warn-bg">
      <span class="block text-sm font-semibold text-warn">Tolerate</span>
      <span class="block text-xs text-warn-text-2">free · the pair enters the pressure clock</span>
    </button>
  </div>
</div>
