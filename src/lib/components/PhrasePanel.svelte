<script lang="ts">
  import { FRAMES, frameOrder, ORDER_TURNS } from "$lib/engine/syntax";
  import { formOf } from "$lib/engine/phonology";
  import { conceptsOfClass } from "$lib/engine/lexicon";
  import { inflect, PATHWAY } from "$lib/engine/morphology";
  import type { Frame } from "$lib/engine/syntax";
  import type { ConceptClass } from "$lib/engine/lexicon";
  import type { AffixState, FrameWeights, Lexicon, ParadigmCell, WordOrder } from "$lib/engine/types";

  let { lex, order, weights, proDrop, paradigm, orderPressure = null, aligningToward = null }:
    { lex: Lexicon; order: WordOrder; weights: FrameWeights; proDrop: boolean;
      paradigm: Record<ParadigmCell, AffixState>;
      // 1ENG.21: optional so every pre-1ENG.21 call site (none exist outside +page.svelte,
      // but the pattern matches how proDrop/paradigm themselves were added) keeps
      // compiling. orderPressure is the rigidification clock's "N/ORDER_TURNS" label
      // (game.svelte.ts's rigidifying already gates whether it's shown at all);
      // aligningToward is the contact driver's target branch name, or null.
      orderPressure?: number | null; aligningToward?: string | null } = $props();

  // 1ENG.20: inverse of morphology.ts's PATHWAY (pronoun concept -> agreement cell),
  // for keying the verb's cell off F1's subject slot. F2's noun subject has no entry
  // here (third person, the bare unmarked baseline) by construction.
  const CELL_OF_PRONOUN: Partial<Record<string, ParadigmCell>> = Object.fromEntries(
    (["p1sg", "p2", "p1pl"] as ParadigmCell[]).map((cell) => [PATHWAY[cell], cell]),
  );

  // 1ENG.19 (spike §4.4) — deterministic slot fill: the Nth slot of a class in a
  // frame takes the Nth concept of that class in SUBSTRATE_ORDER, so F1's O and F4's
  // G+N (both two-noun frames) never repeat the same word twice. First-of-class
  // rather than seeded: this panel is a GRAMMAR demo, not a lexicon sample — the same
  // words every turn make the ORDER change legible, which a re-rolled set would
  // actively obscure. Falls back to "—" on a missing concept so a 32-entry (pre-
  // 1ENG.19) fixture lexicon can't crash it.
  //
  // 1ENG.20: the verb slot renders through inflect() instead of a bare formOf lookup.
  // The agreement cell comes from whichever pronoun sits in THIS frame's CANONICAL
  // subject slot — resolved from frame.slots (never filtered), not from the
  // post-linearisation fill: under pro-drop, frameOrder has already dropped F1's S
  // entirely, so the loop below never visits it and never assigns it a first-of-class
  // concept. Every class's "Nth slot -> Nth concept" numbering is still driven by the
  // slot's position in the CANONICAL (frame.slots) order, matching seen's per-class
  // counting convention, so this lookup can't disagree with the loop's own numbering.
  // F2's noun subject has no pathway (third person, bare). A periphrastic cell
  // returns a separate marker word, rendered alongside the verb — the aller-future
  // moment the spike names.
  function subjectCell(frame: Frame): ParadigmCell | null {
    const idx = frame.slots.findIndex((s) => s.role === "S");
    if (idx < 0 || frame.slots[idx].class !== "pronoun") return null; // F2: noun subject, no pathway
    const pronounIdx = frame.slots.slice(0, idx + 1).filter((s) => s.class === "pronoun").length - 1;
    const concept = conceptsOfClass("pronoun")[pronounIdx];
    // Assumes every pronoun concept has a PATHWAY entry (true for the current i/you/we
    // set) — a future pronoun added without one would silently fall back to bare/nonpast
    // here rather than surfacing the gap.
    return CELL_OF_PRONOUN[concept ?? ""] ?? null;
  }

  function fill(frame: Frame) {
    const cell = subjectCell(frame);
    const seen: Partial<Record<ConceptClass, number>> = {};
    return frameOrder(frame, order, proDrop).map((slot) => {
      const n = (seen[slot.class] = (seen[slot.class] ?? -1) + 1);
      const concept = conceptsOfClass(slot.class)[n];
      const entry = concept ? lex.find((e) => e.concept === concept) : undefined;
      if (slot.class !== "verb" || !entry) {
        return { role: slot.role, concept: concept ?? "—", form: entry ? formOf(entry.word) : "—", marker: null as string | null };
      }
      const { word, marker } = inflect(entry.word, cell, paradigm);
      return { role: slot.role, concept: concept ?? "—", form: formOf(word), marker: marker ? formOf(marker) : null };
    });
  }

  const totalWeight = $derived(weights.reduce((a, w) => a + w, 0));

  const CELL_LABEL: Record<ParadigmCell, string> = { past: "past", p1sg: "1sg", p2: "2", p1pl: "1pl" };
