<script lang="ts">
  import type { Candidate } from "$lib/engine/types";
  // tweaks-1: mode is lifted from +page.svelte (its Expert/Casual buttons set it and
  // clear overrides — see the "set all" requirement in the plan). overrides stays
  // local: it's per-card state nobody outside this component needs to read.
  let { candidates, preview, stepCost, pool, mode, onpreview, onapply }:
    { candidates: Candidate[]; preview: string | null; stepCost: number; pool: number; mode: "expert" | "casual";
      onpreview: (id: string | null) => void; onapply: (id: string) => void } = $props();

  let overrides = $state(new Set<string>());
  // a genuine mode change (not the initial run) means the Expert/Casual buttons were
  // pressed — clear per-card overrides so "set all" actually resets every card, not
  // just the ones nobody flipped. $effect.pre runs before the first render too, so
  // untrack the very first pass (mode === lastMode then) rather than clearing an
  // already-empty Set for no reason.
  let lastMode: "expert" | "casual" | undefined = undefined;
  $effect(() => {
    if (lastMode !== undefined && mode !== lastMode) overrides = new Set();
    lastMode = mode;
  });
  const casualFor = (id: string) => (mode === "casual") !== overrides.has(id);
  function toggleCard(id: string) {
    const next = new Set(overrides);
    next.has(id) ? next.delete(id) : next.add(id);
    overrides = next;
  }
</script>

<div class="flex flex-col gap-2 overflow-y-auto max-h-[344px] max-md:max-h-none">
  {#each candidates as { rule, fires, collDelta, momentum, syntax } (rule.id)}
    {@const afford = stepCost <= pool}
    {@const casual = casualFor(rule.id)}
    <div role="button" tabindex="0" onmouseenter={() => onpreview(rule.id)} onmouseleave={() => onpreview(null)} onclick={() => onpreview(rule.id)}
      onkeydown={(ev) => { if ((ev.key === "Enter" || ev.key === " ") && ev.target === ev.currentTarget) { ev.preventDefault(); onpreview(rule.id); } }}
      class="relative rounded-[7px] px-3 py-2.5 cursor-pointer border {preview === rule.id ? 'border-accent bg-accent-bg-strong' : 'border-border bg-surface hover:border-[#c9c0ac]'}">
      <!-- tweaks-2: "i" pinned to the card's actual top-right corner (absolute), not
           inline with the title — reported too easy to overlook there. pr-7 on the
           title row below clears space so the title/Apply row never sits under it. -->
      <button onclick={(ev) => { ev.stopPropagation(); toggleCard(rule.id); }}
        aria-label="{casual ? 'Show technical name' : 'Show plain-English name'} for {rule.name}"
        title={casual ? "show technical name" : "show plain-English explanation"}
        class="absolute top-1.5 right-1.5 w-5.5 h-5.5 flex items-center justify-center rounded-full border border-accent-border bg-accent-bg text-accent text-xs font-bold hover:bg-accent hover:text-[#f7fbf9]">i</button>
      <div class="flex items-center gap-2.5 pr-7">
        <span class="text-text font-semibold text-[13px] flex-1 min-w-0 truncate">{casual ? (rule.casualName ?? rule.name) : rule.name}</span>
        <button onclick={(ev) => { ev.stopPropagation(); if (afford) onapply(rule.id); }} disabled={!afford}
          class="shrink-0 px-2.5 py-1.5 rounded-[5px] text-xs font-semibold {afford ? 'bg-accent text-[#f7fbf9] hover:bg-accent-hover' : 'bg-surface-raised text-text-faint cursor-not-allowed'}">Apply · {stepCost}</button>
      </div>
      <div class="flex items-center justify-between gap-2.5 mt-1.5">
        <span class="font-mono text-[11px] text-text-muted">{casual ? (rule.example ?? rule.note) : rule.note}</span>
        <span class="flex items-center gap-1.5 shrink-0">
          {#if momentum > 1}<span class="text-[10px] px-1.5 py-0.5 rounded bg-accent-bg text-accent" title="{rule.category} momentum">{rule.category} ×{momentum.toFixed(1)}</span>{/if}
          {#if syntax !== 1}<span class="text-[10px] px-1.5 py-0.5 rounded bg-surface-raised text-text-muted" title="position-scaled by this branch's word order">syntax ×{syntax.toFixed(1)}</span>{/if}
          <span class="font-mono text-[10px] px-1.5 py-0.5 rounded {collDelta > 0 ? 'bg-warn-bg text-warn' : 'bg-accent-bg text-accent'}" title="words affected · new collisions">{fires}w {collDelta > 0 ? `+${collDelta}` : "·"}</span>
        </span>
      </div>
    </div>
  {:else}
    <p class="text-text-muted text-xs">No changes apply to the current lexicon.</p>
  {/each}
</div>
