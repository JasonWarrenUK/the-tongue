---
description: The Tongue — seeded language-evolution simulator, from core engine to diegetic depth
---

# The Tongue: MVP Roadmap

|            | Status                    | Next Up                          | Blocked |
| ---------- | -------------------------- | --------------------------------- | ------- |
| **Core**   | ✅ Milestone 1 complete    | 1ENG.9, 1ENG.11                    | —       |
| **Geo**    | ✅ 2GEO.3 complete          | 2GEO.4 design spike                | —       |
| **Stakes** | Not started                 | 2STK.1 design spike               | 2GEO.2, 2GEO.4 |
| **Glyphs** | Not started                 | 2GLY.1 design spike               | 2STK.2  |
| **Lexicon** | Not started                | 2LEX.1 design spike               | —       |
| **UI**     | Not started                 | 2UI.1 audit                       | 2STK.2, 2GLY.4, 2LEX.2 |

---

## Contents

- [Milestones](#milestones)
  - [Milestone 1: Core Simulator](#m1)
  - [Milestone 2: Depth & Legibility](#m2)
  - [Milestone 3: Persistence & Sharing](#m3)
- [Progress Map](#map)
- [Links](#links)
- [Beyond MVP](#post-mvp)

---

<a name="m1"><h3>Milestone 1: Core Simulator</h3></a>

> [!IMPORTANT]
> **Goal:** A playable, deterministic language-evolution simulator — seeded world generation, sound-change rules, territory expansion, autonomous drift/spread/fracture, and a mutual intelligibility matrix.

<a name="m1-done"><h4>Completed (Milestone 1)</h4></a>

- [x] 1ENG.1. Mulberry32 seeded RNG + deterministic hash for autonomous replay (`rng.ts`)
- [x] 1ENG.2. Phoneme inventory, syllable template, and 32-concept lexicon generation (`lexicon.ts`)
- [x] 1ENG.3. Phone table, 10 sound-change rules, collision/homophone detection (`phonology.ts`)
- [x] 1ENG.4. Mutual intelligibility matrix via normalised edit distance (`intelligibility.ts`)
- [x] 1ENG.5. Branch family tree layout and per-branch colour generation (`tree.ts`)
- [x] 1ENG.6. Terrain map, adjacency, and passable-component detection (`geography.ts`)
- [x] 1ENG.7. World/state initialisation (`world.ts`)
- [x] 1ENG.8. Generation resolution: drift → spread → fracture → repool (`generation.ts`)
- [x] 1UI.1. Reactive game state singleton (Svelte 5 runes) (`game.svelte.ts`)
- [x] 1UI.2. Map, family tree, intelligibility matrix, word table, change list, history panels
- [x] 1UI.3. Economy config panel for tuning pool/growth/overhead/cost settings
- [x] 1UI.4. Main route wiring all components together (`+page.svelte`)

<a name="m1-todo"><h4>To Do (Milestone 1)</h4></a>

- [ ] 1ENG.9. Fracture: guarantee children diverge from the parent at the moment of fracture, not only via later drift — currently a fractured branch's children are exact lexicon copies of the parent (`generation.ts:45`)
- [ ] 1ENG.11. Research spike: rule-set erosion/renewal balance — every rule in `RULES` (`phonology.ts:39-49`) is purely reductive (lenition/deletion/assimilation/vowelShift only ever delete, merge, or simplify); once a lexicon reaches minimal CV/V syllables with no matching environments left, `firingRules()` returns empty and `driftRule()` permanently returns `null`, ossifying the branch after a few generations. Survey real diachronic phonology for renewal/anti-erosion mechanisms (epenthesis, dissimilation, vowel breaking/diphthongisation, compensatory lengthening, morphological/borrowing-driven complexity) and produce a build-ready contract for a sustainable erosion↔renewal cycle

<a name="m1-blocked"><h4>Blocked (Milestone 1)</h4></a>

- [ ] 1ENG.10. Fracture: rework to continue the parent lineage as one branch and spin off only the new sibling(s), instead of retiring the parent and minting two new branches every split; add a divergence-threshold mechanic so a lineage is renamed once accumulated drift makes "still the same language" a fiction (cf. Old English → Middle English, Proto-Indo-European → daughter branches) — **depends on 1ENG.9**
- [ ] 1ENG.12. Implement chosen erosion/renewal mechanism *(placeholder — scope defined by the 1ENG.11 spike's contract)* — **depends on 1ENG.11**

---

<a name="m2"><h3>Milestone 2: Depth & Legibility</h3></a>

> [!IMPORTANT]
> **Goal:** Make geography causally shape language change, give sound-change choices real stakes, add a diegetic evolving-glyph writing system, and make every player-facing decision legible — starting with an onboarding pass informed by all of the above.

<a name="m2-done"><h4>Completed (Milestone 2)</h4></a>

- [x] 2GEO.1. Design spike: terrain→sound-change bias ruleset — split into a social-geography contact/isolation axis (sound change) and a physical-geography terrain axis (semantic salience), with a full implementation contract for 2GEO.2 and 2GEO.3 (`docs/spikes/2geo-1-terrain-sound-change.md`)
- [x] 2GEO.2. Implement terrain-biased rule weighting in `phonology.ts` — contract specified in the 2GEO.1 spike
- [x] 2GEO.3. Implement biome-driven vocabulary resistance — terrain-salient concepts (`salienceRetention` in `lexicon.ts`) drift/replace more slowly, gating word-level drift in `applyRuleToLex` (`phonology.ts`) — contract specified in the 2GEO.1 spike, Axis B minimum scope (iii)

<a name="m2-todo"><h4>To Do (Milestone 2)</h4></a>

- [ ] 2GEO.4. Design spike: neighbour contact/borrowing mechanic — bordering branches converge via borrowing, not just diverge; Axis B's salient-concept borrowing lever is the natural home (2GEO.1 spike §242 sketches `borderEdges`/`dominantTerrain` as hooks but does not give this a build-ready contract) — needs its own spike before implementation, following the 2STK.1/2GLY.1/2LEX.1 pattern
- [ ] 2LEX.1. Design spike: homophone-collision resolution mechanic — how a real semantic collision between two concepts (`homophoneForms`/`collisionPairs` in `phonology.ts`, currently only previewed before a player picks a rule) gets resolved once it actually lands during drift — candidates include a forced disambiguating follow-up change, a tolerated real homophone surfaced in UI/narrative, a borrowed synonym, or compounding — informed by real linguistics on homophone avoidance/tolerance

<a name="m2-blocked"><h4>Blocked (Milestone 2)</h4></a>

- [ ] 2STK.1. Design spike: rule-choice stakes mechanic (resource trade-offs vs directional goals vs prerequisite chains) — **depends on 2GEO.2, 2GEO.4**
- [ ] 2STK.2. Implement chosen rule-stakes mechanic — **depends on 2STK.1**
- [ ] 2GLY.1. Design spike: glyph mutation ruleset — shape-drift grammar + phoneme→glyph reassignment rules, referencing real script lineages (e.g. Phoenician → Greek → Etruscan → Latin) — **depends on 2STK.2**
- [ ] 2GLY.2. Implement per-generation glyph shape drift (independent stylistic mutation) — **depends on 2GLY.1**
- [ ] 2GLY.3. Implement phoneme→glyph reassignment logic, tied to phone split/merge/deletion from phonology rules — **depends on 2GLY.1**
- [ ] 2GLY.4. Build glyph rendering component (branch-level script display) — **depends on 2GLY.2, 2GLY.3**
- [ ] 2LEX.2. Implement chosen homophone-collision resolution mechanic — **depends on 2LEX.1**
- [ ] 2UI.1. UI completeness audit across all components — existing panels plus new biome/stakes/glyph/lexicon data — verify every player-facing decision has a legible data source — **depends on 2STK.2, 2GLY.4, 2LEX.2**
- [ ] 2UI.2. Build onboarding — inline explainers, full tutorial mode, and a UI layout rethink, informed by the audit findings — **depends on 2UI.1**

---

<a name="m3"><h3>Milestone 3: Persistence & Sharing</h3></a>

> [!IMPORTANT]
> **Goal:** Survive a page refresh and let players show their results to someone else. Deferred out of Milestone 2 to keep that milestone focused purely on simulation depth and legibility — stubbed here so the intent isn't lost.

<a name="m3-blocked"><h4>Blocked (Milestone 3)</h4></a>

- [ ] 3PER.1. Local persistence — save/load a session via `localStorage` *(placeholder — deferred from Milestone 2)*
- [ ] 3SHR.1. Shareable output — export/share a family tree or result (image, link, or data export) — **depends on 3PER.1** *(placeholder — deferred from Milestone 2)*

---

<a name="map"><h3>Progress Map</h3></a>

```mermaid
---
title: Progress Map
---
graph TD

m1{"`**Milestone 1**<br/>Core Simulator`"}:::mile
m2{"`**Milestone 2**<br/>Depth & Legibility`"}:::mile
m3{"`**Milestone 3**<br/>Persistence & Sharing`"}:::mile

m1 --> m2
m2 --> m3

1ENG9["`*1ENG.9*<br/>**Core**<br/>fracture divergence-at-birth`"]:::open
1ENG10["`*1ENG.10*<br/>**Core**<br/>lineage-continuation fracture`"]
1ENG11["`*1ENG.11*<br/>**Core**<br/>erosion/renewal spike`"]:::open
1ENG12["`*1ENG.12*<br/>**Core**<br/>renewal mechanism`"]

2GEO.1["`*2GEO.1*<br/>**Geo**<br/>terrain→sound-change spike`"]:::done
2GEO.2["`*2GEO.2*<br/>**Geo**<br/>terrain-biased rule weighting`"]:::done
2GEO.3["`*2GEO.3*<br/>**Geo**<br/>biome-driven vocabulary`"]:::done
2GEO.4["`*2GEO.4*<br/>**Geo**<br/>neighbour contact spike`"]:::open
2STK.1["`*2STK.1*<br/>**Stakes**<br/>rule-choice stakes spike`"]
2STK.2["`*2STK.2*<br/>**Stakes**<br/>rule-stakes mechanic`"]
2GLY.1["`*2GLY.1*<br/>**Glyphs**<br/>glyph mutation ruleset spike`"]
2GLY.2["`*2GLY.2*<br/>**Glyphs**<br/>glyph shape drift`"]
2GLY.3["`*2GLY.3*<br/>**Glyphs**<br/>phoneme→glyph reassignment`"]
2GLY.4["`*2GLY.4*<br/>**Glyphs**<br/>glyph rendering component`"]
2LEX1["`*2LEX.1*<br/>**Lexicon**<br/>homophone-collision spike`"]:::open
2LEX2["`*2LEX.2*<br/>**Lexicon**<br/>collision-resolution mechanic`"]
2UI.1["`*2UI.1*<br/>**UI**<br/>completeness audit`"]
2UI.2["`*2UI.2*<br/>**UI**<br/>onboarding`"]

3PER.1["`*3PER.1*<br/>**Persist**<br/>local save/load`"]
3SHR.1["`*3SHR.1*<br/>**Share**<br/>export/share output`"]

1ENG9 --> 1ENG10
1ENG11 --> 1ENG12

2GEO.1 --> 2GEO.2
2GEO.1 --> 2GEO.3
2GEO.2 --> 2GEO.4
2GEO.3 --> 2GEO.4
2GEO.2 --> 2STK.1
2GEO.4 --> 2STK.1
2STK.1 --> 2STK.2
2STK.2 --> 2GLY.1
2GLY.1 --> 2GLY.2
2GLY.1 --> 2GLY.3
2GLY.2 --> 2GLY.4
2GLY.3 --> 2GLY.4
2LEX1 --> 2LEX2
2LEX2 --> 2UI.1
2STK.2 --> 2UI.1
2GLY.4 --> 2UI.1
2UI.1 --> 2UI.2
3PER.1 --> 3SHR.1

m1 -.-> 2GEO.1
m1 -.-> 1ENG9
m1 -.-> 1ENG11
m1 -.-> 2LEX1
m2 -.-> 2UI.2
m3 -.-> 3PER.1

classDef default,blocked fill:#fff7fb;
classDef open fill:#fff9e5;
classDef done fill:#d9ffe0;
classDef mile fill:#c4fffe;
```

---

<a name="links"><h3>Links</h3></a>

- [README](../../README.md)
- [Engine source](../../src/lib/engine/)
- Live: https://the-tongue.vercel.app

---

<a name="post-mvp"><h3>Beyond MVP</h3></a>

- Writing-system variance beyond phonemic: logographic, alphabetic, abjad glyph sets coexisting per branch (flagged during 2GLY interview, deliberately scoped down to phonemic-only for Milestone 2)
- Climate/terrain-coded phonology (contested in real linguistics — treat as flavour only if ever pursued)
