import { pick } from "./rng";
import type { Inventory, Template, Lexicon, Terrain } from "./types";

export const CONCEPTS = ["water","fire","stone","tree","leaf","root","seed","fish","bird","dog","wolf","hand","eye","ear","tooth","bone","blood","skin","meat","sun","moon","star","sky","rain","wind","hill","river","path","house","night","day","snow"];

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

export function genInventory(rng: () => number): Inventory {
  const vowels = rng() < 0.2 ? ["i","a","u"] : ["i","e","a","o","u"];
  const cons = ["p","t","k","m","n","s","l"];
  const voiced = rng() < 0.7;
  if (voiced) cons.push("b","d","g");
  if (rng() < 0.7) cons.push("r");
  if (rng() < 0.6) cons.push("h");
  if (rng() < 0.5) cons.push("f");
  if (rng() < 0.45) cons.push("ʃ");
  if (rng() < 0.6) cons.push("j");
  if (rng() < 0.6) cons.push("w");
  if (rng() < 0.4) cons.push("ŋ");
  if (voiced && rng() < 0.4) cons.push("z");
  return { vowels, consonants: [...new Set(cons)] };
}

export function genTemplate(rng: () => number): Template {
  const r = rng();
  if (r < 0.3) return { onset: "req", coda: "none", clusters: false, label: "CV" };
  if (r < 0.55) return { onset: "req", coda: "opt", clusters: false, label: "CV(C)" };
  if (r < 0.8) return { onset: "opt", coda: "opt", clusters: false, label: "(C)V(C)" };
  return { onset: "opt", coda: "opt", clusters: true, label: "(C)(C)V(C)" };
}

function genSyllable(rng: () => number, inv: Inventory, t: Template): string[] {
  const s: string[] = [];
  const onset = t.onset === "req" ? true : rng() < 0.6;
  if (onset) { s.push(pick(inv.consonants, rng)); if (t.clusters && rng() < 0.25) s.push(pick(inv.consonants, rng)); }
  s.push(pick(inv.vowels, rng));
  if (t.coda === "opt" && rng() < 0.4) s.push(pick(inv.consonants, rng));
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
