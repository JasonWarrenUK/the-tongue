---
description: 1ENG.24 design spike; per-branch stress placement and the two sound changes it conditions, finding that 1eng-25 §5.3's pre-specified whole-word gate degenerates to a per-branch constant and amending it to a per-segment mechanism, plus a real schwa via a tri-valued back axis
---

# 1ENG.24 — Design Spike: Stress, and the Sound Changes That Need It

> [!IMPORTANT]
> **Goal:** Specify a per-branch stress rule (initial/final/penultimate/weight-sensitive), how it composes with [1ENG.14](./1eng-14-syntax-conditioned-sound-change.md)'s position profiles, and the two stress-conditioned sound changes the roadmap names — unstressed vowel reduction and unstressed syllable loss (the Latin→French engine).
>
> **What the investigation actually found:** [1eng-25 §5.3](./1eng-25-runtime-syllabification.md#composition) pre-specified stress as a whole-word block gate in `applyRuleToLex`, mirroring the salience and syntax gates. **That design cannot work.** Every high-volume rule in this engine targets the word's final syllable (`post: bound`), and whether the final syllable is stressed is not a property of the word — it is a property of the branch's stress rule alone. A whole-word gate therefore collapses to a per-branch constant: measured at 0%/100%/0%/0% final-syllable-stressed across the four modes. Worse, a whole-word gate is all-or-nothing and cannot express *"delete the unstressed vowel, keep the stressed one"* — the roadmap's own headline target. This spike amends §5.3: stress conditions the transducer per-segment, not per-word. The cost is smaller than that departure suggests — zero of the 17 existing rules change, because TypeScript's structural typing makes a widened `ctx` object free for every consumer that ignores it.

---

## Contents

- [1. The measurement: is there anything to stress?](#measurement)
  - [1.1. Syllable-count distribution, post-1ENG.27](#syllcount)
  - [1.2. The degeneracy proof: per-rule stress-position audit](#degeneracy)
  - [1.3. Heavy-penult rate, coda-only vs the honest test](#heavy)
- [2. Amendment to 1eng-25 §5.3](#amendment)
- [3. How stress reaches the transducer](#transducer)
- [4. `StressRule`: type, genesis, storage, inheritance](#stressrule)
- [5. `stressPosition` and `stressMap`](#position)
- [6. The two new rules](#newrules)
- [7. A real schwa, via tri-valued `back`](#schwa)
- [8. Implementation contract](#contract)
- [9. Honesty ledger: real vs proxy vs flavour](#ledger)
- [10. Out of scope (surveyed, deferred)](#deferred)
- [Sources](#sources)

---

<a name="measurement"><h2>1. The measurement: is there anything to stress?</h2></a>

<a name="syllcount"><h3>1.1. Syllable-count distribution, post-1ENG.27</h3></a>

[1eng-25 §2](./1eng-25-runtime-syllabification.md#collapse) measured the corpus at 1.05 syllables/word and concluded stress "would be inert across 95% of the lexicon" — the real blocker was never the absence of a parser but the absence of anything to parse. [1ENG.27](./1eng-25-runtime-syllabification.md#univerbation) (univerbation) and [1ENG.28](./1eng-25-runtime-syllabification.md#syllabify) (syllabification) shipped since. Re-measured against HEAD ([`1eng-24-stress-census.ts`](./assets/1eng-24-stress-census.ts), arm 1, 25 seeds):

| Turn | n | mean syll/word | ≥2 syll | ≥3 syll |
|------|---|-----------------|---------|---------|
| 0 | 1200 | 1.52 | 52.5% | 0.0% |
| 10 | 1200 | 1.48 | 39.1% | 7.8% |
| 40 | 1728 | 1.62 | 45.1% | 13.4% |
| **80** | **1728** | **1.82** | **52.2%** | **20.1%** |
| 150 | 1728 | 1.78 | 47.1% | 19.2% |

**The 95% floor is gone.** 1ENG.27 worked: 52.2% of words are polysyllabic at turn 80, and 20.1% are trisyllabic-or-longer — the population on which antepenultimate stress and medial syncope are non-vacuous. Stress is now expressible. This is not, however, the same as saying a whole-word gate can express it — that is §1.2.

<a name="degeneracy"><h3>1.2. The degeneracy proof: per-rule stress-position audit</h3></a>

[1eng-25 §5.3](./1eng-25-runtime-syllabification.md#composition) specified `stressMult` as a third whole-word gate in `applyRuleToLex`, structurally parallel to the salience gate (`phonology.ts:274-278`) and the syntax gate (`phonology.ts:279-294`). Testing that design against the shipped `RULES` table (`phonology.ts:58-137`), arm 2 of the census, 25 seeds, turn 80, mode=penult:

| rule | changes | on multisyllables | hits stressed | hits unstressed | % stressed |
|------|---------|---------------------|----------------|-------------------|------------|
| `apoc` | 1376 | 768 | 0 | 768 | **0.0%** |
| `break` | 1376 | 768 | 0 | 768 | **0.0%** |
| `smooth` | 597 | 370 | 54 | 316 | 14.6% |
| `raise` | 358 | 136 | 0 | 136 | **0.0%** |
| `finalC` | 352 | 134 | 0 | 134 | **0.0%** |
| `paragoge` | 352 | 134 | 0 | 134 | **0.0%** |
| `complengFinal` | 138 | 56 | 0 | 56 | **0.0%** |
| `shorten` | 43 | 14 | 0 | 14 | **0.0%** |
| `devoice` | 41 | 17 | 0 | 17 | **0.0%** |
| `voice` | 34 | 34 | 6 | 28 | 17.6% |
| `spirant` | 34 | 34 | 6 | 28 | 17.6% |
| `cluster` | 30 | 21 | 14 | 7 | 66.7% |
| `epenth` | 30 | 21 | 14 | 7 | 66.7% |
| `debucc` | 22 | 9 | 0 | 9 | **0.0%** |
| `aphaer` | 22 | 20 | 16 | 4 | 80.0% |
| `compleng` | 6 | 5 | 2 | 3 | 40.0% |
| `palat` | 5 | 3 | 0 | 3 | 0.0% |
| `nasassim` | 4 | 2 | 2 | 0 | 100.0% |

The two highest-volume rules in the engine — `apoc` (1376 changes) and `break` (1376) — both hit the unstressed syllable **0% of the time under `penult`.** They are `post: bound` (`phonology.ts:62`, `:95`): their target is always the final syllable. Whether the final syllable *is* the unstressed one is not answered by anything in the word — it is answered entirely by the branch's stress mode, confirmed directly in §1.2's companion table:

| stress mode | of 902 multisyllables, final syllable stressed |
|---|---|
| `initial` | **0.0%** |
| `final` | **100.0%** |
| `penult` | **0.0%** |
| `antepenult` | **0.0%** |

**This is the degeneracy.** For the seven `post: bound` rules that account for the overwhelming majority of erosion (`apoc`, `break`, `raise`, `finalC`, `paragoge`, `complengFinal`, `shorten`, `devoice` — 3670 of 4408 measured changes, 83.3%), `stressMult(rule, word, mode)` would return exactly one of two values for the *entire lexicon*, forever, keyed only on `mode`. The `word` argument does no work beyond distinguishing monosyllables. A gate built this way is not stress-conditioned sound change — it is a categorical per-branch multiplier on seven rules dressed up as one.

`smooth` (597 changes, third-highest) makes the deeper problem explicit: its `pre`/`post` are both `null` (`phonology.ts:100-101`), so it fires *anywhere* in the word — "which syllable does `smooth` hit?" has no whole-word answer, because it varies per word and per occurrence. No gate at the per-word level, of any shape, can condition it on stress.

**Conclusion: a whole-word gate cannot deliver stress-conditioned erosion for the rules that matter, and it cannot deliver either of the roadmap's two named sound changes at all** — both are *sub-word* changes ("delete the unstressed vowel, keep the stressed one"), and a gate whose only two outcomes are "block the whole word" or "don't" (`phonology.ts:277`, `:293` return the unmodified entry `e`) has no way to express a difference *within* a word.

<a name="heavy"><h3>1.3. Heavy-penult rate, coda-only vs the honest test</h3></a>

[1eng-25 §7](./1eng-25-runtime-syllabification.md#deferred) left syllable weight to this task, naming `coda.length > 0` as the test. That is a simplification: Latin/Greek metrics also count a long vowel or diphthong as heavy, and this engine has both (`VL`/`VD` phones, `phonology.ts:27-28`). Arm 4, 25 seeds, turn 80:

| Test | Heavy penults (of 902 polysyllables) |
|---|---|
| coda-only (`coda.length > 0`) | 15 (**1.66%**) |
| honest (coda OR long OR diphthong) | 123 (**13.64%**) |
| — contribution from coda | 15 (1.66%) |
| — contribution from long vowel | 55 (6.10%) |
| — contribution from diphthong | 57 (6.32%) |

The honest test moves the number **eightfold** — long vowels and diphthongs, not codas, are where syllable weight actually lives in this corpus, which tracks: onset maximisation (1eng-25 §5.1) assigns every intervocalic consonant to the following onset, so codas are already rare by construction, while `VL`/`VD` phones are common renewal output. Against the pre-stated threshold of ≥15% for "live lever": **13.64% falls just short — narrowly, and the honest test is the one that makes the call close rather than obviously negative.**

Weight-sensitive placement diverges from plain penult (arm 5, ≥3-syllable words only, since a disyllable's antepenult degenerates to its initial regardless):

| Test | of 347 words with ≥3 syllables, weight-sensitive diverges from plain penult |
|---|---|
| coda-only | 98.0% |
| honest | **89.9%** |

Both numbers say the same thing from different angles: under the honest test, 10.1% of ≥3-syllable words have a heavy penult (matching §1.3's 13.64% restricted to the larger population, minus a small population-composition effect), so weight-sensitive placement disagrees with plain penult on the other 89.9%. **Ledgered as flavour, not a live lever** (§9) — correct code, narrowly below the threshold, worth re-measuring if a future mechanic makes codas or long vowels commoner.

---

<a name="amendment"><h2>2. Amendment to 1eng-25 §5.3</h2></a>

§1 makes the case; here is the ruling.

> **Amendment to [1eng-25 §5.3](./1eng-25-runtime-syllabification.md#composition) (issued by 1ENG.24).** §5.3 items 1–3 specify stress as a per-word block gate composing with `syntaxMult`. 1ENG.24 departs from **item 1** — *"`stressMult` returns a multiplier on the same [0.5, 1.5] scale and with the same one-sided block-roll semantics"* — and thereby vacates items 2 and 3, because §1.2 measures that a per-word gate cannot express either of the roadmap's named targets: "loss of unstressed syllables" and "unstressed vowel reduction" are *sub-word* changes, and a gate whose only outcomes are "block the whole word" or "don't" can express neither. Stress instead conditions the transducer at the **segment** level, via `Rule.stressed` and a widened `xform` ctx (§3).
>
> **§5.3 item 4 survives intact and is honoured verbatim:** *"Stress placement is a per-branch parameter seeded and inherited like `wordOrder`, and it reads `syllabify(word)` — never a stored syllable count."* §4 and §5 implement exactly this.
>
> **§5.3's underlying claim survives and is strengthened:** stress and position are orthogonal and do not double-count. They now cannot double-count *by construction* rather than by arithmetic, because they act at different levels entirely — syntax decides whether a word-level change survives (a probabilistic per-word roll), stress decides which segments a rule may touch (a deterministic per-segment gate). The item-2/item-3 contradiction in the original text (one clamped product with one roll, vs two independent rolls with their own salts) is **dissolved, not adjudicated**: there is no second multiplier and no second roll. `syntaxMult` and its roll at `phonology.ts:288-294` do not change one character.

Why item 2's own justification does not transfer, for the record: it cites `driftRule` (`phonology.ts:494-502`) composing `biasedMult` and momentum by multiplication — but `driftRule` combines multipliers into a **selection weight** for a single weighted pick over candidate rules. That is categorically different from combining two independent per-word block probabilities, and the analogy that licensed "one clamped product, one roll" does not hold once stress stops being a second block gate.

---

<a name="transducer"><h2>3. How stress reaches the transducer</h2></a>

Three options, weighed:

| Option | Blast radius | Expresses a sub-word change? |
|---|---|---|
| (a) optional `stress` field on `xform`'s ctx | `types.ts:37`; both transducer loops | Yes |
| (b) per-segment mask threaded as a new `applyRuleToWord` parameter that changes its **signature** | breaks 40+ existing call sites | Yes |
| (c) a separate stress-conditioned application path | forks the transducer | Yes, at duplication cost |

**Recommendation: (a).**

Reject (b): `applyRuleToWord(ids, rule)`'s two-argument shape is exercised at `collision.test.ts:169`, two `1eng-25-*` census scripts, and 40+ assertions in `phonology.test.ts`. A required third parameter breaks every one.

Reject (c): it would duplicate the vowel floor (`phonology.ts:189`), the `MAX_LEN` ceiling (`:190`), and the `lengthensPrev` reach-back (`:184-187`) — precisely the hazard `applyRuleToAffix`'s own header comment names (*"Two differences from applyRuleToWord's loop, **not a wrapper** around it"*, `:194-204`). The codebase already carries one such fork and paid the maintenance cost of keeping its invariants in sync; a second is not free.

**The blast radius of (a) is much smaller than it looks, and that is worth stating plainly rather than assumed.** TypeScript's structural typing makes a widened ctx parameter compatible with every narrower consumer:

- **Zero of the 17 existing `RULES` change.** 14 ignore `ctx` entirely (`xform:()=>({...})`). `nasassim` (`phonology.ts:67`) reads only `ctx.post`. `break` (`:95-99`) and `smooth` (`:100-105`) read only the matched phone `p`. Every one type-checks unchanged against a ctx object that has grown a new optional field.
- `normalise` (`:151`) and `resolveSeg` (`:144`) operate on the xform **result**, not its input — unaffected.
- `applyRuleToAffix` (`:205`) calls `rule.xform(p, { pre, post })` with no `stress` key, which stays legal against an optional field — unaffected except for one added fail-closed guard (below).

**The new surface:**

```ts
// 1ENG.24 — the stress view of the segment currently under the transducer's head.
// Present iff the caller supplied a StressRule; absent (undefined) for every legacy
// call — which is what makes the 17 pre-1ENG.24 rules byte-identical either way.
export interface StressCtx {
  isStressed: boolean;                 // this segment's syllable carries primary stress
  syllIdx: number;                     // 0-based syllable index
  syllCount: number;                   // total syllables in the word
  weight: "heavy" | "light";           // §1.3's honest test
  role: "onset" | "nucleus" | "coda";  // where in the syllable
}
```

`Rule.xform`'s ctx parameter widens to `{ pre: Phone | null; post: Phone | null; stress?: StressCtx }` (`types.ts:37`). `Rule` gains one new optional field:

```ts
// 1ENG.24 — a positional gate evaluated alongside match/pre/post. FAIL-CLOSED: a rule
// declaring this never fires when the stress view is absent. An unconditioned stress
// rule firing unconditioned would be a silent unconditioned sound change — the same
// class of bug isBoundaryRule (syntax.ts:164) guards a future boundary rule against.
stressed?: (s: StressCtx) => boolean;
```

`stressMap()` lives in `syllable.ts`, not a new module — it is a pure structural fact about a word, and `syllable.ts` already owns those with no `World` read:

```ts
// Flatten syllabify()'s structure into one StressCtx per SEGMENT INDEX. Sound by the
// round-trip invariant pinned at syllable.test.ts:108: concatenating
// [...onset, nucleus, ...coda] across syllables reproduces the input word exactly, so a
// running cursor over that concatenation indexes correctly back into it.
export function stressMap(word: string[], mode: StressRule): (StressCtx | undefined)[]
```

⚠️ **Ctx collision with 1ENG.17 slice 2.** [`mvp.md:40`](../roadmaps/mvp.md) proposes widening the *same* `xform` ctx object to carry a distance-found segment (`Rule.distance`, for long-distance assimilation). The two are compatible — independent optional fields — but only if whichever lands second extends the object rather than replacing it. Flagged so neither implementer rediscovers the collision the hard way.

⚠️ **Import-cycle check, at implementation time.** `syllable.ts:1` imports `BY_ID` from `phonology.ts`; `phonology.ts` importing `syllable.ts` (for `stressMap`, if `RULES`' `stressed` predicates need it, or for the gate wiring) closes the loop. The identical shape already ships (`syntax.ts:3` imports `BY_ID`; `phonology.ts:3` imports `syntaxMult`) and resolves because both sides only touch each other from inside function bodies, never at module-scope initialisation (`syntax.ts:164`'s `BY_ID.a` sits inside an arrow body, not a top-level `const`). The stress module must follow the same discipline.

---

<a name="stressrule"><h2>4. `StressRule`: type, genesis, storage, inheritance</h2></a>

Modelled throughout on `wordOrder` (`types.ts:64`), per §5.3 item 4.

**Type** — a bare interface, not a fifth enum member for weight-sensitivity:

```ts
export type StressMode = "initial" | "final" | "penult" | "antepenult";
export interface StressRule { mode: StressMode; weightSensitive: boolean }
```

`weightSensitive` is a **modifier on penult placement**, not a fifth mode. Folding it into `mode` would make "weight-sensitive initial" expressible, which corresponds to nothing — Latin weight-sensitivity only ever modifies penult/antepenult selection.

**Genesis** — two `rng()` draws, **tail-appended after the `adj` draw at `world.ts:35`**, per the load-bearing tail-append convention (`world.ts:21-26`, `:33-35`): drawing earlier shifts every downstream draw and changes every seed's world.

```ts
// 1ENG.24 — stress placement, tail-appended after wordOrder. Mode weights follow WALS
// 14A's attested skew (initial/penultimate dominate fixed-stress systems, final is a
// real minority pattern, antepenultimate genuinely rare) — first-pass tuning, ledgered
// as such: 14A (fixed position) and 15A (weight-sensitive) sample disjoint populations,
// so no single table licenses a four-way split. 2SIM.1 owns the re-fit.
const sRoll = rng();
const mode: StressMode =
  sRoll < 0.35 ? "initial" : sRoll < 0.65 ? "penult" : sRoll < 0.90 ? "final" : "antepenult";
// Weight-sensitivity is rarer than fixed placement, and §1.3 measures it as narrowly
// below the "live lever" threshold on this corpus — drawn low, ledgered as flavour.
const weightSensitive = rng() < 0.2;
```

**Storage** — `World.stressRule: StressRule` (genesis record, beside `types.ts:79`); `Branch.stressRule: StressRule` (per-branch, mutable, beside `types.ts:120`).

**Root copy** — `world.ts:60`, spread not shared: `stressRule: { ...world.stressRule }`, matching `wordOrder: { ...world.wordOrder }`'s treatment on the same line.

**Fracture inheritance** — `generation.ts:393`, inherited whole and copied (`stressRule: { ...parent.stressRule }`), for the reason `frameWeights` is copied rather than shared (`generation.ts:377-378`): a sibling's own future state must never mutate the parent's.

**Drift — specify the hook, do not ship the mutation.** The roadmap asks whether stress placement itself drifts. Latin penult stress becoming French final stress is not a stress-*rule* change — it is the *same* rule reading a shorter word after apocope strips the trailing syllables a penult sat inside. Modelling an independent seeded flip would model the symptom, not the cause. Declare `STRESS_SHIFT_RATE` unused-but-present, in the `ORDER_TURNS`/`ORDER_CONTACT_CUT` idiom (`syntax.ts:18-19`: declared before their consuming task, 1ENG.21, exists, so that task tunes against a constant this one already pins). If a genuine trigger emerges — the natural candidate is [4PHON.1](../roadmaps/mvp.md), since stress shift and tonogenesis are historically coupled — it should model on `reanalyse`'s shape (`generation.ts:346-360`): a per-birth roll, exclude-current-value redraw so a fire always produces an observable change.

---

<a name="position"><h2>5. `stressPosition` and `stressMap`</h2></a>

Pure, lives in `syllable.ts`.

```ts
// Which syllable carries primary stress. Returns a 0-based index, or -1 when no
// syllable can bear stress (a wholly vowelless word — reachable via
// applyRuleToAffix's lifted vowel floor, syllable.ts:13-17; syllabify([]) returns one
// such syllable, pinned at syllable.test.ts:50-52).
export function stressPosition(sylls: Syllable[], rule: StressRule): number {
  const n = sylls.length;
  if (n === 0) return -1;
  if (n === 1) return sylls[0].nucleus === null ? -1 : 0;
  if (rule.weightSensitive && rule.mode === "penult") {
    const penult = n - 2;
    return isHeavy(sylls[penult]) ? penult : Math.max(0, n - 3);
  }
  switch (rule.mode) {
    case "initial": return 0;
    case "final": return n - 1;
    case "penult": return n - 2;
    case "antepenult": return Math.max(0, n - 3);
  }
}

// §1.3's honest heavy test.
const isHeavy = (s: Syllable): boolean => {
  if (s.coda.length > 0) return true;
  if (s.nucleus === null) return false;
  const nuc = BY_ID[s.nucleus];
  return !!nuc?.long || !!nuc?.diph;
};
```

Three edge cases, all reachable, all pinned by tests:

- **Monosyllable → 0 under every mode.** 47.8% of the corpus at turn 80 (§1.1). Returning `-1` ("unstressed") would make every monosyllable a syncope target — exactly backwards, since a monosyllable is the *one* word shape that cannot lose its vowel and still be a word.
- **`nucleus === null` → `-1`.** Reachable only via `applyRuleToAffix`'s lifted floor; by construction this always coincides with a monosyllable, so `stressPosition` never needs to inspect `nucleus` outside the `n === 1` branch. Worth pinning as a regression: a future `syllabify` change that produced multiple vowelless syllables should fail loudly here, not silently stress one of them.
- **Disyllable + `antepenult` → 0** via `Math.max(0, n-3)`. What Latin itself does — a disyllable has no antepenult, so it clamps to initial.

---

<a name="newrules"><h2>6. The two new rules</h2></a>

```ts
// 1ENG.24 — unstressed vowel reduction. The first half of the Latin→French engine:
// unstressed nuclei neutralise toward the engine's neutral central vowel (§7) before
// they disappear entirely (syncope, below).
//   w=2.5: same band as spirant/raise/break. Cross-linguistically as common as
// intervocalic spirantisation, commoner than paragoge (1.5), rarer than the w=3 band
// (voice/devoice/apoc/nasassim) — reduction is characteristic of stress-timed
// languages specifically, not universal the way final obstruent devoicing is.
//   Legacy Patch, not Seg[]: 1-in/1-out, no insertion or deletion. NO vowel-floor risk
// (never deletes).
{ id:"reduce", name:"Unstressed vowel reduction",
  note:"unstressed V → ə  (quality neutralised outside the stressed syllable)",
  w:2.5, category:"vowelShift",
  match:isV, pre:null, post:null,
  stressed:(s)=>!s.isStressed && s.role==="nucleus" && s.syllCount>1,
  xform:()=>({ back:"central" }) },

// 1ENG.24 — unstressed syllable loss (syncope). The second half of the Latin→French
// engine and the change this whole 1eng-25/1ENG.27/1ENG.28 chain exists to make
// expressible: calidum > caldu > chaud. Deletes an unstressed nucleus; the stranded
// onset/coda resyllabify for free on the next read (derive-on-read, never cached —
// 1eng-25 §5.2).
//   NOT restricted to medial position, deliberately: apoc (w=3) already owns
// unconditioned final-vowel loss. Overlap is fine and attested — the contrast is that
// apoc deletes the final vowel regardless of stress, while this rule can never touch
// the stressed vowel anywhere in the word, which is the whole distinction the roadmap
// asks for.
//   w=2: below apoc, level with finalC/cluster/shorten. Real and common, but rarer
// cross-linguistically than final vowel loss.
{ id:"syncope", name:"Unstressed syllable loss",
  note:"unstressed V → ∅  (calidum → caldu; the engine of Latin → French)",
  w:2, category:"deletion",
  match:isV, pre:null, post:null,
  stressed:(s)=>!s.isStressed && s.role==="nucleus" && s.syllCount>1,
  xform:()=>({ delete:true }) },
```

⚠️ **The vowel floor (`phonology.ts:189`) is structurally unreachable from `syncope`, and the argument matters more than a second guard would.** `stressPosition` returns a valid index for every word with ≥1 syllable, so exactly one syllable is always stressed, so at least one nucleus is always exempt from `stressed`'s `!isStressed` test. A second explicit guard inside `syncope` would silently mask a future bug in `stressPosition` instead of surfacing it; the existing floor at `:189` already surfaces such a bug correctly, by returning `changed: false`. **Pinned as an invariant test** (§8), not defended twice.

Emergent property worth naming rather than treating as coincidence: `deletion` is contact-favoured (+1.0) and `vowelShift` isolation-favoured (−1.0) under `biasedMult` (`phonology.ts:486`), so high-contact branches will tend to syncopate while isolated ones reduce vowel quality without losing syllables — a real typological correlation (language contact accelerating reduction toward the phonologically "cheaper" outcome) that falls out of category assignment already made for other reasons.

---

<a name="schwa"><h2>7. A real schwa, via tri-valued `back`</h2></a>

The roadmap names reduction "to schwa" specifically, and `PHONES` (`phonology.ts:22-29`) has no central vowel — five qualities on a `height`/`back`/`round` grid, all `back: boolean`. Adding a real one is the one piece of this spike that touches `Phone` itself.

**Use tri-valued `back: "front" | "central" | "back"`, not `central?: boolean`.**

`central?: boolean` looks cheaper on paper, but carries a real corruption bug: `applyXform` (`phonology.ts:44-48`) forwards only `{height, back, round}` into `resolve` (`:32-43`; see `:46`), so `central` would be silently dropped by every rule that fires on a schwa, converting it to the nearest boolean-`back` match — `/e/` (both `mid`, both `!round`) — and `raise` (`:66`) would then turn that into `/i/`. Tri-valued `back` is collision-safe by construction, because `resolve`'s equality tests (`:37-38`) compare the whole `back` value, not a truthy check.

**Measured cost:**

- `.back` has **exactly 7 read/write sites, all inside `phonology.ts`**: `:37`, `:38`, `:46`, `:52`, `:83`, `:89`, `:98`, `:104`. Nothing outside the file reads it.
- ⚠️ **The `frontV` trap, `phonology.ts:52`.** `const frontV = (p: Phone | null) => isV(p) && !p!.back;` — under a boolean this is exactly "front"; under a tri-value, `!"central"` is `false` (truthy string), so the predicate already reads correctly as "not back" only by accident of JS truthiness on `"back"`/`"front"` strings, and silently reclassifies `"central"` as front-like (`!"central"` → `false`, so `frontV` would return `false` for central — the *opposite* accident: it would wrongly exclude schwa from `palat`'s trigger environment rather than wrongly include it, but it is still wrong by construction, not by design). **Must become an explicit `=== "front"` test.** This is the one genuine bug the migration can introduce, and it must be named and tested rather than discovered later.
- **No `VL`/`VD` variants needed.** Nothing assumes every vowel has a long or diphthong counterpart; `applyXform` → `resolve` already returns `null` on no match, and `phonology.ts:180`'s comment documents that exact path for diphthongs (`compleng`/`complengFinal` silently declining to lengthen one). A bare schwa sits in the same already-exercised class. The one consequence: compensatory lengthening cannot fire onto a schwa nucleus — correct, since a genuinely central vowel does not have a conventional long counterpart in most inventories that have one at all.
- **Genesis exclusion is free, and it is the attested pattern, not a workaround.** `genInventory` (`lexicon.ts:80-96`) builds vowels from **hardcoded literals** (`:81`: `["i","a","u"]` or `["i","e","a","o","u"]`), never from `PHONES`. Adding schwa to `PHONES` puts it in **zero** genesis inventories with no new code required. `inventoryOf` (`phonology.ts:318-329`, derived from the live lexicon) is what schwa shows up in, and only after `reduce` has fired. A schwa in a *genesis* inventory would be a typological oddity (schwa is overwhelmingly a reduction product, not a base-inventory vowel); schwa-as-reduction-product is exactly what real languages do, and the engine gets that right for free.
- **Zero test updates strictly required.** No test enumerates `PHONES` or asserts a phone-table size; the only inventory-size assertions are `toBeGreaterThan(0)` bounds (`phonology.test.ts:591-592`). Worth adding anyway (§8): a resolve-collision regression, and a `compleng`-on-schwa null-path test.

---

<a name="contract"><h2>8. Implementation contract</h2></a>

Three slices. Order matters: 2 needs 1 (schwa must exist before `reduce` can target it); 3 needs 2 (the two new rules need the stress substrate).

### Slice 1 — schwa

**Changed — `src/lib/engine/types.ts`:** `Phone.back` and `Patch.back` widen from `boolean` to `"front" | "central" | "back"`.

**Changed — `src/lib/engine/phonology.ts`:** the schwa entry in `PHONES` (`V("ə", "mid", "central", false)` in spirit — `V`'s own signature widens to match); `resolve`'s vowel-branch equality checks (`:37-38`) unaffected in shape, since they already compare the whole `back` value; **`frontV` (`:52`) becomes `(p) => isV(p) && p!.back === "front"`.**

⚠️ **Breaking, `feat(engine)!:`.** Every existing vowel's `back: true/false` literal becomes `back: "back"/"front"` — a type change on a widely-read field, even though `.back`'s only *readers* are inside `phonology.ts`. Every seed's vowel resolution is unaffected in *output* (no new vowel enters any genesis inventory), so drift-replay goldens **do not move** on this slice alone — flagged as the unusual case of a `feat(engine)!:` with no golden movement, the inverse of 1ENG.27's `feat(engine):` that moved every golden despite no type break.

### Slice 2 — the stress substrate

**New — `src/lib/engine/syllable.ts` additions** (extends the existing 1ENG.28 module):

```ts
export type StressMode = "initial" | "final" | "penult" | "antepenult";
export interface StressRule { mode: StressMode; weightSensitive: boolean }
export interface StressCtx {
  isStressed: boolean; syllIdx: number; syllCount: number;
  weight: "heavy" | "light"; role: "onset" | "nucleus" | "coda";
}
export function stressPosition(sylls: Syllable[], rule: StressRule): number;
export function stressMap(word: string[], rule: StressRule): (StressCtx | undefined)[];
```

**Changed — `src/lib/engine/types.ts`:** `Rule.xform`'s ctx widens with `stress?: StressCtx`; `Rule` gains `stressed?: (s: StressCtx) => boolean`; `World.stressRule: StressRule`; `Branch.stressRule: StressRule`.

**Changed — `src/lib/engine/phonology.ts`:** `applyRuleToWord` computes `stressMap` once per call when a `StressRule` is supplied (new optional parameter) and passes the per-segment `StressCtx` into `ctx.stress`; the `hit` test gains the fail-closed conjunct `(rule.stressed ? (st ? rule.stressed(st) : false) : true)`. `applyRuleToAffix` gains the same conjunct, always evaluating `st` as absent (affixes have no independent stress domain).

**Changed — `src/lib/engine/world.ts`:** genesis draw, tail-appended (§4).

**Changed — `src/lib/engine/generation.ts`:** fracture-birth inheritance (§4).

⚠️ **`feat(engine)!:`, despite no goldens moving.** `Branch` gains a required field (`stressRule`), so every `Branch` literal constructed in tests (~40 sites) needs it. Precedent is exact: 1ENG.20 shipped required `Branch.paradigm` as `feat(engine)!:` twice; 1ENG.19 did the same for `wordOrder`/`frameWeights`/`proDrop`. Goldens do not move because no rule in `RULES` yet declares `stressed`, so `driftRule`'s weighted total (`phonology.ts:497`) is unchanged and every existing seed's drift replay is untouched.

### Slice 3 — the two rules

**Changed — `src/lib/engine/phonology.ts`:** `reduce` and `syncope` (§6) added to `RULES`.

⚠️ **`feat(engine)!:`, goldens move.** `firingRules` returns two more candidates and `driftRule`'s weighted total changes, so every seed's drift replay diverges from turn ~1.

### Salt allocation: none needed

Every draw in this spike is either a tail-appended `rng()` at genesis (mulberry32, not `hashRand`) or fully pure (`stressPosition`, `stressMap`, `Rule.stressed`). **`seed+47` stays free.** Update the registry comment (`syntax.ts:100-106`) to record that 1ENG.24 claims no `hashRand` family, and extend the registry regression in the `syntax.test.ts:195-209` idiom to assert `47` remains unclaimed. Add a purity pin on the stress additions to `syllable.ts`, reusing the source-string idiom already at `syllable.test.ts:75-81`.

### Testing (per repo convention: `*.test.ts` alongside source, `bun:test`)

- **17-rule byte-identity sweep** (slice 2): every pre-1ENG.24 rule produces identical output with and without a `StressRule` supplied. Extends the existing 1ENG.12 backward-compat block (`phonology.test.ts:273-294`) rather than a new one — same purpose, one more widening event.
- `stressPosition` golden table: all four modes × 1–4 syllables × `weightSensitive` on/off.
- Monosyllable → `0` under every mode (four assertions); `nucleus === null` → `-1`.
- Weight test goldens: heavy-via-coda, heavy-via-long, heavy-via-diphthong all resolve `weightSensitive` to the penult; a light penult falls back to the antepenult (clamped to `0` on a disyllable).
- **Vowel-floor invariant** (slice 3): drive `syncope` under all four modes over every C/V shape up to 6 segments, assert the output always contains a vowel. This is §6's argued invariant made executable, not a second guard.
- `Rule.stressed` fail-closed: a stress-conditioned rule applied with no `StressRule` returns `changed: false`, in both `applyRuleToWord` and `applyRuleToAffix`.
- `frontV` regression (slice 1): schwa is not classified as front; `palat` does not fire before a schwa.
- `compleng`/`complengFinal` on a schwa nucleus: the lengthening step is silently skipped (returns `null` from `resolve`, per `phonology.ts:180`'s existing documented path), never throws.
- Salt-registry regression: `47` unclaimed (§8, above).
- Fracture inheritance is a **copy**: mutating a child's `stressRule` never touches the parent's.
- ⚠️ **Integration-test instrumentation.** Measure erosion on syllable count **net of fused-in material**, not raw word length or raw syllable count — 1ENG.27's own hard-won lesson (`mvp.md:48`): *"word length stopped being a valid erosion proxy once renewal acted on the same observable... needed a new instrument, not a loosened bound."* The same trap applies here: `reduce`/`syncope` interact with univerbation on the same lexicon.

### Roadmap proposal

- **1ENG.24** → `done` on this spike landing, its entry rewritten to lead with §1.2's finding (the whole-word gate's degeneracy) rather than the assumption it started from — the same treatment 1ENG.25's own entry gives its null result.
- **New — 1ENG.29**, M1, depends on 1ENG.28: implement slice 1 (schwa + tri-valued `back`).
- **New — 1ENG.30**, M1, depends on 1ENG.29: implement slice 2 (the stress substrate).
- **New — 1ENG.31**, M1, depends on 1ENG.30: implement slice 3 (`reduce` + `syncope`).
- **4PHON.1** — note that slice 1 does the `Phone`-axis widening 4PHON.1 would otherwise have had to do itself for tone, and that slice 2's `Rule.stressed` establishes the per-segment conditioning channel a tone rule will also need. Its `dependsOn` stays on 1ENG.24 (the spike, now done) rather than jumping to 1ENG.31, since 4PHON.1's own spike is still unscheduled and should read this document's contract, not wait on its implementation.
- **1ENG.17** — flag the ctx collision (§3): its slice 2 proposes widening the same `xform` ctx object for distance conditioning.

---

<a name="ledger"><h2>9. Honesty ledger: real vs proxy vs flavour</h2></a>

| Mechanic | Status | Note |
|---|---|---|
| Unstressed syllable loss as the Latin→French engine | **real, strongly attested** | `calidum` > `caldu` > *chaud*; named in the LCK's own catalogue |
| Unstressed vowel reduction to a central vowel | **real, strongly attested** | English, Russian, Portuguese, Catalan all reduce unstressed vowels toward schwa or a near-schwa quality |
| Fixed stress modes (initial/final/penult/antepenult) | **real, standard** | the four attested fixed-stress systems; WALS 14A |
| A real schwa, absent from genesis inventories | **real, attested pattern** | schwa is overwhelmingly a reduction product cross-linguistically, not a base-inventory vowel; `genInventory`'s hardcoded literals (§7) deliver this for free |
| Mode draw weights 35/30/25/10 | **first-pass tuning, flagged** | WALS-shaped, not WALS-derived — 14A (fixed position) and 15A (weight-sensitive) sample disjoint populations, so no single table licenses the four-way split. 2SIM.1 owns the re-fit |
| `weightSensitive` draw probability (0.2) | **first-pass tuning, flagged** | no corpus fit |
| Weight-sensitive (Latin) placement | **flavour, flagged, narrowly** | §1.3: 13.64% heavy penults under the honest test — below the pre-stated 15% "live lever" threshold, but close. Correct code either way; re-measure if a future mechanic makes codas or long vowels commoner |
| Stress as segment-level, not word-level, conditioning | **ours, argued** | §2, departs from 1eng-25 §5.3 item 1 |
| `reduce`/`syncope`'s naturalness weights (2.5, 2) | **first-pass tuning, flagged** | positioned relative to existing rules by cross-linguistic commonality judgement, not fit |
| Stress placement itself drifting | **deferred, argued** | §4: attested stress shift (Latin→Romance) is a consequence of syllable loss, not an independent event; modelling a blind seeded flip would model the symptom |
| One primary stress per word, no secondary stress | **simplification, flagged** | real languages (English) have secondary stress with its own conditioning effects. Out of scope §10 |
| Monosyllable always stressed | **real** | universal; also what protects the vowel floor for `syncope` |
| `deletion`/`vowelShift` category split producing contact-vs-isolation stress-erosion bias | **emergent, noted** | falls out of `biasedMult`'s existing category weights (`phonology.ts:486`), not independently designed, but tracks a real typological correlation |

---

<a name="deferred"><h2>10. Out of scope (surveyed, deferred)</h2></a>

- **Secondary stress.** Real (English *ˌreproˈduction*) and it conditions its own reduction/retention patterns. Deferred: the corpus is 20.1% ≥3-syllable at turn 80 (§1.1), so a secondary-stress domain barely exists yet — revisit once that share grows.
- **Stress placement drifting independently.** §4. Reopens if a motivated trigger emerges, most plausibly from 4PHON.1.
- **General stressed-syllable resistance to erosion** (the roadmap's third named target, beyond `reduce`/`syncope`). It falls out for free for those two rules via their `stressed` predicate, but a *general* resistance — stressed segments also resisting `voice`, `spirant`, `apoc`, etc. — would need all 17 existing rules to grow a `stressed` predicate of their own, which is 17 separate linguistic judgements and a task in its own right. **Recorded explicitly so it is not mistaken for an oversight** rather than a deliberate scope line.
- **Weight-sensitive placement as a live lever.** §1.3, §9: ships, narrowly ledgered as flavour. Re-run [`1eng-24-stress-census.ts`](./assets/1eng-24-stress-census.ts) arm 4 if a future mechanic changes coda or long-vowel frequency, and re-ledger against the same 15% threshold.
- **`intelligibility.ts` weighting stress or vowel-quality differences.** Two branches differing only in `stressRule` (or only in whether a vowel reduced to schwa) are currently 100% intelligible under the Levenshtein metric. The same open question [4PHON.1](../roadmaps/mvp.md) already flags for tone; not reopened here.
- **The template-driven syllable parse.** Already deferred by [1eng-25 §8](./1eng-25-runtime-syllabification.md#deferred); this spike inherits that deferral unchanged, since nothing here makes `World.tmpl` a live parameter.

---

<a name="sources"><h2>Sources</h2></a>

Census script (reproduces every number in §1):
- [`assets/1eng-24-stress-census.ts`](./assets/1eng-24-stress-census.ts) — syllable-count distribution, per-rule stress-position audit, final-syllable-stressed degeneracy proof, heavy-penult rate under both tests, weight-sensitive divergence rate

Linguistics:
- WALS 14A, *Fixed Stress Locations* (Goedemans & van der Hulst) — <https://wals.info/chapter/14>
- WALS 15A, *Weight-Sensitive Stress* — <https://wals.info/chapter/15>
- Latin stress rule (penult-if-heavy-else-antepenult) and its loss into Vulgar Latin/Romance — <https://en.wikipedia.org/wiki/Latin_declension#Stress>
- Latin→French unstressed-syllable syncope (*calidum* → *chaud*) — <https://en.wikipedia.org/wiki/History_of_French>
- Vowel reduction to schwa in English, Russian, Portuguese, Catalan — <https://en.wikipedia.org/wiki/Vowel_reduction>
- The LCK's stress-change catalogue, named as the source that surfaced this task — <https://www.zompist.com/kit.html>
- Surfaced by the [1ENG.16 Zompist survey §9](./1eng-16-zompist-tools-survey.md) as a task blocked pending syllabification; discharged by [1ENG.25 §5.3](./1eng-25-runtime-syllabification.md#composition), amended by this spike's §2

---

- [Roadmap](../roadmaps/mvp.md) · [1ENG.25 spike](./1eng-25-runtime-syllabification.md) · [1ENG.14 spike](./1eng-14-syntax-conditioned-sound-change.md) · [1ENG.23 spike](./1eng-23-per-branch-phoneme-inventories.md) · [1ENG.11 spike](./1eng-11-erosion-renewal.md) · [Engine source](../../src/lib/engine/)
