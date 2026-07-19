---
description: 1ENG.15 design spike; a minimal inflectional-paradigm model (tense + agreement) driven by the grammaticalisation cycle, periphrasis to affix to dust to renewal, with a build-ready implementation contract
---

# 1ENG.15 — Design Spike: Morphological Renewal (Agreement/Tense)

> [!IMPORTANT]
> **Goal:** Define, concretely enough to implement without further design work, a minimal inflectional-paradigm model: verbs marked for tense and subject agreement, where the markers are born from real words, fuse into affixes, erode under the same boundary pressure as everything else and are renewed from fresh words when they die. The [1ENG.11 spike §8](./1eng-11-erosion-renewal.md) named morphology as the deepest renewal source and deferred it; this spike collects. Builds directly on the [1ENG.14](./1eng-14-syntax-conditioned-sound-change.md) substrate (word classes, frames, position profiles) and exports the paradigm state 1ENG.14's rigidification driver reads.

---

## Contents

- [1. The gap: words have no insides](#gap)
- [2. What the research actually supports](#research)
- [3. The model](#model)
  - [3.1. One substrate amendment: 'finish'](#finish)
  - [3.2. The paradigm: two categories, five cells](#paradigm)
  - [3.3. The life cycle: periphrasis → affix → dust → renewal](#cycle)
  - [3.4. Affix erosion: the real rules, in edge-injected context](#erosion)
  - [3.5. What replaces the design arithmetic](#arithmetic)
- [4. Where it slots in the turn loop](#slot)
- [5. Implementation contract](#contract)
- [6. Honesty ledger: real vs proxy vs flavour](#ledger)
- [7. Out of scope (surveyed, deferred)](#deferred)
- [Sources](#sources)

---

<a name="gap"><h2>1. The gap: words have no insides</h2></a>

Every word in the engine is a flat segment string. There is no stem, no affix, no paradigm: nothing a language can *inflect*. The 1ENG.12 renewal machinery rebuilds phonological structure (clusters broken, vowels broken, paragoge), and that saved the engine from ossifying, but it is renewal happening entirely *inside* roots. Real languages run a second, deeper renewal loop through their grammar: markers pile onto words, erode away and are replaced from fresh lexical material. That loop is where much of a language's length, variety and drama comes from, and the engine has none of it.

The gap is also a missing export. The [1ENG.14 spike §5](./1eng-14-syntax-conditioned-sound-change.md) specifies word-order rigidification driven by morphological collapse, and until a paradigm exists there is nothing to collapse. 1ENG.14 built the hot zone; this spike puts something in it.

---

<a name="research"><h2>2. What the research actually supports</h2></a>

Four claims underpin the model; each was checked against sources (foot of doc), not asserted from memory.

**The grammaticalisation cycle is real and has run in the historical record, twice, on one tense.** The Romance future: Latin's synthetic *cantabo* gave way to the periphrasis *cantare habeo* ('I have to sing'), which [fused through *chantarayyo* into the new synthetic *chanterai*](https://www.academia.edu/22158945/The_history_of_the_future_morphophonology_syntax_and_grammaticalization), and French is now renewing *again* with periphrastic *aller* + infinitive. Content word → auxiliary → clitic → affix → erosion → fresh periphrasis: the literature calls it the [synthetic/analytical cycle](https://www.academia.edu/4461547/The_Origins_of_the_Synthetic_and_Periphrastic_Futures_in_Latin_and_Italian), and it is this spike's §3.3 stage machine, stage for stage.

**The pathways from word to marker are catalogued and specific.** [Heine & Kuteva's World Lexicon of Grammaticalization](https://www.cambridge.org/core/books/world-lexicon-of-grammaticalization/55F17154D96AB3952734BAB9FCF06959) documents the source → target map across families; 53 of its 173 source concepts are verbs. The ones this spike uses, each independently verified: motion 'go' → future ([French *aller*, English *gonna*](https://grokipedia.com/page/Grammaticalization)); 'have' → future (*cantare habeo* above); **'finish' → perfective/past** ([Rama's suffix *-atkul-* derives from 'finish'](https://en.wikipedia.org/wiki/Perfective_aspect), with the same pathway in unrelated sign languages); **personal pronouns → agreement affixes** ([the pronoun-to-pronominal-affix continuum is standard](https://www.researchgate.net/publication/378174735_Personal_Pronouns_-_Form_Function_and_Grammaticalization)).

**Affixes live at word edges, and word edges are where this engine already erodes.** The [suffixing preference](https://pure.mpg.de/rest/items/item_68385/component/file_506930/content) (Greenberg 1963; Hawkins & Cutler's processing account) puts grammar preferentially at word ends, and 1ENG.14's position profiles make word ends the erosion hot zone for exactly the classes that carry inflection. No new claim is needed for affixes to erode first: a suffix occupies the boundary, so boundary pressure reaches it before the stem. The mechanics compose.

**Morphological collapse has consequences.** The [causal direction morphology → word order](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11765092/) verified for 1ENG.14 means a dead agreement paradigm is not just a display change: it is the trigger condition for that spike's rigidification event. The two spikes share one causal chain, in the attested direction.

---

<a name="model"><h2>3. The model</h2></a>

<a name="finish"><h3>3.1. One substrate amendment: 'finish'</h3></a>

The original 1ENG.14 verb list had no attested past-tense source ('go' and 'say' lead elsewhere). One concept is added: **finish** (class verb, appended at index 47, making 48 concepts), so the pathway map in §3.2 points only at concepts that exist. The [1ENG.14 doc](./1eng-14-syntax-conditioned-sound-change.md) now carries the amended table after the critique-pass revision; 1ENG.19 implements the substrate with all 16 new concepts in one pass.

<a name="paradigm"><h3>3.2. The paradigm: two categories, five cells</h3></a>

Per branch, one paradigm covering both categories the roadmap names:

| Category | Cells | Marked how | Pathway source |
|----------|-------|-----------|----------------|
| tense | past | affix on the verb | **finish** |
| tense | nonpast | bare stem | (unmarked base) |
| agreement | 1sg | affix on the verb | **I** |
| agreement | 2 | affix on the verb | **you** |
| agreement | 1pl | affix on the verb | **we** |
| agreement | 3 | bare stem | (no pronominal source exists) |

Nonpast and third person stay unmarked for an engine-honest reason: the model derives every marker from a source word, nonpast has no source pathway in the verified set and the concept list has no third-person pronoun. Leaving them bare also keeps a visible contrast in the phrase panel (marked cells against a bare baseline) rather than five affixes of undifferentiated porridge.

An affix's *form* is born from its source word's **current form in that branch**, clipped by the same first-vowel-prefix rule 2LEX.1 uses for compound modifiers (machinery reuse, one clipping concept across the engine). Two sibling branches whose words for 'finish' have drifted apart will mint *different* past-tense affixes from the same pathway, which is exactly how related languages end up with cognate but distinct inflections.

Agreement is exercised by the 1ENG.14 frames directly: F1's subject slot is a pronoun, so every rendered transitive clause shows the verb agreeing with its subject's cell; F2's noun subject takes third person, the bare stem. Agreement richness also licenses [1ENG.14's pro-drop parameter](./1eng-14-syntax-conditioned-sound-change.md) (≥2 living agreement cells): the verb says who acts, so the pronoun may vanish from the frame, and paradigm collapse revokes the licence the same turn it starts the rigidification clock.

<a name="cycle"><h3>3.3. The life cycle: periphrasis → affix → dust → renewal</h3></a>

Each marked cell is a small state machine, the synthetic/analytical cycle operationalised:

```
        (seeded at genesis)
              │
              ▼
   ┌──── affixal ────┐   the branch's own sound rules erode (or grow) the affix (§3.4)
   │                 ▼
   │               zero      category unmarked; renewal clock starts;
   │                 │       1ENG.14's rigidification driver sees a dead paradigm
   │                 ▼
   │           periphrastic  after RENEWAL_TURNS: the source concept's current
   │                 │       form (clipped) appears as a separate marker word,
   │                 │       rendered in the phrase panel beside the verb
   └─────────────────┘       after FUSE_TURNS: fusion event; marker becomes affix
```

- **Genesis.** The root branch seeds at the *affixal* stage, affixes pre-fused from the source words' initial forms, as if grammaticalisation happened in prehistory. This mirrors 1ENG.12 seeding diphthongs and long vowels into starting inventories: the erosion machinery gets something to chew from turn 0, and the first dramatic events (an affix dying) arrive within play rather than after a long windup.
- **Placement.** Affix position follows the branch's word order with the suffixing preference on top: OV branches suffix; VO branches suffix on a seeded weighted roll and prefix otherwise. Placement is decided per cell at fusion time and persists until that cell's next cycle.
- **Renewal.** When a dead cell's clock reaches `RENEWAL_TURNS`, the pathway source's *current* word is clipped and enters the periphrastic stage: a real separate word standing beside the verb in the phrase panel, the *aller*-future moment. After `FUSE_TURNS` it fuses: a logged, history-entry event ("in Kasti, the word for 'finish' became the mark of the past").
- **Inheritance.** Fracture children copy the parent's paradigm (stages, forms, clocks), then diverge by ordinary operation: their affixes erode independently, and their renewals clip from their own drifted source words.

History entries for death, renewal and fusion carry no `drift` flag (the 2GEO.4/2LEX.1 ruling: lexical and grammatical events stay out of the sound-change accounting), but they are precisely the kind of era-texture the [1ENG.10 naming collapse](../roadmaps/mvp.md) feeds on.

<a name="erosion"><h3>3.4. Affix erosion: the real rules, in edge-injected context</h3></a>

> [!NOTE]
> **Revised.** The first version of this spike eroded affixes with a seeded segment-shedding clock. The critique pass judged that flat (a three-segment affix of any composition died at the same rate, phonologically inert), and the decision was full realism with no backstop: affixes drift under the actual sound rules, and their lifetimes are whatever emerges.

Each turn, an affix receives **the same drift rule the branch's lexicon just received**, applied through a small transducer variant:

```ts
// applyRuleToWord, with one edge open to the word and the other injected:
// a suffix's RIGHT edge is the word boundary (post:bound rules see it naturally);
// its LEFT context is injected as `ctx` (stem-internal, so pre:bound never fires).
// A prefix mirrors this. The whole-word vowel floor is lifted: an affix may
// legitimately erode to [] — that is cell death.
export function applyRuleToAffix(ids: string[], rule: Rule, edge: "suffix" | "prefix", ctx: Phone | null): string[];
```

The injected context is the **majority stem-final phone** across the branch's verb stems (ties by phone-table order) for a suffix, majority stem-initial for a prefix: the environment the affix actually lives in, computed live, so a branch whose verbs erode to vowel-final stems starts exposing its suffixes to intervocalic lenition. Affixes thereby palatalise, voice, break, lengthen and delete exactly as words do, and the 1ENG.14 syntax gate composes on top: a suffix is verb-final material, so under SOV its boundary rules run at up to 1.5×. The order coupling the clock used to assert by formula now happens by mechanism.

**Consequences, stated plainly:**

- **Death is reachable** (deletion rules empty short affixes; `apoc` and `finalC` on suffixes, `aphaer` and the new `fortify` acting on prefixes) but **never guaranteed**: an affix no drawn rule can touch persists, and one that `break` or `paragoge` reaches can *grow*. Durable inflection is real (Latin's plural *-s* survives in Spanish after two millennia), so long-lived affixes are a feature until proven a bug.
- **Lifetime distribution is emergent**, a function of rule draws, affix shape and position heat. Nothing in this doc claims a cycle period.
- **The acceptance criterion lives in 2SIM.1** (the integration pacing census): 150-turn SOV runs must show grammaticalisation cycles observably turning (past-cell death and renewal actually occurring across seeds). If they never turn, the backstop question this revision closed gets reopened with data in hand.

<a name="arithmetic"><h3>3.5. What replaces the design arithmetic</h3></a>

The clock's neat ~30-turn cycle table is gone and cannot be honestly replaced by hand calculation: the affix now rides the same stochastic rule stream as the lexicon. What remains constant-tunable is the *stage machinery* around erosion: `RENEWAL_TURNS` (dead-cell wait before the new periphrasis) and `FUSE_TURNS` (periphrastic wait before fusion). Those two set the floor of a full cycle at 10 turns plus however long erosion takes, and 2SIM.1 measures the rest.

---

<a name="slot"><h2>4. Where it slots in the turn loop</h2></a>

Morphology lives **inside step 1 (drift)**; no new turn-loop step. After a branch's sound rule resolves against its lexicon, the same rule applies to each affixal cell via `applyRuleToAffix`, then the stage clocks check (death, renewal, fusion, in that order, cells in fixed table order). One locus, same cadence as the erosion it models, no turn-loop reordering:

```
1. drift                 (sound rule on stems, then on affixes; then stage clocks: death → renewal → fusion)
1.5 collisions           (2LEX.2)
2. rename
3. spread
3.5 borrow               (2GEO.5)
3.75 order drift         (1ENG.21; reads TODAY's paradigm state — a same-turn
                          collapse can start the rigidification clock, the
                          intended coupling direction)
4. assimilation
5. fracture              (children inherit the paradigm)
```

Player-touched branches tick their paradigms too, with the player's chosen rule: choosing a branch's sound change does not pause its grammar, it directs it. The tick is skipped for no branch, and erosion itself mints **no randomness at all** (the rule was already drawn); the only new seeded draw is the suffix/prefix placement roll for VO branches at fusion time, one fresh `hashRand` salt documented against the existing registry (drift, spread, salience, borrowing, frame-walk, reanalysis).

---

<a name="contract"><h2>5. Implementation contract</h2></a>

**Changed — `src/lib/engine/lexicon.ts`**: append `finish` (index 47, class verb); `CONCEPT_CLASS` totality extends to 48 (the 2LEX.1 distance table already scores it).

**Changed — `src/lib/engine/phonology.ts`**: export `applyRuleToAffix` per §3.4 (edge-injected variant of `applyRuleToWord`, vowel floor lifted, empty result allowed).

**Changed — `src/lib/engine/types.ts`**

```ts
export type AffixStage = "affixal" | "zero" | "periphrastic";
export interface AffixState {
  stage: AffixStage;
  form: string[];          // segment ids; the marker's current shape (empty at zero)
  suffixed: boolean;       // placement, decided at fusion
  clock: number;           // stage-local counter (renewal wait or fusion wait)
}
export type ParadigmCell = "past" | "p1sg" | "p2" | "p1pl";
export interface Branch { /* + */ paradigm: Record<ParadigmCell, AffixState> }
```

**New — `src/lib/engine/morphology.ts`**

```ts
export const RENEWAL_TURNS = 6;
export const FUSE_TURNS = 4;
export const PATHWAY: Record<ParadigmCell, string> =
  { past: "finish", p1sg: "I", p2: "you", p1pl: "we" };

// genesis paradigm: affixal stage, forms clipped from the source words' current forms
export function seedParadigm(lex: Lexicon, order: WordOrder, seed: number): Record<ParadigmCell, AffixState>;

// majority stem-final (or stem-initial) phone across the branch's verb stems; the
// injected context for applyRuleToAffix. Ties by phone-table order.
export function affixContext(lex: Lexicon, edge: "suffix" | "prefix"): Phone | null;

// one branch-turn of paradigm evolution: apply `rule` (the branch's drawn or
// player-chosen rule; null = no change this turn) to each affixal cell via
// applyRuleToAffix, then death/renewal/fusion clocks. Pure.
export function tickParadigm(
  paradigm: Record<ParadigmCell, AffixState>, rule: Rule | null, lex: Lexicon, order: WordOrder,
  seed: number, turn: number, branchId: number,
): { paradigm: Record<ParadigmCell, AffixState>; events: HistoryEntry[] };

// render one verb stem inflected for a cell (bare for nonpast/p3; periphrastic
// stage renders the marker as a separate word — the phrase panel consumes both)
export function inflect(stem: string[], cell: ParadigmCell | null, paradigm: Record<ParadigmCell, AffixState>):
  { word: string[]; marker: string[] | null };
```

**Changed — `src/lib/engine/generation.ts`** and **`src/lib/game.svelte.ts`**: paradigm tick appended to step 1 for every living leaf, passing whichever rule acted on that branch this turn (the drawn drift rule, the player's applied rule via `apply()`, or `null` when neither); fracture children deep-copy `paradigm`.

**Changed — `src/lib/engine/world.ts`**: root branch seeded via `seedParadigm` (draw positions pinned for replay goldens).

**Changed — `src/lib/components/PhrasePanel.svelte`** (from 1ENG.19): F1/F2 verbs render through `inflect`; periphrastic markers appear as separate words; a paradigm chip (cell → current affix, or "—" at zero) joins the branch info display. [2UI.1](../roadmaps/mvp.md) audits.

**1ENG.14 coupling**: stage B's rigidification driver reads "agreement collapsed" as all three agreement cells at `zero` stage simultaneously; the internal pressure counter starts there and resets on any agreement renewal.

⚠️ Breaking change: `Branch.paradigm` is a required field (constructor sites and fixtures), and the 48th concept shifts whole-lexicon goldens again. Flag `feat(engine)!:`; land 1ENG.19 and 1ENG.20 as separate commits so each golden shift is attributable.

**Roadmap proposal:** **1ENG.20** (implement this contract) depending on the 1ENG.15 spike and 1ENG.19 (needs classes, frames, profiles and the panel). **1ENG.21** (1ENG.14 stage B) then depends on 1ENG.19, 1ENG.20 and 2GEO.5, completing the wiring the 1ENG.14 doc proposed.

**Testing (per repo convention):**

- `seedParadigm`: affixal at genesis; forms are correct clips of source words; determinism under seed.
- `applyRuleToAffix`: `post:bound` rules fire on a suffix's outer edge and never on its inner edge; prefix mirror-case; injected context enables context-dependent rules (a voicing rule fires on a suffix-initial voiceless stop when the injected stem-final phone is a vowel); empty result returned, never floored; growth via `break`/`paragoge` possible.
- `affixContext`: majority stem-final phone computed live; shifts when a fixture's verb stems change; phone-table tie-break.
- Stage machine: erosion to empty → `zero` same tick; renewal fires at exactly `RENEWAL_TURNS`; periphrastic marker equals the *current* source clip (a drifted source yields a different marker than genesis); fusion at `FUSE_TURNS` with correct placement; the VO placement roll's salt collides with no existing draw (registry regression).
- `inflect`: bare for nonpast and p3; suffix/prefix placement; periphrastic returns a separate marker; empty-affix cells render bare.
- Inheritance: fracture children's paradigms deep-copied then independent (a rule eroding the child's affix leaves the parent's intact).
- Integration: multi-seed 150-turn SOV runs show the past cell completing full cycles (death, renewal, fusion all observed); history carries the entries; replay byte-identical on fixed seed. **The pacing acceptance criterion itself lives in 2SIM.1**, which measures lifetime distributions with every mechanic active.
- 1ENG.14 coupling: all-agreement-zero exposes the collapsed state the rigidification driver reads and revokes the pro-drop licence (interface test, ahead of 1ENG.21).

---

<a name="ledger"><h2>6. Honesty ledger: real vs proxy vs flavour</h2></a>

| Mechanic | Status | Note |
|----------|--------|------|
| The periphrasis → affix → erosion → renewal cycle | **real, twice-attested on one tense** | Romance future: *cantabo* → *cantare habeo* → *chanterai* → *aller* + inf |
| Pathway sources (finish → past, go/have → future, pronouns → agreement) | **real, verified per pathway** | Heine & Kuteva's catalogue; Rama *-atkul-*; the pronoun-affix continuum |
| Affixes eroding under the branch's own sound rules | **real** | regular sound change grinding inflection is the attested mechanism (*cantare habeo* → *chanterai* is itself a reduction chain); `applyRuleToAffix` is that, edge for edge |
| Injected context = majority stem-final phone | **abstraction, flagged** | real affixes see every stem they attach to; the majority phone is the deterministic one-context stand-in |
| No guaranteed affix death (emergent lifetimes) | **real in shape, empirically open** | durable inflection is attested (Latin *-s* in Spanish); whether cycles turn at game pace is 2SIM.1's acceptance criterion, and the backstop question reopens there if they never do |
| Erosion speed tracking position heat | **mechanically derived** | the syntax gate applies to affix-bearing word edges; no independent claim made |
| Zero-marked nonpast and third person | **design choice, engine-honest** | driven by which source words exist, not asserted as a typological law |
| Genesis paradigms pre-fused | **convenience, precedented** | the 1ENG.12 move: seed structure so erosion grips from turn 0 |
| Same-branch cognate-divergent affixes (siblings clip drifted sources) | **real in shape** | related languages carry cognate, non-identical inflections |
| `RENEWAL_TURNS`, `FUSE_TURNS` | **first-pass tuning** | the stage floor (§3.5); playtest pass expected in 1ENG.20, pacing measured in 2SIM.1 |

---

<a name="deferred"><h2>7. Out of scope (surveyed, deferred)</h2></a>

- **Per-stem affix allomorphy.** `applyRuleToAffix` evolves one affix form per cell against the majority context; real affixes develop *allomorphs* per stem shape (English plural /s/~/z/~/ɪz/). Needs per-stem inflected storage, which is the doublet problem again (roadmap 2LEX.3).
- **A future-tense cell.** The 'go' pathway is verified and its source word exists; adding `future` to the paradigm is a one-row extension of `PATHWAY` once the two-category version has playtested.
- **The *-zi* hook.** [2LEX.1 §7](./2lex-1-homophone-collision-resolution.md) defers bleached-suffix disambiguation until affix machinery exists. After 1ENG.20 it does: a third repair arm can clip a bleached marker instead of a compound modifier. Cross-referenced there; a shared roadmap line should lift it.
- **Irregularity and suppletion.** High-frequency verbs resisting regular paradigms (English *went*) are real and characterful; the engine has no frequency variable to drive them (the same gap 2LEX.1 noted, filled there by salience; salience-driven irregularity is a plausible future flavour).
- **Object agreement, number on nouns, case.** All real, all bigger; case in particular would hand 1ENG.14's rigidification story its full Latin shape, and all of it stacks on this contract's `Paradigm` type without reshaping it.
- **Player agency over renewal.** Forcing or resisting a fusion could be a [2STK](../roadmaps/mvp.md) stakes lever, exactly as 2GEO.4 positioned borrowing; the autonomous mechanic must exist first.

---

<a name="sources"><h2>Sources</h2></a>

The cycle:
- *The history of the future: morphophonology, syntax, and grammaticalization* — <https://www.academia.edu/22158945/The_history_of_the_future_morphophonology_syntax_and_grammaticalization>
- *The Origins of the Synthetic and Periphrastic Futures in Latin and Italian* — <https://www.academia.edu/4461547/The_Origins_of_the_Synthetic_and_Periphrastic_Futures_in_Latin_and_Italian>

Pathways:
- Heine & Kuteva, *World Lexicon of Grammaticalization* — <https://www.cambridge.org/core/books/world-lexicon-of-grammaticalization/55F17154D96AB3952734BAB9FCF06959>
- 'Finish' → perfective (Rama *-atkul-*; sign languages) — <https://en.wikipedia.org/wiki/Perfective_aspect>
- *Personal Pronouns: Form, Function, and Grammaticalization* — <https://www.researchgate.net/publication/378174735_Personal_Pronouns_-_Form_Function_and_Grammaticalization>
- 'Go' futures (*aller*, *gonna*) — <https://grokipedia.com/page/Grammaticalization>

Position and consequences:
- Hawkins & Cutler, *The suffixing preference: a processing explanation* — <https://pure.mpg.de/rest/items/item_68385/component/file_506930/content>
- *Is Word Order Responsive to Morphology?* (2025) — <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11765092/>

---

- [Roadmap](../roadmaps/mvp.md) · [1ENG.14 spike](./1eng-14-syntax-conditioned-sound-change.md) · [1ENG.11 spike](./1eng-11-erosion-renewal.md) · [2LEX.1 spike](./2lex-1-homophone-collision-resolution.md) · [Engine source](../../src/lib/engine/)
