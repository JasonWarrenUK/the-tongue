import { hashRand } from "./rng";
import { salienceRetention } from "./lexicon";
import { syntaxMult } from "./syntax";
// 1ENG.30: closes an import cycle with syllable.ts (which imports BY_ID from this
// module). Resolves safely because both sides only touch each other inside function
// bodies, never at module-scope initialisation — stressMap is called inside
// applyRuleToWord's body below, not at this file's top level. Same discipline
// syntax.ts's BY_ID.a already keeps for its own cycle with this module.
import { stressMap } from "./syllable";
import type { StressRule } from "./syllable";
import type { Phone, PhoneType, Backness, Patch, Rule, RuleCategory, Lexicon, Terrain, Seg, XformResult, WordOrder, FrameWeights, Inventory } from "./types";

const C = (id: string, place: string, manner: string, voice: boolean): Phone =>
  ({ id, g: id, type: "C", place, manner, voice, obstruent: manner === "stop" || manner === "fric" });
const V = (id: string, height: string, back: Backness, round: boolean): Phone =>
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

// 1ENG.29: /a/ is central, not front — the low vowel in a 5-vowel system is typically
// realised around [ä] cross-linguistically (Maddieson, Patterns of Sounds), and it
// matters here because frontV (below) gates palatalisation, whose canonical
// environment is _ i,e (Latin casa keeps /k/ while centum fronts it; Slavic first
// palatalisation and English keep/car pattern the same way). Central /a/ means
// palatalisation no longer fires before it — see 1eng-24 spike §7 and the phonology
// test suite's "1ENG.29 schwa" block for the goldens this deliberately moves.
const [I, E, A, O, U] = [V("i","high","front",false), V("e","mid","front",false), V("a","low","central",false), V("o","mid","back",true), V("u","high","back",true)];
// 1ENG.29 (1eng-24 spike §7): the schwa slice. No VL/VD variant — nothing assumes
// every vowel has a long or diphthong counterpart, and resolve already returns null
// on no match (the path documented at phonology.ts below for diphthongs against
// {long:true}); a central vowel having no conventional long counterpart is correct,
// not a gap. Doesn't collide with /a/ despite sharing back:"central" — resolve also
// matches on height, and they're low vs mid.
const SCHWA = V("ə","mid","central",false);

