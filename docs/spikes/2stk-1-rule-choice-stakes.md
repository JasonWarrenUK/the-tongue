---
description: 2STK.1 design spike — why rule choices carry no weight, and the five-part stakes layer that fixes it (focal identity & reach, drift momentum, ambitions with lock-in, contact events with trade routes, the treasury-and-laboratory economy), with a build-ready contract for 2STK.2
---

# 2STK.1 — Design Spike: Rule-Choice Stakes

> [!IMPORTANT]
> **Goal:** Specify, concretely enough to implement without further design work, how choosing a sound-change rule becomes a decision with weight. The roadmap carried a candidate answer from the design analysis (drift momentum + ambitions + contact events, explicitly skipping prerequisite chains); this spike evaluated that answer against a fuller diagnosis, kept all three mechanisms, and added two more layers the candidate missed: a focal identity with graded reach, and an economy that puts mutation where the sociolinguistics says it lives. Hands [2STK.2](../roadmaps/mvp.md#m2-blocked) a build-ready contract.

This spike was produced through a guided design dialogue rather than a solo analysis; the decision record (§9) preserves who decided what and why, since several choices deliberately depart from the design analysis's proposal.

---

## Contents

- [1. The gap: six deficits, one root](#gap)
- [2. The frame: the Tongue as narrator, the self as mechanic](#frame)
  - [2.1. Focus and reach](#reach)
  - [2.2. Fracture: choosing the child](#fracture)
  - [2.3. Death of the self: succession and silence](#succession)
- [3. Drift momentum](#momentum)
- [4. Ambitions](#ambitions)
  - [4.1. The phase model: live conditions and lock-in](#phases)
  - [4.2. The constrained draw](#draw)
  - [4.3. The roster](#roster)
- [5. Contact events and trade routes](#contact)
- [6. The economy: treasury and laboratory](#economy)
- [7. Where it slots in the turn loop](#slot)
- [8. Implementation contract](#contract)
- [9. Decision record](#decisions)
- [10. Honesty ledger: real vs proxy vs game-fiction](#ledger)
- [11. Out of scope](#deferred)
- [Sources](#sources)

---

<a name="gap"><h2>1. The gap: six deficits, one root</h2></a>

Applying a rule today has *consequences* (words change, intelligibility falls, renames and assimilation follow) but no *stakes*. The dialogue surfaced six distinct deficits, three more than the design analysis diagnosed:

| # | Deficit | What it feels like | Answered by |
|---|---------|-------------------|-------------|
| 1 | Undifferentiated choice | Rule A vs rule B is an aesthetic pick; the decision commits you to nothing | Momentum (§3) |
| 2 | No convergent pull | Nothing ever rewards two lects staying close; divergence is the only slope | Contact events (§5), reach discounts (§2.1) |
| 3 | No horizon | Every effect is immediate; no sacrifice-now-for-later moment exists | Ambitions (§4) |
| 4 | No portfolio tension | Influence never forces choosing between branches | Emergent: competing sinks + the economy contract (§6) |
| 5 | Invisible irreversibility | Mergers close doors forever, but nothing marks them at decision time | **Folded into 2LEX.2** (§11) |
| 6 | Nothing can be lost | No sequence of choices is ever wrong, so no choice is weighty | Irreversible regrets + the silence ending (§2.3) |

Beneath all six sits a root cause the design analysis identified: an **identity problem**. After the first fracture the player plays every community simultaneously, so fracture costs nothing, assimilation death loses nothing valued, and the intelligibility matrix is a scoreboard for no contest. Loss aversion needs a self to lose something. §2 gives it one, mechanically rather than just fictively.

A seventh candidate deficit, the missing adversary, is real and deliberately excluded: the static world is [2GEO.6](../roadmaps/mvp.md#m2-todo)'s job and the rival family is [2GEO.8](../roadmaps/mvp.md#m2-blocked)'s, sequenced after this layer proves out.

**Cross-cutting constraint adopted throughout: every stake must be visible at decision time.** The rule-preview interaction (hover, watch the lexicon diff) is the model; whatever this layer adds must meet that bar or it produces gotchas rather than dilemmas. Concretely: reach costs appear on the rule picker per target branch, momentum multipliers appear beside categories, contact odds are shown before resolution, heir candidates display their penalties before the choice.

---

<a name="frame"><h2>2. The frame: the Tongue as narrator, the self as mechanic</h2></a>

The player is the Tongue: the language as a living thing that rides its speakers and survives by changing, narrating its own history in first person (the chronicle, [2NAR.3](../roadmaps/mvp.md#m2-todo), becomes its memoir). But identity here is not only fiction. **The player primarily inhabits one living branch, the focal branch (the self), and reaches other branches at a cost that grows with distance from it.** This is the spike's largest addition to the design analysis's proposal, and it converts the frame into three mechanics.

<a name="reach"><h3>2.1. Focus and reach</h3></a>

`GameState.focusId` names the self. Acting on the self costs base price. Acting on kin costs base price times a **reach multiplier**:

```
reachMult(target) = min(REACH_CAP, 1 + W_KIN * kinshipDistance(focus, target) / KIN_NORM
                                     + W_INT * (1 - intelligibility(focus.lex, target.lex)))
```

- **Kinship-dominant blend** (`W_KIN > W_INT`, decision §9.11): tree distance weighs more than measured similarity, so a convergent stranger never becomes cheaper than a fresh sibling. `kinshipDistance` is path length through the family tree (new helper in `tree.ts`; `parentId` chains already exist).
- **Capped, never a gate** (`REACH_CAP`, first pass 3.0), matching the terrain-bias invariant: no branch is ever unreachable, distant ones are just dear.
- Both inputs are already on screen (the family tree, the intelligibility matrix), satisfying the visibility constraint. The matrix stops being a wall chart: it is now, literally, the price list for reaching your kin.

Reach spending is **shepherding, not correction**: applying a rule to a kin branch also builds *that branch's* momentum (§3), so one payment tilts a relative's future current rather than buying a single edit. This synergy is what makes the reach layer worth using.

The self moves only at forced moments: fracture of the focal branch, or its death. No voluntary refocus (decision §9.9: free refocus would quietly reinstate the overseer the focal self exists to abolish).

<a name="fracture"><h3>2.2. Fracture: choosing the child</h3></a>

When the focal branch fractures, **the player chooses which fragment carries the self.** Engine-cheap: lineage continuation is untouched (the largest component keeps the parent's id, name, history and anchors exactly as today); focus is a separate pointer, provisionally following the continuing lineage during resolution, with the player offered a free reassignment to any fragment born of that fracture before the next turn's actions. Choosing the smaller child means the self now wears a fresh stem and a birth-divergence step; ambitions can later reward exactly that sacrifice (The Exile, §4.3).

<a name="succession"><h3>2.3. Death of the self: succession and silence</h3></a>

When the focal branch dies (assimilation), the run reaches its heaviest moment. The succession dialog offers:

- **Up to three heir candidates**, the living branches ranked closest by the same kinship-dominant blend metric as `reachMult`, each displaying its succession penalty before the choice (visibility constraint).
- **Silence, always electable** (decision §9.13): the player may end the run rather than take a distant mouth. Refusing succession is the strongest identity statement the game offers, and it makes every ending chosen rather than imposed. If *no* living branch is within `HEIR_CUT` of the deceased, silence is the only option: the Tongue has fallen silent, the chronicle closes. This is the game's **single formal ending**, a deliberate amendment (decision §9.7) to the otherwise-ending-free irreversible-regrets loss model: failed ambitions stay visibly failed, dead branches stay dead, mangled lexicons stay mangled, and the run otherwise never terminates.

The succession penalty is the **hoarse voice** (decision §9.14): for `MOURN_TURNS` generations after succession, `reachMult` carries an additional mourning multiplier scaled by the heir's distance from the deceased. This stacks with the *intrinsic* penalties a distant heir already suffers, which cost nothing to build: the new self has low intelligibility with everyone the old self was close to (so all reach is dearer anyway), and every ambition that references the self's history is now measured through the heir (The Long Tongue is likely dead the moment a stranger inherits it). Because three multipliers can now stack on one action (target size × reach × mourning), the combined product is capped at `COST_CAP` so mourning never becomes the soft lockout the dialogue rejected.

---

<a name="momentum"><h2>3. Drift momentum</h2></a>

Sapir's drift as a mechanic: each branch carries a decaying per-category multiplier over the five `RuleCategory` values, and applying a rule tilts that branch's future autonomous drift toward the applied rule's category.

```
Branch.momentum: Partial<Record<RuleCategory, number>>   // multiplier ∈ [1, MOMENTUM_CAP]

on player-applied rule:   momentum[cat] = min(MOMENTUM_CAP, momentum[cat] + MOMENTUM_GAIN)
on autonomous drift:      momentum[cat] = min(MOMENTUM_CAP, momentum[cat] + MOMENTUM_GAIN / 2)
each generation:          momentum[cat] decays toward 1 by MOMENTUM_DECAY
```

- **Both sources accrue, player-weighted** (decision §9.15): player rules at full weight keep momentum a legible investment signature; autonomous drift at half weight lets untouched branches slowly acquire characters on their own ("the one that's swallowing its codas"), which is the attested self-reinforcing profile of drift.
- First-pass constants from the design analysis: `MOMENTUM_CAP = 2.0`, `MOMENTUM_DECAY = 0.1` per turn, `MOMENTUM_GAIN = 0.3`. Tuning constants, named, expect a playtest pass.
- Feeds the existing weighted pick in `driftRule` alongside `biasedMult`: `weight = rule.w * biasedMult(cat, iso) * momentumMult(branch, cat)`. The terrain-bias invariant extends unchanged: momentum is a multiplier, never a gate, and naturalness weight (`Rule.w`) stays dominant.
- Visibility: the rule picker shows the per-category multiplier next to each candidate ("lenition momentum ×1.6"), and a branch with sustained momentum earns an epithet in its panel ("the tongue that softens").

This answers deficit 1 directly: the choice of *category* now outlives the choice of rule. You are not picking an edit, you are setting a tendency, and with reach (§2.1) you can set tendencies in your kin.

---

<a name="ambitions"><h2>4. Ambitions</h2></a>

Three seeded ambitions per world, drawn at world generation, visible from turn one. They are the horizon (deficit 3): standing wants that make "sacrifice now for later" a sentence the game can speak.

<a name="phases"><h3>4.1. The phase model: live conditions and lock-in</h3></a>

The run has two phases delineated by state, never by a clock (decision §9.6: no global horizon; the design analysis's fixed generation-30 scoring is dropped):

- **Goal-driven play** while at least one ambition is live and none is locked.
- **Sandbox** after the goal phase ends, which happens exactly two ways:
  1. Every ambition is dead (failed by its own deadline where it has one; see §4.2), or
  2. The player **locks in** a currently-satisfied ambition, declaring it the run's meaning.

Ambitions are **live conditions, not one-shot triggers**. Empire can be satisfied at generation 22 and unsatisfied at 25 when a region is lost. The lock is the mechanism that converts transient satisfaction into permanent achievement, and *lock now or push my luck* is the strongest single stake this layer produces: locking early banks a modest truth, waiting risks the condition slipping away. At the moment of locking, the other two ambitions grade as met or unmet and freeze forever (decision §9.10); sandbox play changes nothing about the record.

Deadlines exist **only where natural** (decision §9.12): The Long Tongue is inherently "still recognisable *at* generation N" and carries one; open-futured ambitions (Babel, Empire) have none and can only resolve by lock or never. Consequence, accepted deliberately: entering sandbox through total failure is rare; the common exits are the lock and the silence ending.

<a name="draw"><h3>4.2. The constrained draw</h3></a>

The trio is seeded (drawn from the world-gen `mulberry32` stream) with a **tension guarantee**: every trio contains at least one divergent-tagged and one convergent- or preservation-tagged ambition (decision §9.16). Conflicted trios are the point: you provably cannot serve all three, so choosing what to pursue, and when to stop pursuing it, is portfolio tension at the goal level. No player input at the draw; the world hands you its wants.

<a name="roster"><h3>4.3. The roster</h3></a>

Sixteen candidates: the design analysis's five, The Exile (invited by §2.2) and ten generated in the dialogue. All computable from existing state or state this spike adds (momentum, contact history, focus history). Tags drive the constrained draw. **The roster is a content surface; prune or extend freely in 2STK.2 without touching the mechanism.**

| Ambition | Condition (sketch) | Tags | Reads |
|----------|-------------------|------|-------|
| Babel | ≥5 living branches, no pair above 30% intelligibility | divergent, family | matrix, tree |
| The Long Tongue | a branch ≥60% intelligible with its birth anchor at generation N | preservation, self | anchors — **natural deadline** |
| Ozymandias | a dead ancestor bearing a Proto- name with ≥3 living descendants | divergent, family | tree, naming |
| Empire | one branch holds ≥8 regions | expansion | territory |
| Wanderwort | one of your words present in every living branch | convergent, family | lex + borrow history |
| The Exile | at a fracture of the self, follow the smaller fragment; self survives N more generations | self, identity | focus history |
| The Hermit | a living branch holds only high-isolation territory for N consecutive generations | isolationist | isolationScore |
| The Twins | two siblings ≥70% mutually intelligible N generations after their fracture | convergent | matrix, tree |
| The Last Word | after the family has numbered ≥3, exactly one branch remains alive | convergent-brutal | tree |
| The Deep Root | the self's anchor chain reaches K frozen anchors | self, change-embracing | anchors — tension with Long Tongue |
| The Salt Roads | N successful contact events on the same border | convergent, economic | contact history |
| The Pure Tongue | the self reaches generation N with zero borrowed words | isolationist, self | borrow history — sacrifices contact income |
| The Soft Mouth | the self sustains momentum ≥1.5 in one category for N consecutive generations | self, stylistic | momentum |
| The Scatterling | living kin on every terrain type | expansion, family | ownerMap + terrain |
| The Survivor | the self outlives N kin deaths | self, dark | history |
| The Matriarch | the self specifically has ≥K living descendants | divergent, self | tree |

Degenerate-strategy tuning (the design analysis flagged this as the spike's proper subject): spam-expansion serves only Empire and Scatterling, and both are checkable against the treasury economy (§6) where expansion competes with every other sink; never-touch-anything cannot hold The Long Tongue because autonomous drift erodes the birth-anchor comparison and suppressing drift costs influence every turn. Each ambition added to the roster must name, in a comment, the degenerate strategy it was checked against.

---

<a name="contact"><h2>5. Contact events and trade routes</h2></a>

Each generation, one seeded contact event fires between a bordering pair of living branches: a trade, a marriage, a warning of danger. **Success probability equals the pair's mutual intelligibility**, rolled with `hashRand` under a fresh salt. This is the missing convergent incentive (deficit 2): the matrix becomes a board under management, because letting a border pair drift apart is now measurably expensive.

- **Pure roll** (decision §9.17): pair and type are seeded, odds are displayed before end-of-turn resolution, and the player's only lever is upstream intelligibility management. No influence spend can sweeten a pending event; agency lives in the long game, not the dice.
- **Typed consequences** (decision §9.18): success always pays `CONTACT_YIELD` influence into the pool and opens a trade route (below). Failure is typed: a failed **trade** costs influence (floored at zero); a failed **warning** adds one turn of assimilation pressure to the pair's smaller branch, *only* when that branch already has a qualifying dominant assimilator (it accelerates an existing countdown, never creates one from nothing); a failed **marriage** is narrative-only, closing the chronicle entry sadly.
- **Trade routes gate borrowing** (decisions §9.19 and §9.20): a success opens the border as a trade route for `ROUTE_TURNS` generations (first pass 4), and **`resolveBorrow` only fires on borders with an open route**. Routes lapse and are renewed by fresh successes.

> [!WARNING]
> ⚠️ **Behavioural change to shipped 2GEO.5.** Borrowing today fires on any passable border, contact-throttled; after this, it additionally requires an open trade route. Borrowing becomes rarer and story-shaped (every loanword now traces to a successful contact the chronicle narrated). The 2GEO.4 spike's cadence reasoning ("gradual and continuous") is deliberately overridden: the route window keeps continuity *within* licensed periods while making licensing itself eventful. 2LEX.2's borrowing arm inherits the same gate. Flag in the 2STK.2 commit as a behaviour change; the `resolveBorrow` signature itself can stay intact (the gate is a call-site condition in `generation.ts`).

---

<a name="economy"><h2>6. The economy: treasury and laboratory</h2></a>

The design analysis assumed big, well-connected branches are where the action is. The dialogue challenged this, and the sociolinguistics backs the challenge, with a correction: isolation and contact produce **different kinds** of change, not different amounts. Trudgill's typology: small isolated communities with dense networks develop complexity and idiosyncratic drift; heavy adult-learner contact simplifies and levels (English shedding case under Norse contact; koinés generally). Milroy: dense networks resist outside innovations but propagate internal ones fast and completely. The famous conservative isolates (Icelandic, Sardinian) show isolation's other face: what isolation blocks is *convergence*, so isolated lects end up far from everyone else whether by innovating strangely or standing still. Deliberate change follows the same gradient: shifting a small dense community's norms is fast; standardising a widespread language takes institutions.

The mechanical translation, **the treasury and the laboratory** (decision §9.21, adopted in full):

1. **Income stays region-based** (`basePool = pool + growth * (totalRegions - 1)`, unchanged shape) with the contact swing of §5 on top. The empire funds.
2. **Rule cost scales with the target branch's size.** The hook already exists: `overheadFor` adds `max(0, territory - 1)` to `changeCost`. 2STK.2 steepens this (a `SIZE_COST` scalar on the territory term) so the gradient is felt: steering a six-region imperial branch should cost several times a one-region isolate.
3. **Autonomous drift rate scales with isolation.** On top of the existing category bias (`biasedMult`), an isolated branch draws a chance of a *second* drift step per generation: `P(extra) = RATE_SCALE * isolationScore`, capped at `RATE_CAP`. The mountain branch drifts fast and strange; the connected plain drifts slowly and borrows (when routes are open).

Income and target-scaled costs do not cancel: income pools from **total** family territory while cost binds to the **target**, so a ten-region family fields a pool of ~10 against a cost of ~6 to steer its imperial branch and ~1 to steer a mountain isolate. Growth buys leverage over small kin, not cheaper self-editing. The resulting texture: big branches are stable, expensive-to-steer treasuries; small isolated branches are cheap, volatile laboratories that are also assimilation-endangered. Mutation concentrates exactly where the literature puts divergent change.

**The scarcity guarantee** (deficit 4's contract): at mid-game branch counts, total desired spending (self-steering + shepherding + expansion + upcoming 2LEX.2 collision repairs) must comfortably exceed income, verified by seeded sweep tests in the 1ENG.11 mould. Scarcity is what makes every other stake in this document bite; if the sweeps show a player can service every sink, raise costs or flatten `growth` before shipping. This contract feeds [2UI.3](../roadmaps/mvp.md#m2-blocked)'s difficulty presets and the retirement of the raw economy sliders.

> [!WARNING]
> ⚠️ The drift-rate knob touches the erosion/renewal equilibrium that 1ENG.11 verified at zero ossified turns over 150-turn sweeps *at current rates*. 2STK.2 must re-run those sweeps with the rate multiplier at its cap before the constant is trusted. Start conservative (`RATE_SCALE = 0.3`, `RATE_CAP = 0.4`).

---

<a name="slot"><h2>7. Where it slots in the turn loop</h2></a>

```
1.   drift                (momentum multiplier joins biasedMult; isolation-scaled extra step)
2.   rename               (unchanged)
3.   spread               (unchanged; owner map final)
3.25 CONTACT EVENT   ◀── new: seeded pair, odds = intelligibility; yields/costs; opens routes
3.5  borrow               (now gated on an open trade route — behaviour change, §5)
4.   assimilation         (a failed warning may have added pressure in 3.25)
5.   fracture             (if the focal branch split: provisional focus follows continuation;
                           player offered reassignment before next turn's actions)
5.5  FOCUS DEATH     ◀── new: if focusId's territory emptied in 4, queue the succession
                           dialog (up to 3 heirs + silence) before the next turn's actions
6.   repool               (basePool + contact yield − contact losses; ambition conditions
                           re-evaluated; momentum decays; mourning ticks down; routes expire)
```

Contact resolves after spread (final borders) and before borrowing (a fresh success licenses borrowing the same turn). Focus interactions are dialogs *between* turns, never mid-resolution: `resolveGeneration` stays a pure state → state function; the queued choices are fields on the returned state that `game.svelte.ts` surfaces before allowing the next action, exactly as the assimilation warning works today.

---

<a name="contract"><h2>8. Implementation contract</h2></a>

Everything below is deterministic: fresh `hashRand` salts for the contact pair, type and roll (distinct from the drift / spread / salience / borrowing salt families); the ambition draw and constraint-retry use the world-gen `mulberry32` stream; focus choices are player actions and replay like any other.

**⚠️ Breaking: new required fields** (same pattern 2LEX.2 flagged):

```ts
// types.ts
export type AmbitionTag = "divergent" | "convergent" | "preservation" | "expansion" | "isolationist" | "self" | "family";
export interface Ambition {
  id: string; name: string; blurb: string; tags: AmbitionTag[];
  deadline: number | null;                  // generation, only where natural (Long Tongue)
  // pure predicate over state; MUST be cheap — re-evaluated every repool
  satisfied: (s: GameState) => boolean;
}
export type AmbitionStatus = "live" | "lockedIn" | "metAtLock" | "unmetAtLock" | "failed";

// World gains:      ambitions: Ambition[]            // exactly 3, constrained draw
// Branch gains:     momentum: Partial<Record<RuleCategory, number>>
// GameState gains:  focusId: number
//                   ambitionStatus: Record<string, AmbitionStatus>
//                   lockedId: string | null           // null until lock; sandbox flag = lockedId !== null || all failed
//                   routes: Record<string, number>    // unordered border-pair key "aId:bId" → expiry turn
//                   mourning: { untilTurn: number; mult: number } | null
//                   pendingFocusChoice: { kind: "fracture"; bornIds: number[] }
//                                     | { kind: "succession"; heirs: HeirCandidate[] } | null
//                   ended: boolean                    // silence ending fired
```

**New module — `src/lib/engine/stakes.ts`** (momentum, reach, succession; one module keeps `generation.ts` imports flat):

```ts
export const MOMENTUM_CAP = 2.0; export const MOMENTUM_GAIN = 0.3; export const MOMENTUM_DECAY = 0.1;
export const W_KIN = 1.0; export const W_INT = 0.5; export const KIN_NORM = 4; export const REACH_CAP = 3.0;
export const HEIR_CUT = 2.0;      // blend distance beyond which a branch cannot inherit
export const MOURN_TURNS = 5; export const COST_CAP = 4.0;
export const SIZE_COST = 1.0;     // scalar on overheadFor's territory term (steepen to taste)
export const RATE_SCALE = 0.3; export const RATE_CAP = 0.4;   // isolation-scaled extra drift

export function momentumMult(b: Branch, cat: RuleCategory): number;          // ∈ [1, MOMENTUM_CAP]
export function bumpMomentum(b: Branch, cat: RuleCategory, full: boolean): Branch;
export function decayMomentum(b: Branch): Branch;
export function kinshipDistance(aId: number, bId: number, branches: Record<number, Branch>): number;  // tree path length (helper may live in tree.ts)
export function blendDistance(a: Branch, b: Branch, branches: Record<number, Branch>): number;        // W_KIN·kin/KIN_NORM + W_INT·(1−intel)
export function reachMult(s: GameState, targetId: number): number;           // min(REACH_CAP, 1 + blendDistance(focus, target)) × mourning, capped COST_CAP with size term at call site
export function heirCandidates(deceased: Branch, s: GameState): HeirCandidate[];  // ≤3, ranked by blendDistance, each with computed mourning penalty; [] ⇒ silence only
```

**New module — `src/lib/engine/contact.ts`**:

```ts
export const CONTACT_YIELD = 2; export const CONTACT_TRADE_LOSS = 1; export const ROUTE_TURNS = 4;
export type ContactKind = "trade" | "marriage" | "warning";
export interface ContactResult { aId: number; bId: number; kind: ContactKind; odds: number; success: boolean }
// seeded pair + kind selection among bordering living pairs, odds = intelligibility, fresh salts.
// Pure; game.svelte.ts calls it pre-resolution to PREVIEW the pending event (visibility constraint).
export function resolveContact(s: GameState, owner: Record<number, number>): ContactResult | null;
export function routeKey(aId: number, bId: number): string;   // canonical unordered key
export function routeOpen(routes: Record<string, number>, aId: number, bId: number, turn: number): boolean;
```

**New module — `src/lib/engine/ambitions.ts`**: the roster (§4.3) as `AMBITIONS: Ambition[]`, `drawAmbitions(rng): Ambition[]` (redraw until the tension constraint holds; bounded retries, deterministic), `evaluateAmbitions(s): Record<string, AmbitionStatus>` (deadline checks + live satisfaction), `lockIn(s, id): GameState` (grades the other two, freezes all).

**Changed — `generation.ts`**: steps 3.25 and 5.5 per §7; step 1 gains `momentumMult` in the drift weight and the isolation-scaled extra-step draw; step 3.5 gains the `routeOpen` guard; repool applies contact yield/loss, `decayMomentum`, ambition evaluation, route expiry and mourning tick.

**Changed — `game.svelte.ts`**: `apply`/`expandInto` cost formula becomes `min(COST_CAP × base, base × reachMult) where base = changeCost + SIZE_COST-scaled overhead`; `bumpMomentum(…, full: true)` on player rules; derived fields for the pending contact preview, ambition statuses, reach-priced candidate list per branch, and the two pending-choice dialogs; a `lockIn` method; block all actions while `pendingFocusChoice` is set or `ended` is true.

**World-gen — `world.ts`**: `drawAmbitions` into `World.ambitions`; `freshState` sets `focusId = rootId`, empty momentum/routes, all-live `ambitionStatus`.

**Testing** (repo convention, `stakes.test.ts` / `contact.test.ts` / `ambitions.test.ts` + `tests/fixtures/`):
- `momentumMult`/`bumpMomentum`/`decayMomentum`: cap respected; half-weight for drift; decay returns toward 1; never below 1.
- `reachMult`: self = 1 (×mourning); kinship dominance (sibling at low intelligibility cheaper than distant cousin at equal intelligibility); `REACH_CAP` and `COST_CAP` binding; mourning expiry.
- `heirCandidates`: ranking, ≤3, `HEIR_CUT` exclusion, empty ⇒ silence-only; penalties monotone in distance.
- `resolveContact`: determinism per (seed, turn); odds equal `intelligibility`; typed failure effects (warning only accelerates an existing assimilation countdown); route opens on success and expires after `ROUTE_TURNS`.
- Borrow gate: `resolveBorrow` unreached without an open route (regression on 2GEO.5 tests: they must now open a route in fixtures).
- `drawAmbitions`: tension constraint holds across a seed sweep; deterministic per seed.
- Lock-in: statuses freeze; sandbox flag; no further evaluation drift.
- **Equilibrium re-verification:** the 1ENG.11 ossification sweep re-run with `RATE_CAP` extra drift and momentum at cap: still zero ossified turns over 150-turn sweeps.
- **Scarcity sweep:** scripted mid-game states where desired-spend > pool by a healthy margin (assert a floor on the ratio, tune constants until it holds).

---

<a name="decisions"><h2>9. Decision record</h2></a>

Produced in a guided design dialogue (2026-07-24/25). Numbered for citation from code comments.

| # | Decision | Note |
|---|----------|------|
| 1 | All three analysis deficits confirmed (undifferentiated choice, no convergent pull, no horizon) | plus three more surfaced below |
| 2 | Portfolio tension: emergent via competing sinks + the §6 economy contract, no fourth mechanism | resource trade-offs from the original task title resolved this way |
| 3 | Invisible irreversibility: folded into 2LEX.2's UI (door-closer marking beside the collision delta) | out of this spike's contract |
| 4 | Loss model: irreversible regrets, no global fail state | amended by #7 |
| 5 | Opposition scoped out to 2GEO.6 / 2GEO.8 | deliberate exclusion |
| 6 | No global horizon; phases delineated by state (goal-driven → sandbox) | replaces the analysis's fixed generation-30 scoring |
| 7 | The silence ending adopted: heirless focal death (or elected silence) is the game's single formal ending | deliberate amendment to #4 |
| 8 | Frame: Tongue-as-narrator **plus** a focal-identity spectrum (primarily one branch, graded reach over kin) | the dialogue's largest addition to the analysis |
| 9 | Refocus only at fracture and death; never voluntary | free refocus reinstates the overseer |
| 10 | On lock-in the other ambitions grade and freeze forever | the lock is the run's full stop |
| 11 | Reach cost: kinship-dominant blend (kinship weighted above intelligibility), capped multiplier, never a gate | |
| 12 | Deadlines only where natural; open ambitions resolve by lock or never | all-failed sandbox entry accepted as rare |
| 13 | Succession: up to 3 heirs ranked by closeness, per-candidate penalties shown; silence always electable | |
| 14 | Succession penalty: hoarse voice (mourning reach multiplier), stacking with intrinsic ambition damage; product capped | meta-currency and lexicon-mangling penalties rejected |
| 15 | Momentum accrues from both sources, player-weighted (drift at half) | |
| 16 | Ambition trio: seeded constrained draw with a tension guarantee | |
| 17 | Contact events: pure roll, odds displayed, no influence sweetening | |
| 18 | Contact failure consequences typed by event kind | trade → influence, warning → assimilation pressure, marriage → narrative |
| 19 | Borrowing gated behind contact success | ⚠️ behaviour change to shipped 2GEO.5 |
| 20 | Gate shape: trade routes (success licenses the border for `ROUTE_TURNS`), not strict same-turn | |
| 21 | Economy: treasury-and-laboratory in full (size-scaled costs + isolation-scaled drift rate), income shape unchanged | player challenge to the analysis's assumption, upheld with the Trudgill/Milroy correction |

---

<a name="ledger"><h2>10. Honesty ledger: real vs proxy vs game-fiction</h2></a>

| Mechanic | Status | Note |
|----------|--------|------|
| Isolation → divergent/idiosyncratic change; contact → convergent/levelling change | **real, attested** | Trudgill's sociolinguistic typology; Milroy's network theory. The correction the dialogue applied: different *kinds*, not simply more |
| Deliberate change easier in small dense communities than widespread ones | **real, directionally** | norm propagation in dense networks vs institutional standardisation; the size-cost gradient is a fair rendering |
| Drift momentum (change begets same-category change) | **real as tendency** | Sapir's drift; chain shifts (Great Vowel Shift) are the canonical case. Cap and decay are game guardrails, not claims |
| Contact success odds = mutual intelligibility | **proxy, flagged** | real determinants include bilingualism, prestige and lingua francas; intelligibility is the engine's one distance metric standing in for all of them |
| Trade routes licensing borrowing | **game-fiction with a real skeleton** | borrowing does track contact intensity (Thomason & Kaufman, per 2GEO.4 §2); the discrete route window is dramatisation |
| Ambitions as a language's desires | **frame** | languages do not want; the Tongue frame is fiction doing mechanical work (giving loss a subject) |
| Reach cost by kinship + intelligibility | **frame** | no real-world analogue claimed; it renders identity as a mechanic |
| All constants (`MOMENTUM_*`, `RATE_*`, `CONTACT_*`, `W_*`, caps) | **first-pass tuning** | named constants, expect a playtest pass as `BIAS_STRENGTH` got in 2GEO.2 |

---

<a name="deferred"><h2>11. Out of scope</h2></a>

- **Prerequisite chains** — rejected outright, upholding the analysis: a tech tree is the wrong fantasy for phonology.
- **The adversary** — the static world is 2GEO.6, the rival family 2GEO.8 (sequenced after this layer proves out).
- **Irreversibility legibility** — door-closer marking on merger/deletion rules belongs beside 2LEX.2's collision-delta UI; noted there, not built here.
- **Ambition-guided fracture incentives beyond The Exile** — a content pass once the mechanism ships.
- **Contact agency (sweetening, chosen pairs)** — deliberately deferred; add only if playtests show the pure roll feels like weather.
- **Difficulty presets** — 2UI.3 consumes §6's scarcity contract; not designed here.

---

<a name="sources"><h2>Sources</h2></a>

- Trudgill, *Sociolinguistic Typology: Social Determinants of Linguistic Complexity* (2011) — isolation/complexification vs contact/simplification
- Milroy & Milroy, *Linguistic change, social network and speaker innovation* (1985) — dense networks resist diffusion, propagate internal innovation
- Sapir, *Language* (1921), ch. 7 — drift
- Thomason & Kaufman (1988) — borrowing scale (via the [2GEO.4 spike](./2geo-4-neighbour-contact-borrowing.md) §2)
- Trask / Garde — irreversibility of mergers (deficit 5's grounding, handed to 2LEX.2)
- [The Tongue design analysis](../reports/the-tongue-design-analysis.md) (visual companion: [eight recommendations](../reports/the-tongue-recommendations.html)) — the candidate answer this spike evaluated

---

- [Roadmap](../roadmaps/mvp.md) · [2GEO.4 spike](./2geo-4-neighbour-contact-borrowing.md) · [Engine source](../../src/lib/engine/)
