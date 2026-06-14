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
