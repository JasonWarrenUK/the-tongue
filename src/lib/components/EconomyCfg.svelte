<script lang="ts">
  import type { Settings } from "$lib/engine/types";
  let { settings, onchange }: { settings: Settings; onchange: (k: keyof Settings, v: number) => void } = $props();
  const fields: [keyof Settings, string][] = [
    ["pool", "base influence"], ["growth", "influence / region"], ["overhead", "attention overhead"],
    ["changeCost", "cost per change"], ["spreadEvery", "spread every N gen"],
  ];
</script>

<div class="mt-2 bg-surface rounded-lg border border-border px-3 py-2.5 flex flex-wrap gap-4">
  {#each fields as [k, label]}
    <label class="flex items-center gap-1.5 text-xs text-muted">{label}
      <input type="number" min={k === "spreadEvery" ? 1 : 0} value={settings[k]}
        oninput={(e) => onchange(k, Number((e.target as HTMLInputElement).value))}
        class="w-14 bg-bg rounded px-1.5 py-0.5 text-accent" />
    </label>
  {/each}
</div>
