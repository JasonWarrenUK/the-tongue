export type PhoneType = "C" | "V";

export interface Phone {
  id: string; g: string; type: PhoneType;
  place?: string; manner?: string; voice?: boolean; obstruent?: boolean;
  height?: string; back?: boolean; round?: boolean;
  // 1ENG.12 renewal: long vowels (long) and diphthongs (diph, decomposed structurally
  // since they don't fit the scalar height/back/round model) — see 1eng-11 spike §4.1.
  long?: boolean; diph?: boolean; nucleus?: string; offglide?: string;
}
export interface Patch {
  delete?: boolean; voice?: boolean; manner?: string; place?: string;
  height?: string; back?: boolean; round?: boolean; long?: boolean;
  diph?: boolean; nucleus?: string; offglide?: string;
}
export type RuleCategory = "lenition" | "deletion" | "assimilation" | "vowelShift" | "epenthesis";

// 1ENG.12: a single output segment. `from:"self"` = resolve as (input phone features
// + patch) — the pre-1ENG.12 applyXform semantics. `from:"abs"` = a brand-new segment
// resolved from the patch alone (an inserted/broken-off phone with no source to diff
// against). See 1eng-11 spike §3.
export type Seg =
  | { from: "self"; patch: Patch }
  | { from: "abs"; type: PhoneType; patch: Patch };
// A rule's xform may return a legacy Patch (1-in/<=1-out, pre-1ENG.12 shape) or an
// ordered Seg[] (1-in/N-out, for renewal rules like epenthesis and breaking).
export type XformResult = Patch | Seg[];

export interface Rule {
  id: string; name: string; note: string; w: number; category: RuleCategory;
  match: (p: Phone) => boolean;
  pre: ((p: Phone | null) => boolean) | null;
  post: ((p: Phone | null) => boolean) | null;
  xform: (p: Phone, ctx: { pre: Phone | null; post: Phone | null }) => XformResult;
}

export interface LexEntry { concept: string; word: string[] }
export type Lexicon = LexEntry[];

export type Terrain = "plain" | "hill" | "mountain" | "water";
export interface Region { id: number; x: number; y: number }
export interface Edge { a: number; b: number; passable: boolean; cost: number; name?: Terrain }
export interface AdjEntry { to: number; passable: boolean; cost: number }
export type Adjacency = Record<number, AdjEntry[]>;

export interface Inventory { vowels: string[]; consonants: string[] }
export interface Template { onset: "req" | "opt"; coda: "none" | "opt"; clusters: boolean; label: string }

export interface World {
  seed: number; inv: Inventory; tmpl: Template; lex: Lexicon;
  regions: Region[]; edges: Edge[]; adj: Adjacency; start: number;
}
export interface HistoryEntry { name: string; note: string; drift?: boolean }
// 1ENG.10 rename mechanic: a frozen lexicon snapshot marking a divergence-threshold
// rename. The anchor chain is flat and lives on the branch that keeps drifting under
// it — renames never spawn a new branch id, only fracture does. `driftFromPrev` (1 -
// intelligibility against the previous anchor, or the branch's birth lexicon for the
// first anchor) is the event-density signal the render-time naming collapse (naming.ts)
// uses to decide which anchors stay resolved as distinct eras.
export interface Anchor {
  lex: Lexicon; turn: number; historyIndex: number; driftFromPrev: number;
}
export interface Branch {
  id: number; name: string; parentId: number | null; depth: number;
  splitIndex: number; history: HistoryEntry[]; lex: Lexicon;
  territory: number[]; pressure: number; anchors: Anchor[];
}
export interface Settings {
  pool: number; growth: number; overhead: number; changeCost: number; spreadEvery: number;
}
export interface GameState {
  world: World; branches: Record<number, Branch>; rootId: number; selectedId: number;
  nextId: number; turn: number; settings: Settings;
  pool: number; touched: Record<number, boolean>; log: string[];
}
export interface FreeRegion { region: number; cost: number; passable: boolean }
export interface Candidate { rule: Rule; fires: number; collDelta: number }
