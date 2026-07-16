import { hashRand } from "./rng";
import { salienceRetention } from "./lexicon";
import type { Phone, PhoneType, Patch, Rule, RuleCategory, Lexicon, Terrain, Seg, XformResult } from "./types";

const C = (id: string, place: string, manner: string, voice: boolean): Phone =>
  ({ id, g: id, type: "C", place, manner, voice, obstruent: manner === "stop" || manner === "fric" });
const V = (id: string, height: string, back: boolean, round: boolean): Phone =>
  ({ id, g: id, type: "V", height, back, round });
// 1ENG.12 renewal phones — see 1eng-11 spike §4.1. Long vowels carry the base vowel's
// features + long:true; diphthongs are structurally distinct (no height/back/round),
// matched instead on nucleus/offglide.
// id keeps the IPA length-mark suffix (internal key, used for matching/rules); g (the
// displayed grapheme) uses a macron instead, so long vowels render as ā/ē/ī/ō/ū.
const MACRON: Record<string, string> = { a: "ā", e: "ē", i: "ī", o: "ō", u: "ū" };
const VL = (base: Phone): Phone => ({ ...base, id: base.id + "ː", g: MACRON[base.g] ?? base.g + "ː", long: true });
const VD = (id: string, nucleus: string, offglide: string): Phone =>
  ({ id, g: id, type: "V", diph: true, nucleus, offglide });

const [I, E, A, O, U] = [V("i","high",false,false), V("e","mid",false,false), V("a","low",false,false), V("o","mid",true,true), V("u","high",true,true)];

export const PHONES: Phone[] = [
  C("p","lab","stop",false),C("b","lab","stop",true),C("t","alv","stop",false),C("d","alv","stop",true),C("k","vel","stop",false),C("g","vel","stop",true),
  C("f","lab","fric",false),C("v","lab","fric",true),C("s","alv","fric",false),C("z","alv","fric",true),C("ʃ","pal","fric",false),C("ʒ","pal","fric",true),C("x","vel","fric",false),C("ɣ","vel","fric",true),C("h","glo","fric",false),
  C("m","lab","nasal",true),C("n","alv","nasal",true),C("ŋ","vel","nasal",true),C("l","alv","liquid",true),C("r","alv","liquid",true),C("j","pal","glide",true),C("w","lab","glide",true),
  I, E, A, O, U,
  VL(I), VL(E), VL(A), VL(O), VL(U),
  VD("ie","i","e"), VD("uo","u","o"), VD("ei","e","i"), VD("ou","o","u"), VD("au","a","u"), VD("ai","a","i"),
];
export const BY_ID: Record<string, Phone> = Object.fromEntries(PHONES.map((p) => [p.id, p]));

function resolve(type: PhoneType, f: Record<string, unknown>): string | null {
  const m = PHONES.find((p) => {
    if (p.type !== type) return false;
    if (type === "V") {
      if (f.diph) return !!p.diph && p.nucleus === f.nucleus && p.offglide === f.offglide;
      if (f.long) return !p.diph && !!p.long && p.height === f.height && p.back === f.back && p.round === f.round;
      return !p.diph && !p.long && p.height === f.height && p.back === f.back && p.round === f.round;
    }
    return p.place === f.place && p.manner === f.manner && p.voice === f.voice;
  });
  return m ? m.id : null;
}
function applyXform(ph: Phone, patch: Patch): string | null {
  if (patch.delete) return null;
  if (ph.type === "V") return resolve("V", { height: ph.height, back: ph.back, round: ph.round, ...patch });
  return resolve("C", { place: ph.place, manner: ph.manner, voice: ph.voice, ...patch });
}

const isV = (p: Phone | null) => !!p && p.type === "V";
const isC = (p: Phone | null) => !!p && p.type === "C";
const frontV = (p: Phone | null) => isV(p) && !p!.back;
const stopC = (p: Phone | null) => isC(p) && p!.manner === "stop";
const bound = (p: Phone | null) => p === null;

