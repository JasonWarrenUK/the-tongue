<script lang="ts">
  // tweaks-2: pages the topic's paragraphs, one per screen, with Next/Previous/Close
  // — replaces the earlier single-scroll-page shape. `pages` resets to page 0 whenever
  // a NEW topic opens (title change), tracked below rather than trusting the parent to
  // remount the component (it doesn't: +page.svelte keeps one <InfoModal> mounted and
  // just swaps props when helpTopic changes).
  let { title, pages, onclose }: { title: string; pages: string[]; onclose: () => void } = $props();

  let page = $state(0);
  // undefined on the first run so that pass is a no-op (nothing to reset FROM yet),
  // matching Changes.svelte's identical mode-change idiom — a plain `let lastTitle =
  // title` captures only the initial value and never sees later prop changes.
  let lastTitle: string | undefined = undefined;
  $effect(() => {
    if (lastTitle !== undefined && title !== lastTitle) page = 0;
    lastTitle = title;
  });

  const isFirst = $derived(page === 0);
  const isLast = $derived(page === pages.length - 1);

  let closeBtn: HTMLButtonElement | undefined = $state();
  let titleId = `info-modal-title-${Math.random().toString(36).slice(2)}`;

  $effect(() => {
    closeBtn?.focus();
  });

  function onkeydown(ev: KeyboardEvent) {
    if (ev.key === "Escape") { ev.preventDefault(); onclose(); }
    if (ev.key === "ArrowRight" && !isLast) { ev.preventDefault(); page += 1; }
    if (ev.key === "ArrowLeft" && !isFirst) { ev.preventDefault(); page -= 1; }
  }
</script>

<svelte:window onkeydown={onkeydown} />

<div class="fixed inset-0 z-30 flex items-center justify-center p-6" style="background:rgba(33,30,25,0.55)"
  onclick={(ev) => { if (ev.target === ev.currentTarget) onclose(); }} role="presentation">
  <div role="dialog" aria-modal="true" aria-labelledby={titleId}
    class="w-full max-w-[480px] max-h-[90dvh] overflow-y-auto bg-surface border border-border-strong rounded-[10px] p-6"
    style="box-shadow:0 24px 60px rgba(33,30,25,0.28)">
    <div class="flex items-start justify-between gap-4 mb-3">
      <h2 id={titleId} class="font-serif text-xl font-semibold m-0">{title}</h2>
      <button bind:this={closeBtn} onclick={onclose} aria-label="Close"
        class="shrink-0 w-7 h-7 flex items-center justify-center rounded-full border border-border text-text-muted hover:bg-surface-raised hover:text-text">×</button>
    </div>
    <div class="text-sm text-text" style="line-height:1.55">
      <p class="m-0">{pages[page]}</p>
    </div>
    {#if pages.length > 1}
      <div class="flex items-center justify-between gap-4 mt-5 pt-3 border-t border-border-subtle">
        <button onclick={() => (page -= 1)} disabled={isFirst}
          class="px-3 py-1.5 rounded-[5px] text-xs font-semibold border border-border-strong {isFirst ? 'text-text-faint cursor-not-allowed opacity-50' : 'text-text hover:bg-surface-raised'}">← Previous</button>
        <span class="text-xs text-text-faint font-mono tabular-nums">{page + 1} / {pages.length}</span>
        {#if isLast}
          <button onclick={onclose}
            class="px-3.5 py-1.5 rounded-[5px] text-xs font-semibold bg-accent text-[#f7fbf9] hover:bg-accent-hover">Close</button>
        {:else}
          <button onclick={() => (page += 1)}
            class="px-3.5 py-1.5 rounded-[5px] text-xs font-semibold bg-accent text-[#f7fbf9] hover:bg-accent-hover">Next →</button>
        {/if}
      </div>
    {/if}
  </div>
</div>
