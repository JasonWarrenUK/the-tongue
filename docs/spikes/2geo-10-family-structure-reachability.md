---
description: 2GEO.10 investigation spike — fracture and assimilation death never fire autonomously on the 10x8 grid; diagnoses why, ships two safety fixes (fracture cooldown, stuck-turn crossing floor), and hands genuine reachability to 2GEO.9
---

# 2GEO.10 — Investigation Spike: Family-Structure Reachability

> [!IMPORTANT]
> **Finding:** a 12-seed × 150-turn autonomous census measured 0 fractures, 0 assimilation deaths, 1 living branch — in every seed. The 10×8 grid's genesis connectivity sits far above the square-lattice bond-percolation threshold, so territory almost never disconnects and the fracture trigger never fires. This spike diagnoses the mechanism precisely (it is not a simple probability problem — see §3), ships two safety fixes that make fracture non-pathological wherever it *does* fire (`FRACTURE_COOLDOWN`, `STUCK_TURNS`), and finds that genuine reachability requires better map generation, which is [2GEO.9](../roadmaps/mvp.md#m2-todo)'s territory, not this task's.

---

## Contents

- [1. Why this exists](#gap)
- [2. The census: zero family structure](#census)
- [3. Why terrain-probability tuning alone fails](#bimodal)
- [4. The actual mechanism: a spread/fracture feedback loop](#mechanism)
- [5. Fix 1 — FRACTURE_COOLDOWN](#cooldown)
- [6. Fix 2 — STUCK_TURNS](#stuck)
- [7. What terrain-probability tuning could NOT deliver](#terrain-verdict)
- [8. Assimilation death: a second, near-zero sink](#assimilation)
- [9. Decision record](#decisions)
- [10. Handed to 2STK.4 and 2GEO.9](#handoff)

---

<a name="gap"><h2>1. Why this exists</h2></a>

This started as [2STK.4](../roadmaps/mvp.md#m2-todo) (ambitions & lock-in). Planning its 10-item roster surfaced that seven ambitions (Babel, Ozymandias, Twins, Last Word, Matriarch, Scatterling, Exile) require fracture or assimilation death to have ever happened — a dead ancestor, a sibling pair, a family that "numbered ≥3". Before committing to that roster, the reachability of those preconditions needed checking against the live engine, not inferred from reading `passableComponents`/`dominantAssimilator`, both of which are correctly implemented in isolation.

<a name="census"><h2>2. The census: zero family structure</h2></a>

`docs/spikes/assets/2geo-10-family-census.ts` runs `resolveGeneration` for 150 turns across 12 seeds with no player input. At the pre-existing baseline (`pickTerrain`: 55% plain, 20% hill, 15% mountain, 10% water):

- **0 fractures, 0 assimilation deaths, 1 living branch — every seed, every checkpoint (t=25/50/100/150).**
- Every seed's single branch saturates the entire passable component: 51 regions held by t=150.
- Mean genesis largest-passable-component size: **78.3/80** — the map is almost never disconnected to begin with.
- 39-57 anchor freezes per seed by t=150 (mean 47.8) — drift and rename fire constantly; only territory-based mechanics are inert.
- Median turn intelligibility-vs-birth-anchor crosses below 0.6: **turn 7**.

Root cause: `geography.ts`'s 10×8 grid at ~75% passable-edge probability sits far above the square-lattice bond-percolation threshold (0.5). `passableComponents` essentially never returns more than one component, so the fracture trigger (`generation.ts`, step 5) never fires. This is a side effect of [1ENG.21](../roadmaps/mvp.md#m1-core-simulator), which grew the grid from 4×3 specifically to fix `ORDER_CONTACT_CUT` reachability (a branch's neighbours were too few for any `pairContact` share to clear 0.6) — correct on its own terms, audited for every region-count assumption, but it did not model that a bigger well-connected lattice percolates *harder*, and fracture depends on the map *failing* to percolate. The pre-existing fracture-rate comment in `geography.ts` ("0-2 events/150 turns per 1ENG.10's own testing") was measured on the 4×3 map; on the current grid it was 0.

<a name="bimodal"><h2>3. Why terrain-probability tuning alone fails</h2></a>

The obvious fix — raise the impassable-terrain share toward the percolation threshold — was tried and produces a **bimodal**, not graduated, outcome. Sweeping impassable share from the 25% baseline through 0.42 and 0.46, at every value tested against the full 12-seed generation-loop census (not just genesis connectivity):

- Roughly half the seeds stay at **0 fractures** — their particular genesis map happens to stay well-connected.
- The other half **run away to 20-35 living branches by turn 150**, with territory distributions like `11,7,6,5,5,3,3,3,2,2,2,2,2,2,2,2,2,2,1×15`.

No probability tested produced "a few interesting splits." The reason is structural, not a matter of finding the right number — see §4.

<a name="mechanism"><h2>4. The actual mechanism: a spread/fracture feedback loop</h2></a>

Isolated by a controlled A/B directly on the live engine: disabling passive spread's impassable-terrain fallback (`generation.ts` step 3 — a boxed-in branch normally crosses a barrier rather than stalling) at the *same* terrain probability that had produced runaway fracture dropped fracture to **exactly 0/12 seeds**, identical to the untouched baseline.

That fallback is fracture's entire trigger path once impassable terrain is common enough to matter:

1. A branch runs out of passable neighbours and is boxed in.
2. It crosses a barrier (the documented "cross only when boxed in" fallback), grabbing a region disconnected from its existing territory.
3. `passableComponents`, checked every generation for every leaf (`generation.ts`, step 5), splits the disconnected region off as a new territory-1 branch.
4. That new branch is itself immediately boxed in on a low-connectivity map.
5. Repeat, from step 1, every ~3 turns (the spread cadence).

Two individually reasonable mechanisms — spread must not permanently stall; fracture must resolve real disconnection — compose into an unbounded feedback loop the moment impassable terrain is common enough to matter. Neither mechanism is wrong in isolation; the interaction is the bug.

<a name="cooldown"><h2>5. Fix 1 — FRACTURE_COOLDOWN</h2></a>

`Branch.fractureCooldown: number` — turns remaining before a branch may fracture again. Set to `FRACTURE_COOLDOWN` (first-pass 8) on a newly-spun-off fragment at birth; the continuing lineage takes none (same reasoning as it taking no birth-divergence step either — it is the same community, mid-sentence, not a new one). Ticks toward 0 every repool, mirroring `assimilationPressure`'s scalar-clock shape. The fracture check in `generation.ts` step 5 is skipped while a branch's cooldown is active — the branch still owns whatever (possibly disconnected) territory it holds; only the *split* is withheld, not spread, drift, or anything else.

This directly breaks the loop at step 3-4 in §4: a fragment born this generation cannot re-fracture next generation even if it immediately gets boxed in again.

Chosen over two alternatives considered and rejected:
- **Suppressing the impassable-crossing fallback entirely** — proven (§4's A/B) to fully stop fracture, but forecloses boxed-in growth permanently, which the census found strictly worse for at least one seed (see §6): a branch whose start region is walled in on every side never grows again for the rest of the game.
- **An after-the-fact branch-count cap** — treats the symptom (too many branches) without explaining or bounding the fragment-cascade mechanism itself.

A cooldown was also judged the diegetically sound option: a just-split community re-fracturing again the very next generation reads as noise, not narrative; a settling period before a fresh lineage can itself fracture again matches how the engine already treats fracture as a lineage-continuation event, not an instant one.

<a name="stuck"><h2>6. Fix 2 — STUCK_TURNS</h2></a>

`FRACTURE_COOLDOWN` alone, tested against a wider probability sweep, surfaced a second bug: a branch whose starting region is walled in on **every** side (a real genesis configuration the census caught) never gets a passable neighbour, ever. With the fallback still gated on "boxed in" but no additional floor, such a branch is fine. But an early attempt to also floor the *crossing* itself on `territory.length >= 2` (to stop a lone territory-1 branch coin-flipping into a different lone region, a related but distinct failure mode from §4) traps this branch at **territory=1 for the entire 150-turn run** — strictly worse than the pre-fix baseline, which at least let it cross and grow via the plain fallback.

Fix: allow the impassable-terrain crossing once a branch has been stalled — `b.pressure` (already the turns-since-last-successful-spread counter) shows no passable option for `STUCK_TURNS` (first-pass 4) consecutive spread attempts, not merely the first one. Long enough that a branch with *any* passable neighbour never needs it (`b.pressure` resets to 0 on every successful passable spread, so it can never accumulate past the floor); short enough that a genuinely walled-in branch is not frozen for the whole run.

Confirmed by direct trace and by a regression test (`generation.test.ts`, `2GEO.10 stuck-turn crossing floor`): a maximally walled-in branch (zero passable neighbours at all) does not cross before `STUCK_TURNS` stalled attempts, and does eventually cross — though the escape shows up as *family growth* (a new sibling spun off, since a lone crossed region is by construction disconnected from a lone starting region, so `passableComponents` splits them the same generation) rather than the original branch's own territory count increasing. That is correct: the family tree grows even though the specific branch that was walled in stays small.

<a name="terrain-verdict"><h2>7. What terrain-probability tuning could NOT deliver</h2></a>

With both fixes in place, a further terrain-probability sweep was run to see whether a moderate nudge (toward 0.42-0.48 impassable share) could now deliver a clean, non-bimodal fracture rate, since the cooldown should cap any runaway.

It did not. At 0.42-impassable against the original 12-seed set, results still varied from 0-19 fractures per seed depending on that seed's particular genesis connectivity (a second failure mode surfaced: a large, well-established branch — territory 31, not a tiny fragment — can sit on a genuinely gap-riddled map and steadily shed small disconnected outposts every ~3 turns as a matter of course, independent of the fixes above). More importantly, **the original 12-seed set turned out not to be representative**: it was reused from an earlier collision census for convention consistency and happened to include several unusually fragmented maps. At a wider, arbitrary 40-seed sample, 0.42-impassable left **35/40 seeds (87.5%) at zero fractures**, with only 1/40 reaching 5 living branches (the Babel ambition precondition).

**Verdict: terrain-probability tuning on the current grid generator cannot deliver reliable reachability — it is fundamentally gated by genesis map quality, not a percentage to find.** Shipping a probability nudge that helps under 15% of seeds was judged not worth the seed-reproducibility churn (every world's terrain assignment changes) for that little benefit. **Terrain probability ships unchanged from baseline.** The two structural fixes ship regardless, since they are correct bug fixes independent of reachability: wherever fracture *does* fire — a lucky seed today, or any seed once map generation improves — it is now safe (bounded, non-freezing) rather than pathological.

<a name="assimilation"><h2>8. Assimilation death: a second, near-zero sink</h2></a>

Independently measured: ~0.001 deaths/branch-turn (2 deaths across 10 aggressive seeds × 200 turns of forced play), with the binding constraint being qualification, not the 3-turn sustain (`ASSIM_TURNS`): only 14 of 20,221 branch-turns ever had a qualifying `dominantAssimilator` at all.

`dominantAssimilator` requires simultaneously: `ASSIM_INTEL_CUT` (0.75) intelligibility **and** a neighbour at least `ASSIM_SIZE_RATIO` (2×) larger. The census shows why these almost never co-occur: intelligibility vs. birth anchor crosses below 0.6 at a median of **turn 7-9** (measured across two independent 12-seed and 20-seed runs), and pairwise intelligibility between any two branches falls comparably fast — so by the time a genuine size disparity develops between two branches (which itself requires fracture to have happened and one side to have out-grown the other), the pair has almost always diverged well past 0.75.

This is a genuine design tension, not a number to nudge blindly: assimilation is meant to model language shift into a near-identical dominant neighbour, which is real, but the engine's drift rate means near-identical neighbours barely exist past the first handful of turns. Left as a documented finding rather than fixed here — fracture is the higher-leverage, largely-independent dial, and the *rate* worth targeting for assimilation depends on how much fracture 2GEO.9 eventually unlocks (more sibling pairs existing at all is a precondition for assimilation ever having a candidate to act on). Options surfaced for whoever takes this up: lower `ASSIM_INTEL_CUT`; make it size-scaled (a much larger neighbour assimilates at lower intelligibility — prestige/demographic pressure rather than mutual comprehension); or accept a low rate and let [2GEO.6](../roadmaps/mvp.md#m2-todo)'s world events (a plague emptying a region) carry branch death instead.

<a name="decisions"><h2>9. Decision record</h2></a>

| # | Decision | Why |
|---|----------|-----|
| 1 | Ship `FRACTURE_COOLDOWN` + `STUCK_TURNS` as pure safety fixes; do not change terrain probability | §7 — no probability delivers reliable reachability on this generator; a nudge helping <15% of seeds isn't worth the reproducibility churn |
| 2 | Cooldown rate-limits fracture directly, rather than removing the impassable-crossing fallback | Removing the fallback (proven to work) forecloses boxed-in growth entirely, worse than the status quo (§5) |
| 3 | Stuck-turn floor is a time-based escape (consecutive stalled attempts), not a hard territory-size gate | A hard `territory >= 2` gate has no escape valve and permanently freezes a walled-in-at-genesis branch (§6) |
| 4 | Assimilation death rate is documented, not fixed, in this task | Genuinely gated by fracture producing sibling pairs at all; premature to tune before 2GEO.9 changes the population it acts on (§8) |
| 5 | The self-anchoring ambition-roster rewrite from 2STK.4's own planning carries forward unchanged | Independent finding, not affected by this spike |

<a name="handoff"><h2>10. Handed to 2STK.4 and 2GEO.9</h2></a>

**To 2STK.4 (ambitions), once unblocked:**
- Proto- naming is render-time only (`naming.ts` `eraContexts`) and requires **≥2** descendant leaves plus a descendant pair below `STAGE_CUT` (0.5) — not the ≥3 the original roster sketch stated for Ozymandias.
- Terrain lives on **edges**, not regions (`Edge.name?: Terrain`). "The Scatterling: descendants on every terrain type" has no referent as written; rebuild on `dominantTerrain`.
- The Long Tongue is satisfiable only for N ≲ 7-9 (median intelligibility-vs-birth-anchor crossing). Its deadline must be set from this, not guessed.
- The Deep Root is trivial at any plausible K given ~3-4 turn anchor gaps (measured: mean 47.8 anchors/150 turns).
- Babel's ≤30% clause fails even when 5+ branches exist — measured max-pair intelligibility under forced fracture play bottoms at 0.319-0.379. Threshold needs re-fitting against real data, not the design sketch's round number.
- Every ambition should name the focal branch (the self) as a required participant — several of the original roster's conditions are god's-eye ("any branch holds ≥8 regions"), which contradicts the stakes layer's own root diagnosis that fracture/death must cost the *self* something to matter. Carried forward from 2STK.4's own planning session.

**To 2GEO.9 (map-shape diversification):** this spike's census (`docs/spikes/assets/2geo-10-family-census.ts`) is the concrete reachability check any map-generation change should run before/after — target no seed at 0 fractures, a majority reaching 5 living branches, genesis largest-component well below the region count, and `pairContact` shares above `ORDER_CONTACT_CUT` still occurring (they do, rarely, once fracture fires at all — 6 samples/0.52% at 0.42-impassable in the 12-seed set — confirming 1ENG.21's fix and family structure are linked, not independent).
