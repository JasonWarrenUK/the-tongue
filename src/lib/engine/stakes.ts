import type { Branch, GameState, HeirCandidate, RuleCategory } from "./types";
import { kinshipDistance, leavesOf } from "./tree";
import { intelligibility } from "./intelligibility";

// 2STK.2 §2/§8 contract (docs/spikes/2stk-1-rule-choice-stakes.md). First-pass tuning
// constants, expect a playtest pass as BIAS_STRENGTH got in 2GEO.2.
export const W_KIN = 1.0;
export const W_INT = 0.5;
export const KIN_NORM = 4;
export const REACH_CAP = 3.0;
export const HEIR_CUT = 2.0; // blend distance beyond which a branch cannot inherit
export const MOURN_TURNS = 5;
export const COST_CAP = 4.0;
// 2STK.3 (2stk-1 spike §3): drift momentum. First-pass tuning constants straight from
// the spike's contract, expect a playtest pass.
export const MOMENTUM_CAP = 2.0;
export const MOMENTUM_GAIN = 0.3;
export const MOMENTUM_DECAY = 0.1;

// Kinship-dominant blend (decision §9.11): tree distance weighs more than measured
// similarity, so a convergent stranger never becomes cheaper than a fresh sibling.
export function blendDistance(a: Branch, b: Branch, branches: Record<number, Branch>): number {
  if (a.id === b.id) return 0;
  const kin = kinshipDistance(a.id, b.id, branches);
  return W_KIN * (kin / KIN_NORM) + W_INT * (1 - intelligibility(a.lex, b.lex));
}

// Mourning: the hoarse-voice succession penalty (§2.3), an extra reachMult factor
// while active. Ticks down to null in generation.ts's repool step.
export function mourningMult(s: GameState): number {
  return s.mourning && s.turn < s.mourning.untilTurn ? s.mourning.mult : 1;
}

// Capped, never a gate (§2.1): no branch is ever unreachable, distant ones are just
// dear. The target-size (SIZE_COST) and momentum factors from the full §6/§8 formula
// are 2STK.6/2STK.3 — call sites in game.svelte.ts additionally cap the product with
// the branch-size base against COST_CAP.
export function reachMult(s: GameState, targetId: number): number {
  const mourn = mourningMult(s);
  if (targetId === s.focusId) return 1 * mourn;
  const focus = s.branches[s.focusId];
  const target = s.branches[targetId];
  const dist = blendDistance(focus, target, s.branches);
  return Math.min(REACH_CAP, 1 + dist) * mourn;
}

// Succession (§2.3): up to 3 heirs ranked by closeness to the deceased, each carrying
// the mourning penalty that would apply if chosen. Empty ⇒ silence is the only option.
export function heirCandidates(deceased: Branch, s: GameState): HeirCandidate[] {
  return leavesOf(s.branches)
    .filter((b) => b.id !== deceased.id)
    .map((b) => ({ id: b.id, name: b.name, blendDistance: blendDistance(deceased, b, s.branches) }))
    .filter((c) => c.blendDistance <= HEIR_CUT)
    .sort((a, b) => a.blendDistance - b.blendDistance)
    .slice(0, 3)
    .map((c) => ({ ...c, mourningMult: 1 + c.blendDistance }));
}

// Drift momentum (§3): Sapir's drift as a mechanic — applying a rule tilts a branch's
// future autonomous drift toward that rule's category. Absent key reads as 1 (no
// tendency set yet), never below 1.
export function momentumMult(b: Branch, cat: RuleCategory): number {
  return b.momentum[cat] ?? 1;
}
// Both accrual sources are player-weighted (decision §9.15): player-applied rules bump
// at full MOMENTUM_GAIN so momentum stays a legible investment signature; autonomous
// drift bumps at half, letting untouched branches slowly acquire their own character.
export function bumpMomentum(b: Branch, cat: RuleCategory, full: boolean): Branch {
  const gain = full ? MOMENTUM_GAIN : MOMENTUM_GAIN / 2;
  const next = Math.min(MOMENTUM_CAP, momentumMult(b, cat) + gain);
  return { ...b, momentum: { ...b.momentum, [cat]: next } };
}
// Every generation, every present category decays toward 1 by MOMENTUM_DECAY — a
// sustained tendency needs sustained reinforcement, not a one-off spend.
export function decayMomentum(b: Branch): Branch {
  const momentum: Partial<Record<RuleCategory, number>> = {};
  (Object.entries(b.momentum) as [RuleCategory, number][]).forEach(([cat, mult]) => {
    const next = Math.max(1, mult - MOMENTUM_DECAY);
    if (next > 1) momentum[cat] = next; // decayed back to baseline: drop the key, don't carry dead weight
  });
  return { ...b, momentum };
}
