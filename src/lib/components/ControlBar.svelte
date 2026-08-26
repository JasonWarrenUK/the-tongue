<script lang="ts">
  import type { ContactResult } from "$lib/engine/contact";
  import type { Settings } from "$lib/engine/types";
  let { log, contact, contactNames, settings, showCfg, onchange }:
    { log: string[]; contact: ContactResult | null; contactNames: [string, string] | null;
      settings: Settings; showCfg: boolean; onchange: (k: keyof Settings, v: number) => void } = $props();
  const fields: [keyof Settings, string][] = [
    ["pool", "base influence"], ["growth", "influence / region"], ["overhead", "attention overhead"],
    ["changeCost", "cost per change"], ["spreadEvery", "spread every N gen"],
  ];
</script>

<div class="flex items-center gap-4.5 px-6 py-2.5 bg-surface-raised border-b border-border flex-wrap">
  <!-- 2STK.5 §5: forecast from CURRENT borders — a spread or drift this generation
       can change the pair or its odds before resolveGeneration actually runs. -->
  {#if contact && contactNames}
    <span class="inline-flex items-center gap-1.5 px-2.5 py-1 border border-accent-border-2 rounded-full bg-accent-bg text-xs whitespace-nowrap"
      title="forecast from current borders — a spread or drift this generation can change it">
      <span class="text-accent">⇄</span>
      {#if contact.odds === 0}
        <span>{contactNames[0]}–{contactNames[1]}: too divergent to make contact</span>
      {:else}
        <span>likely {contact.kind} · {contactNames[0]}–{contactNames[1]}</span>
        <span class="font-mono text-accent font-medium">{Math.round(contact.odds * 100)}%</span>
      {/if}
      <span class="text-text-faint italic">forecast</span>
    </span>
  {/if}
  {#if log.length}<span class="text-xs text-text-muted italic">{log.join(" · ")}</span>{/if}

  {#if showCfg}
    <span class="flex items-center gap-3.5 ml-auto flex-wrap">
      <span class="text-[11px] tracking-[0.1em] uppercase text-text-faint">Economy</span>
      {#each fields as [k, label]}
        <label class="flex items-center gap-1.5 text-[11px] text-text-muted whitespace-nowrap">{label}
          <input type="number" min={k === "spreadEvery" ? 1 : 0} value={settings[k]}
            oninput={(e) => onchange(k, Number((e.target as HTMLInputElement).value))}
            class="w-12 bg-surface border border-input-border rounded px-1.5 py-1 font-mono text-xs text-right" />
        </label>
      {/each}
    </span>
  {/if}
</div>
