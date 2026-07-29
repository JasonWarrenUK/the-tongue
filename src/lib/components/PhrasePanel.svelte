<script lang="ts">
  import { FRAMES, frameOrder } from "$lib/engine/syntax";
  import { formOf } from "$lib/engine/phonology";
  import { conceptsOfClass } from "$lib/engine/lexicon";
  import type { Frame } from "$lib/engine/syntax";
  import type { ConceptClass } from "$lib/engine/lexicon";
  import type { FrameWeights, Lexicon, WordOrder } from "$lib/engine/types";

  let { lex, order, weights, proDrop }:
    { lex: Lexicon; order: WordOrder; weights: FrameWeights; proDrop: boolean } = $props();

  // 1ENG.19 (spike §4.4) — deterministic slot fill: the Nth slot of a class in a
  // frame takes the Nth concept of that class in SUBSTRATE_ORDER, so F1's O and F4's
  // G+N (both two-noun frames) never repeat the same word twice. First-of-class
  // rather than seeded: this panel is a GRAMMAR demo, not a lexicon sample — the same
  // words every turn make the ORDER change legible, which a re-rolled set would
  // actively obscure. Falls back to "—" on a missing concept so a 32-entry (pre-
  // 1ENG.19) fixture lexicon can't crash it.
  function fill(frame: Frame) {
    const seen: Partial<Record<ConceptClass, number>> = {};
    return frameOrder(frame, order, proDrop).map((slot) => {
      const n = (seen[slot.class] = (seen[slot.class] ?? -1) + 1);
      const concept = conceptsOfClass(slot.class)[n];
      const entry = concept ? lex.find((e) => e.concept === concept) : undefined;
      return { role: slot.role, concept: concept ?? "—", form: entry ? formOf(entry.word) : "—" };
    });
  }

  const totalWeight = $derived(weights.reduce((a, w) => a + w, 0));
</script>

<div class="space-y-2.5">
  <div class="text-xs text-muted">
    {order.basic} · {order.adj}{#if proDrop} · pro-drop{/if}
  </div>
  {#each FRAMES as frame, i}
    {@const slots = fill(frame)}
    <div class="flex items-baseline gap-3">
      <span class="text-muted text-xs w-6 shrink-0">{frame.id}</span>
      <div class="flex-1 min-w-0">
        <div class="font-mono text-fg">{slots.map((s) => s.form).join(" ")}</div>
        <div class="text-xs text-muted truncate">{slots.map((s) => s.concept).join(" ")}</div>
      </div>
      <span class="text-muted text-xs tabular-nums shrink-0" title="frame usage weight">
        {totalWeight > 0 ? Math.round((weights[i] / totalWeight) * 100) : 0}%
      </span>
    </div>
  {/each}
</div>
