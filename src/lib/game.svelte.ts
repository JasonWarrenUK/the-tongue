import { freshState } from "./engine/world";
import { resolveGeneration } from "./engine/generation";
import { RULES, RULE_BY_ID, applyRuleToLex, collisionPairs, homophoneForms, formOf } from "./engine/phonology";
import { leavesOf, isLeaf, descendsFrom } from "./engine/tree";
import { ownerMap, freeAdjacentFor, passableComponents, basePool, overheadFor, dominantAssimilator, dominantTerrain, ASSIM_TURNS } from "./engine/geography";
import { displayName, eraStages, protoBlendFor } from "./engine/naming";
import { buildEraLayout } from "./engine/tree";
import { reachMult, COST_CAP, MOURN_TURNS } from "./engine/stakes";
import { resolveContact } from "./engine/contact";
import { severePairs, pairThreshold, yieldingConcept, modifierCandidates, compoundWord } from "./engine/collision";
import type { GameState, Settings, Candidate } from "./engine/types";
import type { EraStage } from "./engine/naming";
import type { ContactResult } from "./engine/contact";

// 2LEX.2 §3.6: one queued repair prompt — a player-applied rule just landed a NEW
// severe pair. Stores enough for the dialog to render without importing collision.ts.
export interface PendingRepair { pair: [string, string]; yielding: string; candidates: string[] }

class Game {
  seed = $state(1985);
  st = $state<GameState>(freshState(1985));
  preview = $state<string | null>(null);
  showCfg = $state(false);
  // 2LEX.2 §3.6: UI-side pause state, unlike pendingFocusChoice — resolveGeneration
  // never produces a repair prompt, so it has no business on GameState, and it never
  // survives a turn (endTurn/loadWorld both clear it below).
  pendingRepairs = $state<PendingRepair[]>([]);

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
  // 2LEX.2: which concepts sit in a currently-severe pair, and how far each pair's
  // pressure has climbed toward its own threshold — WordTable splits the single warn
  // dot into severe (this) vs merely-tolerated (everything else in curHomo).
  severeConcepts = $derived.by<Set<string>>(() => new Set(severePairs(this.sel.lex).flat()));
  pressureLabel = $derived.by<Record<string, string>>(() => {
    const out: Record<string, string> = {};
    severePairs(this.sel.lex).forEach((pair) => {
      const key = `${pair[0]}|${pair[1]}`;
      const pressure = this.sel.collisionPressure[key] ?? 0;
      const label = `${pressure}/${pairThreshold(pair[0], pair[1])} turns until disambiguation`;
      out[pair[0]] = label; out[pair[1]] = label;
    });
    return out;
  });
  willDrift = $derived(this.leaves.filter((l) => !this.st.touched[l.id]).length);
  overhead = $derived(overheadFor(this.sel, this.st.settings));
  overheadDue = $derived(this.st.touched[this.st.selectedId] ? 0 : this.overhead);
  // 2STK.2 §2.1: reach prices acting on kin from the focal branch — self is always
  // ×1 (× mourning). Capped alongside the base cost so mourning can never soft-lock
  // a run (decision §9.14).
  reach = $derived(reachMult(this.st, this.st.selectedId));
  isFocal = $derived(this.st.selectedId === this.st.focusId);
  stepCost = $derived(Math.ceil(Math.min(COST_CAP * (this.st.settings.changeCost + this.overheadDue), (this.st.settings.changeCost + this.overheadDue) * this.reach)));
  fracturing = $derived(passableComponents(this.sel.territory, this.st.world.adj).length > 1);
  // language-shift/assimilation warning: mirrors `fracturing` but reflects ACCUMULATED
  // state (assimilationPressure), not a live geometric recheck — a branch only warns
  // once it's one turn away from being absorbed, giving the player a chance to react
  // (any drift/expand action on it breaks the streak by changing intelligibility/size).
  assimilatingInto = $derived.by<string | null>(() => {
    const b = this.sel;
    if (b.assimilationPressure < ASSIM_TURNS - 1) return null;
    const dominant = dominantAssimilator(b, this.st.branches, this.st.world.edges, ownerMap(this.st.branches));
    return dominant?.name ?? null;
  });
  // 2STK.2: the self, and any focus decision queued by resolveGeneration for the
  // player to resolve before their next turn's actions (§2.2 fracture / §2.3
  // succession), mirroring how the assimilation warning above is surfaced.
  focal = $derived(this.st.branches[this.st.focusId]);
  pendingFocus = $derived(this.st.pendingFocusChoice);
  ended = $derived(this.st.ended);
  // 2LEX.2 §3.6: the head of the repair queue, the flat changeCost it repairs for
  // (no second overhead, not reach-scaled — see repairCollision), and whether the
  // pool can currently afford it. Tolerate remains available even when it can't.
  pendingRepair = $derived(this.pendingRepairs[0] ?? null);
  repairCost = $derived(this.st.settings.changeCost);
  canRepair = $derived(!!this.pendingRepair && this.repairCost <= this.st.pool);
  // 2STK.5 §5: the pending contact event, previewed BEFORE end-of-turn resolution
  // (the spike's visibility constraint). Live-recomputed against current state
  // exactly like `assimilatingInto` above, never stored on GameState — it tracks the
  // player's actions as they act. Caveat, surfaced honestly in the UI copy:
  // resolveGeneration calls resolveContact at step 3.25 with the POST-spread owner
  // map and POST-drift lexicons, so the odds shift slightly and (if this turn's
  // spread changes the border topology) the pair itself can move. The pair is picked
  // by index into a canonically-sorted pair list precisely so a stable border set
  // gives a stable pick — see contact.ts borderingPairs.
  pendingContact = $derived.by<ContactResult | null>(() =>
    resolveContact(this.st, ownerMap(this.st.branches)));
  // open trade routes as a "loId:hiId" key set, for the matrix's route marker.
  openRoutes = $derived.by<Set<string>>(() => {
    const out = new Set<string>();
    Object.entries(this.st.routes).forEach(([k, until]) => { if (this.st.turn < until) out.add(k); });
    return out;
  });
  // 1ENG.10: one computed display name per branch — the perspective-collapsed era name
  // (bare stem for a living tip, Old/Middle/Late/Proto- for a dead ancestor). Built
  // once per render pass since protoBlendFor needs the branch's live descendant leaves,
  // which only whole-tree context (not the branch itself) can supply.
  displayNames = $derived.by<Record<number, string>>(() => {
    const branches = this.st.branches;
    const out: Record<number, string> = {};
    Object.values(branches).forEach((b) => {
      const alive = isLeaf(branches, b.id);
      const protoBlend = alive ? null : protoBlendFor(leavesOf(branches).filter((l) => descendsFrom(branches, l.id, b.id)));
      out[b.id] = displayName(b, { alive, protoBlend });
    });
    return out;
  });
  // family-tree fix: the per-branch era chronology (Old -> Middle (n/m) -> ... -> tip),
  // one node per stage, for the tree's chained rendering. Same alive/protoBlend
  // derivation as displayNames above (whole-tree context a branch can't self-supply)
  // — kept separate rather than merged since FocusDialog/IntelMatrix only ever want
  // the single collapsed displayNames label, not the full per-stage graph.
  eraGraph = $derived.by(() => {
    const branches = this.st.branches;
    const stagesByBranch: Record<number, EraStage[]> = {};
    Object.values(branches).forEach((b) => {
      const alive = isLeaf(branches, b.id);
      const protoBlend = alive ? null : protoBlendFor(leavesOf(branches).filter((l) => descendsFrom(branches, l.id, b.id)));
      stagesByBranch[b.id] = eraStages(b, { alive, protoBlend });
    });
    return buildEraLayout(branches, this.st.rootId, stagesByBranch);
  });
  // the selected branch's own chronology, for the header's current-stage label + the
  // full-chain hover tooltip.
  selEra = $derived.by<EraStage[]>(() => {
    const branches = this.st.branches, b = this.sel;
    const alive = isLeaf(branches, b.id);
    const protoBlend = alive ? null : protoBlendFor(leavesOf(branches).filter((l) => descendsFrom(branches, l.id, b.id)));
    return eraStages(b, { alive, protoBlend });
  });

