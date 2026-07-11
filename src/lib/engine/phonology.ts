import { hashRand } from "./rng";
import type { Phone, PhoneType, Patch, Rule, RuleCategory, Lexicon } from "./types";

const C = (id: string, place: string, manner: string, voice: boolean): Phone =>
  ({ id, g: id, type: "C", place, manner, voice, obstruent: manner === "stop" || manner === "fric" });
const V = (id: string, height: string, back: boolean, round: boolean): Phone =>
  ({ id, g: id, type: "V", height, back, round });

export const PHONES: Phone[] = [
  C("p","lab","stop",false),C("b","lab","stop",true),C("t","alv","stop",false),C("d","alv","stop",true),C("k","vel","stop",false),C("g","vel","stop",true),
  C("f","lab","fric",false),C("v","lab","fric",true),C("s","alv","fric",false),C("z","alv","fric",true),C("ʃ","pal","fric",false),C("ʒ","pal","fric",true),C("x","vel","fric",false),C("ɣ","vel","fric",true),C("h","glo","fric",false),
  C("m","lab","nasal",true),C("n","alv","nasal",true),C("ŋ","vel","nasal",true),C("l","alv","liquid",true),C("r","alv","liquid",true),C("j","pal","glide",true),C("w","lab","glide",true),
  V("i","high",false,false),V("e","mid",false,false),V("a","low",false,false),V("o","mid",true,true),V("u","high",true,true),
];
export const BY_ID: Record<string, Phone> = Object.fromEntries(PHONES.map((p) => [p.id, p]));

function resolve(type: PhoneType, f: Record<string, unknown>): string | null {
  const m = PHONES.find((p) => {
    if (p.type !== type) return false;
    if (type === "V") return p.height === f.height && p.back === f.back && p.round === f.round;
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
];
export const RULE_BY_ID: Record<string, Rule> = Object.fromEntries(RULES.map((r) => [r.id, r]));

export function applyRuleToWord(ids: string[], rule: Rule): { ids: string[]; changed: boolean } {
  const ph = ids.map((id) => BY_ID[id]);
  const out: string[] = [];
  let changed = false;
  for (let i = 0; i < ph.length; i++) {
    const p = ph[i];
    const pre = i > 0 ? ph[i - 1] : null;
    const post = i < ph.length - 1 ? ph[i + 1] : null;
    const hit = rule.match(p) && (rule.pre ? rule.pre(pre) : true) && (rule.post ? rule.post(post) : true);
    if (hit) {
      const nid = applyXform(p, rule.xform(p, { pre, post }));
      if (nid === null) { changed = true; continue; }
      out.push(nid); if (nid !== p.id) changed = true;
    } else out.push(p.id);
  }
  if (out.length === 0 || !out.some((id) => BY_ID[id].type === "V")) return { ids, changed: false };
  return { ids: out, changed };
}
export function applyRuleToLex(lex: Lexicon, rule: Rule): { lex: Lexicon; fires: number } {
  let fires = 0;
  const next = lex.map((e) => { const r = applyRuleToWord(e.word, rule); if (r.changed) fires++; return { ...e, word: r.ids }; });
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