</script>

<div class="space-y-2.5">
  <div class="text-xs text-muted flex items-center gap-2 flex-wrap">
    <span>{order.basic} · {order.adj}{#if proDrop} · pro-drop{/if}</span>
    <!-- 1ENG.21: order-pressure context sits beside the order it's about to change
         (spike §4.4's named home for this warning), mirroring pressureLabel's
         "N/M turns until X" idiom (game.svelte.ts). Shown whenever the clock is
         running, not only in the last-turn window +page.svelte's header warning
         gates on — this is the fuller "why" the header's "what's about to happen"
         doesn't have room for. -->
    {#if orderPressure !== null && orderPressure > 0}
      <span class="text-warn" title="turns of sustained agreement collapse before word order fixes to SVO">
        {orderPressure}/{ORDER_TURNS} turns to rigidify
      </span>
    {/if}
    {#if aligningToward}
      <span class="text-warn" title="sustained contact is pulling this branch's word order toward {aligningToward}">
        aligning toward {aligningToward}
      </span>
    {/if}
  </div>
  {#each FRAMES as frame, i}
    {@const slots = fill(frame)}
    <div class="flex items-baseline gap-3">
      <span class="text-muted text-xs w-6 shrink-0">{frame.id}</span>
      <div class="flex-1 min-w-0">
        <div class="font-mono text-fg">{slots.map((s) => (s.marker ? `${s.form} ${s.marker}` : s.form)).join(" ")}</div>
        <div class="text-xs text-muted truncate">{slots.map((s) => s.concept).join(" ")}</div>
      </div>
      <span class="text-muted text-xs tabular-nums shrink-0" title="frame usage weight">
        {totalWeight > 0 ? Math.round((weights[i] / totalWeight) * 100) : 0}%
      </span>
    </div>
  {/each}
  <!-- 1ENG.20: the paradigm chip row — cell -> current affix form, or "—" at zero.
       Follows Changes.svelte's chip conventions (text-xs, a title on every chip,
       semantic tokens); unlike Changes' fire-gated chips this row always renders,
       since an all-"—" row IS the collapse state worth seeing. -->
  <div class="flex items-center gap-3 flex-wrap pt-1 border-t border-border">
    {#each (["past", "p1sg", "p2", "p1pl"] as ParadigmCell[]) as cell}
      {@const st = paradigm[cell]}
      {@const shown = st.stage === "zero" ? "—" : st.stage === "periphrastic" ? `(${formOf(st.form) || "—"})` : formOf(st.form) || "—"}
      <span class="text-xs {st.stage === 'zero' ? 'text-warn' : st.stage === 'periphrastic' ? 'text-accent' : 'text-muted'}"
        title="{CELL_LABEL[cell]}: {st.stage}{st.stage === 'affixal' ? (st.suffixed ? ' (suffix)' : ' (prefix)') : ''}">
        {CELL_LABEL[cell]} {shown}
      </span>
    {/each}
  </div>
</div>
