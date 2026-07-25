<script lang="ts">
  let { turn, onnew }: { turn: number; onnew: () => void } = $props();
</script>

<div class="sticky top-0 z-10 bg-warn/10 border border-warn/40 rounded-lg px-4 py-3 mb-4 flex items-center justify-between">
  <p class="text-warn text-sm">The Tongue has fallen silent · generation {turn} · chronicle closed</p>
  <button onclick={onnew} class="shrink-0 px-3 py-1 rounded text-xs font-medium bg-accent text-on-accent hover:bg-accent/80">
    Begin a new world
  </button>
</div>
