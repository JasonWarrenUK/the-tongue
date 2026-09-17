<!-- doc-changelog: generated 2026-09-17. Delete this line once you hand-edit this file. -->
# Changelog

All notable changes to The Tongue are documented here. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

Nothing yet.

## [9.2.0] - 2026-09-17

### Fixed
- Corrected a backwards sound-change example: metathesis was documented as "brid" becoming "bird", but the rule actually swaps sounds the other way round, producing "rbid". The example is now "petrol" becoming "pertol", a real word players can pronounce for themselves.

### Added
- A "Welcome to The Tongue" introduction, shown on load, explaining that you play as the language itself, not a person or a nation
- An "i" info button on every panel and on each sound-change card, opening a short plain-English explanation
- Every sound-change card can now show a plain-English name and a worked English example instead of its technical name and formula, toggled per card or for every card at once (Casual mode is now the default)

### Changed
- The header now stays fixed at the top of the screen while the rest of the page scrolls beneath it
- Panel titles now use consistent title case throughout
- The Phrases tab now opens before Intelligibility by default

## [9.1.0] - 2026-09-08

### Fixed
- A branch that has just fractured now has a cooldown before it can fracture again, so a newborn branch cannot immediately split again and again into many single-region fragments
- A branch completely walled in by impassable terrain from birth can now eventually escape and expand once it has been stuck for several turns, instead of staying frozen at minimal territory for the whole game

### Changed
- Replaced the placeholder interface with a new "Instrument" visual design: a dark command bar, a responsive tile grid and a sticky lexicon rail on desktop
- The fracture, succession, collision-repair and "fallen silent" dialogs now share a consistent visual design
- Fonts are now self-hosted, so the app works offline

### Added
- A dedicated mobile layout below 768px width, with a bottom tab bar (Map, Tree, Langs, Lexicon, Changes) and a pinch-to-zoom, pannable territory map

## [9.0.0] - 2026-08-07

### Breaking
- Newly generated languages now pick their starting phonemes by realistic frequency rank rather than uniformly at random, and the map grew substantially, so previously noted seeds will generate a different world

### Added
- Two new sound-change rules: umlaut (a vowel shifts to match a later vowel in the word, as in English "foot"/"feet") and metathesis (two adjacent sounds swap places)
- A branch whose verb-agreement endings have fully worn away for several turns now locks permanently into fixed subject-verb-object word order
- A branch in sustained, intense contact with a neighbour using a different word order now gradually drifts its own word order towards theirs

### Changed
- The world map grew from 12 regions to 80, giving neighbours enough shared border to meaningfully influence each other

## [8.0.0] - 2026-08-06

### Breaking
- Every existing seed's replay diverges from around turn one: the set of sound changes that can fire has changed, and branches now carry a stress attribute that affects generation, so old saved seeds or screenshots no longer reproduce identically

### Added
- Branches now have their own stress pattern (stress falls on the initial, final, penultimate or antepenultimate syllable, sometimes depending on syllable weight)
- Unstressed vowels can now reduce to a neutral schwa sound or be dropped entirely, modelling the kind of change that turned Latin "calidum" into French "chaud"

## [7.2.0] - 2026-08-05

### Breaking
- This changes how every existing seed's words evolve from turn one, so old seed playthroughs no longer reproduce identically

### Added
- When a word gets too short or becomes a homophone of another, it can now fuse with an adjacent word from its branch's own grammar to form a new compound, the way "God be with you" became "goodbye", reversing what had previously been one-way erosion of word length

## [7.1.1] - 2026-08-04

### Added
- The game now writes proper descriptions of phonemic mergers and splits as they happen (for example, "/p/ and /b/ fell together in /b/ in some words") instead of showing only the generic sound-change description

### Fixed
- The header now shows the selected branch's actual current sound inventory instead of the world's original genesis inventory, which by later turns could describe a language nobody in the world still spoke

## [7.1.0] - 2026-08-04

No player-visible changes. This release covers a research spike into phoneme-inventory measurement and syllabification, with no engine code shipped.

## [7.0.2] - 2026-08-01

### Added
- Every branch now has real verb inflection: past tense and person-agreement markers that are born from existing words, erode under the branch's own sound-change rules, die out and eventually re-emerge as new markers, cycling over time
- The Phrases panel now shows real inflected verb forms and a status chip for the branch's current grammar

### Changed
- Whether a branch can drop its subject pronoun is now derived from its live grammar state instead of always being switched off; new worlds are now born with subject-dropping already licensed by default, which changes how a fresh branch drifts from turn one

## [7.0.1] - 2026-07-31

No player-visible changes. Roadmap bookkeeping and an internal null-handling fix with no gameplay effect.

## [7.0.0] - 2026-07-31

### Fixed
- The family tree's per-turn cost, which had been climbing as a game went on, is now computed once instead of three times per render

