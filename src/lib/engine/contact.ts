import { hashRand } from "./rng";
import { neighborsOf } from "./geography";
import { leavesOf } from "./tree";
import { intelligibility } from "./intelligibility";
import type { GameState } from "./types";

// 2STK.5 §5 (docs/spikes/2stk-1-rule-choice-stakes.md) — the missing convergent
// incentive. One seeded event per generation between a bordering living pair; success
// odds equal the pair's mutual intelligibility (decision §9.17: pure roll, no
// influence sweetening). Success pays CONTACT_YIELD and opens a trade route, which
// 2GEO.5's resolveBorrow now requires (⚠️ behaviour change — see borrowing.ts).
// First-pass tuning constants, expect a playtest pass.
export const CONTACT_YIELD = 2;
export const CONTACT_TRADE_LOSS = 1;
export const ROUTE_TURNS = 4;

export type ContactKind = "trade" | "marriage" | "warning";
export interface ContactResult {
  aId: number; bId: number; kind: ContactKind; odds: number; success: boolean;
}

const KINDS: ContactKind[] = ["trade", "marriage", "warning"];

// Canonical unordered border-pair key. Contact and routes are symmetric (a border is
// a border from both sides), unlike borrowing's directional ordered pair.
export function routeKey(aId: number, bId: number): string {
  return aId < bId ? `${aId}:${bId}` : `${bId}:${aId}`;
}

export function routeOpen(routes: Record<string, number>, aId: number, bId: number, turn: number): boolean {
  const until = routes[routeKey(aId, bId)];
  return until !== undefined && turn < until;
}

// Every unordered bordering living pair, in ONE canonical order across the whole
// state. neighborsOf returns Set-insertion order per branch (edge-iteration order,
// different depending on which leaf you start from), so its output is normalised to
// [lo, hi], deduped, and sorted by (a, b) here — resolveContact's seeded index pick
// indexes into THIS list, so a stable border set gives a stable pick regardless of
// which branch enumerates first (load-bearing for the live UI preview, which recomputes
// against pre-turn state while resolution runs post-spread — see game.svelte.ts).
export function borderingPairs(s: GameState, owner: Record<number, number>): [number, number][] {
  const seen = new Set<string>();
  const pairs: [number, number][] = [];
  leavesOf(s.branches).forEach((A) => {
    neighborsOf(A.id, A.territory, s.world.edges, owner).forEach((bId) => {
      const B = s.branches[bId]; if (!B || !B.territory.length) return;
      const lo = Math.min(A.id, bId), hi = Math.max(A.id, bId);
      const key = `${lo}:${hi}`;
      if (seen.has(key)) return;
      seen.add(key); pairs.push([lo, hi]);
    });
  });
  return pairs.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
}

// One seeded contact event per generation between a bordering living pair. Odds ARE
// the pair's mutual intelligibility (proxy, flagged in the spike's honesty ledger
// §10) — the player's only lever is upstream intelligibility management.
//
// Fresh salt family (seed+23 / turn*211+53 / {0,1,2}), distinct from drift
// (seed+7/turn*131+17/id*911+3), spread (seed/turn*7+1/id*13+5), salience
// (seed+13/turn*151+29/id*733+i) and borrowing (seed+19/turn*181+41/A*1009+B). The
// third coordinate is a fixed sub-slot rather than a branch id: the pair is picked BY
// INDEX into the canonical borderingPairs list, so the draw must not depend on any
// particular branch identity.
export function resolveContact(s: GameState, owner: Record<number, number>): ContactResult | null {
  const pairs = borderingPairs(s, owner);
  if (!pairs.length) return null;
  const seed = s.world.seed, turn = s.turn;
  const i = Math.min(Math.floor(hashRand(seed + 23, turn * 211 + 53, 0) * pairs.length), pairs.length - 1);
  const [aId, bId] = pairs[i];
  const kindRoll = hashRand(seed + 23, turn * 211 + 53, 1);
  const kind = KINDS[Math.min(Math.floor(kindRoll * KINDS.length), KINDS.length - 1)];
  const odds = intelligibility(s.branches[aId].lex, s.branches[bId].lex);
  const roll = hashRand(seed + 23, turn * 211 + 53, 2);
  return { aId, bId, kind, odds, success: roll < odds };
}

// Whether a resolved contact event opens/renews the pair's trade route. Today this is
// exactly `result.success` (decision §9.17: pure roll) — kept as its own seam because
// intelligibility 0 is an absorbing state (a fully-diverged pair can never roll a
// success, so it can never open a route, so it can never borrow its way back). 2STK.7
// (deferred design spike) will evaluate a second opening condition against that
// deadlock; when it lands, it's one clause here, not a refactor of generation.ts.
export function shouldOpenRoute(result: ContactResult): boolean {
  return result.success;
}
