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
export type RuleCategory = "lenition" | "deletion" | "assimilation" | "vowelShift";
export interface Rule {
  id: string; name: string; note: string; w: number; category: RuleCategory;
  match: (p: Phone) => boolean;
  pre: ((p: Phone | null) => boolean) | null;
  post: ((p: Phone | null) => boolean) | null;
  xform: (p: Phone, ctx: { pre: Phone | null; post: Phone | null }) => Patch;
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
