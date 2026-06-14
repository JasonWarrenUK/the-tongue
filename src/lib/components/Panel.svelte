<script lang="ts">
  import type { Snippet } from "svelte";
  let { title, children }: { title: string; children: Snippet } = $props();
</script>

<div class="bg-surface rounded-lg border border-border p-3">
  <h2 class="text-xs uppercase tracking-wide text-muted mb-2">{title}</h2>
  {@render children()}
</div>
