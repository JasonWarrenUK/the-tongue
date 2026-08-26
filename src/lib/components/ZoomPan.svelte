<script lang="ts">
  import type { Snippet } from "svelte";
  // Mobile pinch/drag/wheel zoom for the territory map. Pure pointer events so one
  // code path serves touch and mouse. Taps still reach the SVG region buttons: a
  // pointer that moves more than TAP_SLOP is a drag, and the click it would emit on
  // release is swallowed in the capture phase.
  let { children, minScale = 1, maxScale = 4 }: { children: Snippet; minScale?: number; maxScale?: number } = $props();

  const TAP_SLOP = 8;
  let scale = $state(1), tx = $state(0), ty = $state(0);
  let frame: HTMLDivElement;
  const pointers = new Map<number, { x: number; y: number }>();
  let lastDist = 0, lastMid = { x: 0, y: 0 }, moved = 0, dragged = false;

  const clamp = () => {
    scale = Math.min(maxScale, Math.max(minScale, scale));
    const r = frame.getBoundingClientRect();
    const maxX = (r.width * (scale - 1)) / 2, maxY = (r.height * (scale - 1)) / 2;
    tx = Math.min(maxX, Math.max(-maxX, tx));
    ty = Math.min(maxY, Math.max(-maxY, ty));
  };
  const mid = () => {
    const pts = [...pointers.values()];
    return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
  };
  const dist = () => {
    const [a, b] = [...pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  };

  function down(e: PointerEvent) {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    frame.setPointerCapture(e.pointerId);
    if (pointers.size === 2) { lastDist = dist(); lastMid = mid(); }
    if (pointers.size === 1) { moved = 0; dragged = false; }
  }
  function move(e: PointerEvent) {
    const prev = pointers.get(e.pointerId); if (!prev) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const d = dist(), m = mid();
      scale *= d / lastDist; tx += m.x - lastMid.x; ty += m.y - lastMid.y;
      lastDist = d; lastMid = m; dragged = true; clamp();
    } else if (pointers.size === 1) {
      const dx = e.clientX - prev.x, dy = e.clientY - prev.y;
      moved += Math.abs(dx) + Math.abs(dy);
      if (moved > TAP_SLOP) { dragged = true; if (scale > 1) { tx += dx; ty += dy; clamp(); } }
    }
  }
  function up(e: PointerEvent) {
    pointers.delete(e.pointerId);
    if (pointers.size === 1) { moved = TAP_SLOP + 1; }
  }
  function wheel(e: WheelEvent) {
    e.preventDefault();
    scale *= e.deltaY < 0 ? 1.12 : 1 / 1.12; clamp();
  }
  function swallowClick(e: MouseEvent) { if (dragged) { e.stopPropagation(); e.preventDefault(); dragged = false; } }
  function reset() { scale = 1; tx = 0; ty = 0; }
</script>

<div class="relative overflow-hidden touch-none select-none" bind:this={frame} role="presentation"
  onpointerdown={down} onpointermove={move} onpointerup={up} onpointercancel={up}
  onwheel={wheel} onclickcapture={swallowClick} ondblclick={reset}>
  <div style="transform:translate({tx}px,{ty}px) scale({scale});transform-origin:center;will-change:transform">
    {@render children()}
  </div>
  {#if scale > 1}
    <button onclick={reset} class="absolute top-2 right-2 px-2 py-1 rounded bg-surface border border-border text-[11px] text-text-muted">reset</button>
  {/if}
</div>
