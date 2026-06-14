# The Tongue

A language-evolution simulator. Generate a proto-language from a seed, steer its sound changes, expand its territory, and watch it fracture into a family of mutually-(un)intelligible daughters as geography divides it.

**Live:** https://the-tongue.vercel.app

---

## What it is

Each world is generated from a numeric seed: a phoneme inventory, a syllable template, a 32-word lexicon, and a 4×3 terrain map. You play as the language community — spending influence to apply sound changes, expand into adjacent regions, and hold off autonomous drift.

At the end of each generation:
- Untouched branches **drift** automatically (weighted toward cross-linguistically common rules)
- Communities **spread** into adjacent free territory
- Any branch whose territory is split by impassable terrain **fractures** into daughter languages

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
  lexicon.ts        # inventory, template, word generation
  phonology.ts      # phone table, 10 sound-change rules, collision detection
  intelligibility.ts
  tree.ts           # branch layout + colour
  geography.ts      # terrain, adjacency, passable components
  world.ts          # makeWorld, freshState
  generation.ts     # resolveGeneration (drift → spread → fracture → repool)

src/lib/game.svelte.ts   # reactive singleton (Svelte 5 $state / $derived)
src/lib/components/      # presentational Svelte components
src/routes/+page.svelte  # wires everything together
```
