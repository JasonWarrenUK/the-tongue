# The Tongue — SvelteKit source

Svelte 5 (runes) + TypeScript. Engine is plain TS, reactive state is one `.svelte.ts` class, components are presentational.

**Setup:** `bunx sv create` (minimal template, TS) → `bunx sv add tailwindcss` → `bun add reasonable-colors`. Map Reasonable Colors into Tailwind in `src/app.css` (see section below). Drop the rest under `src/`. Tree of files:

```
src/app.css
src/lib/engine/{types,rng,lexicon,phonology,geography,intelligibility,tree,world,generation}.ts
src/lib/game.svelte.ts
src/lib/components/{Panel,Header,ControlBar,EconomyCfg,MapView,FamilyTree,IntelMatrix,WordTable,Changes,HistoryList}.svelte
src/routes/+page.svelte
```

---

### `src/app.css`

```css
@import "tailwindcss";
@import "reasonable-colors";

/* Semantic aliases — the only place RC vars are referenced directly.
   Dark warm UI: grey surfaces, amber accent, rose warn, emerald positive.
   amber-2 (#ffe0b2) used for accent: dark theme needs a *light* gold against
   dark surfaces — amber-3 (#b98300) is a dark mustard, unsuitable here. */
:root {
  --color-surface:    var(--color-gray-6);   /* panels                */
  --color-surface-2:  var(--color-gray-5);   /* raised / hover states */
  --color-bg:         var(--color-gray-6);   /* app background        */
  --color-border:     var(--color-gray-5);
  --color-muted:      var(--color-gray-3);   /* secondary text        */
  --color-fg:         var(--color-gray-1);   /* primary text          */
  --color-accent:     var(--color-amber-2);  /* light gold on dark    */
  --color-on-accent:  var(--color-gray-6);   /* text on accent bg     */
  --color-warn:       var(--color-rose-3);       /* collisions / fracture  */
  --color-positive:   var(--color-emerald-2);
  --color-barrier:    var(--color-cinnamon-4);   /* impassable terrain edges */
}

/* Map semantic aliases into utility classes (bg-surface, text-accent, …).
   @theme inline resolves the value at build time so Tailwind's JIT can
   emit correct CSS — RC :root aliases above must be declared first. */
@theme inline {
  --color-surface:   var(--color-surface);
  --color-surface-2: var(--color-surface-2);
  --color-bg:        var(--color-bg);
  --color-border:    var(--color-border);
  --color-muted:     var(--color-muted);
  --color-fg:        var(--color-fg);
  --color-accent:    var(--color-accent);
  --color-on-accent: var(--color-on-accent);
  --color-warn:      var(--color-warn);
  --color-positive:  var(--color-positive);
  --color-barrier:   var(--color-barrier);
}
```

> `branchColor` in `tree.ts` (`hsl(${(id * 61 + 25) % 360} 48% 56%)`) and its inline copy in `+page.svelte` are intentionally *not* mapped here — they generate arbitrary per-branch hues procedurally and are not theme colours.

---

### `src/lib/engine/types.ts`

```ts
export type PhoneType = "C" | "V";

export interface Phone {
  id: string; g: string; type: PhoneType;
  place?: string; manner?: string; voice?: boolean; obstruent?: boolean;
  height?: string; back?: boolean; round?: boolean;
}
export interface Patch {
  delete?: boolean; voice?: boolean; manner?: string; place?: string;
  height?: string; back?: boolean; round?: boolean;
}
export interface Rule {
  id: string; name: string; note: string; w: number;
  match: (p: Phone) => boolean;
  pre: ((p: Phone | null) => boolean) | null;
  post: ((p: Phone | null) => boolean) | null;
  xform: (p: Phone, ctx: { pre: Phone | null; post: Phone | null }) => Patch;
}

export interface LexEntry { concept: string; word: string[] }
export type Lexicon = LexEntry[];

export interface Region { id: number; x: number; y: number }
export interface Edge { a: number; b: number; passable: boolean; cost: number; name?: string }
export interface AdjEntry { to: number; passable: boolean; cost: number }
export type Adjacency = Record<number, AdjEntry[]>;

export interface Inventory { vowels: string[]; consonants: string[] }
export interface Template { onset: "req" | "opt"; coda: "none" | "opt"; clusters: boolean; label: string }

export interface World {
  seed: number; inv: Inventory; tmpl: Template; lex: Lexicon;
  regions: Region[]; edges: Edge[]; adj: Adjacency; start: number;
}
export interface HistoryEntry { name: string; note: string; drift?: boolean }
export interface Branch {
  id: number; name: string; parentId: number | null; depth: number;
  splitIndex: number; history: HistoryEntry[]; lex: Lexicon;
  territory: number[]; pressure: number;
}
export interface Settings {
  pool: number; growth: number; overhead: number; changeCost: number; spreadEvery: number;
}
export interface GameState {
  world: World; branches: Record<number, Branch>; rootId: number; selectedId: number;
  nextId: number; nameIdx: number; turn: number; settings: Settings;
  pool: number; touched: Record<number, boolean>; log: string[];
}
export interface FreeRegion { region: number; cost: number; passable: boolean }
export interface Candidate { rule: Rule; fires: number; collDelta: number }
```

---

### `src/lib/engine/rng.ts`

