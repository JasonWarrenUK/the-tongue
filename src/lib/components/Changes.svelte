<script lang="ts">
  import type { Candidate } from "$lib/engine/types";
  let { candidates, preview, stepCost, overheadDue, pool, reach, isFocal, onpreview, onapply }:
    { candidates: Candidate[]; preview: string | null; stepCost: number; overheadDue: number; pool: number;
      reach: number; isFocal: boolean;
      onpreview: (id: string | null) => void; onapply: (id: string) => void } = $props();
</script>

<div class="flex flex-col gap-2 overflow-y-auto max-h-[344px] max-md:max-h-none">
  {#each candidates as { rule, fires, collDelta, momentum, syntax } (rule.id)}
    {@const afford = stepCost <= pool}
    <div role="button" tabindex="0" onmouseenter={() => onpreview(rule.id)} onmouseleave={() => onpreview(null)} onclick={() => onpreview(rule.id)}
      onkeydown={(ev) => { if ((ev.key === "Enter" || ev.key === " ") && ev.target === ev.currentTarget) { ev.preventDefault(); onpreview(rule.id); } }}
      class="rounded-[7px] px-3 py-2.5 cursor-pointer border {preview === rule.id ? 'border-accent bg-accent-bg-strong' : 'border-border bg-surface hover:border-[#c9c0ac]'}">
      <div class="flex items-center justify-between gap-2.5">
        <span class="text-text font-semibold text-[13px]">{rule.name}</span>
        <button onclick={(ev) => { ev.stopPropagation(); if (afford) onapply(rule.id); }} disabled={!afford}
          class="shrink-0 px-2.5 py-1.5 rounded-[5px] text-xs font-semibold {afford ? 'bg-accent text-[#f7fbf9] hover:bg-accent-hover' : 'bg-surface-raised text-text-faint cursor-not-allowed'}">Apply · {stepCost}</button>
      </div>
      <div class="flex items-center justify-between gap-2.5 mt-1.5">
        <span class="font-mono text-[11px] text-text-muted">{rule.note}</span>
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