// w = cross-linguistic naturalness weight, biases autonomous drift
// category = terrain contact/isolation bias axis (2GEO.2) — see biasedMult below
export const RULES: Rule[] = [
  { id:"voice", name:"Intervocalic voicing", note:"voiceless stop → voiced / V _ V", w:3, category:"lenition", match:(p)=>isC(p)&&p.manner==="stop"&&!p.voice, pre:isV, post:isV, xform:()=>({voice:true}) },
  { id:"spirant", name:"Intervocalic spirantisation", note:"voiceless stop → fricative / V _ V", w:2.5, category:"lenition", match:(p)=>isC(p)&&p.manner==="stop"&&!p.voice, pre:isV, post:isV, xform:()=>({manner:"fric"}) },
  { id:"devoice", name:"Final devoicing", note:"voiced obstruent → voiceless / _ #", w:3, category:"deletion", match:(p)=>isC(p)&&!!p.obstruent&&!!p.voice, pre:null, post:bound, xform:()=>({voice:false}) },
  { id:"apoc", name:"Apocope (final vowel loss)", note:"vowel → ∅ / _ #", w:3, category:"deletion", match:isV, pre:null, post:bound, xform:()=>({delete:true}) },
  { id:"finalC", name:"Final consonant loss", note:"consonant → ∅ / _ #", w:2, category:"deletion", match:isC, pre:null, post:bound, xform:()=>({delete:true}) },
  { id:"palat", name:"Palatalisation", note:"velar stop → palatal fricative / _ front V", w:2.5, category:"assimilation", match:(p)=>isC(p)&&p.place==="vel"&&p.manner==="stop", pre:null, post:frontV, xform:()=>({place:"pal",manner:"fric"}) },
  { id:"debucc", name:"Debuccalisation", note:"s → h / _ #", w:1.5, category:"lenition", match:(p)=>isC(p)&&p.place==="alv"&&p.manner==="fric"&&!p.voice, pre:null, post:bound, xform:()=>({place:"glo"}) },
  { id:"raise", name:"Final vowel raising", note:"mid vowel → high / _ #", w:2.5, category:"vowelShift", match:(p)=>isV(p)&&p.height==="mid", pre:null, post:bound, xform:()=>({height:"high"}) },
  { id:"nasassim", name:"Nasal place assimilation", note:"nasal → [place of stop] / _ stop", w:3, category:"assimilation", match:(p)=>isC(p)&&p.manner==="nasal", pre:null, post:stopC, xform:(_p,ctx)=>({place:ctx.post!.place}) },
  { id:"cluster", name:"Cluster reduction", note:"consonant → ∅ / _ C", w:2, category:"deletion", match:isC, pre:null, post:isC, xform:()=>({delete:true}) },
  // 1ENG.12 renewal + the erosion rules that consume it — see 1eng-11 spike §3.2/§3.3.
  // epenth and break rebuild structure (clusters/hiatus broken, mid V -> diphthong);
  // smooth and shorten are erosion's grip on that new structure, closing the cycle.
  //
  // Both epenth (needs a cluster) and a mid-vowel-only break (needs pre-existing hiatus)
  // can only exploit structure erosion hasn't fully consumed yet — neither can fire on
  // an already-minimal CV/V word, which is exactly the state ossification converges to
  // (verified empirically: a bare [C]V word has zero firing rules under the original 9 +
  // those two alone). paragoge and a broadened break are the two bootstrap mechanisms
  // that give renewal a foothold on that floor itself.
  { id:"epenth", name:"Anaptyxis", note:"∅ → V / C _ C  (cluster breaking)", w:2, category:"epenthesis",
    match:isC, pre:null, post:isC,
    xform:()=>[
      { from:"self", patch:{} },
      { from:"abs", type:"V", patch:{ height:"high", back:false, round:false } },
    ] },
  { id:"paragoge", name:"Paragoge", note:"∅ → V / C _ #  (unconditioned word-final vowel epenthesis)", w:1.5, category:"epenthesis",
    match:isC, pre:null, post:bound,
    xform:()=>[
      { from:"self", patch:{} },
      { from:"abs", type:"V", patch:{ height:"high", back:false, round:false } },
    ] },
  // Unconditioned breaking (real: cf. the Great Vowel Shift) — any final vowel may
  // diphthongise, not only a pre-existing mid vowel after hiatus. This is the second
  // bootstrap: it fires on the [C]V floor itself, where post:bound is the only
  // environment left once hiatus and mid vowels have both eroded away.
  { id:"break", name:"Vowel breaking", note:"V → diphthong / _ #  (unconditioned; e→ie, a→ai, u→uo…)", w:2.5, category:"vowelShift",
    match:isV, pre:null, post:bound,
    xform:(p)=>[
      { from:"abs", type:"V", patch: p.back ? { diph:true, nucleus:"u", offglide:"o" } : { diph:true, nucleus:"i", offglide:"e" } },
    ] },
  { id:"smooth", name:"Monophthongisation", note:"diphthong → mid V  (ie→e, uo→o)", w:2.5, category:"lenition",
    match:(p)=>isV(p)&&!!p.diph, pre:null, post:null,
    xform:(p)=>{
      const back = p.nucleus === "u" || p.nucleus === "o";
      return [{ from:"abs", type:"V", patch:{ height:"mid", back, round:back } }];
    } },
  { id:"shorten", name:"Vowel shortening", note:"long V → short / _ #", w:2, category:"deletion",
    match:(p)=>isV(p)&&!!p.long, pre:null, post:bound,
    xform:()=>({ long:false }) },
  // 1ENG.13 — compensatory lengthening (shorten's inverse: produces the long vowels
  // shorten consumes). Deferred by the 1eng-11 spike §8 pending long-vowel phones
  // (added by 1ENG.12); split medial/final exactly as epenth/paragoge (§4.2) were,
  // since firing on the coda (not the vowel) keeps both environments expressible with
  // a single-step pre/post — see lengthensPrev above for the reach-back mechanism.
  { id:"compleng", name:"Compensatory lengthening", note:"C → ∅ / V _ C  (coda absorbed, vowel lengthened)",
    w:2, category:"deletion",
    match:(p)=>isC(p)&&!!p.obstruent, pre:isV, post:isC,
    xform:()=>({ delete:true }), lengthensPrev:true },
  { id:"complengFinal", name:"Final compensatory lengthening", note:"C → ∅ / V _ #  (final coda absorbed, vowel lengthened)",
    w:2, category:"deletion",
    match:(p)=>isC(p)&&!!p.obstruent, pre:isV, post:bound,
    xform:()=>({ delete:true }), lengthensPrev:true },
];
export const RULE_BY_ID: Record<string, Rule> = Object.fromEntries(RULES.map((r) => [r.id, r]));