```ts
export function mulberry32(a: number): () => number {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const pick = <T>(arr: T[], rng: () => number): T => arr[Math.floor(rng() * arr.length)];

// deterministic hash → [0,1): autonomous drift / passive spread replay identically per seed+turn
export function hashRand(a: number, b: number, c: number): number {
  let h = 2166136261 >>> 0;
  [a, b, c].forEach((n) => { h ^= n >>> 0; h = Math.imul(h, 16777619); });
  h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15;
  return (h >>> 0) / 4294967296;
}
```

---

### `src/lib/engine/lexicon.ts`

```ts
import { pick } from "./rng";
import type { Inventory, Template, Lexicon } from "./types";

export const CONCEPTS = ["water","fire","stone","tree","leaf","root","seed","fish","bird","dog","wolf","hand","eye","ear","tooth","bone","blood","skin","meat","sun","moon","star","sky","rain","wind","hill","river","path","house","night","day","snow"];

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
```

---

### `src/lib/engine/phonology.ts`

```ts
import { hashRand } from "./rng";
import type { Phone, PhoneType, Patch, Rule, Lexicon } from "./types";

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
export const RULES: Rule[] = [
  { id:"voice", name:"Intervocalic voicing", note:"voiceless stop → voiced / V _ V", w:3, match:(p)=>isC(p)&&p.manner==="stop"&&!p.voice, pre:isV, post:isV, xform:()=>({voice:true}) },
  { id:"spirant", name:"Intervocalic spirantisation", note:"voiceless stop → fricative / V _ V", w:2.5, match:(p)=>isC(p)&&p.manner==="stop"&&!p.voice, pre:isV, post:isV, xform:()=>({manner:"fric"}) },
  { id:"devoice", name:"Final devoicing", note:"voiced obstruent → voiceless / _ #", w:3, match:(p)=>isC(p)&&!!p.obstruent&&!!p.voice, pre:null, post:bound, xform:()=>({voice:false}) },
  { id:"apoc", name:"Apocope (final vowel loss)", note:"vowel → ∅ / _ #", w:3, match:isV, pre:null, post:bound, xform:()=>({delete:true}) },
  { id:"finalC", name:"Final consonant loss", note:"consonant → ∅ / _ #", w:2, match:isC, pre:null, post:bound, xform:()=>({delete:true}) },
  { id:"palat", name:"Palatalisation", note:"velar stop → palatal fricative / _ front V", w:2.5, match:(p)=>isC(p)&&p.place==="vel"&&p.manner==="stop", pre:null, post:frontV, xform:()=>({place:"pal",manner:"fric"}) },
  { id:"debucc", name:"Debuccalisation", note:"s → h / _ #", w:1.5, match:(p)=>isC(p)&&p.place==="alv"&&p.manner==="fric"&&!p.voice, pre:null, post:bound, xform:()=>({place:"glo"}) },
  { id:"raise", name:"Final vowel raising", note:"mid vowel → high / _ #", w:2.5, match:(p)=>isV(p)&&p.height==="mid", pre:null, post:bound, xform:()=>({height:"high"}) },
  { id:"nasassim", name:"Nasal place assimilation", note:"nasal → [place of stop] / _ stop", w:3, match:(p)=>isC(p)&&p.manner==="nasal", pre:null, post:stopC, xform:(_p,ctx)=>({place:ctx.post!.place}) },
  { id:"cluster", name:"Cluster reduction", note:"consonant → ∅ / _ C", w:2, match:isC, pre:null, post:isC, xform:()=>({delete:true}) },
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
export function driftRule(lex: Lexicon, seed: number, turn: number, branchId: number): Rule | null {
  const firing = firingRules(lex);
  if (!firing.length) return null;
  const total = firing.reduce((a, x) => a + x.rule.w, 0);
  let roll = hashRand(seed + 7, turn * 131 + 17, branchId * 911 + 3) * total;
  for (const x of firing) { roll -= x.rule.w; if (roll <= 0) return x.rule; }
  return firing[firing.length - 1].rule;
}
```

---

### `src/lib/engine/geography.ts`

