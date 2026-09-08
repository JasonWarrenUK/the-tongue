<script lang="ts">
  let { seed = $bindable(), leafCount, turn, pool, base, willDrift, onload, onnew, onend, ontogglecfg }:
    { seed: number; leafCount: number; turn: number; pool: number; base: number; willDrift: number;
      onload: () => void; onnew: () => void; onend: () => void; ontogglecfg: () => void } = $props();
  const pct = $derived(Math.max(0, Math.min(100, (pool / base) * 100)));
</script>

<header class="bar shrink-0 bg-bar text-bar-text px-4 pt-3 pb-2.5 flex flex-col gap-2.5" style="padding-top:calc(12px + env(safe-area-inset-top))">
  <div class="flex items-center gap-3">
    <h1 class="font-serif text-[19px] font-semibold tracking-[-0.01em] m-0 whitespace-nowrap">The Tongue</h1>
    <span class="text-[11px] text-bar-muted whitespace-nowrap">{leafCount} living</span>
    <span class="flex items-baseline gap-1.5 ml-auto whitespace-nowrap">
      <span class="text-[10px] tracking-[0.1em] uppercase text-bar-muted">Gen</span>
      <span class="font-serif text-[22px] font-semibold leading-none tabular-nums">{turn}</span>
    </span>
  </div>
  <div class="flex items-center gap-2.5">
    <span class="flex-1 h-[9px] rounded-[5px] bg-bar-track overflow-hidden">
      <span class="block h-full bg-bar-accent transition-[width]" style="width:{pct}%"></span>
    </span>
    <span class="font-mono text-[13px] tabular-nums"><span class="text-bar-accent-bright">{pool}</span><span class="text-bar-muted">/{base}</span></span>
    <span class="text-[11px] text-bar-muted whitespace-nowrap"><span class="font-mono text-bar-text">{willDrift}</span> drift</span>
  </div>
  <div class="flex items-center gap-1.5">
    <input type="number" bind:value={seed} aria-label="seed"
      class="w-18 bg-bar-raised border border-bar-border rounded-[5px] px-2 py-1.5 font-mono text-[13px] text-bar-text" />
    <button onclick={onload} class="px-2.5 py-1.5 border border-bar-border-2 rounded-[5px] bg-transparent text-bar-text text-xs">Load</button>
    <button onclick={onnew} class="px-2.5 py-1.5 rounded-[5px] bg-bar-raised border border-bar-border-2 text-bar-text text-xs">New</button>
    <button onclick={ontogglecfg} title="economy settings" class="px-2.5 py-1.5 border border-bar-border-2 rounded-[5px] bg-transparent text-bar-text text-xs">⚙</button>
    <button onclick={onend} class="ml-auto px-3.5 py-2 rounded-md bg-bar-accent text-bar-accent-text font-semibold text-[13px] whitespace-nowrap">End gen ⟳</button>
  </div>
</header>
