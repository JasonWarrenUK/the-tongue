---
description: 1ENG.11 design spike — why rule-set drift ossifies, what real diachronic phonology offers as renewal, and a build-ready contract for 1ENG.12
---

# 1ENG.11 — Design Spike: Rule-Set Erosion↔Renewal Balance

> [!IMPORTANT]
> **Goal:** Explain, concretely enough to implement without further design work, why the current ruleset ossifies and how to close a sustainable erosion↔renewal cycle. This spike hands [1ENG.12](../roadmaps/mvp.md#m1-blocked) (implement the renewal mechanism) a build-ready contract.

---

## Contents

- [1. The problem](#problem)
- [2. What the research supports](#research)
- [3. Architectural decision: widen the transducer to 1→N](#architecture)
- [4. The new phones and the rules that create *and* consume them](#rules)
- [5. Integration with existing systems](#integration)
- [6. The `driftRule` null guard](#guard)
- [7. Testability](#testing)
- [8. Out of scope (surveyed, deferred)](#deferred)
- [9. Implementation contract](#contract)
- [Sources](#sources)

---

<a name="problem"><h2>1. The problem</h2></a>

Every rule in `RULES` ([`phonology.ts:40-51`](../../src/lib/engine/phonology.ts)) is **purely reductive** — lenition, deletion, assimilation and vowelShift only ever delete, merge, or simplify an existing phone. None adds structure. The engine's transducer (`applyRuleToWord`, [`phonology.ts:54-71`](../../src/lib/engine/phonology.ts)) is 1-phone-in / ≤1-phone-out: `xform` returns a single `Patch`, resolved to one id or `null`.

The consequence is **ossification**. Words shrink toward minimal CV/V. Once a lexicon has no `V_V` (kills `voice`/`spirant`), no clusters (kills `cluster`), no final consonants (kills `finalC`/`devoice`/`debucc`), and no mid vowels (kills `raise`/`palat`), `firingRules()` returns empty, `driftRule()` returns `null` permanently ([`phonology.ts:121`](../../src/lib/engine/phonology.ts)), and [`generation.ts:18`](../../src/lib/engine/generation.ts) (`if (!rule) return`) skips the branch forever. A branch freezes after a few generations — the opposite of a living language.

Real diachronic phonology avoids this via a **cycle**: erosion simplifies, then renewal (epenthesis, vowel breaking) rebuilds complexity, handing erosion new environments to grip. This spike surveys the renewal mechanisms and produces a build-ready contract for a sustainable erosion↔renewal loop.

**This is a research/design spike.** Its deliverable is this document. No engine code is written here — 1ENG.12 does the implementation against this contract.

### Scope decisions (confirmed with maintainer)

- **Minimum build for 1ENG.12:** widen the transducer to 1→N, add **two renewal rules** (epenthesis + vowel breaking), plus **erosion rules that consume the new structure** (§4.3), one/two new rule categories, and damping. Dissimilation and morphological/borrowing complexity are surveyed (§8) but out of scope.
- **Diphthongs and long vowels are real phones** added to `PHONES` (not faked as V+glide or V+V). This gives faithful `e→ie` breaking, makes compensatory lengthening nearly free later, and — critically — lets erosion rules fire *because* diphthongs/long vowels exist (monophthongisation, shortening), closing the cycle from both sides.
- **New phones seed into starting inventories** via `genInventory` too, not drift-only. A fresh world may contain diphthongs/long vowels from turn 0.
- **Compensatory lengthening deferred** to a follow-up (1ENG.13). The long-vowel phones this spike adds are its prerequisite, so 1ENG.13 becomes a small rule-only task.

---

<a name="research"><h2>2. What the research supports</h2></a>

Renewal is well-attested. The relevant mechanisms and their conditioning environments:

| Mechanism | What it does | Conditioning environment (real) |
|-----------|--------------|----------------------------------|
| **Epenthesis (anaptyxis)** | inserts a vowel to break an illegal cluster | between two consonants `C_C`; word-initially before `s`+stop; word-finally after a cluster. Inserted vowel is typically a default high/schwa or a copy of a neighbour. |
| **Vowel breaking / diphthongisation** | a monophthong splits into a diphthong | stressed mid/open vowels (Vulgar Latin `ɛ→ie`, `ɔ→uo/ue` in Spanish/Italian/French); before a following palatal → `i`-offglide, before velar → `u`-offglide. |
| **Monophthongisation / smoothing** | a diphthong collapses back to a monophthong | the erosion counterpart of breaking (`ai→e`, `au→o`); very common, re-simplifies what breaking built. |
| **Compensatory lengthening** | a deleted segment lengthens its neighbour | `Vns→Vːs` — deletion of a coda lengthens the preceding vowel. Needs a long-vowel target. |
| **Dissimilation** | makes two similar sounds less alike | two identical/similar segments in a word (e.g. `r…r→r…l`). Rarer; surveyed only. |

The governing insight (from the phonological life-cycle / typological-cycle literature): **erosion and renewal are two halves of one loop, not opposites.** Isolation innovates and elaborates (breaking, epenthesis, idiosyncratic vowel drift); contact levels and simplifies (deletion, monophthongisation). This maps cleanly onto the existing 2GEO.2 contact/isolation axis (§5), and follows the same honesty-ledger discipline as the [2GEO.1 spike](2geo-1-terrain-sound-change.md): every mechanism below is chosen because it is well-attested, not because it is flavourful.

---

<a name="architecture"><h2>3. Architectural decision: widen the transducer to 1→N</h2></a>

**Recommendation: generalise `xform` to return an ordered segment list per input position, and flatMap in `applyRuleToWord`.** Rejected: a separate `insert`-rule kind (needs a second match/apply/firing/preview path for no linguistic reason). The chosen shape is a strict superset of today's contract — the existing 9 rules keep returning a `Patch` unchanged.

### Type changes — `src/lib/engine/types.ts` (additive)

```ts
export interface Patch {                    // UNCHANGED — the 9 existing rules keep returning this
  delete?: boolean; voice?: boolean; manner?: string; place?: string;
  height?: string; back?: boolean; round?: boolean; long?: boolean;   // + long (for long vowels)
}

// One output segment. `from:"self"` = resolve as (input phone features + patch) — today's
// applyXform semantics. `from:"abs"` = a brand-new segment resolved from the patch alone.
export type Seg =
  | { from: "self"; patch: Patch }
  | { from: "abs"; type: PhoneType; patch: Patch };

export type XformResult = Patch | Seg[];     // Patch = legacy 1→≤1; Seg[] = 1→N

export interface Rule {
  id: string; name: string; note: string; w: number; category: RuleCategory;
  match: (p: Phone) => boolean;
  pre: ((p: Phone | null) => boolean) | null;
  post: ((p: Phone | null) => boolean) | null;
  xform: (p: Phone, ctx: { pre: Phone | null; post: Phone | null }) => XformResult;  // widened
}
```

Widening `xform`'s return from `Patch` to `Patch | Seg[]` is source-compatible: every existing rule already returns `Patch`, still a legal `XformResult`. **No existing rule body changes.**

### `applyRuleToWord` rewrite — `phonology.ts`

Normalise every result to `Seg[]`, resolve each seg to an id, push all. A legacy `Patch` → `[{from:"self",patch}]` (or `[]` if `delete`), reproducing today's delete-and-guard semantics exactly.

```ts
function resolveSeg(input: Phone, seg: Seg): string | null {
  if (seg.from === "self") return applyXform(input, seg.patch);   // today's path, unchanged
  return resolve(seg.type, seg.patch as Record<string, unknown>); // absolute: from patch alone
}
function normalise(input: Phone, r: XformResult): Seg[] {
  if (Array.isArray(r)) return r;
  return r.delete ? [] : [{ from: "self", patch: r }];            // legacy Patch
}

export function applyRuleToWord(ids: string[], rule: Rule): { ids: string[]; changed: boolean } {
  const ph = ids.map((id) => BY_ID[id]);
  const out: string[] = [];
  let changed = false;
  for (let i = 0; i < ph.length; i++) {
    const p = ph[i], pre = i > 0 ? ph[i-1] : null, post = i < ph.length-1 ? ph[i+1] : null;
    const hit = rule.match(p) && (rule.pre ? rule.pre(pre) : true) && (rule.post ? rule.post(post) : true);
    if (!hit) { out.push(p.id); continue; }
    const before = out.length;
    for (const s of normalise(p, rule.xform(p, { pre, post }))) {
      const nid = resolveSeg(p, s);
      if (nid !== null) out.push(nid);      // unresolvable seg dropped, as delete is today
    }
    const slice = out.slice(before);
    if (slice.length !== 1 || slice[0] !== p.id) changed = true;
  }
  if (out.length === 0 || !out.some((id) => BY_ID[id].type === "V")) return { ids, changed: false }; // floor
  if (out.length > MAX_LEN && out.length > ids.length) return { ids, changed: false };               // ceiling (§4.4)
  return { ids: out, changed };
}
```

Backward-compat properties (mechanically true from the code above): legacy `{voice:true}` → one id, identical to today; legacy `{delete:true}` → pushes nothing, identical to today; the **min-vowel guard stays at the end** and is joined by the length ceiling (§4.4). No RNG added.

---

<a name="rules"><h2>4. The new phones and the rules that create *and* consume them</h2></a>

<a name="phones"><h3>4.1. New phones — `PHONES` in `phonology.ts`, `Phone`/`resolve` support</h3></a>

Diphthongs and long vowels do not fit the scalar `height/back/round` V-model, so represent them structurally:

- **Long vowels**: add a `long?: boolean` feature to `Phone` (V branch). Five phones `iː eː aː oː uː` (`g:"iː"` etc.), each = the base vowel's features + `long:true`. `resolve("V", …)` extends its matcher to compare `long` (defaulting `undefined`→`false`), so existing short-vowel resolution is unchanged.
- **Diphthongs**: a diphthong is not featurally decomposable in this model. Add a `diph?: boolean` flag and a `nucleus`/`offglide` id pair on `Phone`, matched structurally (rules test `p.diph`, not height/back/round). Add the breaking outputs of the mid/open vowels: `ie`, `uo`, `ei`, `ou`, `au`, `ai` (grapheme = the two letters). `resolve` gets a `"V"`-diphthong branch keyed on `{diph:true, nucleus, offglide}`.

> [!WARNING]
> **Blast radius (the cost of the "real phones" choice).** This touches `PHONES`, the `Phone` interface, `resolve` (two new match branches), `genInventory` (§4.4), and `Patch`/`Seg` (`long`, `diph` fields). Every downstream that only ever reads `BY_ID[id].g` (`formOf`, `collisionPairs`, `homophoneForms`, `intelligibility`'s edit distance) keeps working, because those read the grapheme, not the features — verify this holds during 1ENG.12. `applyRuleToWord`'s vowel check `BY_ID[id].type === "V"` must return `true` for diphthongs and long vowels (set `type:"V"` on all of them) so the min-vowel floor still counts them.

<a name="renewal-rules"><h3>4.2. Renewal rules (build structure)</h3></a>

> [!WARNING]
> **Post-implementation correction.** The `pre:isV`-conditioned `break` originally specified here **could not bootstrap renewal from a fully-eroded lexicon** — empirical testing during 1ENG.12 showed realistic 32-concept lexicons still ossified on ~97% of turns even with `epenth` + the mid-vowel-only `break` active, because both rules require pre-existing structure (a cluster, or hiatus) that a minimal `[C]V` word never regenerates once eroded away. The as-built rules below (`break` broadened to any word-final vowel, plus a new `paragoge` rule) replace the original design and are what actually ships. Kept here for the historical record; §4.2 as originally written should be read as superseded.

Mirror the existing `note` idiom. All emit real phones.

```ts
// R1 — Anaptyxis: insert a vowel to break a cluster. Recreates V_V (feeds voice/spirant)
// and adds a syllable (feeds apoc/raise). Competes with `cluster` on the same C_C environment.
{ id:"epenth", name:"Anaptyxis", note:"∅ → V / C _ C  (cluster breaking)",
  w:2, category:"epenthesis",
  match:isC, pre:null, post:isC,
  xform:()=>[
    { from:"self", patch:{} },                                            // keep the consonant
    { from:"abs", type:"V", patch:{ height:"high", back:false, round:false } }, // insert /i/
  ] },

// R1b — Paragoge (as-built addition): unconditioned word-final vowel epenthesis after
// a consonant. Bootstrap mechanism — fires on ANY consonant-final word, even one with
// no cluster left, so a fully-eroded [C]V(C) branch always has a live renewal move.
{ id:"paragoge", name:"Paragoge", note:"∅ → V / C _ #  (unconditioned word-final vowel epenthesis)",
  w:1.5, category:"epenthesis",
  match:isC, pre:null, post:bound,
  xform:()=>[
    { from:"self", patch:{} },
    { from:"abs", type:"V", patch:{ height:"high", back:false, round:false } },
  ] },

// R2 — Vowel breaking (as-built: UNCONDITIONED, not mid-vowel-after-hiatus). Any
// word-final vowel may diphthongise (real: cf. the unconditioned Great Vowel Shift,
// §1). This is the second bootstrap mechanism — it fires on the [C]V floor itself,
// where post:bound is the only environment left once hiatus and mid vowels have both
// eroded away. Output is a REAL diphthong phone.
{ id:"break", name:"Vowel breaking", note:"V → diphthong / _ #  (unconditioned; e→ie, a→ai, u→uo…)",
  w:2.5, category:"vowelShift",
  match:isV, pre:null, post:bound,
  xform:(p)=>[
    { from:"abs", type:"V", patch: p.back ? {diph:true,nucleus:"u",offglide:"o"} : {diph:true,nucleus:"i",offglide:"e"} },
  ] },
```

`break` and `paragoge`/`epenth` differ in count (`break` is 1→1 phone but changes a monophthong into a diphthong phone; `epenth`/`paragoge` are 1→2). `resolve` must return `"i"` for `{height:"high",back:false,round:false}` (true today) and the diphthong id for the `diph` spec (new branch).

**Why unconditioned bootstrap rules are necessary.** `break` (any vowel, `post:bound`) and `paragoge` (any consonant, `post:bound`) between them guarantee that *every* non-empty word has at least one firing rule: a word's final phone is either a vowel (`break` fires) or a consonant (`paragoge` fires) — never neither. This makes the "permanent ossification" state the spike's §1 diagnosis worried about **provably unreachable** for any real word, not merely less frequent. See §6 (updated).

<a name="erosion-rules"><h3>4.3. Erosion rules that fire *because* diphthongs/long vowels exist</h3></a>

The new phones are not just renewal outputs — they are **new environments that erosion grips**, closing the cycle from the erosion side. Add these reductive rules so the diphthongs/long vowels created by breaking (and seeded at world-gen) get consumed:

```ts
// E1 — Monophthongisation / smoothing: diphthong → mid monophthong. The erosion counterpart
// of `break`. ie→e, uo→o. Re-simplifies what breaking built, re-exposing a mid vowel that
// `raise`/`break` can act on again.
{ id:"smooth", name:"Monophthongisation", note:"diphthong → mid V  (ie→e, uo→o)",
  w:2.5, category:"lenition",
  match:(p)=>isV(p)&&!!p.diph, pre:null, post:null,
  xform:(p)=>[ { from:"abs", type:"V", patch:{ height:"mid", back:p.offglide==="o", round:p.offglide==="o" } } ] },

// E2 — Vowel shortening: long vowel → short / word-finally (or unstressed proxy _#).
// Consumes the long vowels seeded by genInventory and (later) produced by 1ENG.13
// compensatory lengthening. aː→a. Feeds apoc (a final short vowel can then be lost).
{ id:"shorten", name:"Vowel shortening", note:"long V → short / _ #",
  w:2, category:"deletion",
  match:(p)=>isV(p)&&!!p.long, pre:null, post:bound,
  xform:()=>({ long:false }) },   // legacy Patch form — 1→1 feature clear, from:"self"
```

`shorten` uses the legacy `Patch` shape (`{long:false}`), proving the widened transducer keeps 1→1 rules ergonomic. `smooth` uses `Seg[]` because it targets an absolute mid-vowel spec.

<a name="seeding"><h3>4.4. Seeding into starting inventories — `genInventory` in `lexicon.ts`</h3></a>

New worlds may contain diphthongs/long vowels from turn 0. Extend `genInventory` ([`lexicon.ts:30-44`](../../src/lib/engine/lexicon.ts)) to optionally push a diphthong (`ie`/`au`) and/or a long vowel behind a probability roll, exactly like the existing `if (rng() < …) cons.push(…)` pattern. Keep probabilities modest (e.g. `< 0.3` for a diphthong, `< 0.25` for a long vowel) so most worlds still start simple and gain complexity through evolution. `genSyllable`/`genWord` need no change — they `pick` from `inv.vowels`, which now may include the new ids.

<a name="cycle"><h3>4.5. One traced cycle (proves the loop closes)</h3></a>

> [!NOTE]
> Updated for the as-built unconditioned `break` (§4.2). The cycle below shows a word converging all the way to the single-vowel ossification floor and still finding a live renewal move — the case the original `pre:isV` design could not handle.

Phones by grapheme, `#` = boundary.

Start **/apeto/** `[a,p,e,t,o]` — cluster-free but has vowels throughout. Trace verified directly against `applyRuleToWord`:

1. `apoc` fires on final `o` → `[a, p, e, t]` = /apet/.
2. `finalC` fires on `t` → `[a, p, e]` = /ape/.
3. `voice` fires on `p` in `a_e` (V_V) → `[a, b, e]` = /abe/.
4. `apoc` fires on final `e` → `[a, b]` = /ab/.
5. `finalC` fires on `b` → `[a]`. **The floor: a bare single vowel, zero consonants, zero clusters, zero hiatus, zero mid vowels.**
6. Under the *original* `pre:isV`-conditioned `break`: no firing rule exists here — permanent ossification (the bug this spike diagnoses). Under the **as-built unconditioned `break`** (`match:isV, post:bound`): fires on `a` → `[ie]` (diphthong created from nothing).
7. `smooth` (erosion) fires on `ie` → `[e]` (mid vowel re-exposed).
8. `break` fires on `e` again → `[ie]`… **oscillation, not ossification, sustained indefinitely from the bare-vowel floor.**

Cluster branch, **/atra/** `[a,t,r,a]`:

9. `epenth` fires on `t` before `r` → `[a, t, i, r, a]` — cluster broken, +1 syllable, two fresh `V_V` sites.
10. `voice`/`spirant` (lenition) now fire on `t` in `a_i` → `[a, d/θ, i, r, a]`. Erosion re-grips exactly where renewal rebuilt.

Consonant-final floor, **/mat/** `[m,a,t]` eroded to **/m/** (bare consonant, no vowel — a degenerate transducer-level case, not a real word shape, but useful to confirm the bootstrap covers both edges): `paragoge` fires (`match:isC, post:bound`) → `[m, i]`, immediately restoring a vowel.

The loop closes on both axes, all the way down to the single-phone floor: **deletion → minimal `[C]V` or `V` or `C` → (break/paragoge/epenth) → clusters+hiatus+diphthongs → (smooth/shorten/lenition/deletion) re-fire.**

<a name="damping"><h3>4.6. Damping (prevent unbounded growth)</h3></a>

Three levers; use all three:

1. **Lower `w` + isolation-favoured affinity (§5).** Renewal `w` (2, 2.5) sits below top erosive rules (`apoc`/`voice`/`devoice`/`nasassim` at 3). On open/contact branches `biasedMult` pushes renewal→0.5× and deletion→1.7×, so contact branches **net-erode**; only isolated branches net-build. Correct linguistics *and* the damping.
2. **Narrow conditioning.** `break`'s `pre:isV` and `epenth`'s `C_C` mean neither fires on an already-minimal CV word; renewal is self-arming (only erosion-created hiatus/clusters re-trigger it) and self-disarming (breaking `e→ie` removes the mid-vowel-after-vowel trigger).
3. **Length ceiling (hard backstop).** Add to the guard, symmetric with the min-vowel floor:

   ```ts
   export const MAX_LEN = 12;  // ~4-5 syllables; named export so 1ENG.12 can tune
   if (out.length > MAX_LEN && out.length > ids.length) return { ids, changed: false };
   ```

   Deterministic, no RNG, one funnel point. Floor + ceiling bracket length; `w`+`biasedMult` bias direction per branch; conditioning self-limits. The system oscillates within a band.

---

<a name="integration"><h2>5. Integration with existing systems</h2></a>

### Categories — `RuleCategory` in `types.ts`, `CATEGORY_AFFINITY` in `phonology.ts`

- `break` → **keep in `vowelShift`** (vowel-nucleus change, naturally isolation-favoured; reuses affinity `-1.0`, zero `CATEGORY_AFFINITY` change).
- `smooth` → **`lenition`** (a simplification/weakening; contact-favoured, rides with existing `+0.7`).
- `shorten` → **`deletion`** (contrast/quantity reduction; contact-favoured `+1.0`).
- `epenth` → **new category `"epenthesis"`** (not a vowel shift, not deletion/lenition/assimilation — forcing it elsewhere would be a lie the honesty-ledger shouldn't tell).

```ts
export type RuleCategory =
  "lenition" | "deletion" | "assimilation" | "vowelShift" | "epenthesis";

export const CATEGORY_AFFINITY: Record<RuleCategory, number> = {
  deletion: 1.0, lenition: 0.7, assimilation: 0.4, vowelShift: -1.0,
  epenthesis: -0.8,   // isolation-favoured (complexity-building), just short of vowelShift
};
```

`epenthesis: -0.8` rationale (consistent with the 2GEO.1 honesty ledger — complexity-building correlates with isolation, not contact): at `BIAS_STRENGTH=0.7`, fully-isolated (`t=-1`) → `mult≈1.56`; fully-open (`t=+1`) → `mult=0.44→0.5`. Isolated branches epenthesise ~1.56×, open branches ~0.5×. This *is* damping lever 1 (§4.6). Keeping magnitude below `vowelShift`'s `-1.0` preserves the existing `biasedMult` worked extremes and the four-category assertions in [`phonology.test.ts:17-47`](../../src/lib/engine/phonology.test.ts).

### 2GEO.3 salience — no change

Renewal/new-erosion rules pass through `applyRuleToLex` identically; the per-word salience roll ([`phonology.ts:83-87`](../../src/lib/engine/phonology.ts)) already gates *any* change to a salient concept. A mountain branch's `stone` resists breaking and epenthesis at the same 0.5 retention it resists apocope — correct (salient words are conservative in both directions). Intentional; requires no code.

### Manual-play UI — no wiring

[`game.svelte.ts:17-22`](../../src/lib/game.svelte.ts) maps `RULES` and filters `fires>0`; `Changes.svelte` renders `rule.name`/`note`/`fires`/`collDelta` generically. New rules appear in the player's candidate list automatically the moment they match. `collDelta` works because every emitted phone resolves to an id with a `.g` grapheme — **verify** `formOf`/`collisionPairs` render diphthong graphemes correctly during 1ENG.12.

---

<a name="guard"><h2>6. The `driftRule` null guard — keep it, but ossification is now unreachable</h2></a>

> [!NOTE]
> **Post-implementation update.** This section originally argued the guard was still reachable (e.g. an all-high-vowel lexicon). Empirical testing during 1ENG.12 showed the mid-vowel-only `break` from §4.2's original design in fact could **not** rescue that case either — it doesn't fire on high vowels. The as-built fix (§4.2: unconditioned `break` + new `paragoge`) closes this fully, not just partially. Updated analysis below.

Keep `if (!firing.length) return null` ([`phonology.ts:121`](../../src/lib/engine/phonology.ts)) as a defensive backstop, but with the as-built `break` (any word-final vowel) and `paragoge` (any word-final consonant) both in `RULES`, **every non-empty word has at least one firing rule**: a word's final phone is always either a vowel or a consonant, and one of the two rules matches unconditionally on `post:bound` in either case. This was verified against realistic 32-concept lexicons across multiple seeds (0 nulls over 300-turn sweeps at `iso=1`, versus ~97% null under the original `pre:isV`-conditioned design) and against every single-phone word shape.

The guard is therefore no longer known to be reachable for any word the game can actually produce — but it stays in place as a regression safety net (e.g. against a future refactor that empties `RULES` or narrows a rule's environment). [`generation.ts:18`](../../src/lib/engine/generation.ts) still handles `null` gracefully (branch skips drift that turn) if it is ever hit.

---

<a name="testing"><h2>7. Testability</h2></a>

Repo convention: co-located `phonology.test.ts`, `bun:test` `describe/test`, deterministic `hashRand`. Existing tests are the regression anchor.

1. **Backward-compat of the 9 reductive rules (highest priority).** For each existing rule id, assert `applyRuleToWord(sample, rule)` returns byte-identical `ids`/`changed` to a golden captured pre-widening (the `normalise([{from:"self",patch}])` path must reproduce today exactly). Cover `voice` `[a,p,a]→[a,b,a]`, `apoc` `[t,a,p,e]→[t,a,p]`, `cluster` `[a,p,t,a]→[a,t,a]`, and a guard-hit delete (`[p,a]` under `apoc` → unchanged). Keep the existing `applyRuleToLex salience` block green untouched.
2. **`biasedMult` regression + new category.** Existing four-category assertions stay green unchanged. Add `epenthesis`: `biasedMult("epenthesis",1)≈1.56`, `(…,0)≈0.5`, `(…,0.5)≈1.0`, in-band `[0.5,2]` across the iso sweep.
3. **Renewal rules produce the right sequences.** `break` `[a,e]→[a,ie]`, `[a,o]→[a,uo]`; does NOT fire on `[e]` (no preceding vowel) or `[a,i]` (high). `epenth` `[a,t,r,a]→[a,t,i,r,a]`; does NOT fire on `[a,t,a]` (no cluster).
4. **New erosion rules consume new phones.** `smooth` `[a,ie]→[a,e]`; `shorten` `[a,aː]→[a,a]` word-finally; each fires only on the intended phone class.
5. **Cycle-closure / no-ossification over N=200 turns** on an isolated branch (`iso=1`), starting from a minimal-ish lexicon: assert `driftRule` returns non-null on ≥95% of turns (branch keeps drifting). Contrast with a renewal-disabled control that ossifies, proving the renewal rules are the cause.
6. **No unbounded growth.** Over the same run, assert every word's length `≤ MAX_LEN` every turn, and mean length never monotonically increases for 20 consecutive turns.
7. **Determinism.** Same `(seed,turn,branchId,iso)` → identical `driftRule` id (mirror [`phonology.test.ts:93-99`](../../src/lib/engine/phonology.test.ts)); same salience ctx → identical `applyRuleToLex` including new rules; a full N-turn transcript is byte-identical across two runs (proves no new RNG).
8. **Guard corner case.** `driftRule` on `[[i],[a],[u]]` returns `null` (not a throw); `resolveGeneration` on such a branch advances the turn cleanly.

---

<a name="deferred"><h2>8. Out of scope (surveyed, deferred)</h2></a>

- **Compensatory lengthening (→ 1ENG.13):** deferred, but its prerequisite (long-vowel phones) is delivered by this contract, so it becomes a small rule-only task — a deletion rule whose `xform` deletes a coda *and* lengthens the preceding vowel.
  > [!NOTE]
  > **Post-implementation correction.** The claim above that the widened transducer "already supports" this via `Seg[]` at the preceding position was inaccurate. `Seg[]` fans one input phone out to N outputs at *that* phone's own position; it gives no way for a rule to reach back and modify an output an earlier position already emitted. 1ENG.13 shipped instead via a new `lengthensPrev` flag on `Rule`: a rule fires on the coda itself (`pre:isV`), deletes it via the existing `{delete:true}` idiom, and — because `pre:isV` guarantees the vowel immediately before it was pushed to `out` unchanged — `applyRuleToWord` reaches back to `out[out.length-1]` and lengthens it. Split into `compleng` (`V _ C`, medial coda in a cluster, e.g. `kast→kaːt`) and `complengFinal` (`V _ #`, word-final coda, e.g. `tas→taː`), mirroring the `epenth`/`paragoge` medial/final split above (§4.2) — firing on the coda rather than the vowel avoids needing two-phones-ahead lookahead to distinguish the two environments. See `phonology.ts` (`RULES`, `applyRuleToWord`) and `types.ts` (`Rule.lengthensPrev`).
- **Dissimilation:** real but rarer; needs whole-word context (two similar segments anywhere), which the position-local `pre/post` transducer doesn't express cleanly. Note as a future non-local rule kind.
- **Morphological / borrowing-driven complexity:** the deepest renewal source, but it belongs with 2GEO.4 (neighbour contact/borrowing) — borrowed words reintroduce clusters and syllables. Cross-reference rather than duplicate.

---

<a name="contract"><h2>9. Implementation contract — files 1ENG.12 will touch</h2></a>

| File | Change |
|------|--------|
| `src/lib/engine/types.ts` | Add `Seg`/`XformResult`; widen `Rule.xform` to `XformResult`; add `long?`/`diph?`/`nucleus`/`offglide` to `Phone` and `long?` to `Patch`; extend `RuleCategory` with `"epenthesis"`. |
| `src/lib/engine/phonology.ts` | New diphthong/long-vowel entries in `PHONES`; extend `resolve` (long + diphthong branches); rewrite `applyRuleToWord` (flatMap + `Seg` resolution + `MAX_LEN` ceiling); add `epenth`/`break`/`smooth`/`shorten` to `RULES`; extend `CATEGORY_AFFINITY`; export `MAX_LEN`. |
| `src/lib/engine/lexicon.ts` | Extend `genInventory` to optionally seed a diphthong/long vowel. |
| `src/lib/engine/phonology.test.ts` | Regression goldens for the 9 rules + `biasedMult`; new renewal/erosion/cycle/growth/determinism/guard tests. |
| `src/lib/engine/generation.ts` | Confirm `if (!rule) return` still handles the (now rarer) null case. No change expected. |
| `src/lib/game.svelte.ts` | Confirm the candidate list surfaces renewal rules and `collDelta` resolves diphthong graphemes. No change expected. |

⚠️ **Breaking change** — `Rule.xform`'s return type widens, `Phone`/`Patch` gain fields, `RuleCategory` gains a member. Any external constructor of `Rule`/`Phone` must update. Flag `feat(engine)!:` or a `BREAKING CHANGE:` footer on the 1ENG.12 commit.

**Verification for 1ENG.12:**

1. `bun test src/lib/engine/phonology.test.ts` — all existing tests green (backward compat), all new tests green.
2. `bun run check` — 0 svelte-check/TS errors (strict mode).
3. End-to-end no-ossification check: run `resolveGeneration` in a loop for ~200 turns on a seeded world and assert no leaf branch has a frozen (non-drifting) history tail.
4. Manual play: `bun run dev`, advance many generations on an isolated branch, confirm the Changes panel keeps offering renewal + erosion rules and words visibly oscillate in length rather than collapsing to CV and freezing.

---

<a name="sources"><h2>Sources</h2></a>

- Vowel breaking — <https://en.wikipedia.org/wiki/Vowel_breaking>
- Epenthesis — <https://en.wikipedia.org/wiki/Epenthesis>
- Sound change — <https://en.wikipedia.org/wiki/Sound_change>
- The life cycle of phonological patterns explains drift in sound change (Iosad) — <https://www.anghyflawn.net/presentation/2022/ichl25/>
- Grammaticalization and phonetic erosion — <https://en.wikipedia.org/wiki/Grammaticalization>

---

- [Roadmap](../roadmaps/mvp.md) · [Engine source](../../src/lib/engine/) · [2GEO.1 spike](2geo-1-terrain-sound-change.md)
