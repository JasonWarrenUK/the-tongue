import { BY_ID } from "./phonology";

// 1ENG.28 (1eng-25 spike §5, §6 slice 2) — runtime syllabification. Ships as a pure
// library with no engine call site: consumers are 1ENG.24 (stress, needs positional
// indexing and syllable weight via `coda`) and 4PHON.1 (tonogenesis, needs a
// tone-bearing unit). Derive on read, never cache — §5.2 measures that 29% of
// word-changing rule applications (apoc/paragoge/epenth/aphaer) alter syllable count,
// so a cache would be stale a third of the time it is read, and words are ≤MAX_LEN (12)
// segments, making the parse trivially cheap. Same principle as inventoryOf/eraLabels.

export interface Syllable {
  onset: string[];
  // null iff the syllable has no vowel — reachable via applyRuleToAffix's lifted
  // vowel floor. Widened from the spike's `string` (§5.1) because the spec's own
  // edge case (a vowelless syllable) has no value in that type, and a bare string
  // would let a stress/tone consumer silently key off "" instead of being forced
  // to handle the case.
  nucleus: string | null;
  coda: string[];
}

const isV = (id: string) => BY_ID[id]?.type === "V";

// Sonority hierarchy read off Phone.manner, the standard five-step scale; vowels are
// not manner-keyed so they resolve to 6 via a type check, not a table lookup.
export const SONORITY: Record<string, number> = { stop: 1, fric: 2, nasal: 3, liquid: 4, glide: 5 };
const sonority = (id: string): number => {
  const p = BY_ID[id];
  if (!p) return 0;
  return p.type === "V" ? 6 : (SONORITY[p.manner ?? ""] ?? 1);
};

// Onset maximisation, sonority-constrained — chosen on principle (§5.1), not measurement:
// the spike's own fork test found onset-max and a template-driven parse indistinguishable
// over the (then-monosyllabic) corpus. Template-driven is rejected because World.tmpl is
// drawn once at genesis and never updated — it describes the world's origin, not its
// present phonotactics (same staleness class 1ENG.23 §5 found in World.inv) — and because
// onset-max needs no World read at all, keeping this a pure function of the word.
//
// A consonant sequence between two nuclei is a legal complex onset iff sonority strictly
// rises toward the nucleus; the rest of the run falls back to the preceding coda.
export function syllabify(word: string[]): Syllable[] {
  const nuclei: number[] = [];
  word.forEach((id, i) => { if (isV(id)) nuclei.push(i); });
  // No vowel: the whole word is one onset-only syllable (applyRuleToAffix lifts the
  // vowel floor applyRuleToWord otherwise enforces, so this is reachable, if rare).
  if (!nuclei.length) return [{ onset: word.slice(), nucleus: null, coda: [] }];

  const out: Syllable[] = [];
  let start = 0;
  for (let n = 0; n < nuclei.length; n++) {
    const nuc = nuclei[n];
    const nextNuc = nuclei[n + 1];
    let end: number;
    if (nextNuc === undefined) end = word.length;
    else {
      // walk left from the next nucleus while sonority keeps rising toward it; the
      // furthest point reached becomes the next syllable's onset start
      let onsetStart = nextNuc;
      for (let k = nextNuc - 1; k > nuc; k--) {
        if (sonority(word[k]) < sonority(word[onsetStart])) onsetStart = k; else break;
      }
      end = onsetStart;
    }
    const span = word.slice(start, end);
    const nucIdx = span.findIndex((id) => isV(id));
    out.push({ onset: span.slice(0, nucIdx), nucleus: span[nucIdx], coda: span.slice(nucIdx + 1) });
    start = end;
  }
  return out;
}

export const syllableCount = (word: string[]): number => syllabify(word).length;
