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
  // 1ENG.13: on a hit, lengthen the previously-emitted output vowel (compensatory
  // lengthening — a coda deletes itself and the vowel before it goes long instead).
  // Optional and false for every pre-1ENG.13 rule, so their output is unaffected.
  lengthensPrev?: boolean;
}

export interface LexEntry { concept: string; word: string[] }
export type Lexicon = LexEntry[];

export type Terrain = "plain" | "hill" | "mountain" | "water";
// 2LEX.2 (2lex-1 spike §3.4): per-world compound headedness for collision-repair
// compounds — modFirst gives stone-path (Germanic/Sinitic), headFirst gives
// path-stone (Romance/Celtic). One language family, one habit; seeded once at
// world genesis (world.ts) and shared by every branch in it.
export type CompoundOrder = "modFirst" | "headFirst";
export interface Region { id: number; x: number; y: number }
export interface Edge { a: number; b: number; passable: boolean; cost: number; name?: Terrain }
export interface AdjEntry { to: number; passable: boolean; cost: number }
export type Adjacency = Record<number, AdjEntry[]>;

export interface Inventory { vowels: string[]; consonants: string[] }
export interface Template { onset: "req" | "opt"; coda: "none" | "opt"; clusters: boolean; label: string }

export interface World {
  seed: number; inv: Inventory; tmpl: Template; lex: Lexicon;
  regions: Region[]; edges: Edge[]; adj: Adjacency; start: number;
  // 2LEX.2: compound headedness, seeded once at genesis (see CompoundOrder above).
  compoundOrder: CompoundOrder;
}
export interface HistoryEntry { name: string; note: string; drift?: boolean; borrow?: boolean }
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
  // language-shift/assimilation death: turns sustained bordering a much larger,
  // near-identical neighbour (see generation.ts). Resets to 0 the moment the trigger
  // stops holding; reaching the threshold empties `territory`, killing the branch.
  assimilationPressure: number;
  // 2LEX.2 (2lex-1 spike §3.2): per-pair grace-period counter for severe homophone
  // collisions, key = sorted "concept|concept". Increments each consecutive turn the
  // pair still collides (generation.ts step 1.5); deleted the moment it heals, repairs,
  // or either concept stops being severe. Children inherit it whole at fracture — the
  // community carried the ambiguity across the split.
  collisionPressure: Record<string, number>;
  // 2STK.3 (2stk-1 spike §3): a decaying per-category multiplier ∈ [1, MOMENTUM_CAP];
  // an absent category reads as 1 (no tendency set yet). Player-applied rules bump
  // their category at full weight, autonomous drift at half (stakes.ts bumpMomentum);
  // every repool decays all present categories back toward 1 (stakes.ts decayMomentum).
  // Joins biasedMult in driftRule's weighted pick — naturalness weight (Rule.w) stays
  // dominant, momentum is a tilt on top, never a gate. See phonology.ts.
  momentum: Partial<Record<RuleCategory, number>>;
}
export interface Settings {
  pool: number; growth: number; overhead: number; changeCost: number; spreadEvery: number;
}
// 2STK.2: a living branch ranked as a succession candidate for a dead focal branch,
// closeness measured by the same kinship-dominant blendDistance reachMult uses —
// see stakes.ts.
export interface HeirCandidate { id: number; name: string; blendDistance: number; mourningMult: number }
// 2STK.2 §2.2/§2.3: a focus decision queued by resolveGeneration for game.svelte.ts
// to surface between turns, exactly like the existing assimilation warning — the
// engine stays a pure state -> state function, the dialog is a UI-side pause on
// this field, never a mid-resolution branch.
export type PendingFocusChoice =
  | { kind: "fracture"; bornIds: number[] }
  | { kind: "succession"; heirs: HeirCandidate[] };

export interface GameState {
  world: World; branches: Record<number, Branch>; rootId: number; selectedId: number;
  nextId: number; turn: number; settings: Settings;
  pool: number; touched: Record<number, boolean>; log: string[];
  // 2STK.2: the self. Moves only at forced moments (fracture of the focal branch,
  // its death) — see stakes.ts and the §2 spike section for why voluntary refocus
  // is deliberately absent.
  focusId: number;
  // 2STK.2 §2.3: hoarse-voice succession penalty, an extra reachMult factor scaled
  // by the inherited heir's distance from the deceased self, ticking down to null.
  mourning: { untilTurn: number; mult: number } | null;
  pendingFocusChoice: PendingFocusChoice | null;
  // 2STK.2 §2.3: the silence ending fired — the game's single formal ending.
  ended: boolean;
  // 2STK.5 §5: open trade routes — canonical unordered border-pair key "loId:hiId"
  // (see contact.ts routeKey) → the turn the route expires. A contact SUCCESS opens/
  // renews a route for ROUTE_TURNS generations; resolveBorrow fires only on a border
  // with an open route (⚠️ behaviour change to shipped 2GEO.5 — borrowing now requires
  // a route the chronicle can trace to a narrated contact success). Expired keys are
  // pruned each repool so the record can't grow unbounded across a long run.
  routes: Record<string, number>;
}
export interface FreeRegion { region: number; cost: number; passable: boolean }
// 2STK.3: momentum is the selected branch's current per-category multiplier for this
// rule's category (stakes.ts momentumMult) — shown beside the candidate in the picker
// so the tendency a rule would reinforce is visible at decision time (spike §1's
// cross-cutting visibility constraint).
export interface Candidate { rule: Rule; fires: number; collDelta: number; momentum: number }