```ts
import { pickGen } from "./rng-helpers";
import type { Adjacency, Branch, FreeRegion, Region, Edge, Settings } from "./types";

// branch helpers re-exported from tree to avoid a cycle are imported where needed
import { leavesOf } from "./tree";

export function pickTerrain(rng: () => number): { name: string; passable: boolean; cost: number } {
  const r = rng();
  if (r < 0.55) return { name: "plain", passable: true, cost: 1 };
  if (r < 0.75) return { name: "hill", passable: true, cost: 2 };
  if (r < 0.9) return { name: "mountain", passable: false, cost: 3 };
  return { name: "water", passable: false, cost: 3 };
}
export function genRegions(rng: () => number): { regions: Region[]; edges: Edge[]; adj: Adjacency; start: number } {
  const cols = 4, rows = 3;
  const regions: Region[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++)
    regions.push({ id: r * cols + c, x: (c + 0.5 + (rng() - 0.5) * 0.45) / cols, y: (r + 0.5 + (rng() - 0.5) * 0.45) / rows });
  const edges: Edge[] = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const id = r * cols + c;
    if (c < cols - 1) { const t = pickTerrain(rng); edges.push({ a: id, b: id + 1, ...t }); }
    if (r < rows - 1) { const t = pickTerrain(rng); edges.push({ a: id, b: id + cols, ...t }); }
  }
  const adj: Adjacency = {}; regions.forEach((r) => (adj[r.id] = []));
  edges.forEach((e) => { adj[e.a].push({ to: e.b, passable: e.passable, cost: e.cost }); adj[e.b].push({ to: e.a, passable: e.passable, cost: e.cost }); });
  let start = regions[0], best = 9;
  regions.forEach((r) => { const d = (r.x - 0.5) ** 2 + (r.y - 0.5) ** 2; if (d < best) { best = d; start = r; } });
  return { regions, edges, adj, start: start.id };
}

export function ownerMap(branches: Record<number, Branch>): Record<number, number> {
  const o: Record<number, number> = {};
  leavesOf(branches).forEach((L) => L.territory.forEach((r) => (o[r] = L.id)));
  return o;
}
export function freeAdjacentFor(b: Branch, adj: Adjacency, owner: Record<number, number>): FreeRegion[] {
  const map: Record<number, FreeRegion> = {};
  b.territory.forEach((rid) => adj[rid].forEach((e) => {
    if (owner[e.to] !== undefined) return;
    if (!map[e.to]) map[e.to] = { region: e.to, cost: e.cost, passable: e.passable };
    else { map[e.to].cost = Math.min(map[e.to].cost, e.cost); map[e.to].passable = map[e.to].passable || e.passable; }
  }));
  return Object.values(map);
}
export function passableComponents(territory: number[], adj: Adjacency): number[][] {
  const set = new Set(territory), seen = new Set<number>(), comps: number[][] = [];
  territory.forEach((r) => {
    if (seen.has(r)) return;
    const comp: number[] = [], stack = [r]; seen.add(r);
    while (stack.length) {
      const c = stack.pop()!; comp.push(c);
      adj[c].forEach((e) => { if (e.passable && set.has(e.to) && !seen.has(e.to)) { seen.add(e.to); stack.push(e.to); } });
    }
    comps.push(comp);
  });
  return comps;
}
export function basePool(branches: Record<number, Branch>, settings: Settings): number {
  const tot = leavesOf(branches).reduce((a, L) => a + Math.max(1, L.territory.length), 0);
  return settings.pool + settings.growth * (tot - 1);
}
export function overheadFor(branch: Branch, settings: Settings): number {
  return settings.overhead + Math.max(0, branch.territory.length - 1);
}
```

> Note: `genRegions` imports `pickTerrain` locally — the stray `rng-helpers` import line above is a leftover; delete it, `pickTerrain` is defined in this file.

---

### `src/lib/engine/intelligibility.ts`

```ts
import type { Lexicon } from "./types";

function lev(a: string[], b: string[]): number {
  const m = a.length, n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) d[i][0] = i;
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) {
    const c = a[i - 1] === b[j - 1] ? 0 : 1;
    d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
  }
  return d[m][n];
}
// proxy: normalised edit distance over the shared concept skeleton, not a real comprehension test
export function intelligibility(lexA: Lexicon, lexB: Lexicon): number {
  const mapB = Object.fromEntries(lexB.map((e) => [e.concept, e.word]));
  let s = 0, n = 0;
  lexA.forEach((e) => {
    const wb = mapB[e.concept]; if (!wb) return;
    const mx = Math.max(e.word.length, wb.length) || 1;
    s += 1 - lev(e.word, wb) / mx; n++;
  });
  return n ? s / n : 1;
}
```

---

### `src/lib/engine/tree.ts`

```ts
import type { Branch } from "./types";

export const NAME_POOL = ["Aenic","Boran","Cael","Doran","Eshk","Fenn","Garr","Hroth","Ivar","Joss","Karn","Lorn","Morr","Nys","Orin","Pell","Quor","Rhun","Syl","Tovr","Ulm","Vesk","Wyrr","Xan"];

export const childrenOf = (br: Record<number, Branch>, id: number) =>
  Object.values(br).filter((b) => b.parentId === id);
export const isLeaf = (br: Record<number, Branch>, id: number) =>
  !Object.values(br).some((b) => b.parentId === id);
export const leavesOf = (br: Record<number, Branch>) =>
  Object.values(br).filter((b) => isLeaf(br, b.id));
export const branchColor = (id: number) => `hsl(${(id * 61 + 25) % 360} 48% 56%)`;

export function layoutTree(br: Record<number, Branch>, rootId: number): Record<number, { x: number; depth: number }> {
  let nextX = 0; const pos: Record<number, { x: number; depth: number }> = {};
  function rec(id: number, depth: number): number {
    const kids = childrenOf(br, id).sort((a, b) => a.id - b.id);
    if (!kids.length) { pos[id] = { x: nextX++, depth }; return pos[id].x; }
    const xs = kids.map((k) => rec(k.id, depth + 1));
    pos[id] = { x: (Math.min(...xs) + Math.max(...xs)) / 2, depth };
    return pos[id].x;
  }
  rec(rootId, 0);
  return pos;
}
```

---

### `src/lib/engine/world.ts`

```ts
import { mulberry32 } from "./rng";
import { genInventory, genTemplate, genLexicon } from "./lexicon";
import { genRegions } from "./geography";
import type { GameState, Settings, World } from "./types";

export const DEFAULTS: Settings = { pool: 8, growth: 2, overhead: 3, changeCost: 2, spreadEvery: 3 };

export function makeWorld(seed: number): World {
  const rng = mulberry32(seed);
  const inv = genInventory(rng);
  const tmpl = genTemplate(rng);
  const lex = genLexicon(rng, inv, tmpl);
  const geo = genRegions(rng);
  return { seed, inv, tmpl, lex, ...geo };
}
export function freshState(seed: number): GameState {
  const world = makeWorld(seed);
  const root = { id: 0, name: "Proto", parentId: null, depth: 0, splitIndex: 0, history: [], lex: world.lex, territory: [world.start], pressure: 0 };
  return { world, branches: { 0: root }, rootId: 0, selectedId: 0, nextId: 1, nameIdx: 0, turn: 1, settings: { ...DEFAULTS }, pool: DEFAULTS.pool, touched: {}, log: [] };
}
```

