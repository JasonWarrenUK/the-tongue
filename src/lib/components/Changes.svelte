<script lang="ts">
  import type { Candidate } from "$lib/engine/types";
  let { candidates, preview, stepCost, overheadDue, pool, onpreview, onapply }:
    { candidates: Candidate[]; preview: string | null; stepCost: number; overheadDue: number; pool: number;
      onpreview: (id: string | null) => void; onapply: (id: string) => void } = $props();
</script>

<div>
  <div class="flex items-center justify-between mb-2">
    <h2 class="text-xs uppercase tracking-wide text-muted">Available changes</h2>
    {#if overheadDue > 0}<span class="text-xs text-muted">first change here +{overheadDue} overhead</span>{/if}
  </div>
  <div class="space-y-2">
    {#each candidates as { rule, fires, collDelta } (rule.id)}
      {@const afford = stepCost <= pool}
      <div role="button" tabindex="0" onmouseenter={() => onpreview(rule.id)} onmouseleave={() => onpreview(null)} onclick={() => onpreview(rule.id)}
        class="rounded-md px-2.5 py-1.5 cursor-pointer border transition-colors {preview === rule.id ? 'border-accent bg-surface' : 'border-border bg-surface hover:border-muted'}">
        <div class="flex items-center justify-between gap-2">
          <span class="text-fg font-medium text-xs">{rule.name}</span>
          <button onclick={(ev) => { ev.stopPropagation(); if (afford) onapply(rule.id); }} disabled={!afford}
            class="shrink-0 px-2 py-0.5 rounded text-xs font-medium {afford ? 'bg-accent text-on-accent hover:bg-accent/80' : 'bg-surface-2 text-muted cursor-not-allowed'}">Apply · {stepCost}</button>
        </div>
        <div class="flex items-center justify-between gap-2 mt-0.5">
          <span class="font-mono text-xs text-muted">{rule.note}</span>
          <span class="shrink-0 text-xs {collDelta > 0 ? 'text-warn' : 'text-positive'}">{fires}w {collDelta > 0 ? `+${collDelta}` : "·"}</span>
        </div>
      </div>
    {:else}
      <p class="text-muted text-xs">No changes apply to the current lexicon.</p>
    {/each}
  </div>
</div>
