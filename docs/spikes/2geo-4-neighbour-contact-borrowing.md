---
description: 2GEO.4 design spike — how bordering branches converge via lexical borrowing, the one convergent force in an otherwise all-divergent turn loop, with a build-ready implementation contract for 2GEO.5
---

# 2GEO.4 — Design Spike: Neighbour Contact / Borrowing

> [!IMPORTANT]
> **Goal:** Define, concretely enough to implement without further design work, how two bordering branches grow *more* alike through lexical borrowing. Every existing turn-loop force is divergent (drift, fracture, assimilation-death). This spike specifies the engine's one **convergent** force and hands the implementation task ([2GEO.5](../roadmaps/mvp.md#m2-todo)) a build-ready contract, following the pattern of [2GEO.1](./2geo-1-terrain-sound-change.md).

---

## Contents

- [1. The gap: nothing makes living neighbours converge](#gap)
- [2. What the research actually supports](#research)
- [3. The four-part mechanic](#mechanic)
  - [3.1. Eligibility — the lender's terrain-salient concepts](#eligibility)
  - [3.2. Selection — the most-divergent eligible concept](#selection)
  - [3.3. Contact strength — the pair-local throttle](#contact)
  - [3.4. Outcome — contact-graded faithful vs adapted](#outcome)
  - [3.5. Cadence — every turn, per ordered pair, seeded](#cadence)
- [4. Where it slots in the turn loop](#slot)
- [5. Implementation contract](#contract)
- [6. Honesty ledger: real vs proxy vs flavour](#ledger)
- [7. Out of scope (surveyed, deferred)](#deferred)
- [Sources](#sources)

---

<a name="gap"><h2>1. The gap: nothing makes living neighbours converge</h2></a>

Every force in [`resolveGeneration`](../../src/lib/engine/generation.ts) today pushes branches *apart* or removes one:

| Step | Force | Direction |
|------|-------|-----------|
| 1. drift | autonomous sound change | **divergent** (each branch drifts independently) |
| 2. rename | era-anchor freeze | bookkeeping (records divergence) |
| 3. spread | territory expansion | neutral |
| 4. assimilation death | small near-identical branch absorbed | **removes a language** |
| 5. fracture | disconnected territory splits off | **divergent** (mints new branches) |

Two *living* neighbours can only ever drift apart. Real bordering speech communities do the opposite as well: they lend each other words, and their lexicons partially converge. The intelligibility matrix ([`intelligibility.ts`](../../src/lib/engine/intelligibility.ts)) can measure convergence — a rising per-concept score — but nothing in the loop ever produces it. Borrowing is that missing force.

This is the natural home the [2GEO.1 spike §7](./2geo-1-terrain-sound-change.md) earmarked: *"Axis B's borrowing lever (salient concept words borrowed across border edges) is the natural home for neighbour-convergence. `borderEdges` and `dominantTerrain` from this spike are the hooks."* Those hooks now exist as [`neighborsOf`](../../src/lib/engine/geography.ts) and [`dominantTerrain`](../../src/lib/engine/geography.ts), both shipped with 1ENG.18 / 2GEO.2–3. This spike gives them a build-ready mechanic.

---

<a name="research"><h2>2. What the research actually supports</h2></a>

Four claims underpin the mechanic; each was checked against primary historical-linguistics sources (foot of doc), not asserted from memory.

**Borrowing intensity scales with contact intensity — the single most established fact in contact linguistics.** [Thomason & Kaufman's borrowing scale (1988)](https://wiki.ercpalac.info/index.php?title=Borrowability_scale) makes intensity of contact *the* primary social variable: five degrees, from casual contact (non-basic lexicon only) up to intense contact (structural borrowing). "Greater intensity of contact... results in more borrowing." Contact strength is the correct throttle for both *how often* and *how completely* words cross.

**Faithful-vs-adapted borrowing tracks bilingual proficiency.** [Loanword-adaptation research](https://escholarship.org/content/qt83f5j51f/qt83f5j51f_noSplash_272b41a47ce881ffbdd4b67c674eea07.pdf) shows high bilingualism → faithful copying of the source form; low/intermediate bilingualism → the loan is *nativised* (adapted toward the borrower's phonology). Japanese borrowing from Chinese did exactly this across high- vs low-bilingualism eras. The engine has no proficiency variable, but contact intensity is a legitimate *proxy* (more contact → more bilinguals → more faithful copies). See the ledger (§6) — this is proxy, honestly flagged, not a claimed border-count→faithfulness law.

**Culturally/environmentally salient concepts borrow most; basic vocabulary resists.** [Tadmor's WOLD study (2009)](https://www.eva.mpg.de/linguistics/past-research-resources/typological-surveys/loanword-typology-comparative-study-of-lexical-borrowability/) quantifies it by semantic field: religion & belief 41.2%, clothing & grooming 38.6%, the house 37.2% at the top; **sense-perception 11%, spatial-relations 14%, the body 14.2%** at the bottom. Basic vocabulary is "the most stable and the less prone to borrowing." You borrow the word for a thing from whoever is the cultural authority on that thing (the *Wanderwort* pattern — [WOLD](https://wold.clld.org/)).

> [!IMPORTANT]
> **The consequence that makes our mechanic honest:** our 32 concepts ([`CONCEPTS` in `lexicon.ts`](../../src/lib/engine/lexicon.ts)) are a Swadesh-style *basic* list (water, stone, hand, eye, tooth) — the **least** borrowable stratum in reality. Body parts and basic physical-world terms sit at the *bottom* of Tadmor's scale. Borrowing `eye` or `tooth` would be linguistically wrong. Gating eligibility on the lender's terrain-salient concepts (fish, river, snow, path — environment-cultural, not body-basic) picks precisely the *borrowable* subset of an otherwise borrowing-resistant list. **The salience gate is not flavour; it is the thing keeping the mechanic defensible.**

**Salience does double duty with opposite signs — and that is the real profile.** 2GEO.3 makes salient concepts *resist drift* (stable internally); this spike makes them *attract borrowing* (mobile across borders). A *Wanderwort* is exactly this: stable within a community, mobile between them. The same word can resist drift and be borrowed in the same turn — no contradiction, it is the attested pattern.

---

<a name="mechanic"><h2>3. The four-part mechanic</h2></a>

Borrowing is directional and per-ordered-pair. For an ordered pair `(A, B)` — "A borrows from B" — resolve four things: which concepts are *eligible*, which one is *selected*, how strong the *contact* is, and what *outcome* that produces. Then a *cadence* rule decides whether the event fires at all this turn.

<a name="eligibility"><h3>3.1. Eligibility — the lender's terrain-salient concepts</h3></a>

A concept is eligible to be borrowed **from B** iff it is salient to B's dominant terrain:

```
eligible(B) = { concept : salienceRetention(concept, dominantTerrain(B)) > 0 }
```

Both helpers already exist: [`dominantTerrain`](../../src/lib/engine/geography.ts) and [`salienceRetention`](../../src/lib/engine/lexicon.ts). No new salience data. A water branch lends `fish`/`river` (core, 0.5) and `water`/`wind`/`star` (secondary, 0.25); a mountain branch lends `stone`/`hill` + `snow`/`path`/`bone`. The environment-neutral basics (`eye`, `tooth`, `sun`, `moon`, …) have zero salience under every terrain and so are **never borrowable** — matching Tadmor's bottom-of-scale finding directly.

Directionality falls out for free: A lends *its* salient concepts to B; B lends *its* salient concepts to A. Two neighbours with different terrains exchange different concept sets. Same terrain → they lend the same set, which is fine (they likely already agree on those, so §3.2's selector finds little to do).

<a name="selection"><h3>3.2. Selection — the most-divergent eligible concept</h3></a>

Among `eligible(B)`, borrowing a concept A and B already share is a no-op (A's form is already ≈ B's). So select the eligible concept where the pair **diverges most** — lowest per-concept similarity:

```
sim(concept) = 1 - lev(A.word[concept], B.word[concept]) / max(|A|,|B|)   // per-concept intelligibility
selected = argmin over eligible(B) of sim(concept)                         // ties → lowest CONCEPTS index (deterministic)
```

`lev` is the same normalised edit distance [`intelligibility`](../../src/lib/engine/intelligibility.ts) already uses per concept; factor it out (see §5) rather than duplicate. This is the "most-divergent" lever from the design dialogue, operating *inside* the salience gate — so it never fights 2GEO.3 (it only ever ranks concepts salience already blessed) and maximises visible convergence per event.

If `sim(selected) == 1` (A and B already identical on every eligible concept), the event is a no-op and produces no change — skip it (and do not consume a log line).

<a name="contact"><h3>3.3. Contact strength — the pair-local throttle</h3></a>

Contact strength for the ordered pair `(A, B)` is the share of A's outside world that is B — passable A–B border edges as a fraction of A's total border edges:

```
contact(A, B) = (passable border edges between A and B) / (total border edges of A)      ∈ [0, 1]
```

This is per-pair (unlike A's global [`isolationScore`](../../src/lib/engine/geography.ts), which blends all neighbours) and *relative* (a neighbour across A's only border matters more than one across a sliver of a wide frontier — prestige is relative). It needs one new helper, `pairContact` (§5); the counting logic is the same border-edge walk already inside `isolationScore` and `neighborsOf`, specialised to a target neighbour. `contact(A,B)` and `contact(B,A)` differ (different denominators) — correct, since the smaller branch feels the larger neighbour more.

<a name="outcome"><h3>3.4. Outcome — contact-graded faithful vs adapted</h3></a>

Contact strength decides how completely B's form crosses into A, proxying bilingual proficiency (§2):

```
BORROW_FAITHFUL_CUT = 0.5     // tuning constant; contact share above which loans copy whole

if contact(A,B) >= BORROW_FAITHFUL_CUT:
    A.word[selected] = copy of B.word[selected]        // faithful whole-copy (high bilingualism)
else:
    A.word[selected] = stepToward(A.word[selected], B.word[selected])   // one edit-step adaptation (low bilingualism)
```

`stepToward(a, b)` applies the **first** edit along the Levenshtein path from `a` to `b` (substitute the first differing segment; if `a` is a prefix of `b` append b's next segment; if `a` is longer, delete the first surplus segment). Deterministic (leftmost edit, no RNG), and one call moves `sim` strictly upward unless already equal. Repeated low-contact events converge a pair gradually; a single high-contact event converges the selected concept outright.

> [!TIP]
> `stepToward` must respect the existing word invariants `applyRuleToWord` enforces ([`phonology.ts`](../../src/lib/engine/phonology.ts)): the result must contain ≥1 vowel and be ≤ `MAX_LEN`. A borrowed whole-copy of B's form already satisfies both (B's form is itself valid). A one-step edit toward a valid target cannot violate the vowel floor if the target has a vowel and the step never deletes the last vowel — guard the delete branch accordingly (see §5 testing).

<a name="cadence"><h3>3.5. Cadence — every turn, per ordered pair, seeded</h3></a>

Borrowing in reality is **gradual and continuous**, proportional to contact — not a rare punctuated event (that is language *shift*, already modelled by assimilation death). So it fires every turn, per ordered neighbour pair, with a seeded probability gated on contact strength:

```
BORROW_RATE = 0.5             // tuning constant; scales the per-turn per-pair base probability

fires(A,B) = hashRand(seed + <fresh salt>, turn * <p> + <q>, A.id * <r> + B.id) < BORROW_RATE * contact(A,B)
```

**No new randomness source** — reuses [`hashRand`](../../src/lib/engine/rng.ts) with a salt triple distinct from every existing call site (drift uses `seed+7 / turn*131+17 / branchId*911+3`; spread uses `turn*7+1 / branchId*13+5`; salience uses `seed+13 / turn*151+29 / branchId*733+i`). Pick an unused salt so borrowing draws are independent and seeded replay stays deterministic (the [`hashRand`](../../src/lib/engine/rng.ts) guarantee). Because `A.id * r + B.id` is asymmetric, `fires(A,B)` and `fires(B,A)` roll independently — both directions can borrow the same turn, or neither.

Symmetric with drift's "every untouched turn" cadence, and contact does the throttling exactly as Thomason & Kaufman predict: an open plains frontier exchanges words steadily; a single passable mountain pass trickles.

---

<a name="slot"><h2>4. Where it slots in the turn loop</h2></a>

Borrowing is a **new step 3.5**, after passive spread and **before** assimilation death:

```
1. drift            (salience resists — 2GEO.3)
2. rename           (era anchors — 1ENG.10)
3. spread           (territory settles → owner map final for this turn)
── 3.5 BORROW  ◀── new: living neighbours converge
4. assimilation     (a near-identical small neighbour is absorbed — 1ENG.18)
5. fracture         (disconnected territory splits off — 1ENG.10)
```

Rationale for this exact position:
- **After spread**, because contact strength reads the owner map, and spread is the last step that mutates territory before fracture. Borrowing must see this turn's final borders. (`ownerMap` is recomputed by spread's mutations in place, as it is today — read it after step 3.)
- **After drift**, so the drift/borrow ordering decision from the dialogue holds: drift resolves first (salience resists it), borrowing resolves second (salience attracts it). A salient word can resist drift *and* be borrowed the same turn — the real *Wanderwort* profile. The two steps are independent; no `touched`-style coupling flag between them.
- **Before assimilation death**, because a branch about to be assimilated is a maximal-contact case where borrowing has plausibly been running for turns already; running borrow first lets the doomed branch's salient words cross into the absorber before absorption, a small but real "substrate" echo. It also keeps borrowing away from branches whose territory is emptied this turn (an assimilated branch has `territory: []` after step 4, so a later borrow step would read it as ownerless).

Guard identically to assimilation: **only run when `leavesOf(branches).length > 1`** (a lone branch has no neighbour to borrow from). Borrowing never mints or removes a branch and never touches `territory` — it only edits `lex` — so it cannot itself trigger fracture or change ownership.

---

<a name="contract"><h2>5. Implementation contract</h2></a>

Everything is a pure function of already-seeded world state read at the borrow call site in [`generation.ts`](../../src/lib/engine/generation.ts) (`s.world.edges`, the post-spread `owner` map, per-branch `territory` + `lex`). **No new randomness** beyond a fresh `hashRand` salt (§3.5), so seeded replay is preserved.

**New — `src/lib/engine/intelligibility.ts`** (factor out the per-concept metric selection reuses; keep `intelligibility` behaviour identical)

```ts
// normalised edit-distance similarity of two forms ∈ [0,1]; 1 = identical.
// `intelligibility` becomes the mean of this over shared concepts (unchanged output).
export function formSimilarity(a: string[], b: string[]): number;
```

**New — `src/lib/engine/geography.ts`** (pair-local contact; same border-edge walk as `isolationScore`/`neighborsOf`)

```ts
// contact(A,B) ∈ [0,1]: passable A–B border edges as a share of A's TOTAL border edges.
// 0 when A has no border edges, or none of them reach B. Asymmetric in (A,B).
export function pairContact(
  aId: number, bId: number, aTerritory: number[], edges: Edge[], owner: Record<number, number>
): number;
```

**New — `src/lib/engine/lexicon.ts` or `phonology.ts`** (the outcome transforms; place beside the salience helpers they read)

```ts
// concepts of B eligible to be lent to A: salient to B's dominant terrain (non-zero retention).
export function borrowableConcepts(lenderTerrain: Terrain): string[];   // = CONCEPTS.filter(c => salienceRetention(c, lenderTerrain) > 0)

// one leftmost Levenshtein edit from `a` toward `b`; deterministic, never empties the last vowel.
export function stepToward(a: string[], b: string[]): string[];
```

**New — `src/lib/engine/borrowing.ts`** (new module, or a section of `phonology.ts` — the reviewer's call; a module keeps generation.ts imports flat) — the per-pair resolver and the constants:

```ts
export const BORROW_RATE = 0.5;          // per-turn per-pair base probability scalar
export const BORROW_FAITHFUL_CUT = 0.5;  // contact share at/above which loans copy whole

// Resolve one directional borrow A←B for this turn. Returns the concept borrowed and A's
// new form, or null if it does not fire / is a no-op (already identical / no eligible concept).
export function resolveBorrow(
  A: Branch, B: Branch, edges: Edge[], owner: Record<number, number>,
  seed: number, turn: number,
): { concept: string; word: string[]; faithful: boolean } | null;
```

`resolveBorrow` composes the four parts: `pairContact` → `fires` roll → `borrowableConcepts(dominantTerrain(B))` → `formSimilarity`-argmin selection → contact-graded `stepToward`/copy. Keeping it pure and standalone makes it unit-testable in isolation and lets the live UI (2UI.1) preview "who is borrowing what" without re-running a generation, exactly as `dominantAssimilator` serves the assimilation warning today.

**Changed — `src/lib/engine/generation.ts`** — new step 3.5 between spread and assimilation:

```ts
// 3.5 lexical borrowing: bordering living neighbours converge (2GEO.4). Directional,
//     per ordered pair, contact-throttled. Salient concepts resist drift (step 1) yet
//     are the ones that cross borders here — the real Wanderwort profile.
if (leavesOf(branches).length > 1) {
  leavesOf(branches).forEach((A) => {
    neighborsOf(A.id, A.territory, s.world.edges, owner).forEach((bId) => {
      const B = branches[bId]; if (!B) return;
      const res = resolveBorrow(branches[A.id], B, s.world.edges, owner, seed, turn);
      if (!res) return;
      const lex = branches[A.id].lex.map((e) =>
        e.concept === res.concept ? { ...e, word: res.word } : e);
      branches[A.id] = { ...branches[A.id], lex,
        history: [...branches[A.id].history, { name: "Borrowing", note: `borrowed ‘${res.concept}’ from ${B.name}` }] };
      log.push(`${A.name} borrowed ‘${res.concept}’ from ${B.name}`);
    });
  });
}
```

Note `neighborsOf` already returns only *passable*-border neighbours, so the pair set is correct without extra filtering; `pairContact` inside `resolveBorrow` then weights by how much of A's border that neighbour occupies.

⚠️ No breaking changes: all new exports are additive; `intelligibility`'s output is unchanged (only its internals are refactored to call `formSimilarity`). `HistoryEntry` already supports a bare `{name, note}` (no `drift` flag) — a borrow is not a drift, so it correctly stays out of the rename/anchor drift accounting.

**Testing (2GEO.5, per repo convention `module.test.ts` + `tests/fixtures/`):**
- `pairContact`: A wholly surrounded by B → ~1; A bordering B on one of many edges → small fraction; no A–B edge → 0; A with no border edges → 0. Asymmetry: `pairContact(A,B) !== pairContact(B,A)` when border sizes differ.
- `borrowableConcepts`: water terrain → includes `fish`/`river`/`water`; excludes `eye`/`tooth`/`sun` under every terrain.
- `stepToward`: strictly raises `formSimilarity` unless already 1; never returns a vowelless word; never exceeds `MAX_LEN`; identical inputs → unchanged.
- `resolveBorrow`: high `contact` (≥ cut) → faithful copy (result equals B's form); low contact → single-edit result; already-identical eligible set → null; concept selected is the lowest-`sim` eligible one.
- **Determinism:** same seed+turn+pair → identical result; the fresh `hashRand` salt draws differently from drift/spread/salience on the same (turn, branch) (regression guard that no salt collides).
- **Convergence (integration):** two fixed bordering branches over N turns show rising `intelligibility` on at least the borrowed concepts; a walled pair (no passable edge) shows none. Neutral guard: a single-leaf world runs the loop unchanged (borrow step skipped).

---

<a name="ledger"><h2>6. Honesty ledger: real vs proxy vs flavour</h2></a>

| Mechanic | Status | Note |
|----------|--------|------|
| Borrowing intensity scales with contact intensity | **real, well-attested** | Thomason & Kaufman borrowing scale — contact intensity is *the* primary social variable |
| Salient/cultural concepts borrow more; basic vocab resists | **real, quantified** | Tadmor/WOLD: religion 41% … body 14%, sense-perception 11%; our gate picks the borrowable subset of a basic list |
| Salience resists drift *and* attracts borrowing (Wanderwort) | **real** | stable within a community, mobile between — the attested loanword profile |
| Contact share proxies bilingual proficiency (faithful vs adapted) | **proxy, flagged** | real axis is *proficiency*; we have no proficiency variable, so contact stands in for it — honest stand-in, not a claimed law |
| Directional, per-pair borrowing (A←B ≠ B←A) | **real** | borrowing is asymmetric; smaller branch feels the larger neighbour more |
| `stepToward` = leftmost single Levenshtein edit | **abstraction** | a legible deterministic convergence step, not a claim about *which* segment nativises first |
| Borrow rate / faithful cut magnitudes | **first-pass tuning** | `BORROW_RATE`, `BORROW_FAITHFUL_CUT` are single named constants — expect a playtest pass in 2GEO.5, as `BIAS_STRENGTH` got in 2GEO.2 |

---

<a name="deferred"><h2>7. Out of scope (surveyed, deferred)</h2></a>

- **Doublets / loan variants.** Real borrowing often *adds* a form alongside the native one (a doublet) rather than replacing it. Modelling this needs `LexEntry` to hold multiple forms, which nothing in the engine supports — it would ripple through `intelligibility`, `formOf`, `collisionPairs`, naming and the word-table UI. That is its own roadmap line, not a rider on 2GEO.4. This spike replaces/adapts a single form.
- **Structural borrowing.** Thomason & Kaufman's higher contact degrees borrow *structure* (phonemes, affixes, syntax), not just words. Out of scope; the engine has no cross-word syntax yet (see [1ENG.14](../roadmaps/mvp.md#m1-todo)) and no morphology (see [1ENG.15](../roadmaps/mvp.md#m1-todo)).
- **Borrowing as a player-triggered stakes move.** Could couple to [2STK](../roadmaps/mvp.md#m2-todo) — but 2STK.1 *depends on* 2GEO.4, so borrowing must exist as an autonomous force first. If 2STK later wants a player "force a borrow / resist a borrow" lever, `resolveBorrow` is the hook to gate on pool spend.
- **Prestige asymmetry by branch size/age.** Real borrowing favours the higher-prestige (often larger, older, more-territory) language as lender. Our contact metric already tilts toward the larger neighbour via the relative denominator, but an explicit prestige term (lender territory / age) is a natural 2GEO.5 tuning extension if playtests want stronger directionality.

---

<a name="sources"><h2>Sources</h2></a>

Contact intensity & the borrowing scale:
- Thomason & Kaufman (1988) borrowing scale — <https://wiki.ercpalac.info/index.php?title=Borrowability_scale>
- Winford, *Contact-induced changes — classification and processes* — <https://linguistics.osu.edu/sites/linguistics.osu.edu/files/Don-WPL.pdf>

Loanword adaptation (faithful vs nativised, proficiency):
- *Phonetics vs. phonology in loanword adaptation: revisiting the role of the bilingual* — <https://escholarship.org/content/qt83f5j51f/qt83f5j51f_noSplash_272b41a47ce881ffbdd4b67c674eea07.pdf>

Which concepts borrow (semantic-field borrowability):
- Tadmor & Haspelmath, Loanword Typology Project / WOLD — <https://www.eva.mpg.de/linguistics/past-research-resources/typological-surveys/loanword-typology-comparative-study-of-lexical-borrowability/> · <https://wold.clld.org/>
- Tadmor, *Borrowability and the notion of basic vocabulary* — <https://www.jbe-platform.com/content/journals/10.1075/dia.27.2.04tad>
- *Wanderwort* — <https://en.wikipedia.org/wiki/Wanderwort>

---

- [Roadmap](../roadmaps/mvp.md) · [2GEO.1 spike](./2geo-1-terrain-sound-change.md) · [Engine source](../../src/lib/engine/)
