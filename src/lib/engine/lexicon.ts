import { pick, pickRanked } from "./rng";
import type { Inventory, Template, Lexicon, Terrain } from "./types";

// The 32 original concepts, now the noun class's membership rather than the whole
// substrate (1ENG.19 grew CONCEPTS to cover verb/pronoun/adjective too — see below).
// Never reorder: indices 0..31 are load-bearing (2LEX.1's yieldingConcept tie-break,
// borrowing.ts's CONCEPTS-order iteration).
const NOUNS = ["water","fire","stone","tree","leaf","root","seed","fish","bird","dog","wolf","hand","eye","ear","tooth","bone","blood","skin","meat","sun","moon","star","sky","rain","wind","hill","river","path","house","night","day","snow"];

// 2LEX.2 word classes (1ENG.14's grammar substrate), introduced early for the
// collision-severity class gate (2lex-1 spike §3.1: same-class collisions are the
// ones a language actually fights to avoid — Wedel et al. 2013). Must stay in
// lockstep with the CLASSES map in docs/spikes/assets/2lex-1-semantic-distance-gen.ts,
// which generated the shipped semantic-distance.json from exactly this grouping.
export type ConceptClass = "noun" | "verb" | "pronoun" | "adjective";
const CLASS_MEMBERS: Record<ConceptClass, string[]> = {
  noun: NOUNS,
  verb: ["eat", "drink", "see", "sleep", "die", "give", "go", "say", "finish"],
  pronoun: ["i", "you", "we"],
  adjective: ["big", "small", "new", "old"],
};
export const CONCEPT_CLASS: Record<string, ConceptClass> = Object.fromEntries(
  Object.entries(CLASS_MEMBERS).flatMap(([cls, words]) => words.map((w) => [w, cls as ConceptClass])),
);
// Canonical order over the FULL 48-concept substrate (noun/verb/pronoun/adjective,
// same order as CLASS_MEMBERS/the distance-table generator's CLASSES), for collision.ts
// to enumerate/tie-break candidates across every class rather than just the 32 nouns.
export const SUBSTRATE_ORDER: string[] = Object.values(CLASS_MEMBERS).flat();
// 1ENG.19: CONCEPTS IS the substrate now — genLexicon generates a word for every
// class, not just nouns. Indices 0..31 are unchanged (SUBSTRATE_ORDER opens with the
// noun list), so every index-based tie-break survives untouched. A copy, not an alias
// of SUBSTRATE_ORDER: two exported arrays sharing referential identity is a trap for
// a future `CONCEPTS.push(...)`.
export const CONCEPTS = [...SUBSTRATE_ORDER];

// 2GEO.3 Axis B — physical terrain sets per-concept salience; salient concepts
// resist drift/loss. Graded: core-salient 0.5, secondary 0.25, else 0.
// Source: 2GEO.1 spike §4 (docs/spikes/2geo-1-terrain-sound-change.md:157-161).
const SALIENCE_CORE: Record<Terrain, string[]> = {
  mountain: ["stone", "hill"],
  hill: ["stone", "hill"],
  water: ["fish", "river"],
  plain: ["sky", "wind"],
};
const SALIENCE_SECONDARY: Record<Terrain, string[]> = {
  mountain: ["snow", "path", "bone"],
  hill: ["snow", "path", "bone"],
  water: ["water", "wind", "star"],
  plain: ["bird", "path", "water"],
};

// Retention weight in [0,1): higher = more drift-resistant. Slice 2 will scale
// effective drift probability by (1 - salienceRetention(concept, terrain)).
export function salienceRetention(concept: string, terrain: Terrain): number {
  if (SALIENCE_CORE[terrain].includes(concept)) return 0.5;
  if (SALIENCE_SECONDARY[terrain].includes(concept)) return 0.25;
  return 0;
}

// 2GEO.4/2GEO.5 — concepts a lender is eligible to lend: salient to ITS OWN dominant
// terrain (non-zero retention). Environment-neutral basics (eye, tooth, sun...) have
// zero salience under every terrain, so they're never borrowable — matching Tadmor's
// WOLD finding that basic vocabulary resists borrowing (2geo-4 spike §2, §3.1).
export function borrowableConcepts(lenderTerrain: Terrain): string[] {
  return CONCEPTS.filter((c) => salienceRetention(c, lenderTerrain) > 0);
}