---

### `src/lib/engine/generation.ts`

```ts
import { hashRand } from "./rng";
import { driftRule, applyRuleToLex } from "./phonology";
import { ownerMap, freeAdjacentFor, passableComponents, basePool } from "./geography";
import { leavesOf, isLeaf, childrenOf, NAME_POOL } from "./tree";
import type { Branch, GameState } from "./types";

// One generation resolves: autonomous drift → passive spread → geographic fracture → repool.
export function resolveGeneration(s: GameState): GameState {
  const seed = s.world.seed, turn = s.turn, adj = s.world.adj, log: string[] = [];
  const branches: Record<number, Branch> = {};
  Object.values(s.branches).forEach((b) => (branches[b.id] = { ...b, territory: [...b.territory], history: [...b.history] }));

  // 1. drift untouched leaves
  leavesOf(branches).forEach((L) => {
    if (s.touched[L.id]) return;
    const rule = driftRule(L.lex, seed, turn, L.id); if (!rule) return;
    branches[L.id] = { ...branches[L.id], lex: applyRuleToLex(L.lex, rule).lex, history: [...branches[L.id].history, { name: rule.name, note: rule.note, drift: true }] };
    log.push(`${L.name} drifted (${rule.name.toLowerCase()})`);
  });

  // 2. passive expansion (prefer passable; cross a barrier only when boxed in)
  const owner = ownerMap(branches);
  leavesOf(branches).forEach((L) => {
    const b = branches[L.id]; b.pressure = (b.pressure || 0) + 1;
    if (b.pressure >= s.settings.spreadEvery) {
      const free = freeAdjacentFor(b, adj, owner);
      if (free.length) {
        const passable = free.filter((f) => f.passable); const poolF = passable.length ? passable : free;
        const r = poolF[Math.floor(hashRand(seed, turn * 7 + 1, L.id * 13 + 5) * poolF.length)];
        b.territory.push(r.region); owner[r.region] = L.id; b.pressure = 0;
        log.push(`${L.name} spread`);
      }
    }
  });

  // 3. fracture any territory no longer joined by passable terrain
  let nextId = s.nextId, nameIdx = s.nameIdx;
  leavesOf(branches).forEach((L) => {
    const comps = passableComponents(branches[L.id].territory, adj);
    if (comps.length > 1 && nameIdx + comps.length <= NAME_POOL.length) {
      const parent = branches[L.id]; const names: string[] = [];
      comps.forEach((comp) => {
        const id = nextId++; const name = NAME_POOL[nameIdx++]; names.push(name);
        branches[id] = { id, name, parentId: parent.id, depth: parent.depth + 1, splitIndex: parent.history.length, history: [...parent.history], lex: parent.lex.map((e) => ({ concept: e.concept, word: [...e.word] })), territory: comp, pressure: 0 };
      });
      branches[L.id] = { ...parent, territory: [] };
      log.push(`${parent.name} fractured → ${names.join(", ")}`);
    }
  });

  let selectedId = s.selectedId;
  if (!isLeaf(branches, selectedId)) { const kids = childrenOf(branches, selectedId); if (kids.length) selectedId = kids[0].id; }
  return { ...s, branches, nextId, nameIdx, turn: turn + 1, pool: basePool(branches, s.settings), touched: {}, selectedId, log };
}
```

---

### `src/lib/game.svelte.ts`

```ts
import { freshState } from "./engine/world";
import { resolveGeneration } from "./engine/generation";
import { RULES, RULE_BY_ID, applyRuleToLex, collisionPairs, homophoneForms } from "./engine/phonology";
import { leavesOf, isLeaf } from "./engine/tree";
import { ownerMap, freeAdjacentFor, passableComponents, basePool, overheadFor } from "./engine/geography";
import type { GameState, Settings, Candidate } from "./engine/types";

class Game {
  seed = $state(1985);
  st = $state<GameState>(freshState(1985));
  preview = $state<string | null>(null);
  showCfg = $state(false);

  sel = $derived(this.st.branches[this.st.selectedId]);
  leaves = $derived(leavesOf(this.st.branches));
  baseColl = $derived(collisionPairs(this.sel.lex));
  candidates = $derived.by<Candidate[]>(() =>
    RULES.map((rule) => {
      const { lex: after, fires } = applyRuleToLex(this.sel.lex, rule);
      return { rule, fires, collDelta: collisionPairs(after) - this.baseColl };
    }).filter((c) => c.fires > 0)
  );
  previewLex = $derived(this.preview ? applyRuleToLex(this.sel.lex, RULE_BY_ID[this.preview]).lex : null);
  curHomo = $derived(homophoneForms(this.sel.lex));
  prevHomo = $derived(this.previewLex ? homophoneForms(this.previewLex) : null);
  willDrift = $derived(this.leaves.filter((l) => !this.st.touched[l.id]).length);
  overhead = $derived(overheadFor(this.sel, this.st.settings));
  overheadDue = $derived(this.st.touched[this.st.selectedId] ? 0 : this.overhead);
  stepCost = $derived(this.st.settings.changeCost + this.overheadDue);
  fracturing = $derived(passableComponents(this.sel.territory, this.st.world.adj).length > 1);

  loadWorld(s: number) { this.st = freshState(s); this.seed = s; this.preview = null; }

  apply(ruleId: string) {
    const s = this.st, b = s.branches[s.selectedId];
    const ov = s.touched[s.selectedId] ? 0 : overheadFor(b, s.settings);
    const cost = s.settings.changeCost + ov; if (cost > s.pool) return;
    const rule = RULE_BY_ID[ruleId]; const after = applyRuleToLex(b.lex, rule).lex;
    this.st = { ...s, pool: s.pool - cost, touched: { ...s.touched, [s.selectedId]: true },
      branches: { ...s.branches, [s.selectedId]: { ...b, lex: after, history: [...b.history, { name: rule.name, note: rule.note }] } } };
    this.preview = null;
  }
  expandInto(regionId: number) {
    const s = this.st, b = s.branches[s.selectedId], owner = ownerMap(s.branches);
    const fa = freeAdjacentFor(b, s.world.adj, owner).find((f) => f.region === regionId);
    if (!fa || fa.cost > s.pool) return;
    this.st = { ...s, pool: s.pool - fa.cost, branches: { ...s.branches, [b.id]: { ...b, territory: [...b.territory, regionId] } } };
  }
  endTurn() { this.st = resolveGeneration(this.st); this.preview = null; }
  selectBranch(id: number) { if (isLeaf(this.st.branches, id)) { this.st = { ...this.st, selectedId: id }; this.preview = null; } }
  setCfg(key: keyof Settings, val: number) {
    const s = this.st; const settings = { ...s.settings, [key]: val };
    const pool = key === "pool" || key === "growth" ? basePool(s.branches, settings) : s.pool;
    this.st = { ...s, settings, pool };
  }
}
export const game = new Game();
```

