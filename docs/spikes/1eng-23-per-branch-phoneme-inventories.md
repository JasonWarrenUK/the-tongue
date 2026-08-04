---
description: 1ENG.23 design spike; per-branch phoneme inventories as a derived statistic rather than stored state, and the phonemic-event detector (merger/split/loss/gain) that finally lets the engine name what its rules have been doing all along
---

# 1ENG.23 — Design Spike: Per-Branch Phoneme Inventories

> [!IMPORTANT]
> **Goal:** Define, concretely enough to implement without further design work, how a branch's phoneme inventory is represented and how *phonemic* events (merger, split, loss, gain) become expressible. Hands the implementation task a build-ready contract, following the pattern of [2GEO.4](./2geo-4-neighbour-contact-borrowing.md) and [1ENG.14](./1eng-14-syntax-conditioned-sound-change.md).

---

## Contents

- [1. The gap, restated by measurement](#gap)
- [2. What the census actually found](#census)
- [3. The decision: derive, never store](#decision)
  - [3.1. Why not a stored `Branch.inventory`](#no-store)
  - [3.2. The allophony question, answered honestly](#allophony)
- [4. The mechanic: phonemic events](#mechanic)
  - [4.1. `inventoryOf` as the branch inventory](#inventory)
  - [4.2. `phonemicDiff`: naming the event](#diff)
  - [4.3. Where it slots in the turn loop](#slot)
- [5. The display bug this fixes](#display)
- [6. Implementation contract](#contract)
- [7. Honesty ledger: real vs proxy vs flavour](#ledger)
- [8. Out of scope (surveyed, deferred)](#deferred)
- [Sources](#sources)

---

<a name="gap"><h2>1. The gap, restated by measurement</h2></a>

The roadmap states the gap as: `Branch` holds a lexicon but never an inventory, so a branch whose every /p/ has spirantised still nominally "has" /p/, and sound change can never be represented as a *phonemic* event.

That is true, and the census makes it concrete. Over 40 seeds × 120 turns ([`1eng-23-inventory-census.ts`](./assets/1eng-23-inventory-census.ts)):

| Statistic | Result |
|-----------|--------|
| Surviving branches measured | 59 |
| Mean genesis phonemes **lost** | **6.25** (max 11) |
| Mean phonemes **gained** vs genesis | **2.97** (max 5) |
| Branches with ≥1 genesis phoneme fully gone | **59/59 (100%)** |

Against a genesis inventory of ~16 phonemes, the average branch has drifted by roughly nine — six lost, three gained. Not one branch in the sample still speaks its genesis inventory.

But the sharper finding is the one the roadmap did not anticipate, from [`1eng-23-merger-split-census.ts`](./assets/1eng-23-merger-split-census.ts) (30 seeds × 120 turns, 42 branches, length-preserved alignments only):

| Event | Branches showing it |
|-------|---------------------|
| **Merger** (2 genesis phonemes → overlapping destinations) | **42/42 (100%)** |
| **Split** (1 genesis phoneme → 2+ live phonemes) | **40/42 (95%)** |

**Mergers and splits are not missing from the engine. They are unnamed.** They happen in essentially every branch, every run. The rule table explains why: **18 of 19 rules are context-conditioned** (`pre` or `post` non-null), and a context-conditioned rule applied to a lexicon *is* a conditioned split by construction — /k/ → /x/ before front vowels leaves /k/ elsewhere. Only `smooth` is unconditioned.

This reframes the task. The work is **representation and detection**, not mechanism. The engine has been performing historical phonology correctly and silently since 1ENG.3; it simply has no vocabulary for what it did.

---

<a name="census"><h2>2. What the census actually found</h2></a>

Three findings drive every decision below.

**Finding A — the derived inventory already exists and is already load-bearing.** [`inventoryOf(lex)`](../../src/lib/engine/naming.ts) derives an `Inventory` from a lexicon by walking every word's segments. It ships today, and [`generation.ts`](../../src/lib/engine/generation.ts) calls it at every fracture birth so a newborn sibling's name is drawn from the sounds it actually speaks. The "derive a live inventory from each branch's lexicon (cheap, no new state)" option the roadmap poses as a *candidate* is, in the naming path, **already the shipped behaviour**.

**Finding B — the events are ubiquitous.** 100% merger, 95% split (§1). Any detector will have abundant signal; no tuning is needed to make events "happen often enough to see".

**Finding C — allophony is not reliably detectable at our corpus size.** [`1eng-23-allophone-detection.ts`](./assets/1eng-23-allophone-detection.ts) tested complementary distribution (the only criterion that separates an allophone from a phoneme) across 803 same-type phone pairs appearing in ≥2 environments each:

| Verdict | Count |
|---------|-------|
| Contrastive (share an environment → 2 phonemes) | 776 (97%) |
| Complementary (→ allophones of 1 phoneme) | 27 (3%) |

And the 3% is mostly *accidental sparsity*, not real allophony: the hits are pairs like /e/ vs /i/ appearing in four environments each with no overlap — a 48-word corpus simply does not supply enough environments to distinguish "complementary" from "we only have four examples". This finding is what kills the stored-inventory option (§3.1).

---

<a name="decision"><h2>3. The decision: derive, never store</h2></a>

**A branch's inventory is a derived statistic, recomputed on read. No new `Branch` field.**

This is the same conclusion [1ENG.25](./1eng-25-runtime-syllabification.md) reaches independently for syllable structure, and for the same underlying reason. Stated as a principle the engine already follows three times over:

> **The lexicon is the single source of truth. Every structural fact about a branch's phonology — its inventory, its syllable boundaries, its position profiles — is a pure function of the lexicon, recomputed at the point of use and never cached.**
>
> Prior art in shipped code: [`inventoryOf`](../../src/lib/engine/naming.ts) (inventory), [`positionProfile`/`followerVowelShare`](../../src/lib/engine/syntax.ts) (syntax statistics, explicitly "recomputed from stored parameters, never cached"), [`eraLabels`/`eraStages`](../../src/lib/engine/naming.ts) (era naming, "computed on demand from Branch data, never stored").

The engine's rules rewrite the lexicon. Any parallel representation must be re-derived after every rule application to stay correct, at which point storing it buys nothing and risks desync. See [1ENG.25 §3](./1eng-25-runtime-syllabification.md) for the same argument reached from the syllabification side, with its own measurement (29% of word-changing rule applications alter syllable count).

<a name="no-store"><h3>3.1. Why not a stored `Branch.inventory`</h3></a>

The roadmap poses "store and mutate one (allows allophony, costs a required `Branch` field)". Rejected, on three counts:

1. **It does not buy the allophony it is priced for.** A stored inventory would let a phone be marked present-but-non-contrastive. But *nothing in the engine creates an allophone as a distinct object*: `palat` rewrites /k/→/x/ in the lexicon outright. There is no allophonic layer to phonemicise, because **a split in our engine is already a completed phonemicisation the instant the rule applies**. The stored model would carry a field no shipped rule can populate.
2. **The detection it would need is unreliable anyway.** Finding C: complementary distribution fires at 3% and is dominated by sparsity artefacts at 48 words. Even a stored model would have to *decide* allophone status from the lexicon, and the lexicon cannot support that decision at this corpus size.
3. **It is a breaking change with a live desync invariant.** Every `Branch` constructor site (`world.ts`, fracture birth, every fixture) would need the field, and `applyRuleToLex` would have to keep it in sync with the lexicon on every application — a new invariant, permanently, in exchange for (1) and (2).

<a name="allophony"><h3>3.2. The allophony question, answered honestly</h3></a>

**Allophony is not modelled, and this spike does not pretend otherwise.** The ledger (§7) carries it explicitly. What the engine models is the *phonemic* layer only: every segment in a lexicon entry is a phoneme of that branch, and contrast is whatever the lexicon distinguishes.

This is a real abstraction with a real cost — it means the engine cannot express "/k/ and /x/ are one phoneme with two realisations", the state a language passes *through* on its way to a split. What it can express is the state on either side, which is what the historical record mostly preserves anyway.

If a future task wants genuine allophony, the prerequisite is not a `Branch` field: it is a **larger lexicon**, so complementary distribution becomes statistically decidable. That is recorded in §8 rather than solved here.

---

<a name="mechanic"><h2>4. The mechanic: phonemic events</h2></a>

<a name="inventory"><h3>4.1. `inventoryOf` as the branch inventory</h3></a>

No new function. [`inventoryOf(lex)`](../../src/lib/engine/naming.ts) already returns `{ vowels, consonants }` from a lexicon and already backstops the empty case. The change is one of **status and placement**: it is promoted from a naming helper to the canonical branch-inventory accessor.

It should **move from `naming.ts` to `phonology.ts`**. `naming.ts` documents itself as display-naming ("Nothing here mutates state or is called from resolveGeneration except to freeze an Anchor"), and an inventory is a phonological fact, not a naming one. `phonology.ts` already owns `PHONES`/`BY_ID` and is where every other phone-level query lives. `naming.ts` re-imports it for `genStem`.

⚠️ This is a pure move (same signature, same behaviour); `naming.test.ts`'s `inventoryOf` block moves to `phonology.test.ts` with it.

<a name="diff"><h3>4.2. `phonemicDiff`: naming the event</h3></a>

The new capability. Given a lexicon before and after a change, name what happened phonemically.

```ts
export type PhonemicEvent =
  | { kind: "merger"; from: string[]; to: string }   // 2+ phonemes collapsed into one
  | { kind: "split";  from: string;   to: string[] } // one phoneme became 2+
  | { kind: "loss";   phone: string }                // phoneme left the inventory
  | { kind: "gain";   phone: string };               // phoneme entered the inventory

// Pure. Aligns `before` and `after` per concept and reports the phonemic consequence.
export function phonemicDiff(before: Lexicon, after: Lexicon): PhonemicEvent[];
```

**Algorithm.** For every concept present in both lexicons, walk the two word forms and build a **destination map**: genesis-phone → set of live phones it corresponds to. Alignment is positional where lengths match, and skipped otherwise — the census used exactly this restriction ([`1eng-23-merger-split-census.ts`](./assets/1eng-23-merger-split-census.ts)) and still found 100%/95% event rates, so the conservative alignment loses nothing material. Then:

- **split** — a source phone whose destination set has size > 1
- **merger** — two or more source phones whose destination sets intersect
- **loss** — a phone in `inventoryOf(before)` absent from `inventoryOf(after)`
- **gain** — the converse

**Why positional alignment and not edit distance.** A rule application is 1-in/N-out per segment ([`Seg[]`](../../src/lib/engine/types.ts)), so a single rule can change word length (48% of applications do — see [1ENG.25 §2](./1eng-25-runtime-syllabification.md)). Length-changed words are skipped rather than aligned by a heuristic, because a wrong alignment invents a merger that did not happen. Precision over recall: the events are ubiquitous enough (§1) that discarding ambiguous cases still leaves abundant signal.

**Complexity.** O(concepts × word length) per call, over 48 words of ≤12 segments. Cheap enough to call per branch-turn.

<a name="slot"><h3>4.3. Where it slots in the turn loop</h3></a>

`phonemicDiff` is a **reporting** function, not a force. It changes no state. It is called at exactly one place in [`generation.ts`](../../src/lib/engine/generation.ts): inside step 1 (drift), immediately after a branch's lexicon is rewritten, comparing pre- and post-rule lexicons. Events become `HistoryEntry` records, so the chronicle can finally say *"/p/ and /b/ fell together"* rather than only *"Intervocalic voicing"*.

No new turn-loop step. No new RNG. No reordering. The turn loop's shape is untouched — which is the point of choosing the derived model.

Following the [2GEO.4](./2geo-4-neighbour-contact-borrowing.md)/[2LEX.1](./2lex-1-homophone-collision-resolution.md) ruling that grammatical events stay out of sound-change accounting, phonemic-event entries carry **no `drift` flag**: the drift entry for the rule itself is already recorded alongside them, and flagging both would double-count one change in every history filter.

---

<a name="display"><h2>5. The display bug this fixes</h2></a>

[`Header.svelte`](../../src/lib/components/Header.svelte) renders `world.inv.vowels` and `world.inv.consonants` — the **genesis** inventory — as the standing description of the language, for every branch, regardless of drift.

Given §1's census (mean 6.25 phonemes lost, 2.97 gained, 100% of branches affected), the header is showing every player an inventory that is wrong about roughly nine phonemes by turn 120. It is not stale-ish; it describes a language nobody in the world speaks any more.

Fix: `Header.svelte` reads `inventoryOf(selectedBranch.lex)`. `World.inv` stays exactly as it is — it is the genesis record and remains correct *as that*, still consumed by `genLexicon` at world-gen. The header should say which it is showing.

This is the most immediately visible payoff of the whole task, and it costs one call site.

---

<a name="contract"><h2>6. Implementation contract</h2></a>

**Moved — `src/lib/engine/naming.ts` → `src/lib/engine/phonology.ts`**

```ts
export function inventoryOf(lex: Lexicon): Inventory;   // unchanged signature/behaviour
```

`naming.ts` imports it back for `genStem`'s call site. Pure move, no behavioural change.

**New — `src/lib/engine/phonology.ts`**

```ts
export type PhonemicEvent =
  | { kind: "merger"; from: string[]; to: string }
  | { kind: "split";  from: string;   to: string[] }
  | { kind: "loss";   phone: string }
  | { kind: "gain";   phone: string };

// Pure, no RNG. Positional alignment per concept; length-mismatched words skipped.
export function phonemicDiff(before: Lexicon, after: Lexicon): PhonemicEvent[];

// Render one event as chronicle prose ("/p/ and /b/ fell together").
export function describeEvent(e: PhonemicEvent): string;
```

**Changed — `src/lib/engine/generation.ts`**: in step 1, after `applyRuleToLex` rewrites a leaf's lexicon, call `phonemicDiff(before, after)` and append a `HistoryEntry` per event (no `drift` flag — see §4.3). Also at `divergeAtBirth`, for the same reason the drift entry is recorded there.

**Changed — `src/lib/components/Header.svelte`**: read `inventoryOf(branch.lex)` instead of `world.inv`, and label it as the branch's current inventory rather than the world's.

**Changed — `src/lib/game.svelte.ts`**: expose `liveInventory = $derived(inventoryOf(this.sel.lex))` for the header, matching how every other UI-facing statistic is surfaced.

**No changes to** `types.ts` (no new `Branch` field), the turn-loop order, the RNG registry, or any rule.

✅ **Not a breaking change.** No required field is added, no constructor site changes, no seeded draw is introduced or moved. `feat(engine):`, not `feat(engine)!:` — unusually for an engine task, and a direct consequence of choosing the derived model.

**Testing (per repo convention):**

- `inventoryOf` — existing `naming.test.ts` block moves to `phonology.test.ts` unchanged (regression pin on the move).
- `phonemicDiff` — hand-built fixtures for each event kind: a merger (two concepts whose distinct phones both become /s/), a split (one phone → two under a conditioning environment), a loss, a gain. Assert exact event lists, not counts.
- `phonemicDiff` — length-mismatched words are skipped, not mis-aligned: a fixture where a deletion would produce a spurious merger under naive alignment must yield no merger.
- `phonemicDiff` — empty/identical lexicons yield `[]`.
- Determinism — `phonemicDiff` is pure: same inputs, same output, no `hashRand` call (registry regression: this task adds **no** new salt).
- Integration — a seeded 40-turn run records ≥1 merger event (the census says 100% of branches produce one, so this is a safe pin).
- `Header.svelte` — the rendered inventory changes after a drift turn that removes a phoneme (guards the §5 bug from returning).

**Roadmap proposal:** 1ENG.23 moves `todo` → `done` on this spike landing; a new implementation task **1ENG.26** carries the contract above, depending on 1ENG.23 only. [2GLY.3](../roadmaps/mvp.md) ("phoneme→glyph reassignment tied to phone split/merge/deletion") gains a dependency on 1ENG.26, since `PhonemicEvent` is precisely the event stream it was blocked waiting for — that dependency is the roadmap's own stated reason this spike existed.

---

<a name="ledger"><h2>7. Honesty ledger: real vs proxy vs flavour</h2></a>

| Mechanic | Status | Note |
|----------|--------|------|
| Mergers and splits as the basic units of historical phonology | **real** | standard Neogrammarian description; the engine already produces both (§1: 100%/95%) and this task only names them |
| Conditioned split from context-sensitive rules | **real** | 18 of 19 rules carry `pre`/`post`; a conditioned rule applied lexicon-wide *is* a conditioned split by construction |
| Derived inventory (lexicon as sole truth) | **ours, defensible** | a real language's inventory is defined by contrast, not by enumeration; deriving from the lexicon is closer to the linguistic definition than a stored list would be |
| **Allophony** | **NOT MODELLED, flagged** | §3.2. Nothing creates an allophone as a distinct object; a split is already complete when the rule fires. Detecting it needs a larger corpus (§8), not a `Branch` field |
| Positional alignment in `phonemicDiff` | **abstraction, flagged** | real comparative method aligns cognates by correspondence sets, not by index. We skip length-mismatched words rather than guess — precision over recall (§4.2) |
| Merger detection via destination-set intersection | **proxy** | detects that two phonemes now share a reflex, which is the observable consequence; it does not distinguish an unconditioned merger from two independent changes that happened to converge |
| `World.inv` as genesis record | **real, correctly scoped** | it stays as the genesis inventory, which is a true and useful fact; §5 fixes only its *misuse* as a current description |

---

<a name="deferred"><h2>8. Out of scope (surveyed, deferred)</h2></a>

- **Allophony proper.** Needs complementary distribution to be statistically decidable, which needs a lexicon substantially larger than 48 concepts (§2 Finding C: 3% detection, dominated by sparsity artefacts). The blocker is corpus size, not representation — recorded here so a future "grow the lexicon" task knows it unlocks this, and so the stored-`Branch.inventory` option is not re-litigated on allophony grounds without that prerequisite.
- **Chain shifts.** A merger detector reports pairwise collapse; it cannot see that /a/→/e/→/i/ moved as a system (a push/drag chain). Real historical phonology treats chain shifts as single events. Would need `phonemicDiff` to reason over the destination map as a graph rather than pairwise — tractable, but a distinct piece of analysis with no current consumer.
- **Phoneme frequency within the inventory.** [1ENG.16 §7](./1eng-16-zompist-tools-survey.md) already proposes frequency-ranked phoneme selection for `genLexicon` (gen's geometric dropoff). A live inventory could carry per-phoneme token counts cheaply, and `Header.svelte` could show them; deferred because 1ENG.16's own adoption task owns that surface.
- **Inventory as a naming input.** `genStem` reads `World.inv` for the root but `inventoryOf(parent.lex)` at fracture. After this task both could read the live inventory consistently. Deliberately untouched: changing the root's naming draw shifts every seed's root name, a golden-breaking change with no linguistic payoff.
- **Intelligibility weighting by phonemic distance.** [`intelligibility.ts`](../../src/lib/engine/intelligibility.ts) treats every segment substitution as equal. A merger arguably costs less mutual intelligibility than an arbitrary substitution. Same class of question as 4PHON.1's tone-weighting problem, and it should be answered once for both rather than twice.

---

<a name="sources"><h2>Sources</h2></a>

Census scripts (reproduce every number in §1–§2):
- [`assets/1eng-23-inventory-census.ts`](./assets/1eng-23-inventory-census.ts) — phoneme loss/gain vs genesis, 40 seeds × 120 turns
- [`assets/1eng-23-merger-split-census.ts`](./assets/1eng-23-merger-split-census.ts) — merger/split incidence, 30 seeds × 120 turns
- [`assets/1eng-23-allophone-detection.ts`](./assets/1eng-23-allophone-detection.ts) — complementary-distribution detection rate, 803 pairs

Linguistics:
- Phonemic merger and split (the Neogrammarian units) — <https://en.wikipedia.org/wiki/Phonological_change>
- Complementary distribution as the phoneme/allophone criterion — <https://en.wikipedia.org/wiki/Complementary_distribution>
- Conditioned vs unconditioned sound change — <https://en.wikipedia.org/wiki/Sound_change>
- Surfaced by the [1ENG.16 Zompist survey §9](./1eng-16-zompist-tools-survey.md), which named this "the one gap that comparison exposed rather than confirmed"

---

- [Roadmap](../roadmaps/mvp.md) · [1ENG.25 spike](./1eng-25-runtime-syllabification.md) · [1ENG.16 survey](./1eng-16-zompist-tools-survey.md) · [1ENG.14 spike](./1eng-14-syntax-conditioned-sound-change.md) · [Engine source](../../src/lib/engine/)