// 1ENG.19: a class's members in SUBSTRATE_ORDER, for PhrasePanel's deterministic
// slot fill (the Nth noun slot in a frame takes the Nth noun in this list).
export function conceptsOfClass(cls: ConceptClass): string[] {
  return CLASS_MEMBERS[cls];
}

// 1ENG.12 renewal phones (1eng-11 spike §4.4) — seeded into starting inventories, not
// only produced by drift, so a fresh world can already have complexity for erosion
// (smooth/shorten) to grip from turn 0.
const DIPHTHONGS = ["ie", "uo", "ei", "ou", "au", "ai"];
const LONG_VOWELS = ["iː", "eː", "aː", "oː", "uː"];

// 1ENG.17 (1eng-16 spike §7 slice 1, amended): the pre-1ENG.17 gate order below built
// `cons` by PUSH order, so index 7+ was whichever optional consonant's gate happened to
// pass first for this seed — not a frequency rank at all, just draw order. pickRanked
// needs the input array's index to MEAN something (markedness-descending), so this is a
// fixed canonical order, independent of which gates pass. Same members, same gates, same
// number/sequence of rng() draws as before (only the OUTPUT ORDER changes) — draw-count
// parity is load-bearing, see pickRanked's own comment in rng.ts.
const CONSONANT_RANK = ["p","t","k","m","n","s","l","b","d","g","r","h","f","ʃ","j","w","ŋ","z"];

export function genInventory(rng: () => number): Inventory {
  const vowels = rng() < 0.2 ? ["i","a","u"] : ["i","e","a","o","u"];
  if (rng() < 0.3) vowels.push(pick(DIPHTHONGS, rng));
  if (rng() < 0.25) vowels.push(pick(LONG_VOWELS, rng));
  const present = new Set(["p","t","k","m","n","s","l"]);
  const voiced = rng() < 0.7;
  if (voiced) { present.add("b"); present.add("d"); present.add("g"); }
  if (rng() < 0.7) present.add("r");
  if (rng() < 0.6) present.add("h");
  if (rng() < 0.5) present.add("f");
  if (rng() < 0.45) present.add("ʃ");
  if (rng() < 0.6) present.add("j");
  if (rng() < 0.6) present.add("w");
  if (rng() < 0.4) present.add("ŋ");
  if (voiced && rng() < 0.4) present.add("z");
  return { vowels, consonants: CONSONANT_RANK.filter((c) => present.has(c)) };
}

export function genTemplate(rng: () => number): Template {
  const r = rng();
  if (r < 0.3) return { onset: "req", coda: "none", clusters: false, label: "CV" };
  if (r < 0.55) return { onset: "req", coda: "opt", clusters: false, label: "CV(C)" };
  if (r < 0.8) return { onset: "opt", coda: "opt", clusters: false, label: "(C)V(C)" };
  return { onset: "opt", coda: "opt", clusters: true, label: "(C)(C)V(C)" };
}

// 1ENG.17 slice 1: pickRanked over inv.consonants/inv.vowels, gen's geometric dropoff —
// earlier (more typologically core / markedness-unmarked) members draw more often. The
// two genInventory picks (DIPHTHONGS, LONG_VOWELS) stay `pick` (uniform): those lists
// aren't frequency-ordered, and which diphthong a world has isn't a frequency question.
function genSyllable(rng: () => number, inv: Inventory, t: Template): string[] {
  const s: string[] = [];
  const onset = t.onset === "req" ? true : rng() < 0.6;
  if (onset) { s.push(pickRanked(inv.consonants, rng)); if (t.clusters && rng() < 0.25) s.push(pickRanked(inv.consonants, rng)); }
  s.push(pickRanked(inv.vowels, rng));
  if (t.coda === "opt" && rng() < 0.4) s.push(pickRanked(inv.consonants, rng));
  return s;
}
function genWord(rng: () => number, inv: Inventory, t: Template): string[] {
  const n = rng() < 0.5 ? 1 : 2;
  let w: string[] = [];
  for (let i = 0; i < n; i++) w = w.concat(genSyllable(rng, inv, t));
  return w;
}
export function genLexicon(rng: () => number, inv: Inventory, t: Template): Lexicon {
  const used = new Set<string>();
  return CONCEPTS.map((concept) => {
    let w: string[], form: string, tries = 0;
    do { w = genWord(rng, inv, t); form = w.join(""); tries++; } while (used.has(form) && tries < 25);
    used.add(form);
    return { concept, word: w };
  });
}
