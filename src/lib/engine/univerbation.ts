import { hashRand } from "./rng";
import { CONCEPT_CLASS, conceptsOfClass } from "./lexicon";
import { formOf, homophoneForms, MAX_LEN } from "./phonology";
import { FRAMES, frameOrder } from "./syntax";
import type { ConceptClass } from "./lexicon";
import type { FrameWeights, HistoryEntry, Lexicon, WordOrder } from "./types";

// 1ENG.27 — phrase-level univerbation (1eng-25 spike §4). The engine erodes to 1.05
// syllables per word and stays there (spike §2), because every renewal rule it has
// works at the WORD level, where the only genuinely lengthening rule (`paragoge`) is
// locked out by a 97% V-final corpus (spike §2.3). The counter-erosive forces in real
// languages live in connected speech instead — `hlaf weard` -> lord, `dæges eage` ->
// daisy — and 1ENG.19 already shipped the substrate for that (FRAMES/frameOrder). The
// defect spike §3 names is that all eight consumers of that substrate read it as a
// SCALAR: the engine knows which words stand next to each other and uses that only to
// erode them faster. This module is the first consumer that reads ADJACENCY.

export const UNIVERB_RATE = 0.06;      // per eligible concept per turn; fitted to land
                                        // syll/word in 1.6-2.0 across 300 turns (spike
                                        // §4.2). First-pass tuning, same ledger treatment
                                        // as SYNTAX_STRENGTH/BIAS_STRENGTH — 2SIM.1 owns
                                        // the re-fit with every mechanic active.
export const UNIVERB_MAX_SEGMENTS = 2; // "short word" pressure threshold (spike §4.1).
                                        // Our operationalisation of the attested trigger
                                        // direction (languages compound to restore
                                        // contrast), not a measured threshold — flagged
                                        // as such in the spike's honesty ledger §7.

// Classes that may PRECEDE `cls` in this branch's linearised frames — the modifier
// position — each carrying the weight of the frame it was read off. Walks the same
// frameOrder spine positionProfile/followerVowelShare use (syntax.ts's own `linearised`
// is not exported, so re-walk FRAMES here), so the statistics can never disagree about
// what an utterance looks like. proDrop is deliberately NOT a parameter (spike §4.1
// specifies `frameOrder(f, order, false)`): pro-drop is a property of how a clause is
// UTTERED, while univerbation fuses a collocation that existed whether or not this
// branch currently drops its subject. A branch's word order therefore decides what it
// can fuse with — an AdjN branch compounds adjective+noun, an NAdj branch does not.
// Pure, no RNG.
export function precedersOf(cls: ConceptClass, order: WordOrder, weights: FrameWeights): { cls: ConceptClass; w: number }[] {
  const out: { cls: ConceptClass; w: number }[] = [];
  FRAMES.forEach((f, i) => {
    const slots = frameOrder(f, order, false);
    for (let j = 0; j < slots.length - 1; j++) if (slots[j + 1].class === cls) out.push({ cls: slots[j].class, w: weights[i] });
  });
  return out;
}

// One branch-turn of univerbation (spike §4.1). Per CONCEPT, not per branch: real
// collocations fuse independently and permanently, and the one-per-branch variant was
// measured to reach only 1.30 syll/word even at rate 0.35 — swamped by erosion acting
// on all 48 words at once.
//
// Salt (seed+43, turn*283+71+2k, branchId*769+i) for k = fire/class/modifier (0/1/2).
// First coordinate disjoint from every registered family (spread/genStem: seed, drift:
// seed+7, salience: seed+13, borrow: seed+19, contact: seed+23, syntax gate: seed+29,
// frame walk: seed+31, reanalysis: seed+37, morphology: seed+41). The three draws share
// that first coordinate and separate on the SECOND — morphology.ts's idiom for two
// families under one salt (placement seed+41/turn*269+61 vs erosion-block seed+41/
// turn*271+67), not the prototype script's stacked third-coordinate offsets (those are
// safe only because 1000 mod 433 = 134 exceeds the current 48-concept max index — an
// unstated coupling to CONCEPTS.length that breaks the moment the lexicon grows past
// it). Here b differs by 2 between draws while consecutive turns differ by 283 (prime),
// so no (turn, k) pair can ever alias regardless of branch/index; c = branchId*769 + i
// keeps 769 - CONCEPTS.length of headroom, safe for any lexicon up to 769 concepts.
export function resolveUniverbation(
  lex: Lexicon, order: WordOrder, weights: FrameWeights,
  seed: number, turn: number, branchId: number,
): { lex: Lexicon; events: HistoryEntry[] } {
  // read ONCE against the turn-start (post-repair) lexicon: within one branch-turn every
  // concept is judged against the same homophony picture, so an early fusion in the map
  // below can't silently disqualify a later concept that was equally pressured.
  const homophones = homophoneForms(lex);
  const events: HistoryEntry[] = [];
  const draw = (i: number, k: number) => hashRand(seed + 43, turn * 283 + 71 + 2 * k, branchId * 769 + i);
  const next = lex.map((entry, i) => {
    const cls = CONCEPT_CLASS[entry.concept];
    if (!cls) return entry; // unknown concept (a fixture's ad hoc lexicon) — never fuses, mirroring syntaxMult
    // trigger: contrast pressure, either arm (spike §4.1). homophoneForms returns
    // GRAPHEMIC forms, so the membership test must go through formOf, not the id list.
    if (entry.word.length > UNIVERB_MAX_SEGMENTS && !homophones.has(formOf(entry.word))) return entry;
    if (draw(i, 0) >= UNIVERB_RATE) return entry;
    const preceders = precedersOf(cls, order, weights);
    if (!preceders.length) return entry; // no frame ever places anything before this class
    const total = preceders.reduce((a, p) => a + p.w, 0);
    let roll = draw(i, 1) * total;
    let picked = preceders[0];
    for (const p of preceders) { roll -= p.w; if (roll <= 0) { picked = p; break; } }
    // conceptsOfClass returns lexicon.ts's LIVE internal array — never sort or splice
    // it, only index into it.
    const members = conceptsOfClass(picked.cls);
    const modifier = lex.find((e) => e.concept === members[Math.floor(draw(i, 2) * members.length)]);
    // the drawn concept may not be in this branch's lexicon (fixtures, and any future
    // partial lexicon), and a word can never modify itself into a reduplication — spike
    // §2.2 measured reduplication produces length without ever creating a cluster.
    if (!modifier || modifier.concept === entry.concept) return entry;
    // reuse the existing growth ceiling rather than inventing one (spike §4.1). Unlike
    // compoundWord, which may transiently exceed MAX_LEN because it clips, this keeps
    // both stems whole, so the check has to be a hard skip.
    if (entry.word.length + modifier.word.length > MAX_LEN) return entry;
    const word = [...modifier.word, ...entry.word]; // modifier + head, BOTH whole (spike §4.1) — no
                                                      // clipping, which is precisely what neuters
                                                      // 2LEX.2's compound repair (spike §2.1)
    // No `drift` flag: univerbation is an autonomous grammatical event, and the
    // 2GEO.4/2LEX.1 ruling morphology.ts follows keeps those out of the sound-change
    // accounting — collision's own "Disambiguation" entry is unflagged for the same
    // reason. No `report` either: this IS a distinct change, not a retelling of one, so
    // any per-branch change count must see it.
    events.push({ name: "Univerbation", note: `'${entry.concept}' fused with '${modifier.concept}' → ${formOf(word)}` });
    return { ...entry, word };
  });
  return { lex: next, events };
}