### Added
- Clicking an earlier era in the family tree (for example "Old Talen") now opens a read-only view of that era's actual vocabulary, instead of doing nothing

## [6.0.1] - 2026-07-31

This release folds in the fixes and additions already listed under 6.0.0 below; nothing further to add on top.

## [6.0.0] - 2026-07-31

### Added
- Words now belong to classes (noun, verb, pronoun, adjective) and each branch has its own word order: subject/verb/object arrangement, adjective order and whether subjects can be dropped
- The lexicon grew from 32 to 48 concepts, adding verbs, pronouns and adjectives
- Sound change now depends on where a word sits in a sentence: words at the start or end of an utterance can erode differently to words in the middle
- A new Phrases panel shows the branch's four sentence frames under its current word order, with live usage percentages

### Breaking
- The larger concept list changes what every seed generates from world generation onward, so an existing seed no longer reproduces the same starting world it used to

## [5.0.0] - 2026-07-29

### Added
- A branch now builds up a decaying tendency towards whatever category of sound change was recently applied to it, by you or by autonomous drift, making that category somewhat more likely to fire again soon without forcing it
- The rule picker now shows a momentum multiplier next to each candidate rule when it would reinforce a recent tendency

## [4.0.0] - 2026-07-28

### Added
- When sound drift makes two related words sound identical, the game now tracks how severe the clash is and eventually resolves it automatically, either by compounding the losing word with a related word (like "cat" plus "fish" giving "catfish") or by borrowing a neighbouring branch's word
- A new prompt lets you pay influence to choose the disambiguating word yourself, right when your own applied change creates a severe collision, instead of leaving it to chance

### Changed
- The word table now distinguishes "severe" collisions, actively tracked with a countdown tooltip, from "tolerated" ones, which are cosmetic only

## [3.0.0] - 2026-07-28

### Added
- Each generation, bordering branches may now trigger a seeded contact event (trade, intermarriage or a warning), with odds equal to their mutual intelligibility
- A successful trade opens a time-limited trade route and pays influence income
- The control bar shows a live forecast of the pending contact event, and the intelligibility matrix marks borders with an open trade route

### Breaking
- Lexical borrowing between neighbours now requires an open trade route to fire at all; previously, any sufficiently connected border could borrow on contact alone, so branches that have drifted too far apart to understand each other can no longer open a route or borrow at all

## [2.0.1] - 2026-07-28

No player-visible changes noted beyond what shipped in 2.0.0 below; this release closes out that milestone.

## [2.0.0] - 2026-07-28

### Added
- The family tree now shows each branch's era-by-era chronology as separate nodes instead of one static node per branch

### Fixed
- Map regions can now be activated with the keyboard (Enter or Space), not only the mouse

## [1.0.1] - 2026-07-27

No player-visible changes beyond what shipped in 1.0.0 below.

## [1.0.0] - 2026-07-27

### Added
- The game now tracks a single focal branch, your "self", rather than letting you act freely on every branch; acting on a kin branch instead now costs more, scaled by how distantly related and how mutually intelligible it still is
- When your focal branch's territory fractures, you now choose which fragment carries your lineage forward
- When your focal branch is assimilated by a dominant neighbour, you can name an heir from nearby kin (at a temporary cost penalty) or choose silence, which ends the run

## [0.9.0] - 2026-07-24

### Added
- Bordering living branches now exchange terrain-relevant vocabulary each turn, throttled by how much of a branch's border touches that neighbour, so languages can converge as well as diverge

## [0.8.0] - 2026-07-17

### Added
- A new sound-change rule: a lost consonant causes the preceding vowel to lengthen in compensation (for example, "kast" becomes "kaːt")

<details>
<summary>0.7.1 and earlier</summary>

## [0.7.1] - 2026-07-16

No player-visible changes beyond what shipped in 0.7.0 below.

## [0.7.0] - 2026-07-12

### Added
- When a branch's territory splits, the larger surviving piece now keeps the original branch's name and history rather than both halves becoming brand-new languages; only the smaller piece splits off as a new branch
- Branches now earn era-appropriate names over time (Old, Middle, Late, Proto-) as their vocabulary diverges from its roots
- A much smaller branch bordering a dominant, near-identical neighbour can now be assimilated and die out, becoming a historical ancestor, with a warning shown a turn in advance

### Fixed
- Long vowels now display with a proper macron (ā, ē, ī, ō, ū) instead of raw internal notation
- A placeholder root-branch name that collided with the new era-naming vocabulary

### Changed
- The family tree now shows each branch's computed era-aware name instead of its raw stored name

## [0.6.0] - 2026-07-11

