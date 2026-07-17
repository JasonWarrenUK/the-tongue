# The Tongue MVP: Roadmap Overview

**38 tasks across 3 milestones.** Files: `.claude/roadmaps.json` (machine-readable), `docs/roadmaps/mvp.md` (full task list with Mermaid dependency diagram).

> Migrated from the old simple-format `docs/roadmaps/mvp.md` via `roadmap-migrate`. This overview is a stub synthesised from the milestone goals in the source document; the narrative sections below need fleshing out with the actual reasoning behind the phase structure.

---

## What we're building

*(Stub — expand with the real reasoning.)*

The Tongue is a seeded, deterministic language-evolution simulator. Milestone 1 builds the core engine: RNG, phonology, lexicon generation, territory/geography, and the autonomous drift → spread → fracture turn loop, wrapped in a Svelte 5 UI. Milestone 2 deepens that simulation — geography causally shaping sound change, real stakes attached to rule choices, a diegetic evolving-glyph writing system, and a legibility/onboarding pass tying it all together. Milestone 3 is a deliberately deferred stub for persistence and sharing.

## Milestone sequence and the reasoning behind it

*(Stub — expand per milestone.)*

- **M1 — Core Simulator:** the playable core; 18 of 22 tasks done. The remaining chain (two design spikes, a conlang-tools survey and its follow-up implementation) is scoped small and rule-only.
- **M2 — Depth & Legibility:** gated behind a sequence of design spikes (neighbour contact, stakes, glyphs, homophone resolution) before their implementations, converging on a UI completeness audit and onboarding pass.
- **M3 — Persistence & Sharing:** stubbed out of M2 to keep that milestone focused on simulation depth; two tasks, both deferred.

## Decisions that shaped the structure

*(Stub — capture key decisions, e.g. why 1ENG.18 was scoped as a historical-death pattern rather than territory conquest, why 2GEO.4 was split out from the 2GEO.1 spike's Axis B hooks.)*

## External blockers (flag early)

None currently modelled — no external gates in this phase.
