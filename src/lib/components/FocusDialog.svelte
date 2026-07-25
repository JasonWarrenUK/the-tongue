<script lang="ts">
  import type { Branch, PendingFocusChoice } from "$lib/engine/types";
  let { choice, focusId, branches, displayNames, onfracture, onsuccessor, onsilence }:
    { choice: PendingFocusChoice; focusId: number; branches: Record<number, Branch>;
      displayNames: Record<number, string>;
      onfracture: (id: number) => void; onsuccessor: (id: number) => void; onsilence: () => void } = $props();
</script>

<div class="fixed inset-0 z-20 bg-bg/80 flex items-center justify-center p-4">
  <div class="bg-surface rounded-lg border border-border p-4 max-w-sm w-full space-y-3">
    {#if choice.kind === "fracture"}
      <h2 class="text-accent font-medium">The self has split</h2>
      <p class="text-muted text-xs">Which fragment carries the Tongue forward?</p>
      <div class="space-y-1.5">
        <button onclick={() => onfracture(focusId)}
          class="w-full text-left px-3 py-2 rounded bg-surface-2 hover:bg-muted/20 text-fg">
          <span class="font-medium text-xs">{displayNames[focusId] ?? branches[focusId].name}</span>
          <span class="block text-muted text-xs">stay · continuing lineage</span>
        </button>
        {#each choice.bornIds as id (id)}
          <button onclick={() => onfracture(id)}
            class="w-full text-left px-3 py-2 rounded bg-surface-2 hover:bg-muted/20 text-fg">
            <span class="font-medium text-xs">{displayNames[id] ?? branches[id].name}</span>
            <span class="block text-muted text-xs">wears a fresh stem · birth-divergence applied</span>
          </button>
        {/each}
      </div>
    {:else}
      <h2 class="text-accent font-medium">The Tongue's body has fallen</h2>
      <p class="text-muted text-xs">Who inherits the voice?</p>
      <div class="space-y-1.5">
        {#each choice.heirs as h (h.id)}
          <button onclick={() => onsuccessor(h.id)}
            class="w-full text-left px-3 py-2 rounded bg-surface-2 hover:bg-muted/20 text-fg">
            <span class="font-medium text-xs">{displayNames[h.id] ?? branches[h.id].name}</span>
            <span class="block text-muted text-xs">distance {h.blendDistance.toFixed(2)} · hoarse voice ×{h.mourningMult.toFixed(2)} for 5 gens</span>
          </button>
        {/each}
        {#if !choice.heirs.length}
          <p class="text-muted text-xs">No living branch is close enough to inherit.</p>
        {/if}
        <button onclick={onsilence} class="w-full text-left px-3 py-2 rounded border border-warn/40 text-warn hover:bg-warn/10">
          <span class="font-medium text-xs">Fall silent</span>
          <span class="block text-xs opacity-80">end the run · the chronicle closes</span>
        </button>
      </div>
    {/if}
  </div>
</div>
