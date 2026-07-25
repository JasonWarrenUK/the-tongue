import { freshState } from "./engine/world";
import { resolveGeneration } from "./engine/generation";
import { RULES, RULE_BY_ID, applyRuleToLex, collisionPairs, homophoneForms } from "./engine/phonology";
import { leavesOf, isLeaf, descendsFrom } from "./engine/tree";
import { ownerMap, freeAdjacentFor, passableComponents, basePool, overheadFor, dominantAssimilator, ASSIM_TURNS } from "./engine/geography";
import { displayName, eraStages, protoBlendFor } from "./engine/naming";
import { buildEraLayout } from "./engine/tree";
import { reachMult, COST_CAP, MOURN_TURNS } from "./engine/stakes";
import type { GameState, Settings, Candidate } from "./engine/types";
import type { EraStage } from "./engine/naming";

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

  loadWorld(s: number) { this.st = freshState(s); this.seed = s; this.preview = null; }

  apply(ruleId: string) {
    const s = this.st; if (s.pendingFocusChoice || s.ended) return;
    const b = s.branches[s.selectedId];
    const ov = s.touched[s.selectedId] ? 0 : overheadFor(b, s.settings);
    const base = s.settings.changeCost + ov;
    const cost = Math.ceil(Math.min(COST_CAP * base, base * reachMult(s, s.selectedId)));
    if (cost > s.pool) return;
    const rule = RULE_BY_ID[ruleId]; const after = applyRuleToLex(b.lex, rule).lex;
    this.st = { ...s, pool: s.pool - cost, touched: { ...s.touched, [s.selectedId]: true },
      branches: { ...s.branches, [s.selectedId]: { ...b, lex: after, history: [...b.history, { name: rule.name, note: rule.note }] } } };
    this.preview = null;
  }
  expandInto(regionId: number) {
    const s = this.st; if (s.pendingFocusChoice || s.ended) return;
    const b = s.branches[s.selectedId], owner = ownerMap(s.branches);
    const fa = freeAdjacentFor(b, s.world.adj, owner).find((f) => f.region === regionId);
    if (!fa) return;
    // 2STK.2 §2.1: reach also prices acting on kin territory, not just rule application.
    const cost = Math.ceil(Math.min(COST_CAP * fa.cost, fa.cost * reachMult(s, b.id)));
    if (cost > s.pool) return;
    this.st = { ...s, pool: s.pool - cost, branches: { ...s.branches, [b.id]: { ...b, territory: [...b.territory, regionId] } } };
  }
  endTurn() {
    if (this.st.pendingFocusChoice || this.st.ended) return;
    this.st = resolveGeneration(this.st); this.preview = null;
  }
  selectBranch(id: number) {
    if (this.st.pendingFocusChoice) return;
    if (isLeaf(this.st.branches, id)) { this.st = { ...this.st, selectedId: id }; this.preview = null; }
  }
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
