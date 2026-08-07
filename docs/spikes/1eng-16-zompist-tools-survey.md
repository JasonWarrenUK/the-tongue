---
description: 1ENG.16 research spike; a survey of Mark Rosenfelder's seven Zompist conlang artefacts (SCA², gen, Phono, GGG, GTG, MG, the Language Construction Kit) against our engine, yielding three adoptions — frequency-ranked phoneme selection, distance-conditioned rules, and metathesis — plus a build-ready contract for 1ENG.17
---

# 1ENG.16 — Research Spike: The Zompist Conlang Tools

> [!IMPORTANT]
> **Goal:** Survey Mark Rosenfelder's conlang toolchain for mechanisms worth adopting, and produce a contract concrete enough for [1ENG.17](../roadmaps/mvp.md) to implement without further design work. Unlike the design spikes ([1ENG.14](./1eng-14-syntax-conditioned-sound-change.md), [2LEX.1](./2lex-1-homophone-collision-resolution.md)), this one starts from an existing artefact rather than a gap: the question is not "what should we build" but "what has the reference implementation in this space already worked out, and where are we behind it".
>
> The answer is narrower than the task description assumed, and worth stating up front: **on rule expressiveness our feature-based model is ahead of SCA²'s string model, and the one place we are clearly behind is the naïve uniform phoneme draw in `genLexicon`.** Three adoptions, six documented rejections, one roadmap correction.

---

## Contents

