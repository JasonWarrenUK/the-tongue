<script lang="ts">
  import type { World } from "$lib/engine/types";
  let { seed = $bindable(), leafCount, world, onload, onnew }:
    { seed: number; leafCount: number; world: World; onload: () => void; onnew: () => void } = $props();
</script>

<div class="border-b border-border pb-4">
  <h1 class="text-lg font-semibold text-accent">The Tongue
    <span class="text-muted font-normal">· {leafCount} living {leafCount === 1 ? "language" : "languages"}</span>
  </h1>
  <div class="flex flex-wrap items-center gap-2 mt-3">
    <span class="text-muted text-xs">seed</span>
    <input type="number" bind:value={seed} class="w-24 bg-surface rounded px-2 py-1 text-accent text-xs" />
    <button onclick={onload} class="px-2.5 py-1 rounded bg-surface-2 hover:bg-muted/20 text-xs">Load</button>
    <button onclick={onnew} class="px-2.5 py-1 rounded bg-accent text-on-accent font-medium text-xs hover:bg-accent/80">New world</button>
  </div>
  <div class="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-xs text-muted">
    <span>syllable <span class="font-mono text-fg">{world.tmpl.label}</span></span>
    <span>vowels <span class="font-mono text-fg">{world.inv.vowels.join(" ")}</span></span>
    <span>consonants <span class="font-mono text-fg">{world.inv.consonants.join(" ")}</span></span>
  </div>
</div>