// 1ENG.12: resolve one output Seg against the phone it was matched at. "self" reuses
// the pre-1ENG.12 applyXform path (diff-from-input); "abs" resolves a brand-new
// segment from the patch alone (an inserted/broken-off phone with no source to diff
// against). See 1eng-11 spike §3.
function resolveSeg(input: Phone, seg: Seg): string | null {
  if (seg.from === "self") return applyXform(input, seg.patch);
  return resolve(seg.type, seg.patch as Record<string, unknown>);
}
// Normalise a rule's xform result to Seg[]. A legacy Patch (the pre-1ENG.12 shape,
// still used by all 9 original rules plus `shorten`) becomes a single self-seg, or
// no segs at all if it deletes — reproducing the old delete/guard semantics exactly.
function normalise(r: XformResult): Seg[] {
  if (Array.isArray(r)) return r;
  return r.delete ? [] : [{ from: "self", patch: r }];
}

export const MAX_LEN = 12; // ~4-5 syllables; growth ceiling, symmetric with the min-vowel floor below

export function applyRuleToWord(ids: string[], rule: Rule): { ids: string[]; changed: boolean } {
  const ph = ids.map((id) => BY_ID[id]);
  const out: string[] = [];
  let changed = false;
  for (let i = 0; i < ph.length; i++) {
    const p = ph[i];
    const pre = i > 0 ? ph[i - 1] : null;
    const post = i < ph.length - 1 ? ph[i + 1] : null;
    const hit = rule.match(p) && (rule.pre ? rule.pre(pre) : true) && (rule.post ? rule.post(post) : true);
    if (!hit) { out.push(p.id); continue; }
    const before = out.length;
    for (const s of normalise(rule.xform(p, { pre, post }))) {
      const nid = resolveSeg(p, s);
      if (nid !== null) out.push(nid); // an unresolvable seg is dropped, as delete was pre-1ENG.12
    }
    const slice = out.slice(before);
    if (slice.length !== 1 || slice[0] !== p.id) changed = true;
    // 1ENG.13: compensatory lengthening. The coda just deleted itself above; reach back
    // and lengthen the vowel it left behind. Safe because rule.pre === isV guarantees the
    // input phone before this coda was a vowel, and only one rule runs per call, so
    // out[out.length-1] is exactly that vowel's (unchanged, since it didn't match) output.
    if (rule.lengthensPrev && out.length > 0) {
      const long = applyXform(BY_ID[out[out.length - 1]], { long: true });
      if (long !== null) { out[out.length - 1] = long; changed = true; }
    }
  }
  if (out.length === 0 || !out.some((id) => BY_ID[id].type === "V")) return { ids, changed: false }; // floor
  if (out.length > MAX_LEN && out.length > ids.length) return { ids, changed: false };               // ceiling
  return { ids: out, changed };
}
// 2GEO.3 Axis B — physical terrain sets per-concept salience (2geo-1 spike §4).
// Optional context: when supplied, a word that would change is scaled by
// (1 - salienceRetention(concept, terrain)) via a deterministic per-word roll,
// so salient-domain concepts resist drift. Omitted for firingRules' selection
// pass so drift-rule weighting stays terrain-agnostic, matching pre-2GEO.3 behaviour.
export interface SalienceContext { terrain: Terrain; seed: number; turn: number; branchId: number }
export function applyRuleToLex(lex: Lexicon, rule: Rule, salience?: SalienceContext): { lex: Lexicon; fires: number } {
  let fires = 0;
  const next = lex.map((e, i) => {
    const r = applyRuleToWord(e.word, rule);
    if (!r.changed) return { ...e, word: r.ids };
    if (salience) {
      const retention = salienceRetention(e.concept, salience.terrain);
      const roll = hashRand(salience.seed + 13, salience.turn * 151 + 29, salience.branchId * 733 + i);
      if (roll < retention) return e; // blocked: word keeps its pre-rule form
    }
    fires++;
    return { ...e, word: r.ids };
  });
  return { lex: next, fires };
}
export const formOf = (w: string[]): string => w.map((id) => BY_ID[id].g).join("");