---

### `src/lib/components/Panel.svelte`

```svelte
<script lang="ts">
  import type { Snippet } from "svelte";
  let { title, children }: { title: string; children: Snippet } = $props();
</script>

<div class="bg-surface rounded-lg border border-border p-3">
  <h2 class="text-xs uppercase tracking-wide text-muted mb-2">{title}</h2>
  {@render children()}
</div>
```

---

### `src/lib/components/WordTable.svelte`

```svelte
<script lang="ts">
  import { formOf } from "$lib/engine/phonology";
  import type { Lexicon } from "$lib/engine/types";
  let { lex, previewLex, curHomo, prevHomo }:
    { lex: Lexicon; previewLex: Lexicon | null; curHomo: Set<string>; prevHomo: Set<string> | null } = $props();
</script>

<div class="bg-surface rounded-lg overflow-hidden border border-border">
  <div class="grid grid-cols-2 text-xs text-muted px-3 py-2 border-b border-border"><span>concept</span><span>form</span></div>
  <div class="overflow-y-auto" style="max-height: 46vh">
    {#each lex as e, i}
      {@const before = formOf(e.word)}
      {@const after = previewLex ? formOf(previewLex[i].word) : before}
      {@const changed = !!previewLex && after !== before}
      {@const homo = previewLex ? prevHomo?.has(after) : curHomo.has(before)}
      <div class="grid grid-cols-2 px-3 py-1.5 items-center {changed ? 'bg-accent/10' : i % 2 ? 'bg-fg/5' : ''}">
        <span class="text-fg">{e.concept}</span>
        <span class="font-mono flex items-center gap-1.5">
          {#if changed}
            <span class="text-muted line-through">{before}</span><span class="text-muted">→</span><span class="text-accent">{after}</span>
          {:else}
            <span class="text-fg">{before}</span>
          {/if}
          {#if homo}<span class="text-warn text-xs" title="shares a form with another concept">●</span>{/if}
        </span>
      </div>
    {/each}
  </div>
</div>
```

---

### `src/lib/components/Changes.svelte`

```svelte
<script lang="ts">
  import type { Candidate } from "$lib/engine/types";
  let { candidates, preview, stepCost, overheadDue, pool, onpreview, onapply }:
    { candidates: Candidate[]; preview: string | null; stepCost: number; overheadDue: number; pool: number;
      onpreview: (id: string | null) => void; onapply: (id: string) => void } = $props();
</script>

<div>
  <div class="flex items-center justify-between mb-2">
    <h2 class="text-xs uppercase tracking-wide text-muted">Available changes</h2>
    {#if overheadDue > 0}<span class="text-xs text-muted">first change here +{overheadDue} overhead</span>{/if}
  </div>
  <div class="space-y-2">
    {#each candidates as { rule, fires, collDelta } (rule.id)}
      {@const afford = stepCost <= pool}
      <div role="button" tabindex="0" onmouseenter={() => onpreview(rule.id)} onmouseleave={() => onpreview(null)} onclick={() => onpreview(rule.id)}
        class="rounded-md px-2.5 py-1.5 cursor-pointer border transition-colors {preview === rule.id ? 'border-accent bg-surface' : 'border-border bg-surface hover:border-muted'}">
        <div class="flex items-center justify-between gap-2">
          <span class="text-fg font-medium text-xs">{rule.name}</span>
          <button onclick={(ev) => { ev.stopPropagation(); if (afford) onapply(rule.id); }} disabled={!afford}
            class="shrink-0 px-2 py-0.5 rounded text-xs font-medium {afford ? 'bg-accent text-on-accent hover:bg-accent/80' : 'bg-surface-2 text-muted cursor-not-allowed'}">Apply · {stepCost}</button>
        </div>
        <div class="flex items-center justify-between gap-2 mt-0.5">
          <span class="font-mono text-xs text-muted">{rule.note}</span>
          <span class="shrink-0 text-xs {collDelta > 0 ? 'text-warn' : 'text-positive'}">{fires}w {collDelta > 0 ? `+${collDelta}` : "·"}</span>
        </div>
      </div>
    {:else}
      <p class="text-muted text-xs">No changes apply to the current lexicon.</p>
    {/each}
  </div>
</div>
```

