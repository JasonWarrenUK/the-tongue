<script lang="ts">
  let { seed = $bindable(), leafCount, turn, pool, base, willDrift, onload, onnew, onend, ontogglecfg }:
    { seed: number; leafCount: number; turn: number; pool: number; base: number; willDrift: number;
      onload: () => void; onnew: () => void; onend: () => void; ontogglecfg: () => void } = $props();
  const pct = $derived(Math.max(0, Math.min(100, (pool / base) * 100)));
</script>

<header class="bar flex items-center gap-5 px-6 py-3.5 bg-bar text-bar-text flex-wrap">
  <h1 class="font-serif text-[22px] font-semibold tracking-[-0.01em] m-0 whitespace-nowrap">The Tongue</h1>
  <span class="text-[13px] text-bar-muted whitespace-nowrap">{leafCount} living {leafCount === 1 ? "language" : "languages"}</span>
  <span class="w-px h-[26px] bg-bar-divider"></span>

  <label class="flex items-center gap-2 text-xs text-bar-muted whitespace-nowrap">seed
    <input type="number" bind:value={seed}
      class="w-21 bg-bar-raised border border-bar-border rounded-[5px] px-2 py-1.5 font-mono text-[13px] text-bar-text" />
  </label>
  <span class="flex gap-1.5">
    <button onclick={onload}
      class="px-3 py-1.5 border border-bar-border-2 rounded-[5px] bg-transparent text-bar-text text-xs hover:bg-bar-raised">Load</button>
    <button onclick={onnew}
      class="px-3 py-1.5 border-0 rounded-[5px] bg-bar-accent text-bar-accent-text font-semibold text-xs hover:bg-bar-accent-hover">New world</button>
  </span>
  <span class="w-px h-[26px] bg-bar-divider"></span>

  <span class="flex items-baseline gap-2.5 whitespace-nowrap">
    <span class="text-[11px] tracking-[0.1em] uppercase text-bar-muted">Gen</span>
    <span class="font-serif text-[26px] font-semibold leading-none tabular-nums">{turn}</span>
  </span>

  <span class="flex items-center gap-2.5 w-[250px] shrink-0">
    <span class="text-[11px] tracking-[0.1em] uppercase text-bar-muted">Influence</span>
    <span class="flex-1 h-[9px] rounded-[5px] bg-bar-track overflow-hidden">
      <span class="block h-full bg-bar-accent transition-[width]" style="width:{pct}%"></span>
    </span>
    <span class="font-mono text-[13px] tabular-nums"><span class="text-bar-accent-bright">{pool}</span><span class="text-bar-muted">/{base}</span></span>
  </span>

  <span class="text-xs text-bar-muted whitespace-nowrap"><span class="font-mono text-bar-text">{willDrift}</span> will drift</span>

  <span class="flex gap-2 ml-auto">
    <button onclick={onend} class="px-4 py-2.5 border-0 rounded-md bg-bar-accent text-bar-accent-text font-semibold text-[13px] hover:bg-bar-accent-hover whitespace-nowrap">End generation ⟳</button>
    <button onclick={ontogglecfg} title="economy settings"
      class="px-3 py-2.5 border border-bar-border-2 rounded-md bg-transparent text-bar-text text-[13px] hover:bg-bar-raised">⚙</button>
  </span>
</header>
