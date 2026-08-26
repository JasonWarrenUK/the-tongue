<script lang="ts">
  let { turn, onnew }: { turn: number; onnew: () => void } = $props();
</script>

<!-- full overlay, matching FocusDialog's weight — the run is over, not just paused,
     so the rest of the page (map, tree, rule list) must stop reading as live/clickable.
     the one dark card in the app: this is the run's actual ending, not another tile. -->
<div class="fixed inset-0 z-20 flex items-center justify-center p-6" style="background:rgba(33,30,25,0.55)">
  <div class="w-full max-w-[436px] rounded-[10px] p-8 text-center bg-bar" style="box-shadow:0 24px 60px rgba(33,30,25,0.34)">
    <p class="font-serif text-xl m-0 text-bar-text" style="line-height:1.5">The Tongue has fallen silent.</p>
    <p class="font-mono text-xs mt-2.5 mb-5.5 text-bar-muted">generation {turn} · chronicle closed</p>
    <button onclick={onnew}
      class="px-5 py-2.5 rounded-[7px] bg-bar-accent text-bar-accent-text font-semibold text-sm hover:bg-bar-accent-hover">
      Begin a new world
    </button>
  </div>
</div>
