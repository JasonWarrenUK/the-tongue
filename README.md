# The Tongue

A language-evolution simulator. Generate a proto-language from a seed, steer its sound changes, expand its territory, and watch it fracture into a family of mutually-(un)intelligible daughters as geography divides it.

**Live:** https://the-tongue.vercel.app

---

## What it is

Each world is generated from a numeric seed: a phoneme inventory, a syllable template, a 32-word lexicon, and a 4×3 terrain map. You play as the language community — spending influence to apply sound changes, expand into adjacent regions, and hold off autonomous drift. Seventeen sound-change rules cover both erosion (deletion, lenition, vowel shortening) and renewal (epenthesis, vowel breaking, compensatory lengthening), so a branch's phonology never grinds down to nothing and stays alive to change.

At the end of each generation:
- Untouched branches **drift** automatically, weighted toward cross-linguistically common rules and biased by terrain (open, well-connected branches favour contact-style changes; isolated branches favour isolation-style ones)
- Branches whose lexicon has drifted far enough from its last snapshot **enter a new naming era** (Old/Middle/Late, `Proto-` for shared ancestors)
- Communities **spread** into adjacent free territory
- A much smaller branch sustained beside a near-identical, dominant neighbour is **assimilated**, its territory absorbed and its lineage ended
- Any branch whose territory is split by impassable terrain **fractures** into daughter languages, each diverging from the parent via a birth drift step

Terrain also shapes vocabulary: concepts salient to a branch's dominant terrain (e.g. `snow`/`path` in mountains, `fish`/`river` by water) resist drift and hold onto their older forms longer.

The **mutual intelligibility matrix** tracks how far apart the family has grown, using normalised edit distance across the shared concept list as a proxy.

---

## Stack

- **SvelteKit 2** + **Svelte 5** (runes) + **TypeScript** (strict)
- **Tailwind CSS v4** (CSS-first, no config file) + **Reasonable Colors**
- **Vite 7** + **bun**

The engine (`src/lib/engine/`) is plain TypeScript with no framework dependency — deterministic per seed using a mulberry32 RNG.

---

## Getting started

```sh
bun install
bun run dev       # http://localhost:5173
bun run build
bun run check     # svelte-check (0 errors expected)
```

No environment variables or external services required.

---

## Project structure

```
src/lib/engine/     # deterministic game logic (no Svelte)
  types.ts          # shared interfaces
  rng.ts            # mulberry32 + hashRand
  lexicon.ts        # inventory, template, word generation, terrain salience
  phonology.ts      # phone table, 17 sound-change rules, collision detection
  intelligibility.ts
  tree.ts           # branch layout + colour
  geography.ts      # terrain, adjacency, passable components, isolation/assimilation
  naming.ts         # phonotactic stems, Old/Middle/Late/Proto- era-name collapse
  world.ts          # makeWorld, freshState
  generation.ts     # resolveGeneration (drift → rename → spread → assimilation → fracture → repool)

src/lib/game.svelte.ts   # reactive singleton (Svelte 5 $state / $derived)
src/lib/components/      # Map, family tree, intelligibility matrix, word table, change list, history, economy config
src/routes/+page.svelte  # wires everything together
```