export const PHONES: Phone[] = [
  C("p","lab","stop",false),C("b","lab","stop",true),C("t","alv","stop",false),C("d","alv","stop",true),C("k","vel","stop",false),C("g","vel","stop",true),
  C("f","lab","fric",false),C("v","lab","fric",true),C("s","alv","fric",false),C("z","alv","fric",true),C("ʃ","pal","fric",false),C("ʒ","pal","fric",true),C("x","vel","fric",false),C("ɣ","vel","fric",true),C("h","glo","fric",false),
  C("m","lab","nasal",true),C("n","alv","nasal",true),C("ŋ","vel","nasal",true),C("l","alv","liquid",true),C("r","alv","liquid",true),C("j","pal","glide",true),C("w","lab","glide",true),
  I, E, A, O, U, SCHWA,
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
// 1ENG.29: was `!p!.back` under the old boolean — under Backness every value is a
// truthy string, so that would return false for every vowel and silently kill
// palatalisation outright. Must be an explicit equality test (1eng-24 spike §7).
const frontV = (p: Phone | null) => isV(p) && p!.back === "front";
const stopC = (p: Phone | null) => isC(p) && p!.manner === "stop";
const liquidC = (p: Phone | null) => isC(p) && p!.manner === "liquid";
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
  // 1ENG.17 (1eng-16 spike §7 slice 2) — Germanic umlaut / i-mutation (fōt/fēt), the
  // slice-2 mechanism's reason to exist: long-distance assimilation, expressible for
  // the first time via `distance`. w=2, category "assimilation" (it IS assimilation,
  // and the 0.4 contact affinity is the right tilt — no new RuleCategory, unlike
  // fortify's "fortition").
  //   xform copies back/round off ctx.far (the found front trigger) rather than
  // patching a fixed target — nasassim's shape, not reduce's. reduce's comment above
  // documents a self-seg vowel patch resolving to null for most inputs and silently
  // deleting; probed at spec time (every back-vowel × front-trigger combination in the
  // match/distance sets resolves cleanly — height and long come from the input via
  // applyXform's diff, back/round from the trigger), so that trap doesn't apply here.
  { id:"umlaut", name:"Umlaut", note:"back V → front / _ … front V  (i-mutation: fōt/fēt)",
    w:2, category:"assimilation",
    match:(p)=>isV(p)&&p.back==="back"&&!p.diph, pre:null, post:null,
    distance:{ dir:"post", test:(p)=>isV(p)&&p.back==="front"&&!p.diph },
    xform:(_p,ctx)=>({ back:ctx.far!.back, round:ctx.far!.round }) },
  { id:"cluster", name:"Cluster reduction", note:"consonant → ∅ / _ C", w:2, category:"deletion", match:isC, pre:null, post:isC, xform:()=>({delete:true}) },
  // 1ENG.17 (1eng-16 spike §7 slice 3) — metathesis (brid→bird, parabola→palabra):
  // real, attested, genuinely sporadic. w=1, the floor of RULES alongside fortify/
  // aphaer, precisely because it is not a regular change. Restricted to stop-liquid
  // pairs (the attested English/Romance cases), not any C-C pair — narrower than real
  // metathesis, flagged as a proxy. category "metathesis" (decision 2, not the spike's
  // "assimilation" — see the RuleCategory comment in types.ts): metathesis is
  // reordering, not feature-spreading, so assimilation's 0.4 contact affinity would be
  // an invented tilt.
  //   xform rides the third Seg variant: emit the post neighbour first (consumes:true,
  // so applyRuleToWord's loop skips it on its own turn rather than double-emitting),
  // then self unchanged. Net effect: [C, liquid] → [liquid, C].
  { id:"metath", name:"Metathesis", note:"C r → r C / _  (brid → bird)",
    w:1, category:"metathesis",
    match:(p)=>isC(p)&&p.manner!=="liquid", pre:null, post:liquidC,
    xform:()=>[
      { from:"post", patch:{}, consumes:true },
      { from:"self", patch:{} },
    ] },
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
      { from:"abs", type:"V", patch:{ height:"high", back:"front", round:false } },
    ] },
  { id:"paragoge", name:"Paragoge", note:"∅ → V / C _ #  (unconditioned word-final vowel epenthesis)", w:1.5, category:"epenthesis",
    match:isC, pre:null, post:bound,
    xform:()=>[
      { from:"self", patch:{} },
      { from:"abs", type:"V", patch:{ height:"high", back:"front", round:false } },
    ] },
  // Unconditioned breaking (real: cf. the Great Vowel Shift) — any final vowel may
  // diphthongise, not only a pre-existing mid vowel after hiatus. This is the second
  // bootstrap: it fires on the [C]V floor itself, where post:bound is the only
  // environment left once hiatus and mid vowels have both eroded away.
  // 1ENG.29: three arms on Backness, not a boolean branch — under the old boolean
  // `p.back ?` picked back/front; under Backness every string is truthy, so that test
  // would take the back arm for everything. match excludes diphthongs (isV(p)&&!p.diph)
  // so the switch stays total — a diphthong reaching break would have no back value to
  // dispatch on, and the only diphthong producer (this rule) already fires word-finally,
  // so re-breaking one is not a real path. Central /a/ finally reaches the ai arm the
  // rule's own note has always advertised.
  { id:"break", name:"Vowel breaking", note:"V → diphthong / _ #  (unconditioned; e→ie, a→ai, u→uo…)", w:2.5, category:"vowelShift",
    match:(p)=>isV(p)&&!p.diph, pre:null, post:bound,
    xform:(p)=>{
      const seg = p.back === "back" ? { nucleus:"u", offglide:"o" } : p.back === "central" ? { nucleus:"a", offglide:"i" } : { nucleus:"i", offglide:"e" };
      return [{ from:"abs", type:"V", patch:{ diph:true, ...seg } }];
    } },
  { id:"smooth", name:"Monophthongisation", note:"diphthong → mid V  (ie→e, uo→o)", w:2.5, category:"lenition",
    match:(p)=>isV(p)&&!!p.diph, pre:null, post:null,
    xform:(p)=>{
      // 1ENG.29: explicit Backness map, not `nucleus==="u"||"o"` reused as a boolean.
      // An a-nucleus diphthong (au, ai) has to land on "front" here so it resolves to
      // /e/ — mapping it to "central" would resolve to schwa (mid, central) and silently
      // monophthongise au/ai to ə instead of the intended /e/.
      const back: Backness = (p.nucleus === "u" || p.nucleus === "o") ? "back" : "front";
      return [{ from:"abs", type:"V", patch:{ height:"mid", back, round: back === "back" } }];
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
  // 1ENG.19 (1eng-14 spike §4.3) — the engine's first pre:bound rules. The positional
  // audit found word-initial position wholly inert: eight rules act at word ends,
  // none at the start. Real initial position is the STRONG position (word-initial
  // consonants lengthen cross-linguistically; fortition concentrates there, cf.
  // Spanish /j/ -> [ʝ]) and still occasionally loses material in connected speech
  // (apheresis: esquire -> squire). Both carry w=1, the lowest weight in RULES: true
  // fortition is attested but genuinely rare, and the ledger says so.
  { id:"fortify", name:"Initial fortition", note:"glide → voiced fricative / # _  (j→ʒ, w→v)",
    w:1, category:"fortition",
    match:(p)=>isC(p)&&p.manner==="glide", pre:bound, post:null,
    xform:()=>({ manner:"fric" }) },
  { id:"aphaer", name:"Apheresis", note:"initial vowel → ∅ / # _ C  (esquire → squire)",
    w:1, category:"deletion",
    match:isV, pre:bound, post:isC,
    xform:()=>({ delete:true }) },

  // 1ENG.31 (1eng-24 spike §6) — unstressed vowel reduction. The first half of the
  // Latin→French engine: unstressed nuclei neutralise toward the engine's neutral
  // central vowel (1ENG.29's schwa) before they disappear entirely (syncope, below).
  //   w=2.5: same band as spirant/raise/break. Cross-linguistically as common as
  // intervocalic spirantisation, commoner than paragoge (1.5), rarer than the w=3 band
  // (voice/devoice/apoc/nasassim) — reduction is characteristic of stress-timed
  // languages specifically, not universal the way final obstruent devoicing is.
  //   DIVERGES from the spike's literal `xform:()=>({back:"central"})`, deliberately.
  // That shape is a self-seg, so applyXform diffs the input's OWN height/round and
  // resolves (height, "central", round) against PHONES — which has no entry there
  // outside (mid, central, false). Probed against every vowel type: /i/, /u/, /o/ and
  // every diphthong resolve to null and are silently dropped at resolveSeg below, so a
  // rule advertised as a vowel SHIFT would in fact DELETE seven of eleven vowel types;
  // /aː/ merely shortens to /a/; only /e/ actually reaches ə.
  //   An absolute seg instead, following smooth's own pattern (below) for the same
  // reason smooth needs one: the target vowel is defined by its OWN full feature set,
  // not a diff from the input, so long vowels and diphthongs (which carry no
  // height/back/round to diff against) land on ə uniformly rather than falling off
  // resolve's edge. Idempotent on ə by construction (an already-reduced nucleus is a
  // no-op), so a fully-reduced word stops reporting fires rather than churning.
  //   NO vowel-floor risk: 1-in/1-out, never deletes.
  { id:"reduce", name:"Unstressed vowel reduction",
    note:"unstressed V → ə  (quality neutralised outside the stressed syllable)",
    w:2.5, category:"vowelShift",
    match:isV, pre:null, post:null,
    stressed:(s)=>!s.isStressed && s.role==="nucleus" && s.syllCount>1,
    xform:()=>[{ from:"abs", type:"V", patch:{ height:"mid", back:"central", round:false } }] },

  // 1ENG.31 (1eng-24 spike §6) — unstressed syllable loss (syncope). The second half of
  // the Latin→French engine and the change the whole 1ENG.25/27/28/29/30 chain exists to
  // make expressible: calidum > caldu > chaud. Deletes an unstressed nucleus; the
  // stranded onset/coda resyllabify for free on the next read (derive-on-read, never
  // cached — 1eng-25 §5.2).
  //   NOT restricted to medial position, deliberately: apoc (w=3) already owns
  // unconditioned final-vowel loss. Overlap is fine and attested — the contrast is that
  // apoc deletes the final vowel regardless of stress, while this rule can never touch
  // the stressed vowel anywhere in the word, which is the whole distinction the roadmap
  // asks for.
  //   w=2: below apoc, level with finalC/cluster/shorten. Real and common, but rarer
  // cross-linguistically than final vowel loss.
  //   The `syllCount>1` clause is what exempts monosyllables — the same fact that
  // protects the vowel floor below: stressPosition returns a valid index for every word
  // with >=1 syllable, so exactly one nucleus is always exempt from `!isStressed`, so
  // the floor is structurally unreachable from here. A second explicit guard would
  // silently mask a future stressPosition bug instead of surfacing it, so none is added;
  // instead this is pinned as an invariant test (phonology.test.ts), re-verified
  // empirically over 267,300 applications (every word of <=4 segments over a 15-phone
  // alphabet × 5 stress configurations): zero raw outputs lost their last vowel, zero
  // floor trips.
  { id:"syncope", name:"Unstressed syllable loss",
    note:"unstressed V → ∅  (calidum → caldu; the engine of Latin → French)",
    w:2, category:"deletion",
    match:isV, pre:null, post:null,
    stressed:(s)=>!s.isStressed && s.role==="nucleus" && s.syllCount>1,
    xform:()=>({ delete:true }) },
];
export const RULE_BY_ID: Record<string, Rule> = Object.fromEntries(RULES.map((r) => [r.id, r]));

// 1ENG.12: resolve one output Seg against the phone it was matched at. "self" reuses
// the pre-1ENG.12 applyXform path (diff-from-input); "abs" resolves a brand-new
// segment from the patch alone (an inserted/broken-off phone with no source to diff
// against). See 1eng-11 spike §3.
// 1ENG.17 slice 3: "post"/"pre" resolves against the NEIGHBOUR (diff-from-neighbour,
// applyXform's path again but against `neighbour` instead of `input`) — the moved
// segment keeps its own features, patched. `neighbour` is only absent if a rule
// declares `consumes` at the word edge, which applyRuleToWord below guards against
// before ever calling this, so the null case here is defensive, not a real path.
//   An EMPTY patch (metath's shape: move the neighbour unchanged) is special-cased to
// the neighbour's own id rather than round-tripped through resolve/PHONES.find. The
// consonant feature model doesn't fully individuate every phone — /l/ and /r/ are both
// {alv, liquid, voiced} with nothing else to tell them apart — so re-resolving an
// unchanged /r/ from its own features returns PHONES' FIRST matching entry (/l/, which
// happens to sort earlier), silently swapping the moved segment's identity. No existing
// self-seg rule hits this (none diffs a consonant with an empty patch), so it was never
// exercised before metath. Diffing a NON-empty patch still goes through resolve/
// applyXform as normal — only "unchanged" is special, matching what an unchanged phone
// means everywhere else in this loop (out.push(p.id) on a non-hit).
function resolveSeg(input: Phone, seg: Seg, neighbour: Phone | null): string | null {
  if (seg.from === "self") return applyXform(input, seg.patch);
  if (seg.from === "abs") return resolve(seg.type, seg.patch as Record<string, unknown>);
  if (!neighbour) return null;
  if (Object.keys(seg.patch).length === 0) return neighbour.id;
  return applyXform(neighbour, seg.patch);
}
// Normalise a rule's xform result to Seg[]. A legacy Patch (the pre-1ENG.12 shape,
// still used by all 9 original rules plus `shorten`) becomes a single self-seg, or
// no segs at all if it deletes — reproducing the old delete/guard semantics exactly.
function normalise(r: XformResult): Seg[] {
  if (Array.isArray(r)) return r;
  return r.delete ? [] : [{ from: "self", patch: r }];
}

export const MAX_LEN = 12; // ~4-5 syllables; growth ceiling, symmetric with the min-vowel floor below

// 1ENG.30: stressRule is optional so all pre-1ENG.24 two-arg call sites (~50 in
// phonology.test.ts, collision.test.ts:169) keep compiling and, more importantly, keep
// producing byte-identical output — see the backward-compatibility sweep. When supplied,
// stressMap is computed ONCE before the loop (not per-segment), since it's a pure
// function of the whole word and syllable boundaries don't move mid-application.
// 1ENG.17 slice 2 (1eng-16 spike §7): SCA²'s `…` wildcard. Scans `ph` — the INPUT
// array, same convention pre/post already follow, so an already-rewritten neighbour
// earlier in this word's pass is invisible, matching every other rule's semantics.
// Starts at i±2 (the adjacent slot is pre/post's job already) and walks to the word
// edge; first-match, so a rule can be conditioned on the NEAREST qualifying segment
// rather than any.
function scanDistance(ph: Phone[], i: number, d: { dir: "pre" | "post"; test: (p: Phone) => boolean }): Phone | null {
  const step = d.dir === "post" ? 1 : -1;
  for (let j = i + step * 2; j >= 0 && j < ph.length; j += step) {
    if (d.test(ph[j])) return ph[j];
  }
  return null;
}

export function applyRuleToWord(ids: string[], rule: Rule, stressRule?: StressRule): { ids: string[]; changed: boolean } {
  const ph = ids.map((id) => BY_ID[id]);
  const stress = stressRule ? stressMap(ids, stressRule) : undefined;
  const out: string[] = [];
  let changed = false;
  // 1ENG.17 slice 3: the one place this task touches the loop's own control flow. A
  // "post"-consuming Seg moves ph[i+1] into this iteration's output, so the NEXT
  // iteration (i+1) must not also emit it — skipNext carries that forward one step. A
  // "pre"-consuming Seg reaches BACKWARD into out itself (the neighbour was already
  // emitted last iteration), so it pops rather than skipping ahead.
  let skipNext = false;
  for (let i = 0; i < ph.length; i++) {
    if (skipNext) { skipNext = false; continue; }
    const p = ph[i];
    const pre = i > 0 ? ph[i - 1] : null;
    const post = i < ph.length - 1 ? ph[i + 1] : null;
    const st = stress?.[i];
    // 1ENG.30: fail-closed. A rule declaring `stressed` never fires when the stress
    // view is absent — no StressRule supplied, or (defensively) no StressCtx at this
    // index — rather than firing unconditioned, which would be a silent unconditioned
    // sound change (1eng-24 spike §3). 1ENG.17: `distance` is evaluated the same way —
    // a rule declaring it never fires without a qualifying segment in range.
    const far = rule.distance ? scanDistance(ph, i, rule.distance) : null;
    const hit = rule.match(p) && (rule.pre ? rule.pre(pre) : true) && (rule.post ? rule.post(post) : true)
      && (rule.stressed ? (st ? rule.stressed(st) : false) : true)
      && (rule.distance ? far !== null : true);
    if (!hit) { out.push(p.id); continue; }
    const before = out.length;
    for (const s of normalise(rule.xform(p, { pre, post, stress: st, far }))) {
      // 1ENG.17 slice 3: a "post"-consuming seg needs post itself (not p) as the
      // resolve target, and it must not read past the word edge — post is already
      // null there, so resolveSeg's neighbour-null guard makes an edge consume a
      // (defensive) no-op rather than a crash. "pre" is symmetric, included for a
      // future rule shape even though no shipped rule emits it yet.
      const neighbour = s.from === "post" ? post : s.from === "pre" ? pre : null;
      const nid = resolveSeg(p, s, neighbour);
      if (nid !== null) out.push(nid); // an unresolvable seg is dropped, as delete was pre-1ENG.12
      if (s.from === "post" && post !== null) skipNext = true;
    }
    const slice = out.slice(before);
    if (slice.length !== 1 || slice[0] !== p.id) changed = true;
    // 1ENG.13: compensatory lengthening. The coda just deleted itself above; reach back
    // and lengthen the vowel it left behind. Safe because rule.pre === isV guarantees the
    // input phone before this coda was a vowel, and only one rule runs per call, so
    // out[out.length-1] is exactly that vowel's (unchanged, since it didn't match) output.
    // Also assumes that vowel is plain, not a diphthong: applyXform resolves a diphthong's
    // (undefined) height/back/round against {long:true} to null, so lengthening would be
    // silently skipped rather than applied. Currently guaranteed because break, the only
    // diphthong producer, fires word-finally only (post:bound), so a diphthong can never
    // precede an obstruent coda for compleng/complengFinal to match against.
    if (rule.lengthensPrev && out.length > 0) {
      const long = applyXform(BY_ID[out[out.length - 1]], { long: true });
      if (long !== null) { out[out.length - 1] = long; changed = true; }
    }
  }
  if (out.length === 0 || !out.some((id) => BY_ID[id].type === "V")) return { ids, changed: false }; // floor
  if (out.length > MAX_LEN && out.length > ids.length) return { ids, changed: false };               // ceiling
  return { ids: out, changed };
}

// 1ENG.20 (1eng-15 spike §3.4) — applyRuleToWord's transducer loop, with one edge open
// to the affix and the other injected: a suffix's RIGHT edge is the real word boundary
// (post:bound rules see it naturally, since the affix genuinely IS at the word's end),
// but its LEFT context is stem-internal, not a boundary — injecting `ctx` there (the
// majority stem-final phone, from affixContext below) means pre:bound can never
// spuriously fire on it. A prefix mirrors this: its LEFT edge is real, its RIGHT
// context is injected. Two differences from applyRuleToWord's loop, not a wrapper
// around it: the injected inner context, and the lifted vowel floor (an affix may
// legitimately erode to [] — that IS cell death, not a discarded rule application).
// The MAX_LEN growth ceiling is kept: break/paragoge can legitimately grow an affix,
// but not without bound.
export function applyRuleToAffix(ids: string[], rule: Rule, edge: "suffix" | "prefix", ctx: Phone | null): string[] {
  const ph = ids.map((id) => BY_ID[id]);
  const out: string[] = [];
  // 1ENG.17 slice 3: same skip mechanism as applyRuleToWord — metath is neither
  // stressed nor distance-conditioned, so it isn't fail-closed out of the affix path,
  // and a consuming Seg here needs the same double-emit guard.
  let skipNext = false;
  for (let i = 0; i < ph.length; i++) {
    if (skipNext) { skipNext = false; continue; }
    const p = ph[i];
    // suffix: left (pre) is injected at i===0, right (post) is the real boundary at the
    // last index. prefix: mirrored — right (post) is injected at the last index, left
    // (pre) is the real boundary at i===0.
    const pre = edge === "suffix" ? (i > 0 ? ph[i - 1] : ctx) : (i > 0 ? ph[i - 1] : null);
    const post = edge === "suffix" ? (i < ph.length - 1 ? ph[i + 1] : null) : (i < ph.length - 1 ? ph[i + 1] : ctx);
    // 1ENG.30: same fail-closed conjunct as applyRuleToWord, with the stress view
    // always absent — affixes have no independent stress domain (they attach inside a
    // stem's own syllable structure), so a stress-conditioned rule never fires on one.
    // 1ENG.17: `distance` gets the same fail-closed treatment and for the same reason —
    // an affix is a handful of segments with no meaningful word-scale distance domain,
    // so a distance-conditioned rule (umlaut) never fires here. Without this, umlaut's
    // xform would read the always-absent ctx.far and crash (caught by the integration
    // suites that exercise tickParadigm/applyRuleToAffix over the real rule set).
    const hit = rule.match(p) && (rule.pre ? rule.pre(pre) : true) && (rule.post ? rule.post(post) : true)
      && (rule.stressed ? false : true) && (rule.distance ? false : true);
    if (!hit) { out.push(p.id); continue; }
    for (const s of normalise(rule.xform(p, { pre, post }))) {
      const neighbour = s.from === "post" ? post : s.from === "pre" ? pre : null;
      const nid = resolveSeg(p, s, neighbour);
      if (nid !== null) out.push(nid); // unresolvable/deleted seg dropped — no floor to protect
      if (s.from === "post" && post !== null) skipNext = true;
    }
    if (rule.lengthensPrev && out.length > 0) {
      const long = applyXform(BY_ID[out[out.length - 1]], { long: true });
      if (long !== null) out[out.length - 1] = long;
    }
  }
  if (out.length > MAX_LEN && out.length > ids.length) return ids; // ceiling only — no vowel floor
  return out;
}

// 2GEO.4/2GEO.5 — one leftmost edit from `a` toward `b`: substitute the first
// differing segment; if `a` is a prefix of `b`, append b's next segment; if `a` is
// longer, delete `a`'s first surplus segment. Deterministic (no RNG), and one call
// strictly raises formSimilarity(a,b) unless already equal. Respects the same word
// invariants applyRuleToWord enforces: never deletes the word's last remaining vowel,
// never grows past MAX_LEN (2geo-4 spike §3.4).
export function stepToward(a: string[], b: string[]): string[] {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  if (i < n) { const out = [...a]; out[i] = b[i]; return out; } // substitute first divergence
  if (a.length < b.length) { // a is a prefix of b: append its next segment
    if (a.length >= MAX_LEN) return a;
    return [...a, b[a.length]];
  }
  if (a.length > b.length) { // a overruns b: delete the first surplus segment
    const cut = b.length;
    const remaining = a.filter((_, idx) => idx !== cut);
    if (!remaining.some((id) => BY_ID[id].type === "V")) return a; // would empty the vowel floor
    return remaining;
  }
  return a; // identical
}
// 2GEO.3 Axis B — physical terrain sets per-concept salience (2geo-1 spike §4).
// Optional context: when supplied, a word that would change is scaled by
// (1 - salienceRetention(concept, terrain)) via a deterministic per-word roll,
// so salient-domain concepts resist drift. Omitted for firingRules' selection
// pass so drift-rule weighting stays terrain-agnostic, matching pre-2GEO.3 behaviour.
export interface SalienceContext { terrain: Terrain; seed: number; turn: number; branchId: number }
// 1ENG.14 §4.1 — the syntax gate's read-only view of a branch's grammar, widened
// with the seed triple the per-word roll needs (mirrors SalienceContext's shape).
// Field names match syntax.ts's BranchSyntax (wordOrder/frameWeights/proDrop) so a
// SyntaxContext IS a BranchSyntax structurally and passes straight to syntaxMult.
export interface SyntaxContext {
  wordOrder: WordOrder; frameWeights: FrameWeights; proDrop: boolean;
  seed: number; turn: number; branchId: number;
}
// 1ENG.30: stress follows the salience?/syntax? precedent exactly — an optional field
// on the same context object, threaded straight into applyRuleToWord's own optional
// parameter. Unlike salience/syntax it carries no roll of its own here: the actual
// stress gating happens inside applyRuleToWord (Rule.stressed against the per-segment
// StressCtx), so this is pure plumbing, not a fourth independent block roll.
// A new call site must wrap the branch's stressRule as `{ stress: b.stressRule }`, not
// pass it bare — nothing here enforces that shape structurally. generation.ts and
// game.svelte.ts's call sites are the reference examples.
export interface RuleContext { salience?: SalienceContext; syntax?: SyntaxContext; stress?: StressRule }

export function applyRuleToLex(lex: Lexicon, rule: Rule, ctx?: RuleContext): { lex: Lexicon; fires: number } {
  let fires = 0;
  const next = lex.map((e, i) => {
    const r = applyRuleToWord(e.word, rule, ctx?.stress);
    if (!r.changed) return { ...e, word: r.ids };
    if (ctx?.salience) {
      const retention = salienceRetention(e.concept, ctx.salience.terrain);
      const roll = hashRand(ctx.salience.seed + 13, ctx.salience.turn * 151 + 29, ctx.salience.branchId * 733 + i);
      if (roll < retention) return e; // blocked: word keeps its pre-rule form
    }
    // 1ENG.14 §4.1 — the syntax gate. syntaxMult ∈ [0.5, 1.5] is a RATE multiplier,
    // but this pass is a per-word BLOCK roll, so m < 1 becomes a block probability
    // (1 - m); m > 1 is a no-op here (a rule can't fire MORE than once on a word it
    // already fires on) — the lever is one-sided by construction, and over a lexicon
    // and many turns that asymmetry alone yields the differential erosion §4.1
    // claims (a position-favoured class is never blocked; a disfavoured one often is).
    // Separate roll, fresh salt, independent of the salience roll above: salience and
    // position are two distinct causes of resistance, and folding them into one roll
    // would make a salient-and-final word behave as if one cause cancelled the other.
    if (ctx?.syntax) {
      const m = syntaxMult(rule, e.concept, ctx.syntax, lex);
      if (m < 1) {
        const roll = hashRand(ctx.syntax.seed + 29, ctx.syntax.turn * 167 + 37, ctx.syntax.branchId * 601 + i);
        if (roll < 1 - m) return e;
      }
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

// 1ENG.26 (1eng-23 spike §4.1) — a branch has no stored Inventory of its own (only the
// world does) — derive one from its current lexicon so a fresh sibling's name is drawn
// from the sounds it actually speaks, including whatever renewal/erosion structure it
// has accrued. Moved here verbatim from naming.ts: an inventory is a phonological fact,
// not a naming one, and this file already owns every other phone-level query.
export function inventoryOf(lex: Lexicon): Inventory {
  const ids = new Set<string>();
  lex.forEach((e) => e.word.forEach((id) => ids.add(id)));
  const vowels: string[] = [], consonants: string[] = [];
  ids.forEach((id) => {
    const p = BY_ID[id]; if (!p) return;
    (p.type === "V" ? vowels : consonants).push(id);
  });
  // backstop: an empty lexicon (null-guard fracture, 1ENG.9 §d) yields an empty
  // inventory — fall back to a minimal CV pair so genStem never starves.
  return { vowels: vowels.length ? vowels : ["a"], consonants: consonants.length ? consonants : ["t"] };
}

// 1ENG.26 (1eng-23 spike §4.2) — phonemic events. The engine has produced mergers and
// splits since 1ENG.3 (census: 100%/95% of branches) but had no vocabulary for them;
// this names what the rules were already doing. Pure, no RNG, no state.
//   `partial` (a deliberate addition beyond the spike's literal type) distinguishes a
// CONDITIONED merger — the source survives elsewhere, so the contrast persists in some
// words — from an UNCONDITIONED one, where the source is gone everywhere. Both are true
// statements about the same rule application; recording which is which is more honest
// than suppressing one, and is exactly what the paired split/loss events already imply.
export type PhonemicEvent =
  | { kind: "merger"; from: string[]; to: string; partial: boolean } // 2+ phonemes collapsed into one
  | { kind: "split";  from: string;   to: string[] }                 // one phoneme became 2+
  | { kind: "loss";   phone: string }                                // phoneme left the inventory
  | { kind: "gain";   phone: string };                                // phoneme entered the inventory

// Canonical phone order for stable output. PHONES' own index, NOT localeCompare: the
// ids include ʃ/ʒ/ɣ/ŋ, whose collation is ICU-locale-dependent and so could order
// differently between environments — which would break the purity pin the moment CI's
// locale differed from a dev machine's. PHONES is fixed at module load and already
// reads as the engine's canonical order (labial→glottal, C then V then long then diph).
const PHONE_ORDER: Record<string, number> = Object.fromEntries(PHONES.map((p, i) => [p.id, i]));
const byPhone = (a: string, b: string) => (PHONE_ORDER[a] ?? 99) - (PHONE_ORDER[b] ?? 99);
// Contrast-destroying events before inventory bookkeeping, matching the spike's own
// listing order (§4.2) and the order a reader wants them: what happened, then what it
// cost the inventory.
const KIND_ORDER: Record<PhonemicEvent["kind"], number> = { merger: 0, split: 1, loss: 2, gain: 3 };

// The raw phone-id set of a lexicon. Deliberately NOT inventoryOf: that carries a
// minimal-CV backstop for an empty lexicon (so genStem never starves), and a phantom
// /a/ and /t/ appearing on one side of the diff would invent a loss or gain that never
// happened. inventoryOf keeps its backstop for the naming path; loss/gain read this.
const phoneIds = (lex: Lexicon): Set<string> => {
  const ids = new Set<string>();
  lex.forEach((e) => e.word.forEach((id) => ids.add(id)));
  return ids;
};

export function phonemicDiff(before: Lexicon, after: Lexicon): PhonemicEvent[] {
  const post = new Map(after.map((e) => [e.concept, e.word]));
  // destination map: before-phone → the set of after-phones standing at its index. Only
  // concepts present in BOTH lexicons at the SAME length contribute: a rule is 1-in/N-out
  // per segment, so 48% of applications change word length (1ENG.25 §2) and any
  // length-tolerant alignment would have to guess. A wrong guess invents a merger that
  // did not happen, so length-mismatched words are skipped outright — precision over
  // recall, affordable because the events are ubiquitous anyway (spike §4.2).
  const dest = new Map<string, Set<string>>();
  before.forEach((e) => {
    const w = post.get(e.concept);
    if (!w || w.length !== e.word.length) return;
    e.word.forEach((src, i) => {
      let d = dest.get(src);
      if (!d) dest.set(src, (d = new Set<string>()));
      d.add(w[i]);
    });
  });

  const events: PhonemicEvent[] = [];
  const inv0 = phoneIds(before), inv1 = phoneIds(after);

  // MERGER — grouped per DESTINATION, not pairwise. `to` is a single phone by the
  // type's design (a merger is identified by its reflex), and pairwise intersection
  // can't populate it without inventing a choice when two sources share two
  // destinations. Per-destination also collapses n sources onto one target into ONE
  // n-ary event instead of n-choose-2 near-duplicates, which is the common shape here
  // (voice/spirant/devoice all funnel several sources onto one phone).
  //   Self-mapping sources (d === src) are INCLUDED here, deliberately: the commonest
  // merger is exactly the case where the destination is itself one of the sources
  // (/p/ → {b}, /b/ → {b} — /p/ merged INTO /b/). Excluding self-maps would make that
  // case invisible (only /p/ would remain in the source set, below the ≥2 threshold).
  const sourcesOf = new Map<string, Set<string>>();
  dest.forEach((ds, src) => ds.forEach((d) => {
    let s = sourcesOf.get(d);
    if (!s) sourcesOf.set(d, (s = new Set<string>()));
    s.add(src);
  }));
  sourcesOf.forEach((srcs, to) => {
    if (srcs.size < 2) return;
    // partial iff any source OTHER than the destination itself still survives in
    // `after`: the contrast persists in whatever environment the rule didn't reach.
    const partial = [...srcs].some((s) => s !== to && inv1.has(s));
    events.push({ kind: "merger", from: [...srcs].sort(byPhone), to, partial });
  });

  // SPLIT — one source, 2+ reflexes. No self-filter here, deliberately asymmetric to
  // the merger guard above: a conditioned rule leaves its source behind in the
  // unconditioned environment (palat: /k/ → /ʃ/ before front vowels, /k/ elsewhere),
  // and that residue IS one of the two reflexes. Filtering it would make the detector
  // blind to conditioned splits, which is 18 of the engine's 19 rules — i.e. to the
  // phenomenon itself (spike §1). A merger's definition is that a source stopped being
  // distinct, which surviving as itself refutes; a split's is that it acquired a second
  // reflex, which surviving as itself is half of.
  dest.forEach((ds, from) => {
    if (ds.size < 2) return;
    events.push({ kind: "split", from, to: [...ds].sort(byPhone) });
  });

  // LOSS / GAIN — read the whole lexicon, not the destination map, so they also cover
  // the length-mismatched words alignment skipped. Deliberately NOT deduped against
  // merger/split: a merger WITHOUT a paired loss is a conditioned merger (the source
  // survives elsewhere), and a merger WITH one is unconditioned — that pairing (and the
  // `partial` flag above) is the signal distinguishing the two, so suppressing the
  // "redundant" loss would delete information the type can't otherwise carry.
  inv0.forEach((id) => { if (!inv1.has(id)) events.push({ kind: "loss", phone: id }); });
  inv1.forEach((id) => { if (!inv0.has(id)) events.push({ kind: "gain", phone: id }); });

  // Canonical order. Set/Map iteration is insertion order, which here depends on
  // lexicon and word order, so two lexicons with identical phonemic content but a
  // different concept order would otherwise diff to differently-ORDERED event lists.
  // Sorting makes the output a function of the phonology alone. Total: mergers are
  // keyed uniquely by `to`, splits by `from`, loss/gain by `phone`.
  const anchor = (e: PhonemicEvent) => e.kind === "merger" ? e.to : e.kind === "split" ? e.from : e.phone;
  const second = (e: PhonemicEvent) => e.kind === "merger" ? e.from[0] : e.kind === "split" ? e.to[0] : e.phone;
  return events.sort((a, b) =>
    KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || byPhone(anchor(a), anchor(b)) || byPhone(second(a), second(b)));
}

// Display grapheme, not the internal id: long vowels key on "iː" but render "ī" (see
// MACRON above), and the chronicle should show what the language looks like written.
const slash = (id: string) => `/${BY_ID[id]?.g ?? id}/`;
// "a and b" / "a, b and c" — no Oxford comma (British house style). Shared by merger
// `from` and split `to` so the 2-vs-3+ grammar is fixed in exactly one place.
const list = (ids: string[]) => {
  const g = ids.map(slash);
  return g.length < 2 ? g.join("") : `${g.slice(0, -1).join(", ")} and ${g[g.length - 1]}`;
};

// Render one event as chronicle prose. "fell together" is the standard English gloss
// of Zusammenfall and the spike's own phrasing (§4.3); loss/gain take the present
// perfect to match the chronicle's existing register ("borrowed 'x' from Y"). A partial
// merger gets an "in some words" qualifier so it reads distinctly from the paired split.
export function describeEvent(e: PhonemicEvent): string {
  switch (e.kind) {
    case "merger": return `${list(e.from)} fell together in ${slash(e.to)}${e.partial ? " in some words" : ""}`;
    case "split":  return `${slash(e.from)} split into ${list(e.to)}`;
    case "loss":   return `${slash(e.phone)} has been lost`;
    case "gain":   return `${slash(e.phone)} has entered the language`;
  }
}

// 1ENG.31 (1eng-24 spike §6): stress is threaded into the SELECTION pass, unlike
// salience and syntax which are deliberately withheld (see the RuleContext comment
// above applyRuleToLex, and the terrain-agnostic pin in phonology.test.ts). The
// asymmetry is principled, not an oversight: salience/syntax are per-word BLOCK rolls
// that change how OFTEN a firing rule fires, which is the weighted pick's own job;
// stress changes whether a rule can fire AT ALL. Under the fail-closed conjunct in
// applyRuleToWord, a rule declaring `stressed` reports fires===0 without a StressRule,
// so it would be filtered out here and could never be selected by driftRule — reduce
// and syncope would be dead code for autonomous drift while still working on the
// player path (game.svelte.ts, which passes stress and maps RULES directly rather than
// through this function). Optional, and passed as `stress ? {stress} : undefined`
// rather than `{stress}` unconditionally, so every pre-1ENG.31 one-arg call site
// reproduces the exact same call and stays byte-identical.
export function firingRules(lex: Lexicon, stress?: StressRule) {
  return RULES.map((r) => ({ rule: r, fires: applyRuleToLex(lex, r, stress ? { stress } : undefined).fires })).filter((x) => x.fires > 0);
}
// Terrain contact/isolation bias (2GEO.2): contact-favoured categories fire more
// often for open/high-contact branches, isolation-favoured categories fire more
// often for walled-off branches. Naturalness weight (w) stays dominant — this is
// a gentle multiplier, never zeroing or dominating a rule. See 2GEO.1 spike §3.3.
export const BIAS_STRENGTH = 0.7;
export const CATEGORY_AFFINITY: Record<RuleCategory, number> = {
  deletion: 1.0, lenition: 0.7, assimilation: 0.4, vowelShift: -1.0,
  epenthesis: -0.8, // isolation-favoured (complexity-building) — 1eng-11 spike §5
  // 1ENG.19: deliberately neutral, not a guessed constant. fortify's sources (§4.3)
  // are about prosodic prominence, not contact intensity — the terrain bias axis has
  // no evidence to offer either direction, so 0 is the principled "no tilt" rather
  // than an invented one. biasedMult(fortition, iso) === 1 for every iso.
  fortition: 0.0,
  // 1ENG.17 slice 3 (decision 2): same treatment as fortition, for the same reason —
  // metathesis's attestation (brid->bird, parabola->palabra) carries no contact-vs-
  // isolation claim either direction, so 0 is "no tilt" rather than a guess.
  metathesis: 0.0,
};
export function biasedMult(category: RuleCategory, iso: number): number {
  const tilt = 1 - 2 * iso; // contact tilt ∈ [-1,+1]: +1 fully open, -1 fully walled
  return Math.min(2, Math.max(0.5, 1 + BIAS_STRENGTH * CATEGORY_AFFINITY[category] * tilt));
}
// 2STK.3: momentumMult is an optional per-category multiplier (branch's momentum
// state, category -> mult) joining biasedMult in the weighted pick — see stakes.ts.
// Omitted entirely for callers with no branch momentum to consult (fixtures, the
// pre-2STK.3 call shape); every category then reads as its implicit 1.
// 1ENG.31: stress appended after momentumMult, following the same 2STK.3 idiom — an
// optional trailing param so every 5-arg call site (~50 across the test suite) keeps
// compiling and producing an identical pick.
export function driftRule(lex: Lexicon, seed: number, turn: number, branchId: number, iso: number, momentumMult?: Partial<Record<RuleCategory, number>>, stress?: StressRule): Rule | null {
  const firing = firingRules(lex, stress);
  if (!firing.length) return null;
  const weighted = firing.map((x) => ({ rule: x.rule, weight: x.rule.w * biasedMult(x.rule.category, iso) * (momentumMult?.[x.rule.category] ?? 1) }));
  const total = weighted.reduce((a, x) => a + x.weight, 0);
  let roll = hashRand(seed + 7, turn * 131 + 17, branchId * 911 + 3) * total;
  for (const x of weighted) { roll -= x.weight; if (roll <= 0) return x.rule; }
  return weighted[weighted.length - 1].rule;
}