### Added
- New sound-change rules that rebuild word structure (breaking, epenthesis and word-final consonant insertion) balance out the purely erosive rules, so a branch's language keeps evolving indefinitely instead of grinding to a permanent halt once words wear down to minimal syllables
- Newly generated languages can start with diphthongs or long vowels in their sound inventory

## [0.5.1] - 2026-07-11

No player-visible changes beyond what shipped in 0.5.0.

## [0.5.0] - 2026-07-11

No player-visible changes. This release ships a terrain-linked vocabulary salience lookup with no call sites wiring it into play yet.

## [0.4.0] - 2026-07-11

### Changed
- Words closely tied to a branch's terrain (for example, mountain or fish words in the right environment) now erode more slowly than the rest of the lexicon, so geography shapes which words survive sound change

## [0.3.0] - 2026-07-11

No player-visible changes. This release ships a terrain-linked vocabulary salience lookup with no call sites wiring it into play yet, plus roadmap bookkeeping.

## [0.2.1] - 2026-07-11

No player-visible changes beyond what shipped in 0.2.0.

## [0.2.0] - 2026-07-11

### Changed
- Branches walled off by mountains and water now drift more idiosyncratically, favouring vowel changes, while branches with open borders to neighbours simplify their sounds instead

## [0.1.0] - 2026-07-11

### Added
- Generate a deterministic proto-language from a seed, complete with phoneme inventory, syllable template and starting lexicon, placed on a small terrain map
- Apply sound-change rules to drift a branch's lexicon over time
- Expand a branch's territory across passable terrain
- Branches fracture into mutually unintelligible daughter languages as geography divides them
- View intelligibility between branches, a family tree and a word table in the game dashboard

</details>

[Unreleased]: https://github.com/JasonWarrenUK/the-tongue/compare/v9.2.0...HEAD
[9.2.0]: https://github.com/JasonWarrenUK/the-tongue/compare/v9.1.0...v9.2.0
[9.1.0]: https://github.com/JasonWarrenUK/the-tongue/compare/v9.0.0...v9.1.0
[9.0.0]: https://github.com/JasonWarrenUK/the-tongue/compare/v8.0.0...v9.0.0
[8.0.0]: https://github.com/JasonWarrenUK/the-tongue/compare/v7.2.0...v8.0.0
[7.2.0]: https://github.com/JasonWarrenUK/the-tongue/compare/v7.1.1...v7.2.0
[7.1.1]: https://github.com/JasonWarrenUK/the-tongue/compare/v7.1.0...v7.1.1
[7.1.0]: https://github.com/JasonWarrenUK/the-tongue/compare/v7.0.2...v7.1.0
[7.0.2]: https://github.com/JasonWarrenUK/the-tongue/compare/v7.0.1...v7.0.2
[7.0.1]: https://github.com/JasonWarrenUK/the-tongue/compare/v7.0.0...v7.0.1
[7.0.0]: https://github.com/JasonWarrenUK/the-tongue/compare/v6.0.1...v7.0.0
[6.0.1]: https://github.com/JasonWarrenUK/the-tongue/compare/v6.0.0...v6.0.1
[6.0.0]: https://github.com/JasonWarrenUK/the-tongue/compare/v5.0.0...v6.0.0
[5.0.0]: https://github.com/JasonWarrenUK/the-tongue/compare/v4.0.0...v5.0.0
[4.0.0]: https://github.com/JasonWarrenUK/the-tongue/compare/v3.0.0...v4.0.0
[3.0.0]: https://github.com/JasonWarrenUK/the-tongue/compare/v2.0.1...v3.0.0
[2.0.1]: https://github.com/JasonWarrenUK/the-tongue/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/JasonWarrenUK/the-tongue/compare/v1.0.1...v2.0.0
[1.0.1]: https://github.com/JasonWarrenUK/the-tongue/compare/v1.0.0...v1.0.1
[1.0.0]: https://github.com/JasonWarrenUK/the-tongue/compare/v0.9.0...v1.0.0
[0.9.0]: https://github.com/JasonWarrenUK/the-tongue/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/JasonWarrenUK/the-tongue/compare/v0.7.1...v0.8.0
[0.7.1]: https://github.com/JasonWarrenUK/the-tongue/compare/v0.7.0...v0.7.1
[0.7.0]: https://github.com/JasonWarrenUK/the-tongue/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/JasonWarrenUK/the-tongue/compare/v0.5.1...v0.6.0
[0.5.1]: https://github.com/JasonWarrenUK/the-tongue/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/JasonWarrenUK/the-tongue/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/JasonWarrenUK/the-tongue/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/JasonWarrenUK/the-tongue/compare/v0.2.1...v0.3.0
[0.2.1]: https://github.com/JasonWarrenUK/the-tongue/compare/v0.2.0...v0.2.1
[0.2.0]: https://github.com/JasonWarrenUK/the-tongue/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/JasonWarrenUK/the-tongue/releases/tag/v0.1.0
