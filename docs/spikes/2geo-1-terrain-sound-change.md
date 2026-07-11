---
description: 2GEO.1 design spike — how geography biases language change, split into a social-geography sound axis and a physical-geography semantic axis, with an implementation contract for 2GEO.2 and 2GEO.3
---

# 2GEO.1 — Design Spike: Geography → Language Change

> [!IMPORTANT]
> **Goal:** Define, concretely enough to implement without further design work, how a branch's geography biases its language change. This spike resolves the ruleset and hands [2GEO.2](../roadmaps/mvp.md#m2-todo) (terrain-biased sound-change weighting) and [2GEO.3](../roadmaps/mvp.md#m2-todo) (biome-driven vocabulary) a build-ready contract.

---

## Contents

- [1. The core decision: two axes](#axes)
- [2. What the research actually supports](#research)
- [3. Axis A — Social geography → sound change](#axis-a)
  - [3.1. Rule-category taxonomy](#taxonomy)
  - [3.2. The contact–isolation signal](#signal)
  - [3.3. The bias function](#bias)
- [4. Axis B — Physical geography → semantic salience](#axis-b)
- [5. Implementation contract](#contract)
- [6. Honesty ledger: real vs flavour](#ledger)
- [7. Open questions for later tasks](#open)
- [Sources](#sources)

---

<a name="axes"><h2>1. The core decision: two axes</h2></a>

Geography influences language along **two independent axes**, each with a different signal and a different target. Conflating them is the trap; splitting them is the whole design.

| Axis | Signal (from geography) | Targets | Feeds task |
|------|--------------------------|---------|-----------|
| **A — Social geography** | contact vs isolation (edge *passability*) | **sound change** — which drift rules fire | [2GEO.2](../roadmaps/mvp.md#m2-todo) |
| **B — Physical geography** | terrain *type* (plain/hill/mountain/water) | **semantic change** — which concepts elaborate & resist loss | [2GEO.3](../roadmaps/mvp.md#m2-todo) |

> [!IMPORTANT]
> **The one-line heuristic that keeps us honest:** *If a geographic linkage runs through **who-talks-to-whom**, it is real linguistics. If it runs through **what-the-rock-does-to-your-mouth**, it is flavour.* Axis A runs through contact (real). Axis B runs through which concepts a culture finds salient (real). Direct terrain→specific-sound causation (altitude→ejectives, humidity→tone) runs through the mouth, and is deliberately **not** built.

Both axes read the same underlying geography using the **internal-vs-border terrain** model: terrain lives on *edges*, not regions, and a branch owns many regions, so a branch's terrain is derived by tallying the edges inside and bordering its territory.

---

<a name="research"><h2>2. What the research actually supports</h2></a>

Two rounds of historical-linguistics research (sources at the foot) produced a sharp, sometimes counter-intuitive steer.

**Sound change (Axis A):**
- Direct physical-environment causation of specific sounds is **contested-to-fringe**. The altitude→ejective correlation (Everett 2013) loses significance once relatedness and areal clustering are controlled (Hammarström); uvulars show the same altitude pattern the proposed mechanism can't explain, and phylogenetics point to *contact*, not air pressure (Urban & Moran 2021). Humidity→tone (Everett et al. 2015) is better-executed but still contested and better explained by contact.
- What **is** well-attested is **social geography**: low-contact/isolated communities level less and preserve or idiosyncratically drift (Trudgill's sociolinguistic typology); high-contact communities simplify, level toward neighbours, and diffuse features areally (koineisation, Sprachbünde, areal phoneme spread such as South Asian retroflexion). Contact → simplification is the single most defensible lever.

**Semantic change (Axis B):**
- Environment shaping **which concepts a language elaborates** is **well-attested** and now quantitatively backed: a 2025 PNAS study over 616 languages confirmed 147 of 163 claimed lexical-elaboration examples; temperature strongly predicts snow/ice vocabulary (β = −0.89 for snow). The honest "words for snow" story is real as a *lexical-salience* effect (not the inflated count, and not the strong-Whorf cognition claim).
- Contact borrowing of newly-encountered environment/culture concepts (flora, fauna, tech, trade — *Wanderwörter*) is the cleanest, least-contested effect of all.

The upshot: **physical terrain is the wrong lever for sounds but the right lever for vocabulary.** The spike routes each signal to where the linguistics actually supports it.

---

<a name="axis-a"><h2>3. Axis A — Social geography → sound change</h2></a>

<a name="taxonomy"><h3>3.1. Rule-category taxonomy</h3></a>

The 10 rules in [`phonology.ts:38-49`](../../src/lib/engine/phonology.ts) have no `category` field today. This spike assigns each rule exactly one **category**, the unit the contact–isolation bias acts on. Categories are chosen so each maps to a research-backed contact tendency.

| Rule `id` | Name | **Category** | Contact behaviour |
|-----------|------|--------------|-------------------|
| `voice` | Intervocalic voicing | `lenition` | contact ↑ |
| `spirant` | Intervocalic spirantisation | `lenition` | contact ↑ |
| `debucc` | Debuccalisation (s→h) | `lenition` | contact ↑ |
| `apoc` | Apocope (final V loss) | `deletion` | contact ↑ |
| `finalC` | Final consonant loss | `deletion` | contact ↑ |
| `cluster` | Cluster reduction | `deletion` | contact ↑ |
| `devoice` | Final devoicing | `deletion` | contact ↑ (neutralisation = simplification) |
| `palat` | Palatalisation | `assimilation` | contact ↑ (mild) |
| `nasassim` | Nasal place assimilation | `assimilation` | contact ↑ (mild) |
| `raise` | Final vowel raising | `vowelShift` | **isolation ↑** |

Notes:
- `devoice` (final devoicing) is a fortition phonetically but a *contrast-neutralising simplification* functionally, which is what contact/L2 pressure favours; it rides with `deletion`.
- `vowelShift` is the one **isolation-favoured** category: unchecked local vowel drift is what isolated communities do when levelling pressure is absent. It stands in for "isolated languages innovate idiosyncratically."
- `assimilation` is only mildly contact-favoured (nasal assimilation is near-universal, so it is a weak differentiator — the spike leaves its multiplier gentle, per §3.3).

<a name="signal"><h3>3.2. The contact–isolation signal</h3></a>

Terrain is an edge property. `passable` edges (plain, hill) are contact channels; impassable edges (mountain, water) are isolation walls. This is not a re-interpretation of the data — passability is already the load-bearing signal in spread and fracture ([`geography.ts:45`](../../src/lib/engine/geography.ts), [`generation.ts:38`](../../src/lib/engine/generation.ts)).

Per the user-chosen **internal-vs-border** model, a branch's isolation is derived from two edge sets:

- **Border edges** — edges from a region the branch owns to a region owned by a *different* leaf branch. These measure contact with *neighbours* (who-talks-to-whom). Primary signal.
- **Internal edges** — edges between two regions the *same* branch owns. These measure internal cohesion; a branch webbed by impassable internal terrain is more fragmented and drift-prone.

Define, for a branch `b`:

```
borderEdges(b)   = edges (u,v) where owner[u] == b.id and owner[v] is a different leaf
internalEdges(b) = edges (u,v) where owner[u] == b.id and owner[v] == b.id

contactCount   = count of PASSABLE border edges
isolationCount = count of IMPASSABLE border edges (mountain/water)

// isolation in [0,1]; 0.5 when a branch has no border edges at all (neutral/interior)
isolation(b) =
  borderEdges empty  → 0.5
  else               → isolationCount / (contactCount + isolationCount)
```

Border edges carry the primary weight. Internal impassable terrain contributes a **secondary nudge** toward isolation (a fragmented branch is one fracture away from splitting anyway, and drifts more freely in the meantime):

```
internalIsolation(b) = impassable internal edges / max(1, total internal edges)
isolationScore(b)    = clamp01( 0.75 * isolation(b) + 0.25 * internalIsolation(b) )
```

`isolationScore` ∈ [0,1]: **1 = walled-off/isolated**, **0 = open/high-contact**, **0.5 = neutral**. It is a pure function of world state, so replay stays deterministic — no new randomness (§5).

<a name="bias"><h3>3.3. The bias function</h3></a>

The existing selector `driftRule` ([`phonology.ts:90`](../../src/lib/engine/phonology.ts)) rolls over `firing` rules weighted by static `rule.w`. The bias multiplies each firing rule's weight by a per-category factor derived from `isolationScore`, **before** the roll. Naturalness weights stay dominant (gentle multiplier, per the user's choice).

Define a signed **contact affinity** per category (positive = contact-favoured, negative = isolation-favoured):

| Category | affinity `α` |
|----------|-------------|
| `deletion` | +1.0 |
| `lenition` | +0.7 |
| `assimilation` | +0.4 |
| `vowelShift` | −1.0 |

Let `t = 1 − 2 * isolationScore` ∈ [−1, +1] be the **contact tilt** (+1 = fully open, −1 = fully walled). The multiplier for a rule of category `c`:

```
STRENGTH = 0.7            // tuning constant; gentle band ≈ 0.5×–2×

mult(c) = clamp( 1 + STRENGTH * α(c) * t,  0.5,  2.0 )
```

Worked extremes (with `STRENGTH = 0.7`):
- **Fully isolated branch** (`t = −1`): deletion ×0.5, lenition ×0.51, assimilation ×0.72, vowelShift ×1.7. → isolated languages drift toward idiosyncratic vowel change, resist simplification.
- **Fully open branch** (`t = +1`): deletion ×1.7, lenition ×1.49, assimilation ×1.28, vowelShift ×0.5. → high-contact languages simplify and level.
- **Neutral** (`t = 0`): every multiplier ×1.0 — identical to today's behaviour.

The multiplier never zeroes a rule and never exceeds 2×, so terrain **nudges the odds** while naturalness weights and the firing filter keep outcomes plausible and legible. `STRENGTH` is a single named constant, so 2GEO.2 can retune against playtest feel without touching the mapping.

---

<a name="axis-b"><h2>4. Axis B — Physical geography → semantic salience (for 2GEO.3)</h2></a>

This axis is specified here because 2GEO.1 owns "which biomes push which changes," and 2GEO.3 depends on 2GEO.1. It is a **design contract for 2GEO.3**, not something 2GEO.2 implements.

Physical terrain type sets a **salience weight per concept per branch**. Salience does three research-backed things (all *lexical*, none cognitive): it makes a concept (i) elaborate into more distinctions, (ii) more attractive to borrow on contact (→ 2GEO.4), and (iii) more resistant to drift/loss. 2GEO.3's minimum scope is (iii): salient concepts drift/replace more slowly.

A branch's **dominant terrain** is the plurality terrain across its internal + border edges (tie → the more impassable wins, since rugged terrain is the more salient daily reference). Concept salience by dominant terrain, drawn from the 32-concept list in [`lexicon.ts:4`](../../src/lib/engine/lexicon.ts):

| Dominant terrain | Elaborated / retained concepts | Rationale (real linguistics) |
|------------------|--------------------------------|-------------------------------|
| **mountain / hill** | `stone`, `hill`, `snow`, `path`, `bone` | temperature β=−0.89 for snow; rugged relief drives topographic vocabulary and travel terms |
| **water** | `fish`, `river`, `water`, `wind`, `star` | subsistence + navigation salience |
| **plain** | `sky`, `wind`, `bird`, `path`, `water` | open-horizon orientation; water scarcity raises its salience |

Environment-neutral basics that stay **flat across all terrains** (matching the "basic vocabulary resists change" finding): `sun`, `moon`, `fire`, `dog`, `day`, `night`, `house`, `eye`, `ear`, `hand`, `tooth`, `blood`, `skin`, `meat`. Leaving these flat gives a legible contrast between anchored basics and terrain-flexed concepts.

Concrete mechanic for 2GEO.3 (minimum): when a drift rule would apply to a word, scale its **effective drift probability** by `1 − salienceRetention(concept, terrain)`, so salient-domain words change more slowly. Reuse the same `dominantTerrain(b)` helper defined for the geography layer.

---

<a name="contract"><h2>5. Implementation contract</h2></a>

Everything below is in scope at the drift call site ([`generation.ts:16`](../../src/lib/engine/generation.ts)) via `s.world.edges`, `s.world.adj`, and per-branch `territory` + `ownerMap`. **No new randomness** — every signal is a pure function of already-seeded world state, so seeded replay is preserved (the determinism guarantee of [`hashRand`](../../src/lib/engine/rng.ts)).

**New — `src/lib/engine/types.ts`**

```ts
export type RuleCategory = "lenition" | "deletion" | "assimilation" | "vowelShift";
// add to Rule:  category: RuleCategory;
```

**New — `src/lib/engine/geography.ts`** (helpers; terrain name lives on `world.edges`, so pass `edges`)

```ts
// isolationScore ∈ [0,1]: 1 = walled/isolated, 0 = open, 0.5 = interior/neutral
export function isolationScore(
  branchId: number, territory: number[], edges: Edge[], owner: Record<number, number>
): number;

// plurality terrain across a branch's internal + border edges (impassable wins ties)
export function dominantTerrain(
  branchId: number, territory: number[], edges: Edge[], owner: Record<number, number>
): "plain" | "hill" | "mountain" | "water";
```

> [!TIP]
> `Edge.name` is currently typed `name?: string` ([`types.ts:24`](../../src/lib/engine/types.ts)) even though `pickTerrain` always populates it ([`geography.ts:6`](../../src/lib/engine/geography.ts)). Tighten it to a `Terrain` union (`"plain" | "hill" | "mountain" | "water"`) as part of 2GEO.2 so the helpers are type-safe.

**Changed — `src/lib/engine/phonology.ts`**
- Tag each rule in `RULES` with its `category` (table in §3.1).
- Add `CATEGORY_AFFINITY: Record<RuleCategory, number>` and `BIAS_STRENGTH = 0.7`.
- Change `driftRule` to accept the branch's `isolationScore` and apply `mult(category)` to each firing rule's `w` before the weighted roll:

  ```ts
  export function driftRule(
    lex: Lexicon, seed: number, turn: number, branchId: number, iso: number
  ): Rule | null
  ```

  Inside, replace the weight `x.rule.w` in the `total` sum and the roll loop with `x.rule.w * biasedMult(x.rule.category, iso)`.

**Changed — `src/lib/engine/generation.ts`** (single call site, line 16)

```ts
const owner = ownerMap(branches);                         // already computed at line 22 — hoist above drift
const iso = isolationScore(L.id, L.territory, s.world.edges, owner);
const rule = driftRule(L.lex, seed, turn, L.id, iso);
```

⚠️ **Breaking change** — `driftRule`'s signature gains a required parameter, and `Rule` gains a required `category` field. Any other caller/constructor of these must be updated. Consider `feat(engine)!:` or a `BREAKING CHANGE:` footer on the 2GEO.2 commit.

**Testing (2GEO.2, per repo convention `module.test.ts` + `tests/fixtures/`):**
- `isolationScore`: all-passable border → ~0; all-impassable border → ~1; no border edges → 0.5.
- `driftRule` bias: with a fixed lexicon+seed, an isolated branch selects `vowelShift`-category rules more often than an open branch, and an open branch selects `deletion` more often. Neutral `iso=0.5` reproduces current selections (regression guard).
- Determinism: same seed+turn+branch+iso → identical rule (no new RNG draws).

---

<a name="ledger"><h2>6. Honesty ledger: real vs flavour</h2></a>

Stated plainly so the UI can be truthful and the model stays defensible.

| Mechanic | Status | Note |
|----------|--------|------|
| Contact → simplification (deletion/lenition ↑) | **real, well-attested** | koineisation, L2 simplification, areal lenition |
| Isolation → idiosyncratic vowel drift, resists levelling | **real, tendency** | hedge: isolation is not a time-freeze (Appalachian myth) |
| Contact → assimilation ↑ | **real, weak** | nasal assimilation near-universal → gentle multiplier only |
| Terrain type → concept salience/elaboration | **real, well-attested** | PNAS 2025; the honest "words for snow" |
| Salient concepts resist loss/drift | **plausible extrapolation** | weak lexical-salience reading, not strong Whorf |
| Terrain type → *which specific sound* changes | **NOT built (flavour)** | altitude→ejectives / humidity→tone are contested-to-fringe |

---

<a name="open"><h2>7. Open questions for later tasks</h2></a>

- **2GEO.4 (contact/borrowing):** Axis B's borrowing lever (salient concept words borrowed across border edges) is the natural home for neighbour-convergence. `borderEdges` and `dominantTerrain` from this spike are the hooks.
- **Salience surfacing (2UI.1):** both `isolationScore` and `dominantTerrain` are per-branch legible quantities — candidates for the intelligibility/branch UI so the player can see *why* a branch drifts the way it does.
- **`BIAS_STRENGTH` and affinity magnitudes** are first-pass; expect a playtest tuning pass in 2GEO.2.

---

<a name="sources"><h2>Sources</h2></a>

Sound change / social geography:
- Trudgill, *Sociolinguistic Typology* — <https://scholarspace.manoa.hawaii.edu/bitstream/handle/10125/4521/12trudgill.pdf>
- Dialect levelling / koineisation — <https://en.wikipedia.org/wiki/Dialect_levelling>
- Everett ejectives + critiques — <https://dlc.hypotheses.org/491> · <https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0245522>
- Humidity/tone debate — <https://academic.oup.com/jole/article/1/1/33/2281884>

Semantic change / physical geography:
- Lexical elaboration, PNAS 2025 (616 languages) — <https://www.pnas.org/doi/10.1073/pnas.2417304122>
- Pullum, *The Great Eskimo Vocabulary Hoax* — <https://www.lel.ed.ac.uk/~gpullum/EskimoHoax.pdf>
- Borrowing / *Wanderwörter* — <https://en.wikipedia.org/wiki/Wanderwort>
- Terrain & spatial frames (sociotopographic model) — <https://www.degruyter.com/document/doi/10.1515/lingty-2017-0011/html>

---

- [Roadmap](../roadmaps/mvp.md) · [Engine source](../../src/lib/engine/)
