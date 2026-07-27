<script lang="ts">
  let { turn, onnew }: { turn: number; onnew: () => void } = $props();
</script>

<!-- full overlay, matching FocusDialog's weight — the run is over, not just paused,
     so the rest of the page (map, tree, rule list) must stop reading as live/clickable. -->
<div class="fixed inset-0 z-20 bg-bg/80 flex items-center justify-center p-4">
  <div class="bg-surface rounded-lg border border-warn/40 p-4 max-w-sm w-full space-y-3 text-center">
    <p class="text-warn text-sm">The Tongue has fallen silent · generation {turn} · chronicle closed</p>
    <button onclick={onnew} class="px-3 py-1 rounded text-xs font-medium bg-accent text-on-accent hover:bg-accent/80">
      Begin a new world
    </button>
  </div>
</div>