---

### `src/lib/components/HistoryList.svelte`

```svelte
<script lang="ts">
  import type { HistoryEntry } from "$lib/engine/types";
  let { history, splitIndex }: { history: HistoryEntry[]; splitIndex: number } = $props();
</script>

{#if history.length}
  <div>
    <h2 class="text-xs uppercase tracking-wide text-muted mb-2">Sound-change chronology</h2>
    <ol class="space-y-1">
      {#each history as h, i}
        {#if i === splitIndex && splitIndex > 0}<li class="text-muted my-1" style="font-size:10px">── split ──</li>{/if}
        <li class="text-xs flex gap-2 items-baseline">
          <span class="text-muted tabular-nums">{i + 1}.</span>
          <span class={i < splitIndex ? "text-muted" : h.drift ? "text-muted italic" : "text-fg"}>
            {#if h.drift}<span class="text-warn not-italic mr-1">⤳</span>{/if}{h.name}
          </span>
          <span class="font-mono text-muted">{h.note}</span>
        </li>
      {/each}
    </ol>
  </div>
{/if}
```

---

### `src/lib/components/IntelMatrix.svelte`

```svelte
<script lang="ts">
  import { intelligibility } from "$lib/engine/intelligibility";
  import type { Branch } from "$lib/engine/types";
  let { leaves }: { leaves: Branch[] } = $props();
  const ls = $derived(leaves.slice().sort((a, b) => a.id - b.id));
  const colour = (v: number) =>
    v >= 0.7 ? "var(--color-positive)" : v >= 0.4 ? "var(--color-accent)" : "var(--color-warn)";
</script>

{#if leaves.length < 2}
  <p class="text-muted text-xs">As the family fractures, mutual intelligibility between living languages appears here.</p>
{:else}
  <div class="overflow-x-auto">
    <table class="text-xs border-collapse">
      <thead><tr><th class="p-1"></th>{#each ls as b}<th class="p-1 text-muted font-normal">{b.name}</th>{/each}</tr></thead>
      <tbody>
        {#each ls as a}
          <tr>
            <td class="p-1 text-muted pr-2">{a.name}</td>
            {#each ls as b}
              {#if a.id === b.id}
                <td class="p-1 text-center text-muted">—</td>
              {:else}
                {@const v = intelligibility(a.lex, b.lex)}
                <td class="p-1 text-center tabular-nums font-medium" style="color:{colour(v)}">{Math.round(v * 100)}</td>
              {/if}
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
```

---

### `src/lib/components/MapView.svelte`

```svelte
<script lang="ts">
  import { ownerMap, freeAdjacentFor } from "$lib/engine/geography";
  import { isLeaf, branchColor } from "$lib/engine/tree";
  import type { Branch, FreeRegion, World } from "$lib/engine/types";
  let { world, branches, selectedId, pool, onselect, onexpand }:
    { world: World; branches: Record<number, Branch>; selectedId: number; pool: number;
      onselect: (id: number) => void; onexpand: (region: number) => void } = $props();

  const W = 360, H = 240, R = 12;
  const pos = $derived(Object.fromEntries(world.regions.map((r) => [r.id, { x: r.x * W, y: r.y * H }])));
  const owner = $derived(ownerMap(branches));
  const expandable = $derived.by<Record<number, FreeRegion>>(() => {
    const sel = branches[selectedId]; const m: Record<number, FreeRegion> = {};
    if (sel && isLeaf(branches, selectedId)) freeAdjacentFor(sel, world.adj, owner).forEach((f) => (m[f.region] = f));
    return m;
  });
</script>

<div class="overflow-x-auto">
  <svg viewBox={`0 0 ${W} ${H}`} width="100%" style="max-height:30vh">
    {#each world.edges as e, i}
      <line x1={pos[e.a].x} y1={pos[e.a].y} x2={pos[e.b].x} y2={pos[e.b].y}
        stroke={e.passable ? "var(--color-border)" : "var(--color-barrier)"} stroke-width="2" stroke-dasharray={e.passable ? "0" : "4 3"} />
    {/each}
    {#each world.regions as r}
      {@const own = owner[r.id]}
      {@const exp = expandable[r.id]}
      {@const isSel = own === selectedId}
      {@const afford = exp && exp.cost <= pool}
      {@const clickable = own !== undefined || (exp && afford)}
      <g transform={`translate(${pos[r.id].x},${pos[r.id].y})`} style="cursor:{clickable ? 'pointer' : 'default'}"
        role="button" tabindex="0"
        onclick={() => { if (own !== undefined) onselect(own); else if (exp && afford) onexpand(r.id); }}>
        <circle r={R} fill={own !== undefined ? branchColor(own) : "var(--color-surface-2)"}
          stroke={isSel ? "var(--color-accent)" : exp ? (afford ? "var(--color-accent)" : "var(--color-muted)") : "var(--color-bg)"}
          stroke-width={isSel ? 3 : exp ? 2 : 1} stroke-dasharray={exp ? "3 2" : "0"}
          opacity={own === undefined && !exp ? 0.5 : 1} />
        {#if own !== undefined}<text text-anchor="middle" dy="3.5" font-size="10" font-weight="700" fill="var(--color-on-accent)">{branches[own].name[0]}</text>{/if}
        {#if exp}<text text-anchor="middle" dy="3.5" font-size="9" fill={afford ? "var(--color-accent)" : "var(--color-muted)"}>+{exp.cost}</text>{/if}
      </g>
    {/each}
  </svg>
  <div class="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-muted" style="font-size:10px">
    <span>— passable</span><span style="color:var(--color-barrier)">– – barrier</span>
    <span class="text-muted">tap your land to select · tap a glowing region to expand</span>
  </div>
</div>
```