  loadWorld(s: number) { this.st = freshState(s); this.seed = s; this.preview = null; this.pendingRepairs = []; }

  apply(ruleId: string) {
    const s = this.st; if (s.pendingFocusChoice || s.ended || this.pendingRepair) return;
    const b = s.branches[s.selectedId];
    const ov = s.touched[s.selectedId] ? 0 : overheadFor(b, s.settings);
    const base = s.settings.changeCost + ov;
    const cost = Math.ceil(Math.min(COST_CAP * base, base * reachMult(s, s.selectedId)));
    if (cost > s.pool) return;
    const rule = RULE_BY_ID[ruleId]; const after = applyRuleToLex(b.lex, rule).lex;
    this.st = { ...s, pool: s.pool - cost, touched: { ...s.touched, [s.selectedId]: true },
      branches: { ...s.branches, [s.selectedId]: { ...b, lex: after, history: [...b.history, { name: rule.name, note: rule.note }] } } };
    this.preview = null;
    // 2LEX.2 §3.6: diff severe pairs before/after — the same before/after comparison
    // collDelta already prices for the picker, narrowed to pairs that newly repair.
    // Drift-caused collisions never prompt; only the player's own rule application does.
    const beforeKeys = new Set(severePairs(b.lex).map((p) => `${p[0]}|${p[1]}`));
    const terrain = dominantTerrain(b.id, b.territory, s.world.edges, ownerMap(s.branches));
    const fresh = severePairs(after).filter((p) => !beforeKeys.has(`${p[0]}|${p[1]}`));
    this.pendingRepairs = fresh.map((pair) => {
      const yielding = yieldingConcept(pair, terrain);
      return { pair, yielding, candidates: modifierCandidates(yielding, pair) };
    });
  }
  expandInto(regionId: number) {
    const s = this.st; if (s.pendingFocusChoice || s.ended || this.pendingRepair) return;
    const b = s.branches[s.selectedId], owner = ownerMap(s.branches);
    const fa = freeAdjacentFor(b, s.world.adj, owner).find((f) => f.region === regionId);
    if (!fa) return;
    // 2STK.2 §2.1: reach also prices acting on kin territory, not just rule application.
    const cost = Math.ceil(Math.min(COST_CAP * fa.cost, fa.cost * reachMult(s, b.id)));
    if (cost > s.pool) return;
    this.st = { ...s, pool: s.pool - cost, branches: { ...s.branches, [b.id]: { ...b, territory: [...b.territory, regionId] } } };
  }
  endTurn() {
    if (this.st.pendingFocusChoice || this.st.ended || this.pendingRepair) return;
    this.st = resolveGeneration(this.st); this.preview = null;
  }
  selectBranch(id: number) {
    if (this.st.pendingFocusChoice || this.pendingRepair) return;
    if (isLeaf(this.st.branches, id)) { this.st = { ...this.st, selectedId: id }; this.preview = null; }
  }
  // 2LEX.2 §3.6: repair now — a second lexical intervention, priced flat at changeCost
  // with no second overhead (touched is already set this turn, so overheadFor naturally
  // yields 0) and deliberately NOT reach-scaled: this is a forced consequence of a rule
  // the player already paid reach on, so double-charging would read as a penalty for a
  // mistake rather than a distance cost (2STK.6's economy pass may revisit). The player
  // picked the modifier, so resolveCollision's ranking/repair-made-collision walk are
  // bypassed entirely — a repair that itself collides is the player's own gamble.
  repairCollision(modifier: string) {
    const p = this.pendingRepair; if (!p) return;
    const s = this.st, cost = s.settings.changeCost;
    if (cost > s.pool) return;
    const b = s.branches[s.selectedId];
    const byConcept = Object.fromEntries(b.lex.map((e) => [e.concept, e.word]));
    const head = byConcept[p.yielding], mod = byConcept[modifier];
    if (!head || !mod) { this.pendingRepairs = this.pendingRepairs.slice(1); return; }
    const word = compoundWord(mod, head, s.world.compoundOrder);
    const lex = b.lex.map((e) => (e.concept === p.yielding ? { ...e, word } : e));
    const key = `${p.pair[0]}|${p.pair[1]}`;
    const collisionPressure = { ...b.collisionPressure }; delete collisionPressure[key];
    const other = p.pair[0] === p.yielding ? p.pair[1] : p.pair[0];
    this.st = { ...s, pool: s.pool - cost,
      branches: { ...s.branches, [b.id]: { ...b, lex, collisionPressure,
        history: [...b.history, { name: "Disambiguation", note: `'${p.yielding}' → ${formOf(word)} (collided with '${other}')` }] } } };
    this.pendingRepairs = this.pendingRepairs.slice(1);
  }
  // 2LEX.2 §3.6: tolerate — free, no immediate effect. The pair falls into the standard
  // pressure clock at the next generation's step 1.5, and the engine repairs it
  // autonomously with the top-ranked modifier if it survives its threshold. A real
  // gamble on the 87% heal rate, with the stake being who chooses the word.
  tolerateCollision() { this.pendingRepairs = this.pendingRepairs.slice(1); }
  setCfg(key: keyof Settings, val: number) {
    const s = this.st; const settings = { ...s.settings, [key]: val };
    const pool = key === "pool" || key === "growth" ? basePool(s.branches, settings) : s.pool;
    this.st = { ...s, settings, pool };
  }
  // 2STK.2 §2.2: the focal branch fractured — carry the self onto the continuing
  // lineage (its own id) or a born fragment.
  chooseFracture(id: number) {
    if (this.st.pendingFocusChoice?.kind !== "fracture") return;
    this.st = { ...this.st, focusId: id, pendingFocusChoice: null };
  }
  // 2STK.2 §2.3: the focal branch died — inherit into a living heir, paying the
  // hoarse-voice mourning penalty for MOURN_TURNS, or elect silence (the game's
  // single formal ending, decision §9.7).
  chooseSuccessor(id: number) {
    if (this.st.pendingFocusChoice?.kind !== "succession") return;
    const heir = this.st.pendingFocusChoice.heirs.find((h) => h.id === id); if (!heir) return;
    this.st = { ...this.st, focusId: id, selectedId: id,
      mourning: { untilTurn: this.st.turn + MOURN_TURNS, mult: heir.mourningMult }, pendingFocusChoice: null };
  }
  electSilence() {
    if (this.st.pendingFocusChoice?.kind !== "succession") return;
    this.st = { ...this.st, ended: true, pendingFocusChoice: null };
  }
}
export const game = new Game();
