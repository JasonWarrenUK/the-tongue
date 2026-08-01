---
description: 1ENG.25 design spike; runtime syllabification over live words, and the phrase-level renewal mechanic that must ship first because the engine currently erodes to monosyllabic CV words with nothing to syllabify
---

# 1ENG.25 — Design Spike: Runtime Syllabification

> [!IMPORTANT]
> **Goal:** Specify onset/nucleus/coda parsing over a live word, the shared prerequisite [1ENG.24](../roadmaps/mvp.md) (stress-conditioned change) and [4PHON.1](../roadmaps/mvp.md) (tonogenesis) are both blocked on.
>
> **What the investigation actually found:** syllabification is not the blocker. The engine erodes to **1.05 syllables per word** and stays there, so there is nothing to parse, no stress position to assign, and no tone-bearing unit to contrast. The real blocker is an asymmetry in the turn loop: **erosion reads the phrase model; renewal does not.** This spike specifies both — the renewal mechanic that makes syllable structure exist, and the syllabification that reads it.

---

## Contents

- [1. The stated fork is empirically empty](#empty-fork)
- [2. The real finding: monosyllabic collapse](#collapse)
  - [2.1. Homophonic collapse, the deeper symptom](#homophony)
  - [2.2. Four fixes that don't work](#failures)
  - [2.3. The structural cause: `paragoge` locked out](#lockout)
- [3. The asymmetry: erosion is phrase-aware, renewal is not](#asymmetry)
- [4. The mechanic: frame-adjacent univerbation](#univerbation)
  - [4.1. Trigger, selection and cadence](#cadence)
  - [4.2. Measured results](#results)
  - [4.3. Where it slots in the turn loop](#slot)
- [5. Syllabification, specified against the restored corpus](#syllabify)
  - [5.1. The algorithm](#algorithm)
  - [5.2. Derive on read, never cache](#derive)
  - [5.3. Composition with `syntaxMult` (the 1ENG.24 contract)](#composition)
- [6. Implementation contract](#contract)
- [7. Honesty ledger: real vs proxy vs flavour](#ledger)
- [8. Out of scope (surveyed, deferred)](#deferred)
- [Sources](#sources)

---

<a name="empty-fork"><h2>1. The stated fork is empirically empty</h2></a>

The roadmap frames the central design question as *"sonority-based onset maximisation vs. a language-specific parse driven by the branch's `Template`"*.

Both algorithms were implemented and run against real engine output ([`1eng-25-algorithm-comparison.ts`](./assets/1eng-25-algorithm-comparison.ts), 30 seeds × 60 turns):

| Result | |
|--------|--|
| Words compared | 2016 |
| **Identical parse** | **2016 (100.0%)** |
| Divergent parse | 0 (0.0%) |

The two algorithms can only disagree about an **intervocalic consonant cluster** (`V CC V`) — where onset maximisation assigns both consonants to the following onset and a template-driven parse may split them coda|onset. The corpus contains none ([`1eng-25-ossification-census.ts`](./assets/1eng-25-ossification-census.ts)):

| Intervocalic consonant run | Count |
|----------------------------|-------|
| 1 consonant (`V C V`) | 149 |
| **2+ consonants (`V CC V`)** | **0** |

The fork is unfalsifiable at present. Choosing between the algorithms on their merits would be picking between two functions that provably return the same answer on every input the engine can produce.

That null result is what redirected this spike.

---

<a name="collapse"><h2>2. The real finding: monosyllabic collapse</h2></a>

Clusters are generated correctly at genesis and destroyed almost immediately ([`1eng-25-ossification-census.ts`](./assets/1eng-25-ossification-census.ts), 30 seeds):

| Stage | Words | Any CC | Intervocalic CC |
|-------|-------|--------|-----------------|
| genesis | 1440 | 184 | **142** |
| turn 10 | 1440 | 16 | **2** |
| turn 60 | 2016 | 0 | **0** |

98.6% of intervocalic clusters are gone within 10 turns. But clusters are only the visible edge of a broader collapse — word length and syllable count fall to a floor and stay there:

| Turn | Mean length | Mean syllables/word | Dominant shape |
|------|-------------|---------------------|----------------|
| 0 | 3.23 | 1.51 | CV / CVCV |
| 10 | 2.60 | 1.24 | CV |
| 40 | 2.10 | **1.06** | **CV (1733 of ~2100 words)** |
| 100 | 2.08 | **1.05** | CV |

**The engine converges to monosyllabic CV words.** This is the ossification floor [1ENG.11](./1eng-11-erosion-renewal.md) identified and [1ENG.12](../roadmaps/mvp.md) shipped renewal rules to escape — and the measurement says **those renewal rules are not winning**. Mean syllable count falls *below* genesis (1.51 → 1.05) and never recovers.

The consequences for the two tasks blocked on this spike are direct:

- **[1ENG.24](../roadmaps/mvp.md) (stress).** Initial/final/penultimate stress placement is *undefined on a monosyllable*. A per-branch stress rule would be inert across 95% of the lexicon.
- **[4PHON.1](../roadmaps/mvp.md) (tonogenesis).** A tone-bearing unit in a one-syllable word carries no positional contrast.

Neither task is blocked on syllabification. Both are blocked on there being more than one syllable.

<a name="homophony"><h3>2.1. Homophonic collapse, the deeper symptom</h3></a>

Short words in a small inventory collide. [`1eng-25-homophony-census.ts`](./assets/1eng-25-homophony-census.ts) (25 seeds) measures the lexicon under erosion:

| Turn | syll/word | Collision pairs/branch | Homophone forms | Cumulative 2LEX.2 repairs |
|------|-----------|------------------------|-----------------|---------------------------|
| 0 | 1.52 | 0.0 | 0.0 | 0 |
| 10 | 1.25 | 6.5 | 4.5 | 13 |
| 40 | 1.07 | 39.5 | 10.8 | 193 |
| 80 | 1.09 | 54.1 | 10.8 | 651 |
| 150 | 1.04 | **61.2** | 10.9 | **1468** |

**61 colliding concept-pairs across a 48-concept lexicon**, and climbing monotonically, while [2LEX.2](./2lex-1-homophone-collision-resolution.md)'s repair mechanic has fired **1468 times** without arresting it.

The repair does not help because [`compoundWord`](../../src/lib/engine/collision.ts) **clips both stems** before joining: a compound of two 1-segment words is still ~2 segments. Measured on a real branch at turn 80: **2 of 48 concepts** end up longer than genesis.

This is the disease; word length is the symptom. Erosion destroys lexical contrast faster than any shipped mechanism restores it.

> **Is monosyllabic convergence simply wrong?** Not by itself — Mandarin, Vietnamese, Cantonese and Thai are all overwhelmingly monosyllabic, and Sinitic reached that state by exactly the erosion this engine simulates. What those languages did *in response* is the point: Mandarin answered catastrophic homophony with **disyllabic compounding** (電腦, 朋友) and **tonogenesis**. Our engine has neither, so it sits at the floor with 61 unresolved collisions. The defect is not that words got short; it is that **erosion has no consequence**.

<a name="failures"><h3>2.2. Four fixes that don't work</h3></a>

Recorded so they are not re-attempted. Each was measured, not reasoned about.

| Candidate fix | Result | Script |
|---------------|--------|--------|
| **Syncope** (add a cluster-creating rule, `V → ∅ / VC_CV`) at up to 30%/word/turn | 3 clusters at 15%, 1 at 30% — non-monotonic, i.e. noise. No effect | [`1eng-25-rate-fit.ts`](./assets/1eng-25-rate-fit.ts) |
| **Disable `epenth`** entirely (suspected cluster sink) | **1** cluster instead of 0. `epenth` is *not* the cause | [`1eng-25-weight-tuning-null.ts`](./assets/1eng-25-weight-tuning-null.ts) |
| **Weight tuning**, incl. halving every final-erosion rule and tripling `paragoge` | Best case **1.35** syll/word — still below genesis (1.51), far short of target | [`1eng-25-weight-tuning-null.ts`](./assets/1eng-25-weight-tuning-null.ts) |
| **Reduplication** (CV → CVCV) at 8% | Fixes length (3.92 syll/word) but produces **0** clusters — a copied CV syllable never creates CC | [`1eng-25-univerbation-fit.ts`](./assets/1eng-25-univerbation-fit.ts) |

The `epenth` result is worth dwelling on, because it corrected a plausible-looking diagnosis. One `epenth` application does wipe every cluster in a lexicon at once (12→0, 7→0, 5→0 on sampled seeds) — a genuinely dramatic effect. But removing it changes the outcome from 0 clusters to 1. **Cluster extinction is overdetermined**: several independent erosive rules each suffice, so any single-rule intervention is swamped. Weight tuning fails for the same reason, which is why §2.3 looks at rule *shape* instead.

<a name="lockout"><h3>2.3. The structural cause: `paragoge` locked out</h3></a>

An eligibility audit ([`1eng-25-renewal-audit.ts`](./assets/1eng-25-renewal-audit.ts), 20 seeds × 60 turns) shows erosion outweighing renewal **3.54:1** in effective drift pressure. But the ratio understates it, because of *which* renewal rules are eligible:

| Renewal rule | Weight | Eligible | Actually lengthens a word? |
|--------------|--------|----------|----------------------------|
| `break` | 2.5 | **99%** | **No** — V → diphthong is 1 segment in, 1 out |
| `paragoge` | 1.5 | 77% | **Yes** — appends a final vowel |
| `epenth` | 2.0 | **3%** | Yes, but needs a cluster erosion has already removed |

Only **one** rule in the entire set genuinely lengthens words in practice, and it is the weakest (w=1.5) — against `apoc` (w=3, 86% eligible), `finalC` (w=2, 77%) and `complengFinal` (w=2, 60%).

And it gets locked out entirely ([`1eng-25-paragoge-lockout.ts`](./assets/1eng-25-paragoge-lockout.ts)). `paragoge` requires a **C-final** word (`match:isC, post:bound`). The corpus becomes V-final:

| Turn | Words ending in V | `paragoge` can fire on |
|------|-------------------|------------------------|
| 0 | 75% | 25% |
| 40 | **96%** | 4% |
| 80 | **97%** | **3%** |

Traced explicitly:

```
ta   + paragoge -> ta     (no-op: already V-final)
tak  + paragoge -> taki   then apoc -> tak   then apoc -> tak
ta   + break    -> tie    + smooth -> te     + break -> tie   (segment-neutral, stays V-final)
```

`break` — the most eligible rule in the set at 99% — converts a final vowel to a diphthong, which is segment-neutral **and keeps the word V-final**, permanently locking `paragoge` out. The three renewal rules occupy a state space erosion has made unreachable.

**Every failed fix in §2.2 tried to manufacture material at the *word* level, where the engine has no generative mechanism.** That is the wrong level.

---

<a name="asymmetry"><h2>3. The asymmetry: erosion is phrase-aware, renewal is not</h2></a>

The counter-erosive forces in real languages live in **connected speech**, not in isolated citation forms:

- **Univerbation** needs two words adjacent in a phrase before they can fuse: `hlāf weard` → `hlāfweard` → *lord*; `dæges ēage` → *daisy*; `au jour de hui` → *aujourd'hui*.
- **Liaison and sandhi** preserve material precisely because a following word supplies the environment.
- **Cliticisation** — pronouns and auxiliaries leaning on hosts — is how affixes are born; [1ENG.20](../roadmaps/mvp.md)'s paradigm sources are literally the pronouns.

[1ENG.19](../roadmaps/mvp.md) already shipped the substrate for all of this: [`FRAMES`, `frameOrder`, `positionProfile`, `followerVowelShare`](../../src/lib/engine/syntax.ts). An audit of every consumer ([`1eng-25-substrate-asymmetry.ts`](./assets/1eng-25-substrate-asymmetry.ts)) finds:

| Consumer | Uses | Consumes it as |
|----------|------|----------------|
| `phonology.ts` | `syntaxMult` | a rate multiplier |
| `morphology.ts` | `syntaxMult` | a rate multiplier |
| `game.svelte.ts` | `syntaxMult` | a displayed number |
| `generation.ts` | `walkFrameWeights` | bookkeeping |
| `world.ts` | `walkFrameWeights` | bookkeeping |
| `syntax.ts` | all | internal |
| `PhrasePanel.svelte` | `frameOrder`, `FRAMES` | **display only** |

**Eight consumers, every one of them scalar.** No code path anywhere uses frame **adjacency** to combine two words. [`compoundWord`](../../src/lib/engine/collision.ts) is the engine's sole word-combining operation, and it is triggered by homophony, not adjacency.

> **The engine knows which words stand next to each other, and uses that knowledge only to erode them faster.**

That asymmetry is the defect. The fix belongs at the phrase level, and the substrate for it already shipped.

---

<a name="univerbation"><h2>4. The mechanic: frame-adjacent univerbation</h2></a>

Two words that stand adjacent in a weighted frame fuse into a single lexeme, **keeping both stems whole**.

<a name="cadence"><h3>4.1. Trigger, selection and cadence</h3></a>

**Trigger — pressure, per concept.** A word is a univerbation candidate when it is under contrast pressure: its form is ≤2 segments, **or** it is currently homophonous with another concept ([`homophoneForms`](../../src/lib/engine/phonology.ts)). This is the attested trigger direction — languages compound to restore contrast the way Mandarin did — and it targets the mechanic where the damage is, rather than lengthening words that are doing fine.

**Selection — the branch's own grammar decides the partner.** For a candidate of class `C`, the eligible modifiers are the classes that *precede* `C` in the branch's linearised frames: walk `FRAMES` through [`frameOrder(f, branch.wordOrder, false)`](../../src/lib/engine/syntax.ts) and collect every class appearing immediately before a `C` slot, weighted by that frame's `frameWeights` entry. A branch's word order therefore determines what it can fuse with — an `AdjN` branch compounds adjective+noun, an `NAdj` branch does not.

This is the first consumer of the phrase substrate that reads **adjacency** rather than a scalar, which is the whole point of §3.

**Result — modifier + head, both whole.** The fused form is `[...modifier.word, ...head.word]`, assigned to the head concept. No clipping (that is precisely what neuters [2LEX.2](./2lex-1-homophone-collision-resolution.md)'s repair — §2.1). Skipped when the result would exceed [`MAX_LEN`](../../src/lib/engine/phonology.ts), reusing the existing ceiling rather than inventing one.

**Cadence — per concept, per turn, seeded.** `UNIVERB_RATE` per eligible concept per turn. Not one-per-branch: real collocations fuse independently and permanently, and a single fusion per turn is swamped by erosion acting on all 48 words (measured — the one-per-branch variant reached only 1.30 syll/word at rate 0.35).

Needs one new `hashRand` salt family. **Registry** (first coordinate must stay disjoint): spread/genStem `seed`, drift `seed+7`, salience `seed+13`, borrow `seed+19`, contact `seed+23`, syntax gate `seed+29`, frame walk `seed+31`, reanalysis `seed+37`, morphology `seed+41`. **This mechanic takes `seed+43`.**

<a name="results"><h3>4.2. Measured results</h3></a>

[`1eng-25-univerbation-fit.ts`](./assets/1eng-25-univerbation-fit.ts), 25 seeds × 80 turns:

| Rate | syll/word | Collision pairs | Homophone forms | Intervocalic CC |
|------|-----------|-----------------|-----------------|-----------------|
| 0 (baseline) | 1.09 | 54.1 | 10.8 | 1 |
| 0.01 | 1.16 | 39.4 | 9.5 | 4 |
| 0.02 | 1.30 | 33.4 | 7.8 | 9 |
| 0.04 | 1.57 | 22.8 | 6.3 | 15 |
| **0.08** | **1.89** | **11.0** | **4.1** | **25** |

Every axis moves in the right direction at once: word length restored to the real-language band, **homophonic collapse reversed** (54 → 11 collision pairs), and clusters exist for syllabification to parse.

Equilibrium check at `UNIVERB_RATE = 0.06`, 20 seeds:

| Turn | 20 | 40 | 80 | 150 | 300 |
|------|----|----|----|-----|-----|
| syll/word | 1.59 | 1.70 | 1.82 | 1.69 | **2.00** |
| collision pairs | 5.6 | 8.0 | 13.0 | 22.2 | 19.2 |

A genuine equilibrium, not a runaway: syllables/word oscillates in 1.59–2.00 across 300 turns and collisions stabilise around 20 instead of climbing past 61. Erosion and renewal are in tension, which is what [1ENG.11](./1eng-11-erosion-renewal.md) was reaching for.

**Proposed `UNIVERB_RATE = 0.06`** — first-pass tuning, same ledger treatment as `SYNTAX_STRENGTH`/`BIAS_STRENGTH`. [2SIM.1](../roadmaps/mvp.md) should re-fit it with every mechanic active.

<a name="slot"><h3>4.3. Where it slots in the turn loop</h3></a>

A new **step 1.75**, after collision resolution and before the rename check:

```
1.   drift
1.5  collisions          (2LEX.2)
── 1.75 UNIVERBATION      ◀── new
2.   rename
3.   spread
3.5  borrow              (2GEO.5)
4.   assimilation
5.   fracture
```

After 1.5 because the trigger reads *post-repair* homophony: a collision 2LEX.2 has just fixed should not also trigger a fusion. Before 2 because the rename check must see the final lexicon, exactly as the existing comment at step 1.5 requires for the same reason.

---

<a name="syllabify"><h2>5. Syllabification, specified against the restored corpus</h2></a>

<a name="algorithm"><h3>5.1. The algorithm</h3></a>

**Onset maximisation, sonority-constrained.** Chosen on principle, since §1 established the alternatives are empirically indistinguishable today — and stated as such rather than dressed up as a measured win.

```ts
export interface Syllable { onset: string[]; nucleus: string; coda: string[] }

// Pure. Every vowel is a nucleus; consonants between nuclei are assigned to the
// following onset as far as the sonority sequencing principle allows, the remainder
// to the preceding coda.
export function syllabify(word: string[]): Syllable[];
```

Sonority scale (the standard hierarchy, read off `Phone.manner`): stop 1 < fricative 2 < nasal 3 < liquid 4 < glide 5 < vowel 6. A consonant sequence is a legal complex onset iff sonority strictly rises toward the nucleus.

Why onset maximisation over the template-driven parse:

1. **It is the cross-linguistic default.** Onset maximisation is the standard assumption in syllable theory; the template-driven parse would encode a per-world preference the phonotactics no longer reflect after drift.
2. **`World.tmpl` describes genesis, not the present.** It is drawn once at world-gen and never updated — the same category of staleness [1ENG.23 §5](./1eng-23-per-branch-phoneme-inventories.md) documents for `World.inv`. Feeding a stale parameter into a runtime parse would bake that bug into syllable structure.
3. **It needs no new state and no `World` read**, keeping `syllabify` a pure function of the word.

**Edge cases**, all reachable in real engine output: a word with no vowel (returns a single onset-only syllable — the vowel floor makes this rare but `applyRuleToAffix` lifts that floor, so affixes can hit it); a word-initial vowel (empty onset); a word-final consonant run (all coda).

<a name="derive"><h3>5.2. Derive on read, never cache</h3></a>

The roadmap asks *"whether syllable boundaries are recomputed every rule application or only at drift/turn boundaries"*. The answer is **neither: never store them at all.**

[`1eng-25-resyllabification-census.ts`](./assets/1eng-25-resyllabification-census.ts), 40 seeds over all genesis words × all rules:

| Of 5620 word-changing rule applications | |
|------------------------------------------|--|
| Changed segment count | 2710 (**48%**) |
| Changed **syllable** count | 1611 (**29%**) |

Four rules resyllabify: `apoc`, `paragoge`, `epenth`, `aphaer`. A cached syllabification would be stale in nearly a third of the cases it is touched, and keeping it fresh means recomputing after every application — at which point the cache is pure cost.

Words are ≤`MAX_LEN` (12) segments, so `syllabify` is trivially cheap. This is the same conclusion [1ENG.23 §3](./1eng-23-per-branch-phoneme-inventories.md) reaches for inventories, and the engine already follows the principle three times (`inventoryOf`, `positionProfile`, `eraLabels`):

> **The lexicon is the single source of truth. Every structural fact about a branch's phonology is a pure function of the lexicon, recomputed at the point of use and never cached.**

<a name="composition"><h3>5.3. Composition with `syntaxMult` (the 1ENG.24 contract)</h3></a>

[1ENG.14 §7](./1eng-14-syntax-conditioned-sound-change.md) flags that stress and position profiles *"both condition erosion, and they must compose rather than double-count"*. Discharging that now, so 1ENG.24 inherits a decision rather than a conflict.

**They are orthogonal and must multiply, not add.**

- [`syntaxMult`](../../src/lib/engine/syntax.ts) answers *"where does this **word** sit in the utterance?"* — a per-concept, phrase-level statistic.
- A future `stressMult` answers *"where does this **segment** sit in the word?"* — a per-position, word-internal statistic.

A word-final verb (high `syntaxMult`) whose final syllable is unstressed (high `stressMult`) should erode faster than either factor alone predicts — that is the Latin→French story, and the two causes are genuinely independent. Adding them would let one cause saturate the clamp and mask the other.

**Contract for 1ENG.24:**

1. `stressMult` returns a multiplier on the same `[0.5, 1.5]` scale and with the same one-sided block-roll semantics `applyRuleToLex` already uses (`m > 1` is a no-op; `m < 1` becomes a block probability).
2. The two compose as `syntaxMult × stressMult`, clamped **once** to `[0.5, 1.5]` after multiplication — matching how `biasedMult` and momentum already compose in [`driftRule`](../../src/lib/engine/phonology.ts).
3. Each takes its **own** `hashRand` salt and its own roll. Precedent is explicit: `applyRuleToLex` already keeps the salience and syntax rolls separate with the stated reasoning that folding two distinct causes of resistance into one roll "would make a salient-and-final word behave as if one cause cancelled the other".
4. Stress placement is a per-branch parameter seeded and inherited like `wordOrder`, and it reads `syllabify(word)` — never a stored syllable count.

---

<a name="contract"><h2>6. Implementation contract</h2></a>

Two independent slices. **Slice 1 must ship first** — slice 2 is untestable without it.

### Slice 1 — phrase-level univerbation

**New — `src/lib/engine/univerbation.ts`** (new module, the established pattern)

```ts
export const UNIVERB_RATE = 0.06;        // per eligible concept per turn (§4.2)
export const UNIVERB_MAX_SEGMENTS = 2;   // "short word" pressure threshold

// Classes that may precede `cls` in this branch's linearised frames, frame-weighted.
export function precedersOf(cls: ConceptClass, order: WordOrder, weights: FrameWeights): { cls: ConceptClass; w: number }[];

// One branch-turn of univerbation. Pure given (seed, turn, branchId). Returns the
// new lexicon and one HistoryEntry per fusion.
export function resolveUniverbation(
  lex: Lexicon, order: WordOrder, weights: FrameWeights,
  seed: number, turn: number, branchId: number,
): { lex: Lexicon; events: HistoryEntry[] };
```

**Changed — `src/lib/engine/generation.ts`**: new step 1.75 per §4.3, per living leaf. No `touched` guard (renewal is autonomous, like collision repair). No `leavesOf > 1` guard (a language alone in the world still compounds for itself).

**Changed — `src/lib/engine/syntax.ts`**: none required — `frameOrder` and `FRAMES` are already exported. `precedersOf` lives in the new module so `syntax.ts` stays a pure-statistics module.

⚠️ **Behaviour change, not a type break.** No new required field, so no constructor site changes; but every seed's lexicon evolves differently from turn ~1, so any drift-replay golden moves. `feat(engine):` with the goldens re-pinned — the same treatment [1ENG.16 §7](./1eng-16-zompist-tools-survey.md) prescribes for a new competing rule.

### Slice 2 — syllabification

**New — `src/lib/engine/syllable.ts`**

```ts
export interface Syllable { onset: string[]; nucleus: string; coda: string[] }
export function syllabify(word: string[]): Syllable[];   // pure, no RNG
export function syllableCount(word: string[]): number;   // convenience, = syllabify().length
export const SONORITY: Record<string, number>;           // stop 1 .. glide 5, vowel 6
```

No call site in `generation.ts`. Slice 2 ships as a **pure library with no consumer** — its consumers are 1ENG.24 and 4PHON.1. It is specified and tested here so those tasks inherit a settled substrate. `feat(engine):`, additive, no goldens move.

**Testing (per repo convention):**

*Slice 1:*
- `precedersOf` — golden per order combination: `AdjN` yields adjective before noun, `NAdj` does not; `SOV`/`SVO`/`VSO` yield the right clause-frame adjacencies.
- `resolveUniverbation` — deterministic under fixed `(seed, turn, branchId)`; fires only on pressured concepts; never exceeds `MAX_LEN`; keeps both stems whole (the anti-regression pin against `clip`).
- New salt `seed+43` collides with no registered family (registry regression, per the existing convention in `syntax.ts`).
- Integration — a seeded 80-turn run ends with mean syllables/word > 1.4 and fewer collision pairs than the same run with `UNIVERB_RATE = 0` (pins §4.2's headline result).

*Slice 2:*
- `syllabify` hand-goldens: `CV` → 1 syllable; `CVCV` → `CV·CV`; `CVCCV` → onset-maximised per sonority (`ta.pra` not `tap.ra` for a rising cluster; `al.ka` for a falling one); vowel-initial word → empty onset; final cluster → all coda.
- No-vowel input returns one onset-only syllable (reachable via `applyRuleToAffix`'s lifted floor).
- `syllableCount` agrees with the nucleus count for 1000 real engine words (cross-check against the naive count).
- Purity — no `hashRand` call anywhere in the module.

**Roadmap proposal:** 1ENG.25 moves `todo` → `done` on this spike landing. Two new M1 tasks: **1ENG.27** (slice 1, univerbation) depending on 1ENG.25 and 1ENG.19; **1ENG.28** (slice 2, syllabification) depending on 1ENG.27. [1ENG.24](../roadmaps/mvp.md)'s `dependsOn` changes from `1ENG.25` to `1ENG.28`, and [4PHON.1](../roadmaps/mvp.md)'s note should record that its stated blocker (a tone-bearing unit) is discharged by 1ENG.28 while its *real* blocker was 1ENG.27.

---

<a name="ledger"><h2>7. Honesty ledger: real vs proxy vs flavour</h2></a>

| Mechanic | Status | Note |
|----------|--------|------|
| Univerbation as a word-lengthening force | **real, strongly attested** | *lord* < `hlāfweard`, *daisy* < `dæges ēage`, *aujourd'hui* < `au jour de hui`; Mandarin disyllabic compounding as the answer to monosyllabic homophony |
| Contrast pressure as the univerbation trigger | **real, directionally** | languages do compound to restore contrast (the Mandarin case). That it fires *specifically* on ≤2-segment or homophonous words is our operationalisation, not a measured threshold |
| Word order determining fusion partners | **real** | a compound's internal order follows the language's modifier/head order; this is the same Greenbergian logic [1ENG.14 §3.3](./1eng-14-syntax-conditioned-sound-change.md) already uses |
| `UNIVERB_RATE = 0.06` | **first-pass tuning, flagged** | fitted to land syll/word in 1.6–2.0 over 300 turns (§4.2). No corpus fit; same treatment as `SYNTAX_STRENGTH`/`BIAS_STRENGTH`. 2SIM.1 owns the re-fit |
| Fused form assigned to the head concept | **abstraction, flagged** | real univerbation creates a *new* lexeme with fused semantics; our 48-concept map has no slot for one, so the head concept absorbs the longer form. Same abstraction [2LEX.2](./2lex-1-homophone-collision-resolution.md) already accepted for compound repair |
| Onset maximisation | **real, standard** | the default assumption in syllable theory. Chosen on principle; §1 measured that it is currently indistinguishable from the alternative, and says so |
| Sonority sequencing principle | **real** | standard; our scale is the conventional five-step manner hierarchy |
| Syllabification as a pure function (no cache) | **ours, measured** | §5.2: 29% of word-changing applications alter syllable count, so a cache is stale a third of the time it is read |
| Monosyllabic collapse as a *defect* | **judgement, argued** | §2.1: monosyllabic languages are real (Sinitic). What makes ours a defect is the *unanswered* 61-pair homophony load, not the syllable count itself |

---

<a name="deferred"><h2>8. Out of scope (surveyed, deferred)</h2></a>

- **Cliticisation.** The other phrase-level renewal force §3 names: pronouns and auxiliaries leaning on hosts, which is how affixes are born. [1ENG.20](../roadmaps/mvp.md)'s paradigm already *seeds* affixes from pronoun sources at genesis, so the pathway exists but is not fed by adjacency. A natural follow-on once univerbation proves the adjacency-reading pattern.
- **Sandhi-driven preservation.** [`followerVowelShare`](../../src/lib/engine/syntax.ts) computes exactly the liaison statistic needed to *preserve* a final consonant, and currently only damps a multiplier. Making it preserve actual segments (French liaison proper) needs a doublet model — a word with context-dependent alternants — which [1ENG.14 §9](./1eng-14-syntax-conditioned-sound-change.md) already deferred and this spike does not reopen.
- **Tonogenesis as the alternative answer.** §2.1: Sinitic answered monosyllabic homophony with tone *as well as* compounding. [4PHON.1](../roadmaps/mvp.md) owns that, and it remains correctly deferred — but its framing should be updated: tone is not merely a nice-to-have, it is the second half of the attested response to exactly the collapse measured here.
- **Fixing `compoundWord`'s clipping.** §2.1 shows 2LEX.2's repair produces almost no lengthening because it clips both stems. Deliberately *not* fixed here: 2LEX.2's compounds exist to disambiguate a specific pair, and clipping keeps them short enough to stay usable. Univerbation is the general force; conflating the two would give one mechanic two jobs.
- **The template-driven syllable parse.** §1 measured it as indistinguishable from onset maximisation. If a future task makes `World.tmpl` a live per-branch parameter that drifts (rather than a genesis record), the fork reopens with real stakes — recorded so that task knows it inherits the question.
- **Chain-shift-aware syllable weight.** Heavy vs light syllables (coda-bearing vs open) condition stress in many languages, and `syllabify` returns enough structure to compute weight. Left to 1ENG.24, which owns the stress model that would consume it.

---

<a name="sources"><h2>Sources</h2></a>

Census scripts (reproduce every number in §1–§4):
- [`assets/1eng-25-algorithm-comparison.ts`](./assets/1eng-25-algorithm-comparison.ts) — onset-max vs template parse, 2016 words
- [`assets/1eng-25-ossification-census.ts`](./assets/1eng-25-ossification-census.ts) — word length / syllable count / cluster lifecycle over time
- [`assets/1eng-25-homophony-census.ts`](./assets/1eng-25-homophony-census.ts) — collision load and 2LEX.2 repair activity at the floor
- [`assets/1eng-25-renewal-audit.ts`](./assets/1eng-25-renewal-audit.ts) — per-rule eligibility, erosion:renewal pressure ratio
- [`assets/1eng-25-paragoge-lockout.ts`](./assets/1eng-25-paragoge-lockout.ts) — V-final ecology, the lockout traces
- [`assets/1eng-25-weight-tuning-null.ts`](./assets/1eng-25-weight-tuning-null.ts) — the null results of §2.2
- [`assets/1eng-25-substrate-asymmetry.ts`](./assets/1eng-25-substrate-asymmetry.ts) — phrase-substrate consumer audit
- [`assets/1eng-25-univerbation-fit.ts`](./assets/1eng-25-univerbation-fit.ts) — the mechanic, rate fit and equilibrium check
- [`assets/1eng-25-resyllabification-census.ts`](./assets/1eng-25-resyllabification-census.ts) — resyllabification rate per rule

Linguistics:
- Univerbation — <https://en.wikipedia.org/wiki/Univerbation>
- Sonority sequencing principle — <https://en.wikipedia.org/wiki/Sonority_Sequencing_Principle>
- Syllable onset maximisation — <https://en.wikipedia.org/wiki/Syllable>
- Mandarin disyllabic compounding as a response to homophony — <https://en.wikipedia.org/wiki/Chinese_classifier#Disyllabic_words>
- Old English → Modern English univerbation (*lord*, *daisy*) — <https://www.etymonline.com/word/lord>
- Surfaced by the [1ENG.16 Zompist survey §9](./1eng-16-zompist-tools-survey.md) as the blocking prerequisite for 1ENG.24

---

- [Roadmap](../roadmaps/mvp.md) · [1ENG.23 spike](./1eng-23-per-branch-phoneme-inventories.md) · [1ENG.11 spike](./1eng-11-erosion-renewal.md) · [1ENG.14 spike](./1eng-14-syntax-conditioned-sound-change.md) · [2LEX.1 spike](./2lex-1-homophone-collision-resolution.md) · [Engine source](../../src/lib/engine/)
