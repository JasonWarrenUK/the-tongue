<script lang="ts">
  import type { Snippet } from "svelte";
  // grow: the panel is a flex item that fills its column and hands the free height
  // to its body (used by the rail's lexicon, which scrolls inside the sticky rail).
  let { title, titleHint, titlePrefix, aside, noPadding = false, span = false, grow = false, children }:
    { title: string; titleHint?: string; titlePrefix?: Snippet; aside?: Snippet; noPadding?: boolean; span?: boolean; grow?: boolean; children: Snippet } = $props();
</script>

<section class="bg-surface border border-border rounded-lg overflow-hidden {span ? 'col-span-full' : ''} {grow ? 'flex flex-col flex-1 min-h-0' : ''}">
  <div class="flex items-center justify-between gap-4 px-4 py-3 border-b border-border-subtle flex-wrap">
    <span class="flex items-center gap-2.5 min-w-0" title={titleHint}>
      {#if titlePrefix}{@render titlePrefix()}{/if}
      <h2 class="font-serif text-base font-semibold m-0 truncate">{title}</h2>
    </span>
    {#if aside}<span class="text-xs text-text-faint flex gap-4 flex-wrap">{@render aside()}</span>{/if}
  </div>
  <div class="{noPadding ? '' : 'p-4'} {grow ? 'flex-1 min-h-0 flex flex-col' : ''}">{@render children()}</div>
</section>
