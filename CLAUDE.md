# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

The Tongue: a seeded, deterministic language-evolution simulator. Each world is generated from a numeric seed (phoneme inventory, syllable template, 32-word lexicon, 4×3 terrain map). The player spends influence to apply sound-change rules to a branch, expand its territory, and hold off autonomous drift; untouched branches drift automatically each generation, weighted by cross-linguistic naturalness and biased by terrain. Branches rename into eras (Old/Middle/Late/Proto-) as their lexicon diverges, spread into free territory, assimilate into dominant neighbours, or fracture into daughters when their territory is split by impassable terrain.

Full mechanic description: `README.md`.

## Commands

```sh
bun install
bun run dev       # http://localhost:5173
bun run build
bun run check     # svelte-kit sync && svelte-check — 0 errors expected before any commit
bun test          # bun:test, runs src/lib/engine/*.test.ts
```

Run a single test file: `bun test src/lib/engine/generation.test.ts`. No lint script exists; `bun run check` (svelte-check, strict TS) is the correctness gate.

## Architecture

**`src/lib/engine/` is plain, framework-free, deterministic TypeScript.** Every random choice routes through `hashRand(seed, ...)` / `mulberry32` (`rng.ts`) so a given seed + action sequence always reproduces the same world. When adding engine logic, never call `Math.random()` or `Date.now()` — thread a `(seed, turn, branchId)` triple through instead, matching the existing call sites.

Engine module map (dependency order, roughly bottom-up):
- `types.ts` — every shared interface; read this first when touching engine code
- `rng.ts` — `mulberry32` (world-gen PRNG), `hashRand` (per-decision deterministic draws)
- `lexicon.ts` — inventory/template/word generation, terrain-concept salience (`salienceRetention`)
- `phonology.ts` — the `Phone`/`Rule` model, all 17 sound-change rules (`RULES`), `applyRuleToWord`/`applyRuleToLex`, `driftRule` (weighted autonomous pick)
- `geography.ts` — terrain/region/edge generation, `ownerMap`, `passableComponents` (connectivity → fracture trigger), `isolationScore`/`dominantTerrain` (feed rule bias), `dominantAssimilator` (assimilation-death selection)
- `intelligibility.ts` — normalised Levenshtein over the shared concept list; the sole "how far apart are these two lects" proxy, used by rename, assimilation, and Proto-blend naming
- `tree.ts` — branch-tree queries (`leavesOf`, `childrenOf`, `descendsFrom`); note `isLeaf` means "still owns territory", not "childless" (see lineage-continuation below)
- `naming.ts` — phonotactic stem generation (`genStem`), Proto-blend morphology, and the render-time era-name perspective-collapse (`eraLabels`/`displayName`) over a branch's anchor chain
- `world.ts` — `makeWorld`/`freshState`, the seed → initial `GameState` pipeline
- `generation.ts` — `resolveGeneration`, the single per-turn pipeline: drift → rename check → spread → assimilation → fracture → repool

`src/lib/game.svelte.ts` is the one reactive bridge into the engine: a `$state`-backed singleton (`export const game = new Game()`) whose `$derived`/`$derived.by` fields recompute UI-facing values (candidate rules, collision deltas, display names, cost previews) from `st: GameState` and whose methods (`apply`, `expandInto`, `endTurn`, `selectBranch`) are the only place engine calls happen. Components read `game.*` directly; there is no separate store layer.

`src/routes/+page.svelte` wires `src/lib/components/*.svelte` (Map, FamilyTree, IntelMatrix, WordTable, Changes, HistoryList, EconomyCfg, ControlBar, Header, Panel) to the `game` singleton.

### Key design invariants worth knowing before editing generation/branch logic

- **Lineage continuation vs. fracture**: when a branch's territory splits across impassable terrain, the *largest* surviving component keeps the parent's id/name/history/anchors (same lineage, mid-sentence); only the smaller component(s) spin off as new branch ids with a fresh phonotactic stem and a birth-divergence drift step. `isLeaf` therefore tracks territory ownership, not tree position — a branch can be both a "leaf" (still simulated) and a parent (having spun off siblings).
- **Anchors and eras**: every branch is born with an implicit birth `Anchor`. When live-lexicon-vs-last-anchor intelligibility drops below `RENAME_CUT` (naming.ts), a new anchor freezes — frequently, by design. Turning that frequent anchor chain into legible Old/Middle/Late/Proto- labels is `naming.ts`'s `eventDensityPolicy` collapse, computed at render time, never stored.
- **Rule shape**: a `Rule.xform` returns either a legacy `Patch` (1-in/≤1-out; delete-or-modify) or an ordered `Seg[]` (1-in/N-out, for renewal rules like epenthesis/breaking that insert or split a segment). `normalise()` in `phonology.ts` reconciles both shapes — check it before adding a rule that inserts/deletes multiple segments.
- **Terrain bias is a multiplier, not a gate**: `biasedMult` (phonology.ts) nudges `driftRule`'s weighted pick by category/isolation; naturalness weight (`Rule.w`) stays dominant. Don't let a new terrain mechanic zero out or override rule weights outright.
- **Assimilation and fracture share tie-break logic**: `dominantAssimilator` (geography.ts) intentionally mirrors the fracture tie-break (larger territory, then lower id) and is called from both `generation.ts` (the actual turn resolution) and `game.svelte.ts` (a live "about to be assimilated" UI warning) — keep them calling the same function rather than duplicating the selection rule.

## Design process (spike-driven)

Non-trivial engine features go through a design spike before implementation: `docs/spikes/<task-id>-<slug>.md` (e.g. `1eng-14-syntax-conditioned-sound-change.md`). Task ids follow `<PhaseArea>.<n>` (e.g. `1ENG.15`, `2GEO.4`, `2LEX.1`) and are tracked in `.claude/roadmaps.json` plus mirrored in `docs/roadmaps/mvp.md`. Code comments frequently cite the originating task id and spike section (e.g. "1ENG.13 — compensatory lengthening... see 1eng-11 spike §8") — when those comments reference a spike, read it before changing the surrounding logic, since the reasoning (why this shape and not an alternative) usually lives there, not in the code.

## Conventions

- Indentation is **2 spaces** in `src/lib/engine/` and `src/lib/*.ts` (this differs from the tabs default in Jason's global config — match the surrounding file).
- Tests live alongside source as `*.test.ts` (`bun:test`, `describe`/`test`/`expect`), not in `tests/`. `tests/fixtures/` holds hand-built fixtures (e.g. `geography.ts`) shared across engine test files — prefer extending these over inlining new ad hoc geometry in a test.
- Engine code favours dense, single-line arrow-function pipelines over verbose control flow; comments explain *why* a shape was chosen (often citing a spike or an empirically-observed tuning outcome), not what the line does.