---

### `src/lib/components/FamilyTree.svelte`

```svelte
<script lang="ts">
  import { layoutTree, isLeaf, branchColor } from "$lib/engine/tree";
  import type { Branch } from "$lib/engine/types";
  let { branches, rootId, selectedId, touched, onselect }:
    { branches: Record<number, Branch>; rootId: number; selectedId: number;
      touched: Record<number, boolean>; onselect: (id: number) => void } = $props();

  const COL = 96, ROW = 62, NW = 78, NH = 36;
  const pos = $derived(layoutTree(branches, rootId));
  const W = $derived((Math.ceil(Math.max(...Object.values(pos).map((p) => p.x))) + 1) * COL);
  const H = $derived((Math.max(...Object.values(pos).map((p) => p.depth)) + 1) * ROW);
  const cx = (id: number) => pos[id].x * COL + COL / 2;
  const cy = (id: number) => pos[id].depth * ROW + 10;
</script>

<div class="overflow-x-auto" style="max-height:30vh">
  <svg width={W} height={H} style="min-width:100%">
    {#each Object.values(branches) as b}
      {#if b.parentId !== null}
        <line x1={cx(b.parentId)} y1={cy(b.parentId) + NH} x2={cx(b.id)} y2={cy(b.id)} stroke="var(--color-border)" stroke-width="1.5" />
      {/if}
    {/each}
    {#each Object.values(branches) as b}
      {@const leaf = isLeaf(branches, b.id)}
      {@const selected = b.id === selectedId}
      <g transform={`translate(${cx(b.id) - NW / 2}, ${cy(b.id)})`} role="button" tabindex="0"
        onclick={() => onselect(b.id)} style="cursor:{leaf ? 'pointer' : 'default'}">
        <rect width={NW} height={NH} rx="6" fill={selected ? "var(--color-surface-2)" : "var(--color-surface)"}
          stroke={selected ? "var(--color-accent)" : leaf ? "var(--color-muted)" : "var(--color-border)"} stroke-width={selected ? 2 : 1.5} />
        {#if leaf}<rect x="6" y={NH - 7} width={NW - 12} height="3" rx="1.5" fill={branchColor(b.id)} />{/if}
        <text x={NW / 2} y="15" text-anchor="middle" fill={selected ? "var(--color-accent)" : leaf ? "var(--color-fg)" : "var(--color-muted)"} font-size="12" font-weight="600">{b.name}</text>
        <text x={NW / 2} y="27" text-anchor="middle" fill="var(--color-muted)" font-size="9">{leaf ? `${b.history.length} chg` : "ancestor"}</text>
        {#if leaf && touched[b.id]}<circle cx={NW - 8} cy="8" r="3.5" fill="var(--color-accent)" />{/if}
      </g>
    {/each}
  </svg>
</div>
```

---

### `src/lib/components/ControlBar.svelte`

```svelte
<script lang="ts">
  let { turn, pool, base, willDrift, log, onend, ontogglecfg }:
    { turn: number; pool: number; base: number; willDrift: number; log: string[];
      onend: () => void; ontogglecfg: () => void } = $props();
  const pct = $derived(Math.max(0, Math.min(100, (pool / base) * 100)));
</script>

<div class="mt-4 bg-surface rounded-lg border border-border px-3 py-2.5">
  <div class="flex flex-wrap items-center gap-3">
    <span class="text-accent font-medium text-xs">Generation {turn}</span>
    <div class="flex items-center gap-2 grow min-w-40">
      <span class="text-muted text-xs">Influence</span>
      <div class="grow h-2 bg-surface-2 rounded overflow-hidden max-w-xs"><div class="h-full bg-accent" style="width:{pct}%"></div></div>
      <span class="text-fg text-xs tabular-nums">{pool}/{base}</span>
    </div>
    <span class="text-xs text-muted">{willDrift} will drift</span>
    <button onclick={onend} class="text-xs px-3 py-1 rounded bg-surface-2 hover:bg-muted/20 text-fg">End generation ⟳</button>
    <button onclick={ontogglecfg} class="text-xs px-2 py-1 rounded bg-surface-2 hover:bg-muted/20">⚙</button>
  </div>
  {#if log.length}<div class="text-xs text-muted mt-1.5">last gen: {log.join(" · ")}</div>{/if}
</div>
```

---

### `src/lib/components/EconomyCfg.svelte`

```svelte
<script lang="ts">
  import type { Settings } from "$lib/engine/types";
  let { settings, onchange }: { settings: Settings; onchange: (k: keyof Settings, v: number) => void } = $props();
  const fields: [keyof Settings, string][] = [
    ["pool", "base influence"], ["growth", "influence / region"], ["overhead", "attention overhead"],
    ["changeCost", "cost per change"], ["spreadEvery", "spread every N gen"],
  ];
</script>

<div class="mt-2 bg-surface rounded-lg border border-border px-3 py-2.5 flex flex-wrap gap-4">
  {#each fields as [k, label]}
    <label class="flex items-center gap-1.5 text-xs text-muted">{label}
      <input type="number" min={k === "spreadEvery" ? 1 : 0} value={settings[k]}
        oninput={(e) => onchange(k, Number((e.target as HTMLInputElement).value))}
        class="w-14 bg-bg rounded px-1.5 py-0.5 text-accent" />
    </label>
  {/each}
</div>
```

