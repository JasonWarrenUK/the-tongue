---
description: 2LEX.1 design spike; how a homophone collision that lands during play gets resolved, with a severity gate, a grace period, two attested repair strategies and a build-ready implementation contract for 2LEX.2
---

# 2LEX.1 — Design Spike: Homophone-Collision Resolution

> [!IMPORTANT]
> **Goal:** Define, concretely enough to implement without further design work, what happens when two concepts collide onto one form and stay there. The engine detects collisions ([`collisionPairs`/`homophoneForms`](../../src/lib/engine/phonology.ts)) and warns the player before a rule is applied ([`collDelta`](../../src/lib/game.svelte.ts)), and that is the whole story: a collision that lands persists silently until drift happens to separate the forms again. This spike specifies the resolution mechanic and hands [2LEX.2](../roadmaps/mvp.md) a build-ready contract, following the pattern of [2GEO.1](./2geo-1-terrain-sound-change.md) and [2GEO.4](./2geo-4-neighbour-contact-borrowing.md).

---

## Contents

- [1. The gap, measured](#gap)
- [2. What the research actually supports](#research)
- [3. The mechanic](#mechanic)
  - [3.1. Severity: the class gate and the graded distance table](#severity)
  - [3.2. Grace period: the pressure counter](#pressure)
  - [3.3. Repair: who yields, and what they get instead](#repair)
  - [3.4. Compound order: a per-world typological trait](#order)
  - [3.5. The borrowing arm (gated on 2GEO.5)](#borrowarm)
  - [3.6. The player path: choice at apply time](#player)
- [4. Where it slots in the turn loop](#slot)
- [5. Implementation contract](#contract)
- [6. Honesty ledger: real vs proxy vs flavour](#ledger)
- [7. Out of scope (surveyed, deferred)](#deferred)
- [Sources](#sources)

---

<a name="gap"><h2>1. The gap, measured</h2></a>

Nobody had measured how often collisions actually land in autonomous play, so this spike started there. A census harness ran [`resolveGeneration`](../../src/lib/engine/generation.ts) for 150 turns across 12 seeds with no player input, tracking every per-branch concept-pair collision episode from birth (forms become identical) to death (drift re-separates them, or the branch dies).

| Measurement | Value |
|-------------|-------|
| Branch-turns with ≥1 live collision | **98.1%** |
| Collision episodes landed | 6,642 |
| Healed by later drift | **87.0%** (median 3 turns, mean 4.5) |
| Still colliding at the 150-turn horizon | 13.0% |
| Fresh worlds starting with collisions | 0 ([`genLexicon`](../../src/lib/engine/lexicon.ts) dedups) |

Two design constraints fall straight out of the numbers. Collisions are constant background noise; a mechanic that reacts to every one would fire thousands of times per game. And most collisions are self-healing; drift giveth and drift taketh away, usually within three turns. The mechanic must therefore be selective twice over: only some collisions matter (severity, §3.1) and only persistent ones deserve intervention (grace period, §3.2). The 13% chronic tail, 863 episodes that never healed, is what the mechanic exists for.

---

<a name="research"><h2>2. What the research actually supports</h2></a>

Four claims underpin the mechanic; each was checked against sources (foot of doc), not asserted from memory.

**Homophony avoidance is real, statistical and selective.** [Wedel, Jackson & Kaplan (2013)](https://journals.sagepub.com/doi/abs/10.1177/0023830913489096) examined attested phoneme mergers across eight languages and found merger probability is inhibited by the number of minimal pairs a contrast distinguishes, and specifically by minimal pairs that **share a syntactic category** and have **similar frequency**. Homophones the grammar can't disambiguate are the ones a language fights to avoid. *Bear*/*bare* is cheap; two nouns for farmyard animals is expensive. The [1ENG.14](./1eng-14-syntax-conditioned-sound-change.md) substrate gives the engine word classes, so the category half of the finding is expressible directly; within a category, graded **semantic relatedness** carries the confusability axis (§3.1).

**The classic repair is lexical replacement.** [Gilliéron's Gascon case](https://markstextterminal.com/2020/09/02/term-of-art-homonymic-clash/): Latin *cattus* 'cat' and *gallus* 'rooster' both regularly became *gat* precisely in the districts where *-ll-* → *-t-*, and exactly there the rooster word was replaced: *faisan* 'pheasant', *vicaire* 'curate', *pullus* derivatives. Two closely related words collided and one was re-lexified from semantic neighbours. [Dworkin's medieval Spanish case studies](https://www.semanticscholar.org/paper/Near-Homonymy,-Semantic-Overlap-and-Lexical-Loss-in-Dworkin/a7d42c42c49bcbbb3fd96908b4612afec73ae54e) document the same pattern. There is [scholarly scepticism](https://www.researchgate.net/publication/28079575_The_conflict_of_homonyms_does_it_exist) about homonymic clash as a general driver of change; Wedel's corpus statistics are the modern support for the avoidance pressure being real. Both go in the ledger (§6).

**The systemic repair is compounding.** [Mandarin's phonological history](https://en.wikipedia.org/wiki/Historical_Chinese_phonology): erosion shrank the syllable inventory to roughly 1,200, homophony proliferated, and the lexicon responded with mass disyllabification; two-syllable compounds steadily replaced monosyllabic words until they became the majority word shape. English does the same at retail: *catfish*, *dogfish*, *wolffish* disambiguate by prefixing a semantic neighbour as modifier. Compounding also feeds this engine's existing erosion/renewal cycle ([1ENG.11 spike](./1eng-11-erosion-renewal.md)): compounds are long, and long words are what erosion is for. Mandarin also grammaticalised a bleached suffix for the same job ([子 *-zi*](https://www.mandarinzest.com/blog/our-blog-1/why-do-chinese-people-add-zi-%E5%AD%90-to-words-2), 'child' → empty noun-suffix); that arm needs affix machinery the engine lacks until [1ENG.15](../roadmaps/mvp.md), so it is deferred with a named hook (§7).

**Compound headedness is a per-language typological trait.** [German and Dutch are strongly right-headed](https://www.degruyter.com/document/doi/10.1515/lingvan-2018-0033/html) (modifier + head, the *catfish* shape), French and Arabic strongly left-headed (head + modifier: *timbre-poste*), English, Spanish and Italian mixed. So the engine seeds compound order per world at genesis, the same way [`genTemplate`](../../src/lib/engine/lexicon.ts) seeds syllable shape: one language family, one habit. Whether headedness couples to word order (the Greenbergian correlations, [Dryer 1992](https://www.acsu.buffalo.edu/~dryer/DryerGreenbergian.pdf)) is left for [1ENG.14](../roadmaps/mvp.md)'s syntax model to own; the correlation is noisy (English is VO yet compounds right-headed), so an independent parameter is defensible now.

---

<a name="mechanic"><h2>3. The mechanic</h2></a>

Resolution has two entry paths sharing one repair toolkit. Drift-caused collisions resolve autonomously through a severity gate and a pressure counter. Player-caused collisions surface a choice at apply time. The engine picks on one path, the player on the other; the repairs themselves are identical.

<a name="severity"><h3>3.1. Severity: the class gate and the graded distance table</h3></a>

> [!NOTE]
> **Revised.** The first version of this spike triaged collisions through six hand-drawn semantic fields. The critique pass judged that table brittle (categorical judgement calls carrying the whole repair economy), and once [1ENG.14](./1eng-14-syntax-conditioned-sound-change.md) added word classes, Wedel's finding became expressible literally. This section replaces the field model.

Severity is decided in two tiers:

**Tier 1: the class gate.** A collision between concepts of different [`CONCEPT_CLASS`](./1eng-14-syntax-conditioned-sound-change.md) values (a *see*|*eye* homophone) is **tolerated indefinitely**: this is Wedel's actual finding, that syntax disambiguates cross-category minimal pairs, so a language keeps them cheaply. Tolerated collisions are surfaced as flavour in the word table.

**Tier 2: graded semantic relatedness.** Within a class, severity is a *score*, taken from a static data table: cosine relatedness of the pair in the [ConceptNet Numberbatch](https://github.com/commonsense/conceptnet-numberbatch) embeddings, precomputed for all 541 within-class pairs of the 48-concept substrate by [`2lex-1-semantic-distance-gen.ts`](./assets/2lex-1-semantic-distance-gen.ts) and shipped as [`2lex-1-semantic-distance.json`](./assets/2lex-1-semantic-distance.json). One constant divides the range:

```
SEVERITY_CUT = 0.2    // tuning constant; relatedness below this is tolerated indefinitely
```

Pairs scoring below the cut never repair; pairs above it repair on a clock that runs *faster the closer they are* (§3.2). The table's own top scorers are the pairs any speaker would refuse to conflate: *i|you* 0.62, *day|night* 0.56, *big|small* 0.56, *moon|sun* 0.52, *ear|eye* 0.48, *leaf|tree* 0.48. And the data overrules the old hand-drawn lines in both directions: *path|stone* (formerly same-field, maximally severe) scores 0.11 and is now tolerated, while *blood|water* (formerly cross-field, invisible) scores 0.26 and now repairs. Replacing judgement with measurement is the point of the revision.

Re-running the census under this model (noun pairs only, since the census drives the current 32-noun engine; re-measure after 1ENG.19):

| `SEVERITY_CUT` | Severe share | Repairs per 150-turn game | Chronic-severe caught |
|---------------|-------------|---------------------------|----------------------|
| 0.1 | 41.1% | 88.6 | 304 |
| **0.2** | **13.2%** | **30.3** | **103** |
| 0.3 | 3.6% | 9.0 | 25 |

0.2 keeps the pacing of the original field model (roughly one repair per branch per five turns, the steady Mandarin current) while ranking every repair by measured confusability.

<a name="pressure"><h3>3.2. Grace period: the pressure counter</h3></a>

Severe collisions get a per-pair counter on the branch, mirroring [`assimilationPressure`](../../src/lib/engine/types.ts) exactly: increment each consecutive turn the pair still collides, reset (delete) the moment it heals, repair when it reaches the threshold.

```
COLLISION_TURNS = 6    // tuning constant; base grace period before autonomous repair

threshold(pair) = max(2, round(COLLISION_TURNS × (1 − score(pair))))   // closer pairs repair sooner
```

The base is set from the census: median heal time is 3 turns, so 6 lets the ordinary churn heal itself and touches only the stubborn tail. The distance scaling then grades urgency by measured confusability: *moon|sun* (0.52) repairs after 3 colliding turns, *sky|wind* (0.29) after 4, a pair just over the cut waits the better part of the full 6. The floor of 2 keeps even the most catastrophic pair from repairing the turn it lands, preserving the tolerate-and-hope gamble (§3.6). The census sweep for this model is in §3.1; expect a playtest pass on both constants in 2LEX.2, as `BIAS_STRENGTH` got in 2GEO.2 and `BORROW_RATE` will get in 2GEO.5.

The counter state lives on the branch (`collisionPressure: Record<string, number>`, key = sorted concept pair). Children inherit it at fracture: the community carried the ambiguity across the split. It clears on heal, on repair and for the player path on an apply-time repair.

<a name="repair"><h3>3.3. Repair: who yields, and what they get instead</h3></a>

**Who yields.** Wedel found similar-frequency pairs drive avoidance hardest; frequent words also keep short forms (Zipf). The engine has no frequency, but it has terrain salience, and salience is the same "importance to this community" quantity. The concept with the higher [`salienceRetention`](../../src/lib/engine/lexicon.ts) under the branch's [`dominantTerrain`](../../src/lib/engine/geography.ts) keeps the short form; the other yields and is compounded. Tie (both zero, or equal): the lower [`CONCEPTS`](../../src/lib/engine/lexicon.ts) index keeps. Mountain folk colliding *snow|rain* keep *snow* short.

**The compound.** The yielding concept's new word is a modifier joined to its current form (the head):

- **Modifier source and ranking:** same-class concepts ranked by semantic relatedness to the yielding concept (the distance table again), nearest first, excluding both members of the colliding pair; ties broken by lower `CONCEPTS` index. This is the *catfish*/*dogfish*/*wolffish* pattern (and Swedish *flodhäst* 'river-horse') stated properly: real disambiguating modifiers are semantic neighbours of the head. Autonomous repair always takes the top candidate; the player picks from the list (§3.6). Every class holds at least one candidate (the smallest, pronouns, has three members, so a colliding pair still leaves one).
- **Fallback:** none needed beyond the ranking itself; the repair-made-collision guard below walks down the same list.
- **Clipping:** the modifier contributes only its initial segments up to and including its first vowel, in practice ≤3 segments since onsets never exceed two consonants, echoing how real compound members reduce. The head is untouched; recognisability lives there.
- **Repair-made collisions:** if the compound form itself collides with a third word, try the next-ranked modifier; if every candidate collides, take the top one anyway and log it. Bounded, deterministic.

A compound may transiently exceed `MAX_LEN` (worst case 3 + 12 = 15 segments). This is deliberate and safe: the [`applyRuleToWord`](../../src/lib/engine/phonology.ts) ceiling only blocks *growth* (`out.length > MAX_LEN && out.length > ids.length`), so erosion rules keep firing on an oversized compound and grind it down. Compound then erode is exactly the Mandarin sequence.

**History.** A repair appends `{ name: "Disambiguation", note: "'moon' → skymoon (collided with 'sun')" }` with no `drift` flag, the same reasoning 2GEO.4 applied to borrows: lexical replacement is change, but it is not sound change, so it stays out of the drift accounting.

<a name="order"><h3>3.4. Compound order: a per-world typological trait</h3></a>

`World` gains a `compoundOrder` field, seeded once at world genesis:

```
compoundOrder: "modFirst" | "headFirst"     // rng() < 0.5 ? … : … at genWorld time
```

`modFirst` gives *stone-path* (Germanic/Sinitic habit); `headFirst` gives *path-stone* (Romance/Celtic habit). Every branch in a family shares the trait, because headedness is a property of a language's grammar, and the engine's branches inherit their grammar from one proto-language. Both patterns exist across worlds rather than within one repair choice. The 50/50 seed is a free parameter (the cross-linguistic base rates are contested; the [Right-Hand Head Rule literature](https://www.degruyter.com/document/doi/10.1515/lingvan-2018-0033/html) documents strong languages on both sides). Per-branch drift of headedness, and coupling it to word order, are 1ENG.14's to own (§7).

<a name="borrowarm"><h3>3.5. The borrowing arm (gated on 2GEO.5)</h3></a>

Gilliéron's Gascon speakers did not compound; they replaced the rooster word from outside. The engine's version: if the branch has a passable neighbour whose form for the yielding concept is distinct from the colliding form, adopt it through the 2GEO.5 machinery, using [`pairContact`](./2geo-4-neighbour-contact-borrowing.md) to pick the highest-contact lending neighbour and the contact-graded faithful/adapted outcome from that spike's §3.4. Compounding remains the repair whenever no such neighbour exists (isolated branches, lone survivors, all neighbours sharing the same eroded form).

This arm is **conditional on 2GEO.5 having shipped**. 2GEO.5 sits above 2LEX.2 in the ready queue, so in practice it lands first; if implementation order inverts, 2LEX.2 ships compound-only behind the same `resolveCollision` interface and the borrowing arm becomes a one-function rider on 2GEO.5. Either way 2LEX.2's roadmap dependency on 2LEX.1 alone stays honest, with a recommendation below (§5) to add the soft edge.

<a name="player"><h3>3.6. The player path: choice at apply time</h3></a>

When the player applies a rule whose result creates one or more **new severe** pairs (computed by diffing severe pairs before/after, the same comparison [`collDelta`](../../src/lib/game.svelte.ts) already prices), the apply completes as normal and a repair prompt surfaces per new pair:

- **Repair now:** costs `changeCost` again (a second lexical intervention, priced like one), no second overhead (the branch is already touched this turn). The player picks the modifier from the ranked candidate list (§3.3); order and clipping follow the world's trait. Pool-gated: if `pool < changeCost` the option is disabled and only tolerate remains.
- **Tolerate:** free, no immediate effect. The pair enters the standard pressure clock (§3.2), and if it survives its distance-scaled threshold the engine repairs it autonomously with the top-ranked modifier. Tolerating is a real gamble on the 87% heal rate, with the stake being who chooses the word, and the odds worse the closer the pair.

Drift-caused collisions never prompt; the player learns of them from the log and the word table, and may only watch the clock run. Cross-class and sub-cut collisions never prompt anyone; they are the tolerated texture of the language.

---

<a name="slot"><h2>4. Where it slots in the turn loop</h2></a>

Collision resolution is a **new step 1.5**, immediately after drift and before the rename check:

```
1. drift            (creates collisions; salience resists: 2GEO.3)
── 1.5 RESOLVE COLLISIONS  ◀── new: pressure tick + autonomous repairs
2. rename           (era anchors; sees the repaired lexicon)
3. spread
3.5 borrow          (2GEO.5; may create collisions, counted next turn)
4. assimilation
5. fracture         (children inherit collisionPressure)
```

Rationale for this exact position:

- **After drift**, because drift is the collision source and the counter must tick against this turn's post-drift forms; ticking before drift would measure yesterday's lexicon.
- **Before rename**, so the anchor/era accounting compares against a lexicon whose repairs have landed. A repair changes intelligibility against the last anchor; the rename check should see that honestly rather than one turn late.
- **Borrow-created collisions wait one turn.** 2GEO.5's step 3.5 can land a borrowed form onto an existing one; that pair is first counted at the next turn's step 1.5. A one-turn lag on a six-turn clock is noise, and a single check point keeps the loop legible.

The step never mints or removes a branch and never touches territory; it edits `lex` and `collisionPressure` only. It runs for every living leaf including lone survivors (a language alone in the world still disambiguates for itself; no `leavesOf > 1` guard, unlike borrowing and assimilation which need a counterpart).

---

<a name="contract"><h2>5. Implementation contract</h2></a>

Everything is a pure function of already-seeded state. Autonomous repairs introduce **no new randomness at all** (deterministic argmin/argmax selection; the only nondeterminism anywhere in the mechanic is the player's own choice), so seeded replay is preserved by construction.

**New data — `src/lib/engine/semantic-distance.json`**: the 541-pair table from [`docs/spikes/assets/2lex-1-semantic-distance.json`](./assets/2lex-1-semantic-distance.json), copied verbatim (Vite imports JSON natively). Regenerate only via the committed generator script; never hand-edit.

**New — `src/lib/engine/collision.ts`** (new module, keeping `generation.ts` imports flat, as `borrowing.ts` does for 2GEO.5)

```ts
export const COLLISION_TURNS = 6;   // base grace period before autonomous repair
export const SEVERITY_CUT = 0.2;    // relatedness floor; below it a pair is tolerated forever

// relatedness score for a sorted pair; 0 for cross-class pairs (never in the table)
export function pairScore(a: string, b: string): number;

// distance-scaled grace period: max(2, round(COLLISION_TURNS * (1 - score)))
export function pairThreshold(a: string, b: string): number;

// colliding same-class pairs scoring >= SEVERITY_CUT, each sorted, list sorted.
export function severePairs(lex: Lexicon): [string, string][];

// which of the pair yields (is compounded): lower salienceRetention under `terrain`;
// tie -> higher CONCEPTS index yields (lower index keeps the short form).
export function yieldingConcept(pair: [string, string], terrain: Terrain): string;

// ranked modifier candidates: same-class concepts by relatedness to `yielding` (nearest
// first, distance table), excluding both pair members; ties by CONCEPTS index.
export function modifierCandidates(yielding: string, pair: [string, string]): string[];

// join modifier (clipped to its first-vowel prefix, <=3 segs) and head per the world
// trait. Never returns a vowelless word (head keeps its vowels); may exceed MAX_LEN
// transiently (erosion grinds it down; growth ceiling is growth-only).
export function compoundWord(modifier: string[], head: string[], order: CompoundOrder): string[];

// resolve one autonomous repair for a branch's severe pair: yielding concept + top
// non-colliding modifier (or top-ranked if all collide) -> new word. Pure; no RNG.
// The 2GEO.5-gated borrowing arm slots in here when available (see §3.5).
export function resolveCollision(
  pair: [string, string], lex: Lexicon, terrain: Terrain, order: CompoundOrder,
): { concept: string; word: string[]; modifier: string };
```

**Changed — `src/lib/engine/types.ts`**

```ts
export type CompoundOrder = "modFirst" | "headFirst";
export interface World { /* + */ compoundOrder: CompoundOrder }
export interface Branch { /* + */ collisionPressure: Record<string, number> }
```

**Changed — `src/lib/engine/world.ts`**: seed `compoundOrder` in world genesis (one `rng()` draw, position documented so replay goldens can pin it); initialise `collisionPressure: {}` on the root branch.

**Changed — `src/lib/engine/generation.ts`**: new step 1.5 per §4 (tick counters against `severePairs`, delete healed keys, repair at each pair's `pairThreshold` via `resolveCollision`, log `"X disambiguated 'sun' as 'skysun'"`); fracture birth copies `collisionPressure` to children.

**Changed — `src/lib/game.svelte.ts`**: `apply()` diffs `severePairs` before/after; new pending-repair state (queue of new severe pairs with their `modifierCandidates`), `repairCollision(modifier)` (costs `changeCost`, pool-gated, clears the pair's pressure) and `tolerateCollision()` (no-op dismiss). Word-table derived state distinguishes severe (warning styling + pressure count against its threshold) from tolerated homophones (neutral badge); [2UI.1](../roadmaps/mvp.md) audits the presentation.

⚠️ Breaking change: `World` and `Branch` gain required fields, so every constructor site must add them (`world.ts`, the fracture birth in `generation.ts`, test fixtures). Flag `feat(engine)!:` or a `BREAKING CHANGE:` footer on the 2LEX.2 commit, as 1ENG.18's `assimilationPressure` should have been flagged.

**Roadmap recommendation:** add `2GEO.5` to 2LEX.2's `dependsOn` as the honest soft edge (the borrowing arm consumes its exports), accepting that compound-only shipping is possible if priorities invert.

**Testing (2LEX.2, per repo convention `module.test.ts` + `tests/fixtures/`):**

- Distance table: 541 entries, every within-class pair present, no cross-class key; pinned spot values (*i|you* 0.6167, *moon|sun* 0.5167) guard against silent regeneration drift.
- `severePairs`: cross-class pairs excluded; sub-cut pairs excluded; three-way collisions decompose into sorted pairs; output order stable.
- `pairThreshold`: floor of 2 respected; *moon|sun* → 3; a just-over-cut pair → 5.
- `yieldingConcept`: salience decides (mountain *snow|rain* → *rain* yields); zero-zero tie → higher index yields.
- `modifierCandidates`: excludes both pair members; nearest-by-relatedness order with index tie-break; pronoun class (smallest) still yields a candidate.
- `compoundWord`: clip ≤ first vowel; both orders; result keeps head intact; oversized compound (15 segs) still accepts erosion rules (regression on the growth-only ceiling).
- `resolveCollision`: determinism (same inputs → same output); repair-made collision steps to next candidate; all-colliding fallback.
- Pressure lifecycle: ticks only while colliding; heal deletes the key; repair deletes the key; fracture children inherit the parent's counters.
- Integration: census-style run (150 turns, several seeds) with the mechanic active shows zero severe (score ≥ cut) chronic pairs at horizon while tolerated homophones persist untouched; a lone-branch world runs step 1.5 without error.
- Determinism: full-game replay on a fixed seed is byte-identical, pinning the new world-gen `rng()` draw position.

---

<a name="ledger"><h2>6. Honesty ledger: real vs proxy vs flavour</h2></a>

| Mechanic | Status | Note |
|----------|--------|------|
| Avoidance targets same-category, similar-frequency pairs | **real, quantified** | Wedel et al. 2013, eight-language merger corpus |
| Cross-class collisions tolerated | **real** | Wedel's same-category finding applied literally, via the 1ENG.14 class table |
| Distributional relatedness as the confusability score | **proxy, flagged** | the real axis is contextual confusability; Numberbatch cosine relatedness stands in, with provenance in the committed generator |
| Homonymic clash repaired by replacement | **real, classically attested; contested as a general driver** | Gilliéron's *gat*; the sceptical literature is noted, Wedel supplies the statistical backbone |
| Compounding as systemic homophony response | **real** | Mandarin disyllabification; *catfish* at retail |
| Salience as the frequency proxy for who keeps the short form | **proxy, flagged** | real axis is usage frequency (Zipf); salience is the engine's importance variable |
| Per-world compound headedness | **real** | German right-headed, French left-headed; seeded 50/50 as a free parameter |
| Modifier as nearest semantic neighbour | **abstraction** | real modifier choice is semantic and idiosyncratic; nearest-by-relatedness is the legible deterministic version of it |
| Grace period before repair | **real in spirit** | real repairs take generations; the census-tuned clock (6 turns) is a game-scale abstraction |
| `COLLISION_TURNS`, `SEVERITY_CUT`, clip length, 50/50 order seed | **first-pass tuning** | expect a playtest pass in 2LEX.2 |

---

<a name="deferred"><h2>7. Out of scope (surveyed, deferred)</h2></a>

- **Bleached-suffix disambiguation (the *-zi* arm).** Mandarin's other repair: a grammaticalised empty suffix (子 'child' → noun-forming *-zi*) that disyllabifies without semantic content. Needs affix machinery; [1ENG.15](../roadmaps/mvp.md)'s inflectional-paradigm model is the prerequisite. When 1ENG.15 lands, this becomes a third repair strategy behind the same `resolveCollision` interface, and the two spikes should cross-reference.
- **Coordinate near-synonym compounds.** Mandarin 道路 'way-road': two near-synonyms compounded. Needs synonym storage the `LexEntry` model lacks; the same doublet limitation 2GEO.4 §7 deferred. The multi-form lexical-entry spike (roadmap 2LEX.3) is the line that lifts both.
- **Headedness drift and word-order coupling.** Compound order flipping over a branch's history, or keying off a word-order parameter via the Greenbergian correlations, belongs to [1ENG.14](../roadmaps/mvp.md)'s syntax model. The per-world constant is the honest MVP.
- **Semantic shift as repair.** Real languages sometimes resolve a clash by letting one meaning migrate ('corn' narrowing per region) rather than re-forming the word. The engine's fixed concept list has no meaning space to migrate in; noted as beyond the current model, not worth a roadmap line yet.
- **Reduplication.** Attested widely as word formation, but not specifically as a homophone repair in the sources surveyed; excluded rather than speculated on.
- **Narrative surfacing of tolerated homophones.** A log line when a tolerated pair becomes chronic ("in Kasti, 'wind' and 'wolf' are one word") would be cheap flavour; left to 2UI.1's audit rather than specced here.

---

<a name="sources"><h2>Sources</h2></a>

Functional load and homophony avoidance:
- Wedel, Jackson & Kaplan (2013), *Functional Load and the Lexicon* — <https://journals.sagepub.com/doi/abs/10.1177/0023830913489096>
- Wedel, Kaplan & Jackson (2013), *High functional load inhibits phonological contrast loss: a corpus study* — <https://www.researchgate.net/publication/236919624_High_functional_load_inhibits_phonological_contrast_loss_A_corpus_study>

Semantic-distance table provenance:
- ConceptNet Numberbatch 19.08 (English) — <https://github.com/commonsense/conceptnet-numberbatch>; generation pipeline committed at [`assets/2lex-1-semantic-distance-gen.ts`](./assets/2lex-1-semantic-distance-gen.ts)

Homonymic clash and therapeutic replacement:
- Gilliéron's *gat* case, homonymic clash — <https://markstextterminal.com/2020/09/02/term-of-art-homonymic-clash/> · <https://www.oxfordreference.com/view/10.1093/acref/9780199675128.001.0001/acref-9780199675128-e-1502>
- Dworkin, *Near-Homonymy, Semantic Overlap and Lexical Loss in Medieval Spanish* — <https://www.semanticscholar.org/paper/Near-Homonymy,-Semantic-Overlap-and-Lexical-Loss-in-Dworkin/a7d42c42c49bcbbb3fd96908b4612afec73ae54e>
- Scepticism: *The conflict of homonyms: does it exist?* — <https://www.researchgate.net/publication/28079575_The_conflict_of_homonyms_does_it_exist>

Compounding, disyllabification and headedness:
- Historical Chinese phonology (disyllabification) — <https://en.wikipedia.org/wiki/Historical_Chinese_phonology>
- The *-zi* suffix — <https://www.mandarinzest.com/blog/our-blog-1/why-do-chinese-people-add-zi-%E5%AD%90-to-words-2>
- Right-Hand Head Rule cross-linguistically — <https://www.degruyter.com/document/doi/10.1515/lingvan-2018-0033/html>
- Dryer (1992), *The Greenbergian word order correlations* — <https://www.acsu.buffalo.edu/~dryer/DryerGreenbergian.pdf>

---

- [Roadmap](../roadmaps/mvp.md) · [2GEO.4 spike](./2geo-4-neighbour-contact-borrowing.md) · [1ENG.11 spike](./1eng-11-erosion-renewal.md) · [Engine source](../../src/lib/engine/)
