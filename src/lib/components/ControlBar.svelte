<script lang="ts">
  let { turn, pool, base, willDrift, log, onend, ontogglecfg }:
    { turn: number; pool: number; base: number; willDrift: number; log: string[];
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
    <button onclick={onend} class="text-xs px-3 py-1 rounded bg-surface-2 hover:bg-muted/20 text-fg">End generation ⟳</button>
    <button onclick={ontogglecfg} class="text-xs px-2 py-1 rounded bg-surface-2 hover:bg-muted/20">⚙</button>
  </div>
  {#if log.length}<div class="text-xs text-muted mt-1.5">last gen: {log.join(" · ")}</div>{/if}
</div>
