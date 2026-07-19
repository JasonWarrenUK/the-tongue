---
description: 1ENG.14 design spike; a minimal syntax/adjacency substrate (word classes, phrase frames, per-branch word order) so sound change can be conditioned by position and neighbouring words, with per-branch word-order drift and a staged implementation contract
---

# 1ENG.14 — Design Spike: Syntax-Conditioned Sound Change

> [!IMPORTANT]
> **Goal:** Define, concretely enough to implement without further design work, the minimal syntax model the roadmap asks for: word classes, an utterance/adjacency model and per-branch word order, so that sound change can finally be conditioned by *where a word sits* and *what follows it* rather than treating every word as an island before silence. This substrate is also the foundation [1ENG.15](./1eng-15-morphological-renewal.md) builds its paradigm model on. Follows the pattern of [2GEO.4](./2geo-4-neighbour-contact-borrowing.md) and [2LEX.1](./2lex-1-homophone-collision-resolution.md).

---

## Contents

- [1. The gap: eight rules fire at a boundary no model defines](#gap)
- [2. What the research actually supports](#research)
- [3. The substrate](#substrate)
  - [3.1. Word classes: 32 → 48 concepts](#classes)
  - [3.2. Phrase frames: the utterance model](#frames)
  - [3.3. Word order: two per-branch parameters](#order)
  - [3.4. Position profiles: the computed statistic](#profiles)
  - [3.5. Pro-drop: the null-subject parameter](#prodrop)
- [4. The mechanic](#mechanic)
  - [4.1. Position-scaled boundary rules](#scaling)
  - [4.2. Liaison protection: the cross-word statistic](#liaison)
  - [4.3. The initial position: fortition and apheresis](#initial)
  - [4.4. The phrase panel](#panel)
- [5. Word-order drift](#drift)
- [6. Staging and the turn loop](#staging)
- [7. Implementation contract](#contract)
- [8. Honesty ledger: real vs proxy vs flavour](#ledger)
- [9. Out of scope (surveyed, deferred)](#deferred)
- [Sources](#sources)

---

<a name="gap"><h2>1. The gap: eight rules fire at a boundary no model defines</h2></a>

Eight of the seventeen rules in [`RULES`](../../src/lib/engine/phonology.ts) are boundary rules (`post:bound`): final devoicing, apocope, final consonant loss, debuccalisation, final raising, paragoge, breaking and final compensatory lengthening. Every one of them treats every word as if it always stands at the end of an utterance. That is half the rule set conditioned on a position the engine cannot even represent: each [`LexEntry`](../../src/lib/engine/types.ts) is an isolated concept→word mapping, and nothing anywhere says which words stand next to which.

Real boundary phenomena are position-sensitive. [French liaison](https://en.wikipedia.org/wiki/Liaison_(French)) keeps a final consonant alive exactly where a vowel-initial word follows; [external sandhi](https://en.wikipedia.org/wiki/Sandhi) covers a family of such cross-word processes (Italian raddoppiamento, Japanese rendaku). A verb in a verb-final language really does spend most of its life utterance-final, and its endings really do live in the erosion hot zone. The engine can say none of this, and [1ENG.15](./1eng-15-morphological-renewal.md)'s affixes need exactly that hot zone to exist before their erosion/renewal cycle means anything.

The lexicon is also all nouns. Thirty-two of them. There is no verb to be verb-final, no pronoun to cliticise, no adjective to sit beside a noun. The substrate starts there.

---

<a name="research"><h2>2. What the research actually supports</h2></a>

Five claims underpin the design; each was checked against sources (foot of doc), not asserted from memory.

**External sandhi is real, common and boundary-conditioned.** [Liaison](https://en.wikipedia.org/wiki/Liaison_(French)), [raddoppiamento, rendaku](https://en.wikipedia.org/wiki/Sandhi): sound processes at word boundaries conditioned by the neighbouring word. The diachronic detail that bounds our abstraction: sandhi effects can [morphologise over time into consonant mutations](https://en.wikipedia.org/wiki/Sandhi) (the Celtic story), meaning cross-word phonology tends to become grammar. Our model stops before that stage and says so (§8).

**Word order correlates with other order choices, imperfectly.** The [Greenbergian correlations](https://www.acsu.buffalo.edu/~dryer/DryerGreenbergian.pdf) (Dryer 1992): OV languages tend genitive-before-noun and postpositions; VO the reverse. Adjective order does *not* correlate reliably with basic order, so it must be an independent parameter. Genitive order correlates strongly enough to derive.

**The suffixing preference is real.** [Suffixes outnumber prefixes cross-linguistically](https://pure.mpg.de/rest/items/item_68385/component/file_506930/content) (Greenberg 1963; Hawkins & Cutler's processing account: word onsets carry recognition, so grammar colonises the ends). Strongest in OV languages via head ordering. 1ENG.15 consumes this directly: affix position follows word order, with the suffixing bias on top.

**Morphological erosion drives word-order rigidification, and the causal arrow points that way.** The classic story: Latin lost its case distinctions and Romance fixed SVO; [Old English's free order rigidified as inflection collapsed](https://www.researchgate.net/publication/260245204_Linguistic_adaptation_The_trade-off_between_case_marking_and_word_order_in_Germanic_and_Romance_languages). A [2025 entropy study across five Western European languages](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11765092/) tested the direction and found changes in morphological complexity are statistically more likely to cause shifts in word-order rigidity than the reverse. This is the internal driver of §5, and it is what makes 1ENG.15's paradigm state a *cause* in this spike's mechanic.

**Word order is borrowable under heavy contact.** [Ethio-Semitic languages shifted from VSO toward SOV in contact with Cushitic](https://www.academia.edu/5514256/Contact_induced_language_change_in_selected_Ethiopian_Semitic_Languages); Akkadian did the same in contact with non-Semitic neighbours. A retention hypothesis exists for the Ethio-Semitic case (the SOV may be inherited, not borrowed), so the ledger carries the caveat. This is the external driver of §5, and it is the "structural borrowing" 2GEO.4 §7 explicitly deferred to this spike.

---

<a name="substrate"><h2>3. The substrate</h2></a>

<a name="classes"><h3>3.1. Word classes: 32 → 48 concepts</h3></a>

Sixteen new concepts join [`CONCEPTS`](../../src/lib/engine/lexicon.ts), **appended** so every existing index (and every index-based tie-break in the 2LEX.1 contract) is preserved. The verb list includes `finish`, added by the [1ENG.15 spike](./1eng-15-morphological-renewal.md) as the attested past-tense pathway source:

| Class | New concepts | Count |
|-------|-------------|-------|
| verb | eat, drink, see, sleep, die, give, go, say, finish | 9 |
| pronoun | I, you, we | 3 |
| adjective | big, small, new, old | 4 |

A class table (`CONCEPT_CLASS`, same shape as the salience tables) maps every concept to `"noun" | "verb" | "pronoun" | "adjective"`; the 32 existing concepts are all nouns. Words for the new concepts are generated by the existing [`genLexicon`](../../src/lib/engine/lexicon.ts) path unchanged.

The class table is also 2LEX.1's severity tier 1: a noun|verb collision (*see*|*eye* sharing a form) is automatically **cross-class and tolerated**, which is exactly Wedel's finding, syntax disambiguating cross-category homophones, and this substrate is what gives the engine a syntax to do it with. Within-class severity is graded by that spike's [semantic-distance table](./2lex-1-homophone-collision-resolution.md), whose 541 pairs already cover all 48 concepts; a *big*|*small* collision (relatedness 0.56, antonyms) repairs fast, and no hand-drawn field grouping exists any more.

The new concepts carry zero terrain salience (the salience tables are untouched; [`salienceRetention`](../../src/lib/engine/lexicon.ts) already returns 0 for unlisted concepts). Pronouns and basic verbs are the most change-resistant, least borrowable stratum in reality ([Tadmor's borrowability hierarchy](https://wold.clld.org/), already cited by 2GEO.4), so leaving them out of the terrain-salience system, and hence out of 2GEO.5's borrowing eligibility, is correct behaviour falling out for free.

<a name="frames"><h3>3.2. Phrase frames: the utterance model</h3></a>

An utterance is one instance of a **frame**: a fixed template of class slots whose linear order the branch's word-order parameters decide. Four frames:

| Frame | Slots | Ordered by |
|-------|-------|------------|
| F1 transitive clause | S (pronoun), O (noun), V (verb) | `basic` |
| F2 intransitive clause | S (noun), V (verb) | `basic` |
| F3 attributive NP | Adj (adjective), N (noun) | `adj` |
| F4 possessive NP | G (noun, possessor), N (noun) | derived: OV → GN, VO → NG |

That is the whole model. No recursion, no embedding, no agreement slots (1ENG.15 adds those to F1/F2). The genitive order is derived from `basic` because that correlation is strong (Dryer); adjective order is a free parameter because that one is not.

Frames are not equally weighted. Each branch carries **frame-usage weights** (`frameWeights`: one non-negative float per frame, normalised in use), seeded at genesis and drifting by a slow seeded random walk each turn, clamped to a floor so no frame ever vanishes. The weights are how one culture comes to speak more in bare clauses and another in possessive chains, and they are what makes two same-order branches diverge continuously in §3.4's profiles rather than sharing one of six frozen configurations: the critique pass's flatness fix. The walk's step size is a tuning constant (`FRAME_WALK`); weights inherit at fracture and then wander independently.

<a name="order"><h3>3.3. Word order: two per-branch parameters</h3></a>

```ts
interface WordOrder { basic: "SOV" | "SVO" | "VSO"; adj: "AdjN" | "NAdj" }
// Branch gains: wordOrder: WordOrder
```

Seeded on the root branch at world genesis: `basic` by a weighted roll reflecting the attested skew (SOV and SVO dominate overwhelmingly among order-dominant languages, VSO a distant third), `adj` 50/50. Children inherit at fracture. Unlike 2LEX.1's per-world `compoundOrder`, word order is **per-branch and mutable** (§5); sibling branches that diverge in order develop genuinely different erosion profiles, which is the payoff of the whole mechanic. Whether `compoundOrder` should eventually key off `basic` is left open (the Greenberg correlation there is noisy; English is VO with head-final compounds), noted in §9.

<a name="profiles"><h3>3.4. Position profiles: the computed statistic</h3></a>

From frames, the branch's word order and its frame weights, each class gets a deterministic **position profile**: the weighted share of its slot occurrences that are utterance-final and utterance-initial. Worked example at equal weights (the audit-by-hand reference; live branches deviate continuously as their weights wander), SOV + AdjN:

| Class | Final share | Initial share | From (5 noun slots, 2 verb slots, 1 each pronoun/adjective) |
|-------|------------|---------------|------|
| verb | 1.0 | 0 | final in F1 and F2 |
| noun | 0.4 | 0.4 | final as N in F3 and F4; initial as S in F2 and G in F4; medial as O in F1 |
| pronoun | 0 | 1.0 | its only slot is S in F1, initial under SOV |
| adjective | 0 | 1.0 | its only slot is Adj in F3, initial under AdjN |

Flip to VSO and verbs go to 0 final / 1.0 initial; the O noun takes the final slot. The profile is a pure function `positionProfile(class, order, weights)`; only the weights are stored state, and the equal-weight case stays auditable by hand from the frame table.

<a name="prodrop"><h3>3.5. Pro-drop: the null-subject parameter</h3></a>

Each branch carries `proDrop: boolean`. A pro-drop branch omits F1's subject pronoun: "eat fish" for "I eat fish", the [null-subject pattern of Italian and Spanish](https://en.wikipedia.org/wiki/Null-subject_language). The licensing follows Taraldsen's generalisation, that null subjects ride on **rich agreement** (the verb already says who acts, so the pronoun is redundant): a branch may be pro-drop only while at least two of its agreement cells ([1ENG.15](./1eng-15-morphological-renewal.md)) carry living affixes. Seeded on at genesis where licensed (a weighted roll), inherited at fracture, and **revoked the moment agreement collapses**: subjects return to every rendered clause, a logged event and a visible profile shock (pronouns re-enter the frames, verbs lose initial share under VSO, and the rigidification clock of §5 is by then already running on the same collapsed paradigm).

The engine models only the agreement-licensed variety; discourse pro-drop without agreement (Japanese, Chinese) is real and out of scope, noted in the ledger. Until 1ENG.20 ships paradigm state, `proDrop` stays `false` everywhere and the parameter is inert.

---

<a name="mechanic"><h2>4. The mechanic</h2></a>

<a name="scaling"><h3>4.1. Position-scaled boundary rules</h3></a>

Boundary rules stop firing class-blind. [`applyRuleToLex`](../../src/lib/engine/phonology.ts) already has the exact pattern this needs: the 2GEO.3 salience gate, a per-word deterministic roll that blocks a change the context disfavours. A parallel syntax gate does the same for `post:bound` rules:

```
SYNTAX_STRENGTH = 0.7        // tuning constant, deliberately the same shape as BIAS_STRENGTH

mult(word) = clamp(1 + SYNTAX_STRENGTH * (finalShare(class(word)) - 0.5) * 2, 0.5, 1.5)
```

A class that is always utterance-final (SOV verbs) sees boundary rules at 1.5× the base rate; a class that is never final (SOV pronouns) at 0.5×. The clamp keeps the lever gentle, never zeroing and never dominating, the same philosophy as [`biasedMult`](../../src/lib/engine/phonology.ts). Non-boundary rules are untouched. The gate applies in both the autonomous drift path and the player-preview path so [`collDelta`](../../src/lib/game.svelte.ts) prices what will actually happen.

The behavioural claim this buys: **in an SOV branch, verbs erode from the end faster than pronouns do**, and when 1ENG.15 hangs suffixes on those verbs, the suffixes inherit the hot zone. Word order now causally shapes which words wear down where.

<a name="liaison"><h3>4.2. Liaison protection: the cross-word statistic</h3></a>

One genuinely cross-word conditioning, the liaison abstraction: a final consonant is protected where a vowel usually follows. For each class, compute from the frames *which class follows it* and from the live lexicon *what share of that follower class's forms are vowel-initial*:

```
followerVowelShare(class) ∈ [0, 1]     // 0 when the class is always utterance-final
```

Final-consonant deletion rules (`finalC`, `debucc`, the coda-deleting `complengFinal`) get their multiplier scaled down by this share: a consonant that typically resyllabifies into a following vowel resists deletion, which is what liaison is. The statistic reads the *current* forms, so it shifts as the lexicon drifts: a branch whose nouns erode to vowel-initial forms starts protecting the final consonants of whatever precedes nouns. Deterministic, recomputed per turn, no stored alternants.

<a name="initial"><h3>4.3. The initial position: fortition and apheresis</h3></a>

The critique pass's positional audit found word-initial position **inert**: eight rules act at word ends, several act medially, none is conditioned on the word's start. Real initial position is alive on both sides. It is the *strong* position ([word-initial consonants lengthen across a diverse language sample](https://pmc.ncbi.nlm.nih.gov/articles/PMC11576513/); [fortition concentrates word-initially](https://en.wikipedia.org/wiki/Fortition), e.g. Spanish /j/ → [ʝ]), and it still occasionally *loses* material in connected speech ([apheresis](https://en.wikipedia.org/wiki/Apheresis_(linguistics)): *esquire* → *squire*, *alone* → *lone*, *amend* → *mend*). Two new rules, both `pre:bound`, the engine's first:

```
fortify:  initial glide → voiced fricative / # _   (j → ʒ, w → v; glide strengthening)   w = 1
aphaer:   initial vowel → ∅ / # _ C                (esquire → squire)                     w = 1
```

Their syntax scaling runs in **opposite directions**, which is the design's point: `fortify` scales with the class's utterance-*initial* share (strong positions strengthen), `aphaer` scales against it (initial vowels drop in the flow of connected speech, where the word leans on what precedes; an utterance-initial word is protected). The initial-share statistic §3.4 computes, previously consumed by nothing except affix placement, now has both its consumers. Both rules carry low naturalness weights: true fortition is [attested but rare](https://en.wikipedia.org/wiki/Fortition), and the ledger says so. `aphaer`'s deletion respects the existing vowel-floor guard, so it can never empty a word of vowels.

<a name="panel"><h3>4.4. The phrase panel</h3></a>

A new UI panel renders sample utterances for the selected branch: one instance per frame, current forms, current order ("I fish eat" under SOV, "eat I fish" under VSO), with 1ENG.15's inflections appearing inline once they exist. This is where word order becomes *visible* rather than a hidden multiplier, and it is the natural home for the order-drift warning (§5). [2UI.1](../roadmaps/mvp.md) audits the presentation.

---

<a name="drift"><h2>5. Word-order drift</h2></a>

Order is stable by default: real basic orders persist for millennia, and no seeded coin-flip should wobble them. Drift happens through two verified drivers, evaluated in a new turn-loop step:

**Internal driver: morphological collapse (the Latin path).** When a branch's agreement paradigm (1ENG.15) has eroded below the distinctness floor and stayed there for a sustained run of turns, a one-time **rigidification event** fires: the branch adopts `basic: "SVO"` if it is not already there, logged and narrated ("with its endings gone, Kasti fixed its words in place"). SVO-as-target is modelled on the Western European cases the causality study covers (Latin → Romance, Old → Modern English) and is flagged as exactly that in the ledger; the mechanism (morphology loss forces order to carry the disambiguation load) is the attested causal direction. The event uses a pressure counter (`ORDER_TURNS`, mirroring `assimilationPressure` and 2LEX.1's collision clock), reset whenever agreement is renewed. A branch with a living paradigm never rigidifies.

**External driver: contact alignment (the Ethio-Semitic path).** When [`pairContact`](./2geo-4-neighbour-contact-borrowing.md) from a branch to some neighbour exceeds a high threshold (`ORDER_CONTACT_CUT`, well above borrowing's casual range, matching Thomason & Kaufman's placement of structural borrowing at *intense* contact) sustained over the same pressure pattern, the branch's `basic` shifts one step toward that neighbour's; `adj` aligns on a subsequent event. Seeded roll, per ordered pair, fresh `hashRand` salt, same determinism guarantees as borrowing.

**Innovation: fracture-birth reanalysis.** Both drivers above are convergent (rigidification always lands on SVO; contact pulls neighbours together), so left alone the world's order diversity can only shrink: the critique pass named the asymmetry. The counterweight is a third, divergent event: at fracture, each newborn sibling has a small seeded chance (`ORDER_INNOVATE_RATE`) of flipping **one** order axis, on the grounds that new speech communities are where reanalysis fixes ([creole and koine formation reanalyse inherited syntax](https://www.jbe-platform.com/content/journals/10.1075/le.17007.dal); child acquisition in emerging varieties drives the innovation). The flip is uniform over axes and values, a deliberate diversity choice flagged in the ledger, since real new-community varieties themselves skew SVO. It rides the existing fracture event: one extra roll per birth, logged ("the young of Kasti speak in a new order").

Both pressure drivers are events with visible pressure, warnable in the UI like fracture and assimilation already are. Absent all three mechanisms, `wordOrder` is inert. A branch that flips order gets its position profiles, and therefore its whole erosion physiognomy, recomputed for free (profiles are pure functions of the parameters).

---

<a name="staging"><h2>6. Staging and the turn loop</h2></a>

The substrate and the drift mechanic have different prerequisites, so the implementation splits in two:

**Stage A (no new dependencies): substrate + conditioning.** Concepts 32 → 48 with the class table, `wordOrder` and `frameWeights` seeded and inherited, fracture-birth reanalysis (the one stage A order mutation; it needs neither contact data nor paradigm state), weighted position profiles, the syntax gate + liaison statistic in `applyRuleToLex`, the two initial-position rules and the phrase panel. `proDrop` ships as an inert `false` until 1ENG.20 provides its licence. Ships alone; every piece is deterministic state read at existing call sites. No turn-loop reordering at all: the gate rides inside step 1 (drift) where the salience gate already lives, and the reanalysis roll rides inside step 5 (fracture).

**Stage B (gated): order drift.** The new turn-loop step, after borrowing and before assimilation (contact data is live there, and an order flip should precede this turn's assimilation check rather than trail it):

```
1. drift            (now position-scaled)
1.5 collisions      (2LEX.2)
2. rename
3. spread
3.5 borrow          (2GEO.5)
── 3.75 ORDER DRIFT  ◀── stage B: rigidification + contact alignment
4. assimilation
5. fracture         (children inherit wordOrder)
```

The contact driver needs 2GEO.5's `pairContact` (shipping ahead of this in the ready queue). The internal driver needs 1ENG.15's paradigm state, so stage B lands after both. The roadmap proposal at the end of this doc encodes the split.

---

<a name="contract"><h2>7. Implementation contract</h2></a>

**Changed — `src/lib/engine/lexicon.ts`**

```ts
// CONCEPTS: append the 16 new concepts (indices 32..47, finish last); never reorder.
export type ConceptClass = "noun" | "verb" | "pronoun" | "adjective";
export const CONCEPT_CLASS: Record<string, ConceptClass>;   // total over CONCEPTS
```

**New — `src/lib/engine/syntax.ts`** (new module, the established pattern)

```ts
export const SYNTAX_STRENGTH = 0.7;
export const FRAME_WALK = 0.02;           // per-turn step of the seeded frame-weight walk
export const ORDER_INNOVATE_RATE = 0.08;  // stage A: per-birth chance of a one-axis reanalysis flip
export const ORDER_TURNS = 6;             // stage B: sustained turns before an order event
export const ORDER_CONTACT_CUT = 0.6;     // stage B: pairContact floor for the contact driver

export interface Frame { id: string; slots: { class: ConceptClass; role: string }[] }
export const FRAMES: Frame[];             // F1..F4 per §3.2
export type FrameWeights = [number, number, number, number];   // per-frame usage, floor-clamped

// pure: linearise a frame's slots under a branch's word order (genitive derived from basic)
export function frameOrder(frame: Frame, order: WordOrder): { class: ConceptClass; role: string }[];

// pure: per-class utterance-final and utterance-initial shares, weighted per §3.4;
// proDrop=true removes F1's pronoun slot before computing (§3.5)
export function positionProfile(cls: ConceptClass, order: WordOrder, weights: FrameWeights, proDrop: boolean): { final: number; initial: number };

// one seeded step of the frame-weight random walk (fresh hashRand salt, clamped to the floor)
export function walkFrameWeights(weights: FrameWeights, seed: number, turn: number, branchId: number): FrameWeights;

// share of the classes that follow `cls` (per weighted frames+order) whose current forms are vowel-initial
export function followerVowelShare(cls: ConceptClass, order: WordOrder, weights: FrameWeights, lex: Lexicon): number;

// the multiplier of §4.1/§4.2/§4.3 for one word under one rule; clamped [0.5, 1.5].
// post:bound rules scale by final share (liaison-damped for final-C deletions);
// pre:bound rules scale by initial share (fortify with it, aphaer against it).
export function syntaxMult(rule: Rule, concept: string, branch: BranchSyntax, lex: Lexicon): number;
```

**Changed — `src/lib/engine/types.ts`**

```ts
export interface WordOrder { basic: "SOV" | "SVO" | "VSO"; adj: "AdjN" | "NAdj" }
export interface Branch {
  /* + */ wordOrder: WordOrder;
  /* + */ frameWeights: FrameWeights;
  /* + */ proDrop: boolean;                                      // inert false until 1ENG.20 licenses it
  /* stage B: + */ orderPressure: number;                       // internal driver (rigidification clock)
  /* stage B: + */ orderContactPressure: Record<number, number>; // contact driver, keyed by neighbour id
}
```

**Changed — `src/lib/engine/phonology.ts`**: `applyRuleToLex`'s optional context widens to `{ salience?, syntax?: { order: WordOrder } }`; when `syntax` is present and the rule is boundary-conditioned, the per-word roll gates on `syntaxMult` alongside the salience gate. The selection pass (`firingRules`) stays context-free, exactly as it does for salience.

**Changed — `src/lib/engine/world.ts`**: seed root `wordOrder` (weighted `basic` roll, 50/50 `adj`), `frameWeights` and `proDrop: false`; draw positions documented for replay goldens.

**Changed — `src/lib/engine/phonology.ts` (`RULES`)**: add `fortify` and `aphaer` per §4.3, the first `pre:bound` rules.

**Changed — `src/lib/engine/generation.ts`**: pass `syntax` context at both drift call sites (step 1 and `divergeAtBirth`); tick `walkFrameWeights` per living leaf in step 1; fracture children inherit `wordOrder`/`frameWeights`/`proDrop` and roll the reanalysis flip at birth. Stage B adds step 3.75 per §6.

**New — `src/lib/components/PhrasePanel.svelte`**: sample utterances per §4.4.

⚠️ Breaking change: `Branch.wordOrder`, `frameWeights` and `proDrop` are required fields (constructor sites: `world.ts`, fracture birth, fixtures); `CONCEPTS` grows, which shifts any test golden that counts concepts or asserts whole-lexicon output; two new `RULES` entries shift rule-count goldens. Flag `feat(engine)!:`.

**Roadmap proposal:** two new M1 tasks. **1ENG.19** (stage A) depending on the 1ENG.14 spike + 2LEX.2 (severity tier 1 reads `CONCEPT_CLASS`, and the distance table already covers all 48 concepts, so landing the class table against the finished collision module avoids drift). **1ENG.21** (stage B) depending on 1ENG.19, 2GEO.5 and 1ENG.20 (15's implementation). If sequencing 2LEX.2 behind stage A is preferred instead, the edge reverses; either is coherent, the doc recommends the first.

**Testing (per repo convention):**

- `CONCEPT_CLASS` total over all 48; existing 32 indices unchanged (regression pin).
- `positionProfile` equal-weight goldens for all six order combinations against the §3.4 table, computed by hand; weighted cases spot-checked (doubling F1's weight raises verb final share under SOV); pro-drop removes pronoun exposure.
- `walkFrameWeights`: deterministic under seed; respects the floor; fresh salt collides with no existing draw (registry regression).
- `followerVowelShare`: 0 for always-final classes; responds to lexicon change (a fixture where noun forms flip to vowel-initial raises the share for whatever precedes nouns).
- `syntaxMult`: clamps at [0.5, 1.5]; position-blind rules always 1; liaison scaling only on final-C deletion rules; `fortify` scales with initial share, `aphaer` against it.
- New rules: `fortify` turns initial j/w to ʒ/v and never fires medially; `aphaer` deletes an initial vowel only before C and respects the vowel floor.
- Drift integration: SOV fixture branch erodes verb finals measurably faster than pronoun finals over N turns; VSO reverses the asymmetry.
- Reanalysis flip: fires at `ORDER_INNOVATE_RATE` frequency across many seeded fractures; flips exactly one axis; logged.
- Determinism: fixed-seed replay byte-identical; new world-gen draws pinned.
- Stage B: rigidification fires once and only after sustained paradigm absence; revokes `proDrop` on the same collapse; contact alignment respects the cut and the salt-collision regression guard.

---

<a name="ledger"><h2>8. Honesty ledger: real vs proxy vs flavour</h2></a>

| Mechanic | Status | Note |
|----------|--------|------|
| Boundary phenomena conditioned by position and neighbour | **real** | external sandhi, liaison; the phenomenon our gate abstracts |
| Position profiles generalising the majority environment | **abstraction, flagged** | real sandhi yields per-context alternants; we store one form, so the typical environment wins outright. Alternant storage is the doublet problem, deferred a third time (§9) |
| Class-blind → class-sensitive erosion via word order | **real** | verb-final languages genuinely concentrate erosion on verb endings; the suffixing-preference literature's processing logic |
| Morphology loss → order rigidification, with that causal direction | **real, quantified** | the 2025 entropy study; Latin → Romance, Old → Modern English |
| SVO as the rigidification target | **proxy, flagged** | modelled on the Western European cases the study covers; not a universal law |
| Contact-induced order shift at intense contact | **real, with a caveat** | Ethio-Semitic VSO → SOV under Cushitic; a retention hypothesis exists for that case and the ledger says so |
| Per-branch frame-usage weights with a seeded walk | **abstraction** | real usage frequencies vary by community and drift; the walk is a legible deterministic stand-in with no claimed mechanism |
| Pro-drop licensed by rich agreement | **real** | Taraldsen's generalisation, Rizzi's null-subject parameter; the engine models only the agreement-licensed variety (discourse pro-drop à la Japanese is out of scope) |
| Initial fortition | **real, rare, flagged** | attested (glide strengthening, word-initial lengthening) but genuinely uncommon; weighted low accordingly |
| Apheresis scaled against utterance-initial share | **mechanism reading, flagged** | the sources attest unstressed-initial loss in connected speech; the position-scaling law is our inference from that, not a stated finding |
| Fracture-birth reanalysis flip | **plausible mechanism, flagged** | reanalysis in new communities is creole/koine-adjacent evidence; the uniform flip direction is a deliberate diversity choice, noting real new varieties skew SVO |
| `SYNTAX_STRENGTH`, `FRAME_WALK`, `ORDER_INNOVATE_RATE`, `ORDER_TURNS`, `ORDER_CONTACT_CUT`, the seed skew | **first-pass tuning** | same treatment as `BIAS_STRENGTH` and `COLLISION_TURNS` |

---

<a name="deferred"><h2>9. Out of scope (surveyed, deferred)</h2></a>

- **Initial mutations.** The Celtic endpoint of sandhi morphologisation: word-initial consonants alternating by the *preceding* word's grammar. §4.3's `fortify`/`aphaer` are position-scaled, so the initial position is no longer inert, but grammar-conditioned mutation (the alternation depending on which word precedes) still needs preceding-class statistics and stored alternants; deferred together with those.
- **Stored alternants (liaison forms proper).** One form per concept is a load-bearing simplification; per-context alternants are the doublet model 2GEO.4 §7 and 2LEX.1 §7 both deferred. The multi-form lexical-entry spike (roadmap 2LEX.3) is the line that lifts all three.
- **Pairwise cross-boundary sandhi.** Real external sandhi assimilates across specific word pairs (*tem buks*); our statistics are class-aggregate and never pairwise. Needs the alternant storage above; named here so the positional audit's remaining gap is on the record.
- **Order flexibility as a variable.** The rigidification literature is really about order *freedom* collapsing, and this engine's order is always a fixed template; we model the endpoint event, never the intermediate free-order stage. A flexibility scalar per branch would be its own design.
- **`compoundOrder` coupling.** 2LEX.1's per-world headedness could key off `basic` per branch now that order drifts; the correlation is noisy (English), so the two stay independent until playtesting motivates it.
- **Richer frames.** Ditransitives, adpositions, embedding: all real, none needed for the mechanic to work. The four-frame model is the smallest one where every class has a position.

---

<a name="sources"><h2>Sources</h2></a>

Sandhi and liaison:
- Sandhi (external; morphologisation into mutations) — <https://en.wikipedia.org/wiki/Sandhi>
- French liaison — <https://en.wikipedia.org/wiki/Liaison_(French)>

The initial position:
- Fortition (glide strengthening; rarity) — <https://en.wikipedia.org/wiki/Fortition>
- Word-initial consonant lengthening across a diverse sample — <https://pmc.ncbi.nlm.nih.gov/articles/PMC11576513/>
- Apheresis/aphesis (*esquire* → *squire*) — <https://en.wikipedia.org/wiki/Apheresis_(linguistics)>

Pro-drop and reanalysis:
- Null-subject languages and Taraldsen's generalisation — <https://en.wikipedia.org/wiki/Null-subject_language>
- Order in the creole speech community — <https://www.jbe-platform.com/content/journals/10.1075/le.17007.dal>

Order correlations and the suffixing preference:
- Dryer (1992), *The Greenbergian word order correlations* — <https://www.acsu.buffalo.edu/~dryer/DryerGreenbergian.pdf>
- Hawkins & Cutler, *The suffixing preference: a processing explanation* — <https://pure.mpg.de/rest/items/item_68385/component/file_506930/content>

Morphology loss and order rigidification:
- *Is Word Order Responsive to Morphology? Disentangling Cause and Effect in Morphosyntactic Change in Five Western European Languages* (2025) — <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11765092/>
- *Linguistic adaptation: the trade-off between case marking and word order in Germanic and Romance* — <https://www.researchgate.net/publication/260245204_Linguistic_adaptation_The_trade-off_between_case_marking_and_word_order_in_Germanic_and_Romance_languages>

Contact-induced order change:
- *Contact-induced language change in selected Ethiopian Semitic languages* — <https://www.academia.edu/5514256/Contact_induced_language_change_in_selected_Ethiopian_Semitic_Languages>
- *When They Change the Way They Speak: Contact-Induced Word Order Shifts in Semitic* — <https://knowledge.uchicago.edu/record/3382?ln=en>

---

- [Roadmap](../roadmaps/mvp.md) · [1ENG.15 spike](./1eng-15-morphological-renewal.md) · [2LEX.1 spike](./2lex-1-homophone-collision-resolution.md) · [2GEO.4 spike](./2geo-4-neighbour-contact-borrowing.md) · [Engine source](../../src/lib/engine/)
