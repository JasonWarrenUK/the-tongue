<script lang="ts">
  import { branchColor } from "$lib/engine/tree";
  import type { Branch, PendingFocusChoice } from "$lib/engine/types";
  let { choice, focusId, branches, displayNames, mournTurns, onfracture, onsuccessor, onsilence }:
    { choice: PendingFocusChoice; focusId: number; branches: Record<number, Branch>;
      displayNames: Record<number, string>; mournTurns: number;
      onfracture: (id: number) => void; onsuccessor: (id: number) => void; onsilence: () => void } = $props();
</script>

<div class="fixed inset-0 z-20 flex items-center justify-center p-6" style="background:rgba(33,30,25,0.55)">
  <div class="w-full max-w-[436px] bg-surface border border-border-strong rounded-[10px] p-6" style="box-shadow:0 24px 60px rgba(33,30,25,0.28)">
    {#if choice.kind === "fracture"}
      <h2 class="font-serif text-xl font-semibold m-0">The self has split</h2>
      <p class="my-2 mb-4.5 text-sm text-text-muted">Which fragment carries the Tongue forward?</p>
      <div class="flex flex-col gap-2">
        <button onclick={() => onfracture(focusId)}
          class="flex items-center gap-3 w-full text-left px-3.5 py-3 border border-border rounded-lg bg-bg hover:border-accent hover:bg-accent-bg-strong">
          <span class="w-2.5 h-2.5 rounded-sm shrink-0" style="background:{branchColor(focusId)}"></span>
          <span class="flex-1 min-w-0">
            <span class="block text-[15px] font-semibold">{displayNames[focusId] ?? branches[focusId].name}</span>
            <span class="block text-xs text-text-muted">stay · continuing lineage</span>
          </span>
        </button>
        {#each choice.bornIds as id (id)}
          <button onclick={() => onfracture(id)}
            class="flex items-center gap-3 w-full text-left px-3.5 py-3 border border-border rounded-lg bg-bg hover:border-accent hover:bg-accent-bg-strong">
            <span class="w-2.5 h-2.5 rounded-sm shrink-0" style="background:{branchColor(id)}"></span>
            <span class="flex-1 min-w-0">
              <span class="block text-[15px] font-semibold">{displayNames[id] ?? branches[id].name}</span>
              <span class="block text-xs text-text-muted">wears a fresh stem · birth-divergence applied</span>
            </span>
          </button>
        {/each}
      </div>
    {:else}
      <h2 class="font-serif text-xl font-semibold m-0">The Tongue's body has fallen</h2>
      <p class="my-2 mb-4.5 text-sm text-text-muted">Who inherits the voice?</p>
      <div class="flex flex-col gap-2">
        {#each choice.heirs as h (h.id)}
          <button onclick={() => onsuccessor(h.id)}
            class="flex items-center gap-3 w-full text-left px-3.5 py-3 border border-border rounded-lg bg-bg hover:border-accent hover:bg-accent-bg-strong">
            <span class="w-2.5 h-2.5 rounded-sm shrink-0" style="background:{branchColor(h.id)}"></span>
            <span class="flex-1 min-w-0">
              <span class="block text-[15px] font-semibold">{displayNames[h.id] ?? branches[h.id].name}</span>
              <span class="block font-mono text-[11px] text-text-muted">distance {h.blendDistance.toFixed(2)} · hoarse voice ×{h.mourningMult.toFixed(2)} for {mournTurns} gens</span>
            </span>
          </button>
        {/each}
        {#if !choice.heirs.length}
          <p class="text-text-muted text-xs">No living branch is close enough to inherit.</p>
        {/if}
        <button onclick={onsilence}
          class="w-full text-left px-3.5 py-3 border border-warn-border rounded-lg bg-warn-bg-2 hover:bg-warn-bg">
          <span class="block text-sm font-semibold text-warn">Fall silent</span>
          <span class="block text-xs text-warn-text-2">end the run · the chronicle closes</span>
        </button>
      </div>
    {/if}
  </div>
</div>