export function collisionPairs(lex: Lexicon): number {
  const m: Record<string, string[]> = {};
  lex.forEach((e) => { const f = formOf(e.word); (m[f] = m[f] || []).push(e.concept); });
  return Object.values(m).reduce((a, g) => a + (g.length * (g.length - 1)) / 2, 0);
}
export function homophoneForms(lex: Lexicon): Set<string> {
  const m: Record<string, number> = {};
  lex.forEach((e) => { const f = formOf(e.word); m[f] = (m[f] || 0) + 1; });
  return new Set(Object.keys(m).filter((f) => m[f] > 1));
}
export function firingRules(lex: Lexicon) {
  return RULES.map((r) => ({ rule: r, fires: applyRuleToLex(lex, r).fires })).filter((x) => x.fires > 0);
}
// Terrain contact/isolation bias (2GEO.2): contact-favoured categories fire more
// often for open/high-contact branches, isolation-favoured categories fire more
// often for walled-off branches. Naturalness weight (w) stays dominant — this is
// a gentle multiplier, never zeroing or dominating a rule. See 2GEO.1 spike §3.3.
export const BIAS_STRENGTH = 0.7;
export const CATEGORY_AFFINITY: Record<RuleCategory, number> = {
  deletion: 1.0, lenition: 0.7, assimilation: 0.4, vowelShift: -1.0,
  epenthesis: -0.8, // isolation-favoured (complexity-building) — 1eng-11 spike §5
};
export function biasedMult(category: RuleCategory, iso: number): number {
  const tilt = 1 - 2 * iso; // contact tilt ∈ [-1,+1]: +1 fully open, -1 fully walled
  return Math.min(2, Math.max(0.5, 1 + BIAS_STRENGTH * CATEGORY_AFFINITY[category] * tilt));
}
export function driftRule(lex: Lexicon, seed: number, turn: number, branchId: number, iso: number): Rule | null {
  const firing = firingRules(lex);
  if (!firing.length) return null;
  const weighted = firing.map((x) => ({ rule: x.rule, weight: x.rule.w * biasedMult(x.rule.category, iso) }));
  const total = weighted.reduce((a, x) => a + x.weight, 0);
  let roll = hashRand(seed + 7, turn * 131 + 17, branchId * 911 + 3) * total;
  for (const x of weighted) { roll -= x.weight; if (roll <= 0) return x.rule; }
  return weighted[weighted.length - 1].rule;
}
