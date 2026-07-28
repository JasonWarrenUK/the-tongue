<script lang="ts">
  import type { ContactResult } from "$lib/engine/contact";
  let { turn, pool, base, willDrift, log, contact, contactNames, onend, ontogglecfg }:
    { turn: number; pool: number; base: number; willDrift: number; log: string[];
      contact: ContactResult | null; contactNames: [string, string] | null;
      onend: () => void; ontogglecfg: () => void } = $props();
  const pct = $derived(Math.max(0, Math.min(100, (pool / base) * 100)));
</script>

<div class="mt-4 bg-surface rounded-lg border border-border px-3 py-2.5">
  <div class="flex flex-wrap items-center gap-3">
    <span class="text-accent font-medium text-xs">Generation {turn}</span>
    <div class="flex items-center gap-2 grow min-w-40">
      <span class="text-muted text-xs">Influence</span>
      <div class="grow h-2 bg-surface-2 rounded overflow-hidden max-w-xs"><div class="h-full bg-accent" style="width:{pct}%"></div></div>
      <span class="text-fg text-xs tabular-nums">{pool}/{base}</span>
    </div>
    <span class="text-xs text-muted">{willDrift} will drift</span>
    <!-- 2STK.5 §5: the pending contact forecast, shown before resolution (visibility
         constraint). "likely"/(forecast) name their own uncertainty deliberately —
         the pair/odds are live-recomputed from CURRENT state, but resolveGeneration
         resolves post-spread/post-drift, so a spread this generation can move the
         pair and drift can shift the odds — see game.svelte.ts pendingContact. -->
    {#if contact && contactNames}
      <span class="text-xs text-muted" title="forecast from current borders — a spread or drift this generation can change it">
        <span class="text-positive not-italic">⇄</span>
        likely {contact.kind}: {contactNames[0]}–{contactNames[1]}
        <span class="tabular-nums {contact.odds >= 0.5 ? 'text-positive' : 'text-warn'}">{Math.round(contact.odds * 100)}%</span>
        <span class="italic">(forecast)</span>
      </span>
    {/if}
    <button onclick={onend} class="text-xs px-3 py-1 rounded bg-surface-2 hover:bg-muted/20 text-fg">End generation ⟳</button>
    <button onclick={ontogglecfg} class="text-xs px-2 py-1 rounded bg-surface-2 hover:bg-muted/20">⚙</button>
  </div>
  {#if log.length}<div class="text-xs text-muted mt-1.5">last gen: {log.join(" · ")}</div>{/if}
</div>
