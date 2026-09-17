<script lang="ts">
  import type { Snippet } from "svelte";
  // grow: the panel is a flex item that fills its column and hands the free height
  // to its body (used by the rail's lexicon, which scrolls inside the right rail).
  // helpKey/onhelp (tweaks-2): when both are set, an "i" button renders as its OWN
  // flex item at the far right of the title row — always last, after `aside` — rather
  // than inline next to the title (tweaks-1's placement, reported too easy to miss).
  // Panel owns no modal state itself; the caller does (+page.svelte), so this is a
  // plain emit-upward pair.
  let { title, titleHint, titlePrefix, aside, noPadding = false, span = false, grow = false, helpKey, onhelp, children }:
    { title: string; titleHint?: string; titlePrefix?: Snippet; aside?: Snippet; noPadding?: boolean; span?: boolean; grow?: boolean;
      helpKey?: string; onhelp?: (key: string) => void; children: Snippet } = $props();
</script>

<section class="bg-surface border border-border rounded-lg overflow-hidden {span ? 'col-span-full' : ''} {grow ? 'flex flex-col flex-1 min-h-0' : ''}">
  <div class="flex items-center justify-between gap-4 px-4 py-3 border-b border-border-subtle flex-wrap">
    <span class="flex items-center gap-2.5 min-w-0" title={titleHint}>
      {#if titlePrefix}{@render titlePrefix()}{/if}
      <h2 class="font-serif text-base font-semibold m-0 truncate">{title}</h2>
    </span>
    <span class="flex items-center gap-4 flex-wrap ml-auto">
      {#if aside}<span class="text-xs text-text-faint flex gap-4 flex-wrap">{@render aside()}</span>{/if}
      {#if helpKey && onhelp}
        <button onclick={() => onhelp(helpKey)} aria-label="About {title}" title="About {title}"
          class="shrink-0 w-6 h-6 flex items-center justify-center rounded-full border border-accent-border bg-accent-bg text-accent text-xs font-bold hover:bg-accent hover:text-[#f7fbf9]">i</button>
      {/if}
    </span>
  </div>
  <div class="{noPadding ? '' : 'p-4'} {grow ? 'flex-1 min-h-0 flex flex-col' : ''}">{@render children()}</div>
</section>