- [1. The seven artefacts, and what the roadmap got wrong](#artefacts)
- [2. SCA²: the sound change applier](#sca)
  - [2.1. The notation](#sca-notation)
  - [2.2. Category correspondence: we already generalise it](#correspondence)
  - [2.3. What SCA² can express and we cannot](#sca-gaps)
  - [2.4. What we can express and SCA² cannot](#our-gaps)
- [3. gen: the word generator](#gen)
  - [3.1. The dropoff mechanism](#dropoff)
  - [3.2. Our uniform draw is the survey's clearest deficiency](#uniform)
- [4. Phono, GGG, GTG, MG: surveyed, nothing adopted](#minor)
- [5. The Language Construction Kit](#lck)
  - [5.1. The sound-change catalogue against our 19 rules](#catalogue)
  - [5.2. Analogy: 2LEX.2 already implements his advice](#analogy)
- [6. The adoption ledger](#adoptions)
- [7. Implementation contract](#contract)
- [8. Honesty ledger: real vs proxy vs flavour](#ledger)
- [9. Out of scope (surveyed, deferred)](#deferred)
- [10. Roadmap amendment](#roadmap)
- [Sources](#sources)

---

<a name="artefacts"><h2>1. The seven artefacts, and what the roadmap got wrong</h2></a>

The task description groups six URLs as "conlang tools" and characterises them in three ways, two of which are wrong. Correcting the map first, because it determines where the survey's effort went:

| Artefact | Task description says | What it actually is | Value here |
|----------|----------------------|---------------------|-----------|
| [SCA²](https://www.zompist.com/sca2.html) | "sound-change rule notation and batch application" | Correct | **High** — direct analogue of [`phonology.ts`](../../src/lib/engine/phonology.ts) |
| [gen](https://www.zompist.com/gen.html) | "procedural word/name generation" | Correct | **High** — direct analogue of [`lexicon.ts`](../../src/lib/engine/lexicon.ts) |
| [Phono](https://www.zompist.com/phono.html) | "phonology description conventions" | An **inventory table builder** — arranges phonemes into IPA-style grids and exports category strings *to* SCA²/gen. No allophony, no phonotactics, no rules. | Low |
| [GGG](https://www.zompist.com/ggg.html) | "general conlanging methodology" | The **Generative Grammar Gadget**: production rules over nonterminals | Low |
| [GTG](https://www.zompist.com/gtg.html) | "general conlanging methodology" | The **Generative Tree Gadget**: phrase-structure rules + transformations, deriving trees | Low |
| [MG](https://www.zompist.com/mg.html) | "general conlanging methodology" | The **Minimalism Gadget**: Minimalist grammar, Merge and feature checking | Low |
| [LCK](https://www.zompist.com/kit.html) | *(absent from the task)* | The **Language Construction Kit**: the actual methodology text, free online | **Medium** — §5 |

Two corrections. **GGG/GTG/MG are not methodology**; they are three academic syntax demonstrators built in 2018, and the closest thing among them to our concerns ([`syntax.ts`](../../src/lib/engine/syntax.ts)) is a *tree derivation* engine for a single fixed grammar, where we need weighted position statistics over a drifting one. **Phono is not a description convention**; it is a formatter whose output feeds the other two tools.

The methodology the task was reaching for exists, but it is the LCK, which the task omits. It is surveyed here as a seventh artefact (§5) and it earns its place: it is the only one of the seven that reasons about sound change *diachronically* rather than mechanically, which is the thing this engine is.

---

<a name="sca"><h2>2. SCA²: the sound change applier</h2></a>

SCA² is the reference implementation for applying ordered sound changes to a word list, and the closest external analogue to what [`applyRuleToWord`](../../src/lib/engine/phonology.ts) does. It is worth being precise about its model before comparing, because the comparison is not the one the task anticipated.

<a name="sca-notation"><h3>2.1. The notation</h3></a>

A rule is `target/replacement/environment`, or equivalently `c→g/V_V`. The environment carries an underscore marking the affected segment. Categories are single-character labels over single-character phonemes: `V=aeiou`, `S=ptc`, `Z=bdg`. The full special-character set:

| Symbol | Meaning |
|--------|---------|
| `_` | the affected segment's position in the environment |
| `#` | word boundary |
| `()` | optional element in an environment |
| `[]` | nonce category, defined inline |
| `…` | wildcard: matches any number of segments |
| `²` | gemination / degemination |
| `\\` | metathesis |
| a fourth `/` field | exception environment |

Rules apply **in the order listed**, sequentially, one pass per word.

Two structural limits matter for us. Phonemes must be *single characters*, so digraphs cannot go in categories at all; the documented workaround is a global non-contextual rewrite pass (`kh|x`) before processing and its inverse after. And there is **no feature system whatsoever** — `S/Z/V_V` voices stops only because the author hand-aligned `S=ptc` against `Z=bdg` positionally.

<a name="correspondence"><h3>2.2. Category correspondence: we already generalise it</h3></a>

SCA²'s central trick is **category correspondence**: when a category appears on both sides, members map one-to-one by position. `S=ptc`, `Z=bdg`, and the rule `S/Z/V_V` yields p→b, t→d, c→g.

This is intervocalic voicing, and it is our `voice` rule. Ours:

```ts
{ id:"voice", ..., match:(p)=>isC(p)&&p.manner==="stop"&&!p.voice, pre:isV, post:isV, xform:()=>({voice:true}) }
```

The difference is not cosmetic. SCA²'s version is an *extensional list* the author must keep aligned by hand: add a phoneme to `S` and forget to add its voiced partner to `Z` at the same index, and the rule silently maps it to the wrong sound (or, per the docs, deletes it when the replacement category is shorter). Ours is an *intensional predicate* — `{voice:true}` resolves through [`resolve()`](../../src/lib/engine/phonology.ts) against the whole [`PHONES`](../../src/lib/engine/phonology.ts) table, so it stays correct for any inventory, including the long vowels and diphthongs 1ENG.12 added later.

**Finding: adopt nothing; record the validation.** Category correspondence is the mechanism SCA² uses *because* it has no features. We have features. The design we already shipped is the strict generalisation, and a future contributor who reads SCA² and proposes porting its notation should find this section explaining why not.

<a name="sca-gaps"><h3>2.3. What SCA² can express and we cannot</h3></a>

Two of its mechanisms are genuinely beyond our rule shape, and both correspond to well-attested change types.

**Distance conditioning (`…`).** `S/Z/_…V` tests for a vowel *anywhere* downstream. Our [`applyRuleToWord`](../../src/lib/engine/phonology.ts) matching loop reads exactly one segment either side:

```ts
const pre = i > 0 ? ph[i - 1] : null;
const post = i < ph.length - 1 ? ph[i + 1] : null;
```

So no rule in [`RULES`](../../src/lib/engine/phonology.ts) can be conditioned on a non-adjacent segment, and the whole family of **long-distance assimilations** is inexpressible: umlaut, vowel harmony, and consonant harmony. The LCK's own catalogue names umlaut explicitly ("a vowel changes to match the rounding of the next vowel"), and the process is the source of the English *foot/feet*, *mouse/mice* alternations — [i-mutation](https://en.wikipedia.org/wiki/Germanic_umlaut) is one of the most consequential sound changes in the history of the language this project is written in. Its absence is the biggest expressiveness gap the survey found.

**Metathesis (`\\`).** `nt/\\/_V` reverses a pair. Attested and sporadic: Old English *brid* → *bird*, Spanish *palabra* from Latin *parabola*, and the [common English *ask*/*aks* variation](https://en.wikipedia.org/wiki/Metathesis_(linguistics)). Our `xform` returns segments resolved from *the matched phone* (`from:"self"`) or *absolutely* (`from:"abs"`), with no way to say "the segment after me, then me".

Both are adopted; see §6 and the contract in §7.

<a name="our-gaps"><h3>2.4. What we can express and SCA² cannot</h3></a>

The comparison runs both ways, and this direction is where the survey landed most of its weight. Four of our mechanisms have no SCA² counterpart at all:

**Probabilistic application.** SCA² has **no optional or percentage rules** — the documentation offers parentheses for optional *environment elements*, and nothing for making a rule fire *sometimes*. Every SCA² change is exceptionless over the lexicon. Our [`applyRuleToLex`](../../src/lib/engine/phonology.ts) carries two independent per-word gates (2GEO.3 salience, 1ENG.19 syntax), each a deterministic roll that can block an otherwise-firing change. This is not a small difference: SCA² models the *Neogrammarian* ideal of regular exceptionless change, while lexical diffusion (a change spreading word by word) is the phenomenon our gates abstract.

**Weighted rule selection.** SCA² is told which rules to apply; the author supplies the history. Our [`driftRule`](../../src/lib/engine/phonology.ts) *chooses*, weighting cross-linguistic naturalness (`Rule.w`) by terrain bias ([`biasedMult`](../../src/lib/engine/phonology.ts)) and branch momentum. The tool has no notion of one change being likelier than another, because it never picks.

**Features over graphemes.** §2.2.

**Word-integrity invariants.** Our `applyRuleToWord` enforces a vowel floor and a `MAX_LEN` ceiling, so no change can empty a word of vowels or grow it without bound. SCA² will happily reduce a word to nothing.

The honest summary: **SCA² is a better *tool* and we are a better *model*.** It is designed for an author who knows the history and wants it applied precisely; we are simulating a history nobody authored. Nothing in its architecture is worth importing, and one of its absences (probabilistic application) is a feature of ours that belongs in the ledger.

---

<a name="gen"><h2>3. gen: the word generator</h2></a>

<a name="dropoff"><h3>3.1. The dropoff mechanism</h3></a>

gen defines categories the same way SCA² does (`C=ptkbdg`, `V=ieaou`) and takes syllable patterns one per line (`CV`, `V`, `CRV`). It has no optionality syntax: `(C(R))V(V)(N)` must be written out as all twelve combinations.

The mechanism worth taking is **dropoff**. Within a category, gen does not select uniformly. It walks the list from the start with a fixed per-member stop probability:

| Setting | Stop chance per phoneme |
|---------|------------------------|
| Fast | 45% |
| Medium | 30% |
| Slow | 15% |
| Molasses | *(slower still)* |
| Equiprobable | uniform |

Phonemes are therefore **listed in intended frequency order**, and the geometric decay makes earlier ones commoner. The documentation's stated rationale is naturalism, and specifically that uniform alternatives "make all possibilities equiprobable, which is highly unnaturalistic".

That claim is correct and better-supported than gen's own docs argue (they cite nothing). Phoneme frequency distributions in real languages are steeply skewed, and the skew is [robust across languages and closely fitted by a power law](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3806260/). English /t/ and /n/ are an order of magnitude commoner than /ʒ/ or /ð/. There is also a typological reason the *ordering* is not arbitrary: cross-linguistically frequent segments are the ones that recur in small inventories — [/p t k m n s/ and the basic five vowels are near-universal, while /ʒ ɣ ŋ/ are marked](https://wals.info/), which is exactly the asymmetry [`genInventory`](../../src/lib/engine/lexicon.ts) already encodes.

<a name="uniform"><h3>3.2. Our uniform draw is the survey's clearest deficiency</h3></a>

[`genInventory`](../../src/lib/engine/lexicon.ts) builds consonants in a deliberate order — the universal core first, then progressively marked additions behind probability gates:

```ts
const cons = ["p","t","k","m","n","s","l"];
const voiced = rng() < 0.7;
if (voiced) cons.push("b","d","g");
if (rng() < 0.7) cons.push("r");
…
if (voiced && rng() < 0.4) cons.push("z");
```

The array is already in something very close to frequency-rank order. Then [`pick`](../../src/lib/engine/rng.ts) throws that information away:

```ts
export const pick = <T>(arr: T[], rng: () => number): T => arr[Math.floor(rng() * arr.length)];
```

Uniform. In a world that rolled the full inventory, `ŋ` is exactly as common as `t`, and `z` as common as `n`. Every generated lexicon is flatter than any real one, and the flatness is *structural* — no amount of drift corrects it, because drift operates on whatever forms generation produced.

This is the one place in the survey where an external tool is unambiguously ahead of us, and the fix is small: the ordering the fix needs is already there, unexploited. Adopted; see §7.

Two scope notes. The syllable-pattern side of gen offers us nothing — [`genTemplate`](../../src/lib/engine/lexicon.ts)/[`genSyllable`](../../src/lib/engine/lexicon.ts) generate structure from a seeded template with proper optionality, which is strictly better than gen's write-out-every-combination approach. And gen's rewrite rules are an orthography layer we already have in `Phone.g` (the macron mapping for long vowels).

---

<a name="minor"><h2>4. Phono, GGG, GTG, MG: surveyed, nothing adopted</h2></a>

Recorded so the survey is complete and so no future contributor re-reads them expecting more.

**Phono** builds consonant/vowel grids and exports category strings for the other two tools, auto-deriving `C`/`V`/`S`/`Z` labels. Every function it serves is a consequence of SCA²/gen lacking features: an author needs a grid to keep `S=ptc` aligned with `Z=bdg`. We generate inventories from a seed and match on features, so there is nothing to arrange. Its one transferable idea — presenting an inventory as an articulatory grid rather than a list — is a *UI* thought, not an engine one, and belongs to a future inventory-display task if anywhere.

**GGG** (production rules over nonterminals), **GTG** (phrase structure plus transformations: passivisation, wh-movement, do-support, agreement), and **MG** (Minimalist grammar with Merge and feature checking) are all syntax derivation engines. GTG is the interesting near-miss: it has a lexicon with features (`cat:N::p cats`), phrase-structure rules (`VP=V (NP)|V NP PP`) and ordered transformations, which sounds adjacent to [`syntax.ts`](../../src/lib/engine/syntax.ts)'s frames.

It is not. GTG derives *a tree for a sentence* in *one fixed grammar*, to demonstrate how generative syntax works. [1ENG.14](./1eng-14-syntax-conditioned-sound-change.md) needed the opposite: not trees but **weighted position statistics** ([`positionProfile`](../../src/lib/engine/syntax.ts)) over a grammar that *drifts*, cheap enough to recompute for every branch every turn. Our four-frame model is deliberately the smallest thing that gives every word class a position; adopting phrase-structure machinery would add derivational depth we have no consumer for. The spike's §9 already says richer frames are out of scope and why.

MG's Minimalist apparatus is further still from a diachronic simulator, and its theoretical commitments (Merge, feature checking) are contested in ways that would be strange to bake into a game engine.

---

<a name="lck"><h2>5. The Language Construction Kit</h2></a>

The [LCK](https://www.zompist.com/kit.html) is the methodology text, free online, expanded in print. Its prescribed order of operations is sounds → lexicon → grammar → writing system, with a warning against working backwards ("creating a text and then devising a grammar to match will lead to an inconsistent if not incoherent work"). That sequencing advice is aimed at a human author and has no bearing on a generator, which does all of it at once from a seed.

The relevant material is the [sound change chapter](https://www.zompist.com/sounds.htm), which is where the LCK reasons diachronically and therefore where it speaks to us.

<a name="catalogue"><h3>5.1. The sound-change catalogue against our 19 rules</h3></a>

The chapter lists the change types it considers worth modelling. Checked against [`RULES`](../../src/lib/engine/phonology.ts):

| LCK change type | Our coverage |
|-----------------|--------------|
| Lenition ("stops become fricatives; unvoiced become voiced") | `voice`, `spirant` ✓ |
| Palatalisation ("before or after a front vowel") | `palat` ✓ |
| Monophthongisation ("diphthongs tend to simplify") | `smooth` ✓ |
| Assimilation ("consonants change to match adjoining articulation") | `nasassim` ✓ |
| Vowel shifts | `raise`, `break` ✓ |
| Loss of final sounds | `apoc`, `finalC`, `devoice`, `debucc` ✓ |
| Loss of unstressed syllables | ✗ — no stress model (§9) |
| Nasalisation ("a nasal disappears after nasalising the previous vowel") | ✗ — no nasal vowels (§9) |
| **Umlaut** ("a vowel changes to match the rounding of the next vowel") | ✗ — **§2.3, adopted** |
| Tonogenesis ("tones can originate… for voiced consonants") | ✗ — rejected (§9) |
| Analogy ("can regularize the grammar") | Partly — §5.2 |

Also absent from his list but present in ours: `epenth`, `paragoge`, `cluster`, `shorten`, `compleng`/`complengFinal`, `fortify`, `aphaer`. Our rule set is *broader* than the LCK's catalogue, which is a fair check on 1ENG.11–13's renewal work.

The catalogue's value is corroborative: it independently identifies umlaut as a change type worth having, from a source that is not this spike's own reasoning about SCA²'s `…` operator. Two mechanisms, two sources, same conclusion.

<a name="analogy"><h3>5.2. Analogy: 2LEX.2 already implements his advice</h3></a>

The chapter's one mechanism with no analogue in the tools is **analogy**, as the counter-force to sound change. His worked example: Spanish sound change collapsed *cocer* ("to cook") and *coser* ("to sew") into homophones, and the language responded by innovating *cocinar* for one of them.

That is [`collision.ts`](../../src/lib/engine/collision.ts). [2LEX.2](./2lex-1-homophone-collision-resolution.md) detects severe homophone pairs, picks which member yields, and repairs it by compounding with a semantic neighbour or adopting a neighbour's form outright. Rosenfelder's advice ("invent a new word to replace one of the homonyms") is the mechanic we shipped, and we arrived at it from Wedel et al. 2013 rather than from him — convergence from independent sources, which is the good case.

**Finding: adopt nothing; record the validation.** One caveat worth logging: he also uses "analogy" in its other sense, **paradigm levelling** (regularising *dived* to *dove* by pattern pressure). That requires paradigms, so it is [1ENG.20](../roadmaps/mvp.md)'s territory, not 1ENG.17's — noted in §9 rather than claimed here.

---

<a name="adoptions"><h2>6. The adoption ledger</h2></a>

The whole survey, decided:

| # | Finding | Source | Verdict |
|---|---------|--------|---------|
| 1 | Frequency-ranked phoneme selection (geometric dropoff) | gen §3.1 | **Adopt** — §7 |
| 2 | Distance conditioning (`…`), enabling umlaut/harmony | SCA² §2.3, LCK §5.1 | **Adopt** — §7 |
| 3 | Metathesis | SCA² §2.3, LCK §5.1 | **Adopt** — §7 |
| 4 | Category correspondence | SCA² §2.2 | **Reject** — our feature model is the generalisation |
| 5 | String/grapheme rule notation + digraph rewrites | SCA² §2.1 | **Reject** — strictly weaker than `Phone` |
| 6 | Ordered multi-rule application per word | SCA² §2.1 | **Reject** — different problem; we fire one rule per branch per turn |
| 7 | Analogy as homophony repair | LCK §5.2 | **Reject** — already shipped as 2LEX.2 |
| 8 | Inventory grids | Phono §4 | **Reject** — a consequence of lacking features |
| 9 | Phrase structure / trees / Minimalist derivation | GGG, GTG, MG §4 | **Reject** — wrong shape; we need statistics, not trees |
| 10 | Tonogenesis, stress-conditioned loss, nasalisation | LCK §5.1 | **Defer** — §9 |

Three adoptions. Note what they are *not*: no part of the survey recommends changing how rules are written, matched, selected or applied. The rule *architecture* comes out of the comparison well; what it lacks is **reach** (findings 2, 3) and what generation lacks is **shape** (finding 1).

---

<a name="contract"><h2>7. Implementation contract</h2></a>

Three independent slices. Each ships alone and is separately testable; they touch different modules and can land in any order.

### Slice 1 — frequency-ranked phoneme selection

**Changed — [`src/lib/engine/rng.ts`](../../src/lib/engine/rng.ts)**

```ts
// gen's dropoff (1eng-16 spike §3.1): walk the list from the start, stopping at each
// member with probability DROPOFF; the last member absorbs the remaining tail.
// Consumes exactly ONE rng() draw regardless of list length — an inverse-CDF jump,
// not a loop of draws — so seeded world-gen draw sequences stay length-stable and a
// future inventory change can't shift every downstream draw.
export const DROPOFF = 0.3;                                  // gen's "Medium"
export const pickRanked = <T>(arr: T[], rng: () => number): T => { … };
```

The single-draw requirement is load-bearing. A naïve `while (rng() < DROPOFF)` loop would consume a variable number of draws per call, so the *number* of phonemes in an inventory would shift every subsequent draw in `genLexicon`, coupling unrelated parts of world generation. Compute the index by inverting the geometric CDF against one draw instead:

```
i = min(⌊log(1 - u) / log(1 - DROPOFF)⌋, n - 1)
```

Verified against 400k draws on a 10-member list before writing this contract, so the implementer has expected values to assert rather than re-derive:

| Index | 0 | 1 | 2 | 3 | 4 | 5 | … | 9 (last) |
|-------|---|---|---|---|---|---|---|----------|
| Share | .300 | .210 | .146 | .103 | .072 | .051 | … | .041 |

The last member is the one deviation from the pure geometric series (.041 against its series value of .012): it absorbs the entire remaining tail, which is what keeps the total exactly 1 and makes the function total for `u → 1`. `u = 0` returns index 0, and a 1-member list always returns its only member.

**Changed — [`src/lib/engine/lexicon.ts`](../../src/lib/engine/lexicon.ts)**: `genSyllable`'s four phoneme draws (onset, cluster, nucleus, coda) switch `pick` → `pickRanked`. The two `genInventory` calls (`DIPHTHONGS`, `LONG_VOWELS`) stay uniform — those lists are not in frequency order, and the choice of *which* diphthong a world has is not a frequency question.

`pick` itself stays exported and unchanged: `naming.ts` has its own `pickAt`, and leaving `pick` in place keeps the diff to the four call sites that should change.

⚠️ **Breaking change** — this alters the lexicon every seed generates. Flag `feat(engine)!:`. Blast radius, checked: `pick` has exactly five call sites, all in `lexicon.ts`; no engine test calls `makeWorld`/`freshState`, and `lexicon.test.ts` pins only `CONCEPTS.length`, so the 331-test suite is not expected to move. Verify rather than assume.

**Testing**

- `pickRanked` consumes exactly one `rng()` draw (spy on a counting rng) — the invariant above.
- Distribution against the table above: member 0 ≈ .300, member 1 ≈ .210, strictly decreasing through member 8, and the total is 1.
- Degenerate inputs: 1-member list always returns it; never returns `undefined` for `u → 1`; `u = 0` returns member 0.
- Golden: a fixed seed's generated lexicon, pinned fresh (the old golden is expected to change, which is the point).
- Naturalism assertion: for a seed whose inventory holds both, `t` appears strictly more often than `ŋ` across the 48-word lexicon.

### Slice 2 — distance conditioning

**Changed — [`src/lib/engine/types.ts`](../../src/lib/engine/types.ts)**

```ts
export interface Rule {
  …
  // 1ENG.17 (1eng-16 spike §2.3) — SCA²'s `…` wildcard: an optional condition on a
  // segment ANYWHERE downstream (`dir:"post"`) or upstream (`dir:"pre"`) of the match,
  // scanning outward from the adjacent segment to the word edge. Absent on every
  // pre-1ENG.17 rule, so their matching is byte-identical.
  distance?: { dir: "pre" | "post"; test: (p: Phone) => boolean };
}
```

**Changed — [`src/lib/engine/phonology.ts`](../../src/lib/engine/phonology.ts)**: `applyRuleToWord`'s `hit` computation gains one conjunct. The scan starts at `i ± 2` (the adjacent slot is `pre`/`post`'s job) and runs to the word edge; `first-match` semantics, not `any`, so a rule can also be conditioned on the *nearest* qualifying segment.

Crucially, `xform` needs the found segment to copy features from (umlaut fronts a vowel *to match* a following one), so `xform`'s ctx widens:

```ts
xform: (p: Phone, ctx: { pre: Phone | null; post: Phone | null; far?: Phone | null }) => XformResult;
```

Optional, so the 19 existing `xform`s are untouched.

**New rule** — the mechanism's consumer, and the reason the slice exists:

```ts
{ id:"umlaut", name:"Umlaut", note:"back V → front / _ … front V  (i-mutation: fōt/fēt)",
  w:2, category:"assimilation",
  match:(p)=>isV(p)&&!!p.back&&!p.diph, pre:null, post:null,
  distance:{ dir:"post", test:(p)=>isV(p)&&!p.back&&!p.diph },
  xform:()=>({ back:false, round:false }) }
```

Weight 2 and `category:"assimilation"` (it *is* long-distance assimilation, and the existing `assimilation` affinity of 0.4 is the right contact tilt — no new `RuleCategory`, unlike 1ENG.19's `fortition`).

Design note for the implementer: `distance` deliberately does not model the *blocking* that real harmony systems show (an intervening segment halting the process). Adding it means a third predicate and a genuine harmony model; §9.

**Testing**

- `umlaut` fires on `a…i` and not on `a…u`; fronts `a`→`e`-ish per `resolve`, and never touches an already-front vowel.
- The distance scan skips the adjacent slot (a rule with both `post` and `distance` requires both).
- First-match semantics: with two qualifying segments downstream, `ctx.far` is the nearer.
- Every pre-1ENG.17 rule produces byte-identical output on a fixture lexicon (the `distance?`-absent path).
- Interaction with the vowel floor and `MAX_LEN`: unchanged (umlaut is 1-in/1-out).
- Determinism: `distance` adds no RNG draw; drift replay unchanged except for the new rule's presence in the weighted pick.

### Slice 3 — metathesis

**Changed — [`src/lib/engine/types.ts`](../../src/lib/engine/types.ts)**: a third `Seg` variant, so metathesis rides the existing `Seg[]` output shape 1ENG.12 built rather than needing new machinery in `applyRuleToWord`:

```ts
export type Seg =
  | { from: "self"; patch: Patch }
  | { from: "abs"; type: PhoneType; patch: Patch }
  // 1ENG.17 (1eng-16 spike §2.3): emit a NEIGHBOUR of the matched phone, so a rule can
  // reorder segments (SCA²'s `\\`). `consumes` marks that the neighbour is moved, not
  // copied, so applyRuleToWord skips it rather than emitting it twice.
  | { from: "post" | "pre"; patch: Patch; consumes: true };
```

**Changed — [`src/lib/engine/phonology.ts`](../../src/lib/engine/phonology.ts)**: `resolveSeg` handles the new variant (resolve against `ctx.post`/`ctx.pre` instead of the matched phone), and `applyRuleToWord` advances `i` past a consumed neighbour. This is the one adoption that touches the matching loop's *control flow*, so it wants the most care: the `consumes` flag must not let a rule consume past the word edge, and the vowel-floor/`MAX_LEN` checks still apply to the result.

**New rule**

```ts
{ id:"metath", name:"Metathesis", note:"C r → r C / _  (brid → bird)",
  w:1, category:"assimilation",
  match:(p)=>isC(p)&&p.manner!=="liquid", pre:null, post:(p)=>isC(p)&&p.manner==="liquid",
  xform:()=>[
    { from:"post", patch:{}, consumes:true },
    { from:"self", patch:{} },
  ] },
```

Weight 1 (the lowest in `RULES`, matching `fortify`/`aphaer`): metathesis is real but genuinely sporadic, and the ledger says so. Restricted to stop-liquid pairs, which is where the attested English and Romance cases sit, rather than any C-C pair.

**Testing**

- `metath` turns `brid`→`bird`; does not fire on non-liquid `post`; does not fire word-finally (no `post`).
- The consumed neighbour is emitted exactly once (a regression guard for the double-emit bug this shape invites).
- `consumes` at the word edge is a no-op, not a crash.
- Word invariants hold: length unchanged, vowel floor intact.
- Every pre-1ENG.17 rule byte-identical (the two-variant `Seg` path untouched).

### Cross-slice

⚠️ Slices 2 and 3 each add a `RULES` entry (19 → 21), which changes `driftRule`'s weighted total and so shifts which rule a given seed/turn picks. Checked at survey time: **no test asserts a rule count** (no `RULES.length`, `toBe(19)` or `toBe(17)` anywhere in `src/lib/`), so both slices are additive `feat(engine):`. Slice 1 is `feat(engine)!:` — it changes what every seed generates.

Any drift-replay golden that pins a *specific* rule firing at a specific turn will still move under slices 2 and 3, since the weighted pick's denominator changes. That is correct behaviour (a new rule genuinely competes), not a regression; re-pin rather than special-case.

`bun run check` must be clean and `bun test` green (baseline: 331 pass, 0 fail) before each slice commits.

> **Revised (1ENG.17 implementation).** By implementation time the "no test asserts a rule count" claim above was already stale — `phonology.test.ts`'s `PRE_1ENG24_IDS` (added by 1ENG.31) enumerates every stress-blind rule explicitly and fails if a new one isn't added to the list, a deliberate tripwire rather than a bug. Both `umlaut` and `metath` needed a one-line addition there. Three further corrections, all confirmed against the shipped implementation:
>
> **Slice 1's rank wasn't stable.** `genInventory`'s consonant list was built by PUSH order — the seven core consonants (`p,t,k,m,n,s,l`) are principled, but the optional members after them landed in whichever order their independent probability gates happened to pass for a given seed, not a frequency rank. A `pickRanked` dropoff over a seed-dependent order wouldn't mean what it claims. Fixed by rebuilding the list against a fixed typological rank (`CONSONANT_RANK`) filtered by the same gates, same draw count and sequence — only the output *order* became seed-stable.
>
> **Slice 2's `umlaut` didn't compile, and would have deleted vowels if it had.** §7's sketch, `xform:()=>({back:false, round:false})`, doesn't typecheck (`back` is `Backness`, not boolean). More seriously, `reduce`'s own comment in `phonology.ts` documents that a self-seg patch on a vowel's own diffed features resolves to `null` for most vowel types and gets silently dropped by `resolveSeg` — an advertised shift would in fact have been a deletion for most of the match set. Shipped instead as a feature-copy off the found trigger (`nasassim`'s shape: `xform:(_p,ctx)=>({back:ctx.far!.back, round:ctx.far!.round})`), probed against every back-vowel × front-trigger combination in the match/distance sets before committing — none resolves to `null`.
>
> **Slice 3's `metath` category was a mislabel, and its neighbour-move path had a real bug.** §7 specified `category:"assimilation"`, but metathesis is reordering, not feature-spreading — `assimilation`'s 0.4 contact affinity would have been an invented tilt with no evidence behind it. Shipped a new `"metathesis"` category at affinity `0.0`, mirroring exactly what 1ENG.19 did for `fortify`/`"fortition"`. Separately, `resolveSeg`'s new neighbour-diff branch re-resolved a moved consonant from its own diffed features via `PHONES.find`, which returns the FIRST matching entry — but `/l/` and `/r/` are featurally identical in this engine's consonant model (`{place:"alv", manner:"liquid", voice:true}`, nothing else distinguishes them), so a moved `/r/` silently became `/l/` regardless of which liquid actually moved. Fixed by special-casing an empty patch (metath's "move unchanged" shape) to the neighbour's own id rather than re-resolving; pinned with a regression test for both liquids.

---

<a name="ledger"><h2>8. Honesty ledger: real vs proxy vs flavour</h2></a>

| Mechanic | Status | Note |
|----------|--------|------|
| Skewed phoneme frequency within an inventory | **real, quantified** | phoneme frequencies follow a power law across languages; gen's own docs assert naturalism without citing it, the source is in §Sources |
| Frequency *ordering* of `genInventory`'s consonant list | **proxy, flagged** | the list's order encodes typological markedness (/p t k m n s/ universal, /ŋ z ʒ/ marked) and is treated as a frequency rank; the two correlate strongly but are not the same statistic, and no per-phoneme frequency data is consulted |
| `DROPOFF = 0.3` | **borrowed tuning** | gen's "Medium" default, adopted as-is; no independent fit to any corpus. Same treatment as `BIAS_STRENGTH`/`SYNTAX_STRENGTH` |
| Umlaut / long-distance vowel assimilation | **real** | Germanic i-mutation; *foot/feet*, *mouse/mice*. The LCK's catalogue names it independently |
| The distance scan's first-match semantics | **abstraction** | real harmony systems are directional and can be blocked by intervening segments; we scan to the word edge unblocked. Harmony proper is deferred (§9) |
| Metathesis | **real, sporadic, flagged** | attested (*brid*→*bird*, *parabola*→*palabra*) but irregular; weighted 1, the floor of `RULES`, precisely because it is not a regular change |
| `metath` restricted to stop-liquid pairs | **proxy, flagged** | the attested English/Romance cases are stop-liquid; real metathesis is broader (including vowel-consonant), so this is the narrow, defensible subset rather than the full phenomenon |
| Probabilistic per-word rule application | **ours, no counterpart** | SCA² has no optional rules at all; our salience/syntax gates model lexical diffusion, which the Neogrammarian model SCA² implements explicitly denies |
| Feature-based `xform` over category correspondence | **ours, the generalisation** | §2.2; recorded so the comparison isn't re-litigated |
| Analogy as homophony repair | **already shipped** | 2LEX.2, reached from Wedel et al.; the LCK's *cocinar* example is the same mechanic from another direction |

---

<a name="deferred"><h2>9. Out of scope (surveyed, deferred)</h2></a>

- **Tonogenesis** → **[4PHON.1](../roadmaps/mvp.md)**, filed `deferred` under M4 (Beyond Current Scope), since it belongs to no shipping milestone. The LCK names it ("tones can originate… for voiced consonants") and it is thoroughly attested — the Sinitic and Vietnamese histories are largely tonogenetic. Rejected for 1ENG.17 on cost, not merit: tone is **suprasegmental**, so it needs a new axis on `Phone`, a tone-bearing-unit notion (our words are flat segment lists with no syllable structure at runtime), a reckoning with all 21 rules, and a decision about how [`intelligibility.ts`](../../src/lib/engine/intelligibility.ts)'s Levenshtein metric should weigh a tone difference against a segment difference. That is a design spike of its own, not a slice of an implementation task.
- **Stress, and stress-conditioned loss** → **[1ENG.24](../roadmaps/mvp.md)**. The LCK's "loss of unstressed syllables" is one of the great engines of change (Latin → French), and we cannot express it: there is no stress model. Same shape of problem as tone (suprasegmental, needs syllabification), which is why 4PHON.1 depends on it. The LCK's *Sounds* chapter covers stress and pitch-accent; a future spike has a starting point.
- **Nasalisation.** "A nasal disappears after nasalising the previous vowel" — needs nasal vowel phones. Cheaper than tone (it is a segmental feature) and a plausible companion to a future renewal task; not in this survey's three adoptions because nothing in the tools pushed for it beyond the one-line mention.
- **Harmony proper, with blocking.** Slice 2 gives us unblocked distance conditioning, enough for umlaut. Real vowel-harmony systems (Turkish, Finnish) are root-controlled, directional and blockable, and they interact with morphology — so they want [1ENG.20](../roadmaps/mvp.md)'s paradigms in place first.
- **Paradigm levelling.** The LCK's second sense of "analogy" (§5.2). Requires paradigms; 1ENG.20's territory.
- **Mergers and splits as phonemic events** → **[1ENG.23](../roadmaps/mvp.md)**. The LCK touches on sound change destroying distinctions. We model the *consequence* (homophony → 2LEX.2 repair) but never represent a branch's phoneme *inventory* as changing — `Branch` has a lexicon, not an inventory, so a branch whose every /p/ has spirantised still nominally "has" /p/. Fixing this means per-branch inventories derived from live lexicons; noted here because the survey is the first place it became visible, and it is the one gap this comparison *exposed* rather than confirmed.
- **Rule chronology as authored history.** SCA²'s ordered rule lists let an author *compose* a history. Our histories are generated, so there is nothing to author — but a "replay this branch's history as an SCA² rule list" *export* would be a genuinely nice chronicle feature, and is the one place a Zompist tool could consume our output rather than the reverse. Not a 1ENG.17 item.

---

<a name="roadmap"><h2>10. Roadmap amendment</h2></a>

§1 found the task description mis-describes three of its six URLs and omits the artefact that actually supplies methodology. Proposed replacement text for **1ENG.16** in [`.claude/roadmaps.json`](../../.claude/roadmaps.json) and [`docs/roadmaps/mvp.md`](../roadmaps/mvp.md):

> Research spike: survey Mark Rosenfelder's Zompist conlang artefacts for mechanisms applicable to our engine — sound-change rule notation and batch application ([SCA²](https://www.zompist.com/sca2.html)), procedural word generation ([gen](https://www.zompist.com/gen.html)), inventory presentation ([Phono](https://www.zompist.com/phono.html)), the three syntax gadgets ([GGG](https://www.zompist.com/ggg.html), [GTG](https://www.zompist.com/gtg.html), [MG](https://www.zompist.com/mg.html)), and the diachronic methodology of the [Language Construction Kit](https://www.zompist.com/kit.html) — producing a build-ready contract for 1ENG.17 identifying which findings are worth adopting

And for **1ENG.17**, replacing the placeholder:

> Implement the three adoptions from the Zompist survey (1eng-16 spike §7): frequency-ranked phoneme selection (gen's geometric dropoff) in `genLexicon`; distance-conditioned rules (SCA²'s `…`) with an `umlaut` rule; and metathesis via a neighbour-consuming `Seg` variant with a `metath` rule. Three independent slices.

Not applied — awaiting approval, per the roadmap-amendment pattern [1ENG.14](./1eng-14-syntax-conditioned-sound-change.md) followed.

---

<a name="sources"><h2>Sources</h2></a>

The artefacts surveyed:
- SCA² — <https://www.zompist.com/sca2.html> · help: <https://www.zompist.com/scahelp.html>
- gen — <https://www.zompist.com/gen.html> · help: <https://www.zompist.com/genhelp.html>
- Phono — <https://www.zompist.com/phono.html>
- GGG (Generative Grammar Gadget) — <https://www.zompist.com/ggg.html>
- GTG (Generative Tree Gadget) — <https://www.zompist.com/gtg.html>
- MG (Minimalism Gadget) — <https://www.zompist.com/mg.html>
- The Language Construction Kit — <https://www.zompist.com/kit.html> · full free text: <https://www.zompist.com/kitlong.html> · sound change chapter: <https://www.zompist.com/sounds.htm>

Phoneme frequency distributions (the claim gen asserts without citing):
- *Menzerath's law and the distribution of phoneme frequencies* / power-law fits to phoneme frequency across languages — <https://www.ncbi.nlm.nih.gov/pmc/articles/PMC3806260/>
- WALS, on segment inventories and markedness — <https://wals.info/>

The two adopted change types:
- Germanic umlaut / i-mutation — <https://en.wikipedia.org/wiki/Germanic_umlaut>
- Metathesis (*brid*→*bird*, *parabola*→*palabra*) — <https://en.wikipedia.org/wiki/Metathesis_(linguistics)>

---

- [Roadmap](../roadmaps/mvp.md) · [1ENG.14 spike](./1eng-14-syntax-conditioned-sound-change.md) · [2LEX.1 spike](./2lex-1-homophone-collision-resolution.md) · [1ENG.11 spike](./1eng-11-erosion-renewal.md) · [Engine source](../../src/lib/engine/)
