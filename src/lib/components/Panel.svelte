<script lang="ts">
  import type { Snippet } from "svelte";
  let { title, titleHint, titlePrefix, aside, noPadding = false, span = false, children }:
    { title: string; titleHint?: string; titlePrefix?: Snippet; aside?: Snippet; noPadding?: boolean; span?: boolean; children: Snippet } = $props();
</script>

<section class="bg-surface border border-border rounded-lg overflow-hidden {span ? 'col-span-full' : ''}">
  <div class="flex items-center justify-between gap-4 px-4 py-3 border-b border-border-subtle flex-wrap">
    <span class="flex items-center gap-2.5 min-w-0" title={titleHint}>
      {#if titlePrefix}{@render titlePrefix()}{/if}
      <h2 class="font-serif text-base font-semibold m-0 truncate">{title}</h2>
    </span>
    {#if aside}<span class="text-xs text-text-faint flex gap-4 flex-wrap">{@render aside()}</span>{/if}
  </div>
  <div class={noPadding ? "" : "p-4"}>{@render children()}</div>
</section>