---

### `src/lib/components/Header.svelte`

```svelte
<script lang="ts">
  import type { World } from "$lib/engine/types";
  let { seed = $bindable(), leafCount, world, onload, onnew }:
    { seed: number; leafCount: number; world: World; onload: () => void; onnew: () => void } = $props();
</script>

<div class="border-b border-border pb-4">
  <h1 class="text-lg font-semibold text-accent">The Tongue
    <span class="text-muted font-normal">· {leafCount} living {leafCount === 1 ? "language" : "languages"}</span>
  </h1>
  <div class="flex flex-wrap items-center gap-2 mt-3">
    <span class="text-muted text-xs">seed</span>
    <input type="number" bind:value={seed} class="w-24 bg-surface rounded px-2 py-1 text-accent text-xs" />
    <button onclick={onload} class="px-2.5 py-1 rounded bg-surface-2 hover:bg-muted/20 text-xs">Load</button>
    <button onclick={onnew} class="px-2.5 py-1 rounded bg-accent text-on-accent font-medium text-xs hover:bg-accent/80">New world</button>
  </div>
  <div class="flex flex-wrap gap-x-6 gap-y-1 mt-3 text-xs text-muted">
    <span>syllable <span class="font-mono text-fg">{world.tmpl.label}</span></span>
    <span>vowels <span class="font-mono text-fg">{world.inv.vowels.join(" ")}</span></span>
    <span>consonants <span class="font-mono text-fg">{world.inv.consonants.join(" ")}</span></span>
  </div>
</div>
```

---

### `src/routes/+page.svelte`

```svelte
<script lang="ts">
  import { game } from "$lib/game.svelte";
  import Panel from "$lib/components/Panel.svelte";
  import Header from "$lib/components/Header.svelte";
  import ControlBar from "$lib/components/ControlBar.svelte";
  import EconomyCfg from "$lib/components/EconomyCfg.svelte";
  import MapView from "$lib/components/MapView.svelte";
  import FamilyTree from "$lib/components/FamilyTree.svelte";
  import IntelMatrix from "$lib/components/IntelMatrix.svelte";
  import WordTable from "$lib/components/WordTable.svelte";
  import Changes from "$lib/components/Changes.svelte";
  import HistoryList from "$lib/components/HistoryList.svelte";
</script>

<div class="w-full min-h-screen bg-bg text-fg p-5 font-sans text-sm">
  <div class="max-w-5xl mx-auto">
    <Header bind:seed={game.seed} leafCount={game.leaves.length} world={game.st.world}
      onload={() => game.loadWorld(game.seed)} onnew={() => game.loadWorld(Math.floor(Math.random() * 99999))} />

    <ControlBar turn={game.st.turn} pool={game.st.pool} base={game.st.settings.pool}
      willDrift={game.willDrift} log={game.st.log} onend={() => game.endTurn()} ontogglecfg={() => (game.showCfg = !game.showCfg)} />
    {#if game.showCfg}<EconomyCfg settings={game.st.settings} onchange={(k, v) => game.setCfg(k, v)} />{/if}

    <div class="grid lg:grid-cols-2 gap-4 mt-4">
      <Panel title="Map">
        <MapView world={game.st.world} branches={game.st.branches} selectedId={game.st.selectedId}
          pool={game.st.pool} onselect={(id) => game.selectBranch(id)} onexpand={(r) => game.expandInto(r)} />
      </Panel>
      <Panel title="Family tree">
        <FamilyTree branches={game.st.branches} rootId={game.st.rootId} selectedId={game.st.selectedId}
          touched={game.st.touched} onselect={(id) => game.selectBranch(id)} />
      </Panel>
    </div>

    <div class="mt-4"><Panel title="Mutual intelligibility"><IntelMatrix leaves={game.leaves} /></Panel></div>

    <div class="grid md:grid-cols-5 gap-5 mt-4 items-start">
      <div class="md:col-span-3 sticky top-2 z-10 bg-bg self-start">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-accent font-medium flex items-center gap-2">
            <!-- branchColor generates arbitrary per-branch hues procedurally — not a theme colour -->
            <span class="inline-block w-3 h-3 rounded-sm" style="background:{`hsl(${(game.sel.id * 61 + 25) % 360} 48% 56%)`}"></span>
            {game.sel.name}
            <span class="text-muted font-normal text-xs">· {game.sel.territory.length} region{game.sel.territory.length !== 1 ? "s" : ""} · {game.st.touched[game.st.selectedId] ? "held" : "will drift"}</span>
          </h2>
          {#if game.fracturing}<span class="text-xs text-warn">⚠ will fracture at gen end</span>{/if}
        </div>
        <WordTable lex={game.sel.lex} previewLex={game.previewLex} curHomo={game.curHomo} prevHomo={game.prevHomo} />
      </div>
      <div class="md:col-span-2 space-y-4">
        <Changes candidates={game.candidates} preview={game.preview} stepCost={game.stepCost}
          overheadDue={game.overheadDue} pool={game.st.pool}
          onpreview={(id) => (game.preview = id)} onapply={(id) => game.apply(id)} />
        <HistoryList history={game.sel.history} splitIndex={game.sel.splitIndex} />
      </div>
    </div>
  </div>
</div>
```
