<script lang="ts">
  export type MobileTab = "tree" | "map" | "lexicon" | "changes" | "langs";
  let { tab = $bindable(), warn = false }: { tab: MobileTab; warn?: boolean } = $props();
  // orientation order: where → how we got here → who's alive (centre, default) →
  // the words → act on them.
  const TABS: { id: MobileTab; label: string; glyph: string }[] = [
    { id: "map", label: "Map", glyph: "⬡" },
    { id: "tree", label: "Tree", glyph: "⑂" },
    { id: "langs", label: "Langs", glyph: "◆" },
    { id: "lexicon", label: "Lexicon", glyph: "≡" },
    { id: "changes", label: "Changes", glyph: "→" },
  ];
</script>

<nav class="shrink-0 flex bg-surface border-t border-border" style="padding-bottom:env(safe-area-inset-bottom)">
  {#each TABS as t (t.id)}
    <button role="tab" aria-selected={tab === t.id} onclick={() => (tab = t.id)}
      class="relative flex-1 flex flex-col items-center gap-0.5 py-2 min-h-[52px] text-[11px] border-t-2 {tab === t.id ? 'border-accent text-accent font-semibold' : 'border-transparent text-text-muted'}">
      <span class="text-base leading-none">{t.glyph}</span>
      <span>{t.label}</span>
      {#if t.id === "langs" && warn}<span class="absolute top-1.5 right-[22%] w-2 h-2 rounded-full bg-warn"></span>{/if}
    </button>
  {/each}
</nav>
