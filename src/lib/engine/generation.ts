import { hashRand } from "./rng";
import { driftRule, applyRuleToLex, formOf, RULE_BY_ID, inventoryOf, phonemicDiff, describeEvent } from "./phonology";
import { ownerMap, freeAdjacentFor, passableComponents, basePool, isolationScore, dominantTerrain, dominantAssimilator, neighborsOf, pairContact, ASSIM_TURNS } from "./geography";
import { leavesOf, isLeaf, childrenOf } from "./tree";
import { genStem, RENAME_CUT } from "./naming";
import { intelligibility } from "./intelligibility";
import { resolveBorrow } from "./borrowing";
import { severePairs, pairThreshold, resolveCollision } from "./collision";
import { resolveUniverbation } from "./univerbation";
import { heirCandidates, bumpMomentum, decayMomentum } from "./stakes";
import { resolveContact, shouldOpenRoute, routeKey, CONTACT_YIELD, CONTACT_TRADE_LOSS, ROUTE_TURNS } from "./contact";
import { walkFrameWeights, ORDER_INNOVATE_RATE } from "./syntax";
import { tickParadigm, licensesProDrop } from "./morphology";
import type { StressRule } from "./syllable";
import type { Anchor, Branch, GameState, HistoryEntry, Lexicon, PendingFocusChoice, RuleCategory, WordOrder, FrameWeights, ParadigmCell, AffixState } from "./types";

// One generation resolves: autonomous drift → collision resolution → univerbation →
// rename check → passive spread → contact event → lexical borrowing → assimilation
// death → geographic fracture → repool.

// 2LEX.2: per-branch per-turn repair budget (step 1.5 below). A live-engine census
// found up to 14 concurrent severe pairs on one branch-turn (drift generates far more
// collisions than the spike's original passive census implied), so 1 was too tight to
// ever clear the chronic tail; 3 clears real backlogs within a few turns while staying
// well short of "every collision fixed instantly."
const MAX_REPAIRS_PER_TURN = 3;

export function resolveGeneration(s: GameState): GameState {
  const seed = s.world.seed, turn = s.turn, adj = s.world.adj, log: string[] = [];
  const branches: Record<number, Branch> = {};
  Object.values(s.branches).forEach((b) => (branches[b.id] = { ...b, territory: [...b.territory], history: [...b.history] }));
  // 2STK.2: at most one focus decision queues per turn (a branch that fractured
  // still owns its largest component, so it can't also be emptied by assimilation
  // the same pass) — the UI pauses on this exactly like the existing log/warnings.
  let pendingFocusChoice: PendingFocusChoice | null = null;

  // 1. drift untouched leaves (terrain-biased: 2GEO.2 — see 2geo-1-terrain-sound-change spike)
  const owner = ownerMap(branches);
  leavesOf(branches).forEach((L) => {
    // 1ENG.19 (spike §3.2): the frame-weight walk ticks for EVERY living leaf,
    // touched or not — usage frequencies drift with the speech community, not with
    // whether the player intervened this turn (unlike drift itself, which `touched`
    // explicitly holds). Ticked BEFORE the drift below so this turn's syntax gate
    // reads this turn's weights, not last turn's — otherwise the PhrasePanel (which
    // reads the post-walk weights) would visibly disagree with the erosion it explains.
    branches[L.id] = { ...branches[L.id], frameWeights: walkFrameWeights(branches[L.id].frameWeights, seed, turn, L.id) };
    const b = branches[L.id];
    const iso = isolationScore(L.id, L.territory, s.world.edges, owner);
    // 1ENG.20 (1eng-15 spike §4): "Player-touched branches tick their paradigms too,
    // with the player's chosen rule" — so the rule the paradigm tick consumes must be
    // resolved BEFORE the touched guard below, unlike the lexicon drift itself (which
    // stays skipped for touched branches). appliedRules carries the id game.svelte.ts's
    // apply() recorded this turn; an untouched branch instead gets its own freshly
    // drawn rule (the same one the lexicon receives just below).
    const rule = s.touched[L.id]
      ? (s.appliedRules[L.id] ? RULE_BY_ID[s.appliedRules[L.id]] : null)
      : driftRule(L.lex, seed, turn, L.id, iso, L.momentum, b.stressRule);
    const { paradigm, events } = tickParadigm(b.paradigm, rule, L.lex, b.wordOrder, seed, turn, L.id,
      { wordOrder: b.wordOrder, frameWeights: b.frameWeights, proDrop: b.proDrop });
    branches[L.id] = { ...branches[L.id], paradigm, proDrop: licensesProDrop(paradigm),
      history: events.length ? [...branches[L.id].history, ...events] : branches[L.id].history };
    events.forEach((e) => log.push(`${L.name}: ${e.note}`));
    if (s.touched[L.id] || !rule) return;
    const terrain = dominantTerrain(L.id, L.territory, s.world.edges, owner);
    const nextLex = applyRuleToLex(L.lex, rule, {
      salience: { terrain, seed, turn, branchId: L.id },
      syntax: { wordOrder: b.wordOrder, frameWeights: b.frameWeights, proDrop: b.proDrop, seed, turn, branchId: L.id },
      // 1ENG.31: without this, a stress-conditioned rule selected just above by
      // driftRule would be applied with no stress view and fail closed to a no-op — the
      // rule would be logged as having drifted while changing nothing. Same StressRule
      // the selection consulted, so selection and application can never disagree.
      stress: b.stressRule,
    }).lex;
    // 1ENG.26 (1eng-23 spike §4.3) — name what the rule just did phonemically. Reporting
    // only: no state change, no RNG. No `drift` flag on these entries (2GEO.4/2LEX.1
    // ruling) — the rule's own drift entry below already carries that, and flagging both
    // would double-count one change in every history filter. `report: true` marks them
    // as a retelling of that drift entry rather than a distinct change, for any
    // per-branch change count that must not double-count the turn these describe.
    const phonemicEntries = phonemicDiff(L.lex, nextLex).map((e) => ({ name: e.kind[0].toUpperCase() + e.kind.slice(1), note: describeEvent(e), report: true }));
    // 2STK.3 §3: autonomous drift bumps momentum at half weight (decision §9.15) —
    // untouched branches slowly acquire a self-reinforcing category profile.
    branches[L.id] = bumpMomentum({ ...branches[L.id],
      lex: nextLex,
      history: [...branches[L.id].history, { name: rule.name, note: rule.note, drift: true }, ...phonemicEntries] }, rule.category, false);
    log.push(`${L.name} drifted (${rule.name.toLowerCase()})`);
  });

  // 1.5 COLLISION RESOLUTION (2LEX.2, 2lex-1 spike §4). Tick a per-pair pressure
  //     counter against this turn's POST-drift forms, drop healed/cross-class/sub-cut
  //     keys, and repair the ripest pairs once they reach their distance-scaled
  //     threshold. Runs after drift (the collision source) and before rename (so the
  //     era check sees the repaired lexicon). No leavesOf > 1 guard, unlike
  //     borrowing/assimilation: a language alone in the world still disambiguates for
  //     itself. No touched guard either: repair is autonomous regardless of player
  //     action. Pure — the whole mechanic adds no RNG beyond world.ts's one
  //     compoundOrder draw.
  //     Capped at MAX_REPAIRS_PER_TURN ripest pairs per branch per turn, not one: a
  //     census run against the real engine (not the passive pre-mechanic census) found
  //     40% of branch-turns carry MULTIPLE concurrent severe pairs (up to 14 at once —
  //     drift creates far more collisions than the spike's original passive numbers
  //     implied), so a strict one-per-turn cap leaves a permanent backlog rather than
  //     ever clearing the chronic tail this mechanic exists for. Each repair in the
  //     batch is resolved against the batch's OWN progressively-updated lex (not the
  //     turn-start snapshot), so a second repair sees the first's new form and can't
  //     silently recreate the collision it just fixed.
  leavesOf(branches).forEach((L) => {
    const b = branches[L.id];
    const severe = severePairs(b.lex);
    // fresh record built from this turn's severe pairs only: the cleanest expression of
    // "reset the moment it heals" — also drops keys for pairs that became cross-class,
    // sub-cut, or whose concepts vanished, with no separate delete pass needed.
    const pressure: Record<string, number> = {};
    severe.forEach((p) => { const k = `${p[0]}|${p[1]}`; pressure[k] = (b.collisionPressure[k] ?? 0) + 1; });
    const ripe = severe
      .filter((p) => pressure[`${p[0]}|${p[1]}`] >= pairThreshold(p[0], p[1]))
      .sort((p, q) => (pressure[`${q[0]}|${q[1]}`] - pairThreshold(q[0], q[1])) - (pressure[`${p[0]}|${p[1]}`] - pairThreshold(p[0], p[1])));
    if (!ripe.length) { branches[L.id] = { ...b, collisionPressure: pressure }; return; }
    // borrowing arm (spike §3.5): the yielding concept isn't known until resolveCollision
    // picks it, so resolve BOTH pair members' potential lenders and let the callee
    // select whichever one is actually yielding. Highest-pairContact passable neighbour
    // whose form differs from the colliding form; deterministic, no RNG. Reads `lex`
    // fresh each call so an earlier repair in this same batch is visible to the next.
    const lenderFor = (concept: string, lex: Lexicon) => {
      let best: { name: string; word: string[]; contact: number } | null = null;
      neighborsOf(L.id, b.territory, s.world.edges, owner).forEach((nId) => {
        const N = branches[nId]; if (!N) return;
        const entry = N.lex.find((e) => e.concept === concept); if (!entry) return;
        if (formOf(entry.word) === formOf(lex.find((e) => e.concept === concept)!.word)) return;
        const contact = pairContact(L.id, nId, b.territory, s.world.edges, owner);
        if (!best || contact > best.contact) best = { name: N.name, word: entry.word, contact };
      });
      return best;
    };
    let lex = b.lex;
    const entries: HistoryEntry[] = [];
    const terrain = dominantTerrain(L.id, b.territory, s.world.edges, owner);
    ripe.slice(0, MAX_REPAIRS_PER_TURN).forEach((pair) => {
      const lender = lenderFor(pair[0], lex) ?? lenderFor(pair[1], lex);
      const res = resolveCollision(pair, lex, terrain, s.world.compoundOrder, lender);
      lex = lex.map((e) => (e.concept === res.concept ? { ...e, word: res.word } : e));
      delete pressure[`${pair[0]}|${pair[1]}`]; // repair clears the pair's clock
      const other = pair[0] === res.concept ? pair[1] : pair[0];
      entries.push({ name: "Disambiguation", note: `'${res.concept}' → ${formOf(res.word)} (collided with '${other}')` });
      log.push(`${L.name} disambiguated '${res.concept}' as '${formOf(res.word)}'`);
    });
    branches[L.id] = { ...b, lex, collisionPressure: pressure, history: [...b.history, ...entries] };
  });

  // 1.75 UNIVERBATION (1ENG.27, 1eng-25 spike §4/§4.3). The engine's first consumer of
  //      frame ADJACENCY rather than a phrase scalar: a word under contrast pressure
  //      (<=UNIVERB_MAX_SEGMENTS segments, or currently homophonous) fuses with a
  //      modifier drawn from the classes its branch's own linearised frames place
  //      immediately BEFORE it. Both stems stay whole — clipping is precisely what
  //      neuters 2LEX.2's compound repair (spike §2.1: only 2 of 48 concepts end up
  //      longer than genesis under it), and this mechanic exists to answer the
  //      monosyllabic collapse that repair could not.
  //      AFTER 1.5 because the trigger reads POST-repair homophony: a collision step
  //      1.5 just fixed must not also trigger a fusion for the same pressure. BEFORE 2
  //      for the same reason step 1.5 is — the era check must see the final lexicon.
  //      No `touched` guard: renewal is autonomous regardless of player action, exactly
  //      like collision repair. No `leavesOf > 1` guard either: a language alone in the
  //      world still compounds for itself.
  //      Reads `branches[L.id]` rather than the loop's `L`, since step 1.5 above may
  //      already have rewritten this branch's lexicon this same turn.
  leavesOf(branches).forEach((L) => {
    const b = branches[L.id];
    const { lex, events } = resolveUniverbation(b.lex, b.wordOrder, b.frameWeights, seed, turn, L.id);
    if (!events.length) return;
    branches[L.id] = { ...b, lex, history: [...b.history, ...events] };
    events.forEach((e) => log.push(`${L.name}: ${e.note}`));
  });

  // 2. divergence-threshold rename (1ENG.10): every branch is born with one implicit
  //    anchor (its birth lexicon — seeded in world.ts/freshState and at fracture birth
  //    below), so there is always a most-recent anchor to compare the live lexicon
  //    against. Once that comparison's intelligibility drops below RENAME_CUT, freeze
  //    a new Anchor. This never mints a branch id — only fracture does — the lineage
  //    just accrues a marker in its own anchor chain, which naming.ts's render-time
  //    collapse turns into the Old/Middle/Late/Proto- display names. Frequent by
  //    design; legibility is the collapse's job, not the freeze rate's.
  leavesOf(branches).forEach((L) => {
    const b = branches[L.id];
    const last = b.anchors[b.anchors.length - 1];
    if (!last) return; // defensive: every branch should have a birth anchor
    const intel = intelligibility(b.lex, last.lex);
    if (intel < RENAME_CUT) {
      const anchor: Anchor = { lex: b.lex, turn, historyIndex: b.history.length, driftFromPrev: 1 - intel };
      branches[L.id] = { ...b, anchors: [...b.anchors, anchor] };
      log.push(`${b.name} entered a new era`);
    }
  });

  // 3. passive expansion (prefer passable; cross a barrier only when boxed in)
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

  // 3.25 CONTACT EVENT (2STK.5 §5). One seeded event per generation between a
  //      bordering living pair; odds ARE the pair's mutual intelligibility (decision
  //      §9.17: pure roll, displayed pre-resolution via game.svelte.ts's live
  //      pendingContact preview, no influence sweetening). Runs after spread (owner
  //      map is final for this turn) and before borrowing (a fresh success licenses
  //      borrowing the SAME turn, per §7). Called against the LOCAL mutated `branches`
  //      (post-drift lexicons) rather than s.branches, since odds must read this
  //      turn's live intelligibility.
  let contactYield = 0;
  const routes: Record<string, number> = { ...s.routes };
  const contactResult = resolveContact({ ...s, branches }, owner);
  if (contactResult) {
    const A = branches[contactResult.aId], B = branches[contactResult.bId];
    const pct = Math.round(contactResult.odds * 100);
    if (shouldOpenRoute(contactResult)) {
      contactYield += CONTACT_YIELD;
      // route opens on the turn resolved (`turn`) through ROUTE_TURNS further
      // generations, tested against the RETURNED state's turn (turn + 1) — see repool.
      routes[routeKey(A.id, B.id)] = turn + 1 + ROUTE_TURNS;
      log.push(`${contactResult.kind} between ${A.name} and ${B.name} succeeded (${pct}%) — trade route open`);
    } else if (contactResult.kind === "trade") {
      contactYield -= CONTACT_TRADE_LOSS;
      log.push(`trade between ${A.name} and ${B.name} failed (${pct}%)`);
    } else if (contactResult.kind === "warning") {
      // §9.18: a failed warning ACCELERATES an existing assimilation countdown, it
      // never starts one from nothing — the smaller branch must already have a
      // qualifying dominant assimilator (checked live, same call step 4 makes). Step
      // 4's own +1 can then complete the assimilation this same turn; that stacking
      // is intended (decision: the warning went unheeded). Size tie -> lower id,
      // mirroring the fracture/assimilation tie-break convention.
      const small = A.territory.length <= B.territory.length ? A : B;
      if (dominantAssimilator(small, branches, s.world.edges, owner)) {
        branches[small.id] = { ...branches[small.id], assimilationPressure: branches[small.id].assimilationPressure + 1 };
        log.push(`a warning between ${A.name} and ${B.name} went unheeded (${pct}%) — ${small.name} wavers`);
      } else {
        log.push(`a warning between ${A.name} and ${B.name} went unheeded (${pct}%)`);
      }
    } else {
      log.push(`a marriage between ${A.name} and ${B.name} came to nothing (${pct}%)`);
    }
  }

  // 3.5 lexical borrowing: bordering living neighbours converge (2GEO.4). Directional,
  //     per ordered pair, contact-throttled, and now additionally gated on an open
  //     trade route (2STK.5 — see borrowing.ts). Salient concepts resist drift (step
  //     1) yet are the ones that cross borders here — the real Wanderwort profile.
  //     Runs after spread (owner map is final for this turn) and before assimilation
  //     (a doomed branch's salient words can still cross into its absorber first).
  //     Guarded like assimilation: a lone/boxed-in branch has no neighbour to borrow
  //     from.
  if (leavesOf(branches).length > 1) {
    leavesOf(branches).forEach((A) => {
      neighborsOf(A.id, A.territory, s.world.edges, owner).forEach((bId) => {
        const B = branches[bId]; if (!B) return;
        const res = resolveBorrow(branches[A.id], B, s.world.edges, owner, seed, turn, routes);
        if (!res) return;
        const lex = branches[A.id].lex.map((e) =>
          e.concept === res.concept ? { ...e, word: res.word } : e);
        branches[A.id] = { ...branches[A.id], lex,
          history: [...branches[A.id].history, { name: "Borrowing", note: `borrowed '${res.concept}' from ${B.name}`, borrow: true }] };
        log.push(`${A.name} borrowed '${res.concept}' from ${B.name}`);
      });
    });
  }

  // 4. language-shift/assimilation death: a much smaller branch bordering a
  //    near-identical dominant neighbour, sustained over ASSIM_TURNS turns, stops
  //    being spoken as its own language and its territory transfers to the neighbour.
  //    Runs after spread (this turn's growth has settled) and before fracture (a
  //    neighbour that just absorbed territory may itself now need re-splitting).
  //    Guarded on >1 living leaf so a lone/boxed-in branch — which by definition has no
  //    neighbour to assimilate into — can never be evaluated into extinction.
  if (leavesOf(branches).length > 1) {
    leavesOf(branches).forEach((L) => {
      const b = branches[L.id];
      // dominant candidate = most mutually intelligible qualifying neighbour; ties
      // broken by larger territory, then lower id (mirrors the fracture tie-break) —
      // shared with the live UI warning check (game.svelte.ts), see geography.ts.
      const dominant = dominantAssimilator(b, branches, s.world.edges, owner);
      if (!dominant) { if (b.assimilationPressure) branches[L.id] = { ...b, assimilationPressure: 0 }; return; }
      const pressure = b.assimilationPressure + 1;
      if (pressure < ASSIM_TURNS) { branches[L.id] = { ...b, assimilationPressure: pressure }; return; }
      // threshold reached: absorb. Re-read the dominant branch in case an earlier
      // absorption this same pass already grew it.
      const absorber = branches[dominant.id];
      branches[absorber.id] = { ...absorber, territory: [...absorber.territory, ...b.territory] };
      b.territory.forEach((r) => (owner[r] = absorber.id));
      branches[L.id] = { ...b, territory: [], assimilationPressure: 0 };
      log.push(`${b.name} assimilated into ${absorber.name}`);
      // 2STK.2 §2.3: the self just died. Not a new pressure counter — the focal
      // branch's death IS this same assimilation trigger. Queue succession; focusId
      // itself moves only once the player (or silence) resolves the dialog.
      if (L.id === s.focusId) {
        const heirs = heirCandidates(b, { ...s, branches });
        pendingFocusChoice = { kind: "succession", heirs };
      }
    });
  }

  // 5. fracture any territory no longer joined by passable terrain (1ENG.10:
  //    lineage-continuation). The parent's lineage CONTINUES on its largest surviving
  //    component (ties -> lowest region id) — same id, name, history, anchors. Only
  //    the OTHER component(s) spin off as new siblings, each with a fresh phonotactic
  //    stem (naming.ts genStem, drawn from the parent's own inventory) and the 1ENG.9
  //    birth-divergence drift step. The continuing parent gets no birth-divergence:
  //    it's the same language, mid-sentence, not a new one.
  let nextId = s.nextId;

  // one birth drift step for a freshly-copied sibling lexicon; null rule (unreachable
  // backstop, 1eng-11 spike §6) leaves the sibling an exact parent copy, never throws.
  // A newborn sibling has no momentum history yet (empty {} — see the born-branch
  // literal below), so this call's momentum arg is always a no-op multiplier of 1;
  // still passed through for signature consistency with the other driftRule call site.
  const divergeAtBirth = (
    lex: Lexicon, childId: number, territory: number[], owner: Record<number, number>, momentum: Branch["momentum"],
    syntax: { wordOrder: WordOrder; frameWeights: FrameWeights; proDrop: boolean }, stress: StressRule,
  ): { lex: Lexicon; entries: HistoryEntry[]; category: RuleCategory | null } => {
    const iso = isolationScore(childId, territory, s.world.edges, owner);
    const rule = driftRule(lex, seed, turn, childId, iso, momentum, stress);
    if (!rule) return { lex, entries: [], category: null };
    const terrain = dominantTerrain(childId, territory, s.world.edges, owner);
    // the child diverges under its OWN (possibly just-reanalysed) order — that's the
    // whole point of rolling reanalysis before this call, not after.
    const next = applyRuleToLex(lex, rule, {
      salience: { terrain, seed, turn, branchId: childId },
      syntax: { ...syntax, seed, turn, branchId: childId },
      // 1ENG.31: the sibling's OWN stressRule (inherited-by-copy from the parent at
      // fracture, per the tree-continuity invariant), not the continuing parent's — they
      // happen to be the same value at birth, but the parameter is threaded explicitly
      // rather than closed over `s` to keep this function's inputs self-contained.
      stress,
    }).lex;
    // 1ENG.26 (1eng-23 spike §6) — the same phonemic-event reporting as step 1's drift,
    // recorded here too since this is the other site a lexicon-rewriting rule fires
    // outside the player's own apply(). No `drift` flag, same reasoning as step 1.
    const phonemicEntries = phonemicDiff(lex, next).map((e) => ({ name: e.kind[0].toUpperCase() + e.kind.slice(1), note: describeEvent(e), report: true }));
    return { lex: next, entries: [{ name: rule.name, note: `at fracture: ${rule.note}`, drift: true }, ...phonemicEntries], category: rule.category };
  };

  // 1ENG.19 (1eng-14 spike §5) — fracture-birth reanalysis, stage A's one order
  // mutation. Both stage-B drivers (1ENG.21) are convergent — rigidification always
  // lands on SVO, contact pulls neighbours together — so left alone the world's order
  // diversity can only shrink. This is the divergent counterweight: a new speech
  // community has a small seeded chance of flipping exactly one order axis (creole/
  // koine formation reanalyses inherited syntax; child acquisition in emerging
  // varieties drives the innovation). Salt (seed+37, turn*193+59, childId*1013+k):
  // disjoint on the first coordinate from every other registered family (spread/
  // genStem: seed, drift: seed+7, salience: seed+13, borrow: seed+19, contact:
  // seed+23, syntax gate: seed+29, frame walk: seed+31).
  const reanalyse = (order: WordOrder, childId: number): { order: WordOrder; flipped: boolean } => {
    const fire = hashRand(seed + 37, turn * 193 + 59, childId * 1013 + 7);
    if (fire >= ORDER_INNOVATE_RATE) return { order, flipped: false };
    // "flips exactly one axis": pick the axis (uniform), then pick a NEW value on it
    // from the alternatives EXCLUDING the current one — so a fire always produces an
    // observable change; a same-value redraw would make the measured rate silently
    // undershoot ORDER_INNOVATE_RATE. Uniform over axes and values is a deliberate
    // diversity choice (spike §5): real new-community varieties themselves skew SVO,
    // but the mechanic exists specifically to counter that convergent pull.
    const axis = hashRand(seed + 37, turn * 193 + 59, childId * 1013 + 8) < 0.5 ? "basic" : "adj";
    if (axis === "adj") return { order: { ...order, adj: order.adj === "AdjN" ? "NAdj" : "AdjN" }, flipped: true };
    const alts = (["SOV", "SVO", "VSO"] as const).filter((v) => v !== order.basic);
    const pick = alts[Math.floor(hashRand(seed + 37, turn * 193 + 59, childId * 1013 + 9) * alts.length)];
    return { order: { ...order, basic: pick }, flipped: true };
  };

  leavesOf(branches).forEach((L) => {
    const comps = passableComponents(branches[L.id].territory, adj);
    if (comps.length > 1) {
      const parent = branches[L.id];
      // largest component continues the parent lineage; ties -> lowest region id.
      const ranked = [...comps].sort((a, b) => b.length - a.length || Math.min(...a) - Math.min(...b));
      const [main, ...rest] = ranked;
      const names: string[] = [];
      const born: number[] = [];
      rest.forEach((comp) => {
        const id = nextId++;
        const name = genStem(inventoryOf(parent.lex), seed, id); names.push(name); born.push(id);
        const startLex = parent.lex.map((e) => ({ concept: e.concept, word: [...e.word] }));
        // 1ENG.19: the three syntax fields inherit whole — the community carried its
        // grammar across the split — then the reanalysis roll may flip one order axis.
        // frameWeights is COPIED (a fresh array), not shared: the sibling's own future
        // walkFrameWeights ticks must never mutate the parent's tuple.
        const { order, flipped } = reanalyse(parent.wordOrder, id);
        if (flipped) log.push(`the young of ${parent.name} speak in a new order`);
        // birth anchor: the sibling's starting lexicon, so subsequent rename checks
        // measure drift from the moment it became its own lineage, not the parent's.
        // 2LEX.2: collisionPressure inherited whole — the community carried the
        // ambiguity across the split (2lex-1 spike §3.2).
        // 2STK.3: a newborn sibling starts with no momentum — it hasn't drifted yet.
        // 1ENG.20: paradigm is DEEP-copied (AffixState.form is a string[], so a shallow
        // { ...parent.paradigm } would share four arrays across siblings) — same
        // treatment as startLex just above, not the shallow collisionPressure copy:
        // the sibling's own future erosion must never mutate the parent's affix forms.
        const paradigm = Object.fromEntries(
          Object.entries(parent.paradigm).map(([cell, st]) => [cell, { ...st, form: [...st.form] }]),
        ) as Record<ParadigmCell, AffixState>;
        // 1ENG.30: stressRule inherited whole and copied (not shared), same reason as
        // frameWeights just above — a sibling's own future state must never mutate the
        // parent's. No divergence roll yet (unlike wordOrder's reanalyse): §4's
        // STRESS_SHIFT_RATE hook is declared but deliberately unshipped.
        branches[id] = { id, name, parentId: parent.id, depth: parent.depth + 1, splitIndex: parent.history.length, history: [...parent.history], lex: startLex, territory: comp, pressure: 0, anchors: [{ lex: startLex, turn, historyIndex: parent.history.length, driftFromPrev: 0 }], assimilationPressure: 0, collisionPressure: { ...parent.collisionPressure }, momentum: {}, wordOrder: order, stressRule: { ...parent.stressRule }, frameWeights: [...parent.frameWeights] as FrameWeights, proDrop: parent.proDrop, paradigm };
      });
      branches[L.id] = { ...parent, territory: main };
      // parent keeps its component; siblings own theirs — ownerMap reflects the
      // post-split ownership (incl. any earlier parent's split committed this same
      // generation).
      const owner2 = ownerMap(branches);
      born.forEach((id) => {
        const child = branches[id];
        const { lex, entries, category } = divergeAtBirth(child.lex, id, child.territory, owner2, child.momentum,
          { wordOrder: child.wordOrder, frameWeights: child.frameWeights, proDrop: child.proDrop }, child.stressRule);
        const updated = { ...child, lex, history: entries.length ? [...child.history, ...entries] : child.history };
        // 2STK.3: this half-weight bump (+MOMENTUM_GAIN/2) takes one repool decay tick
        // (-MOMENTUM_DECAY, below) before the turn returns, same as every other
        // branch's momentum this generation — so the sibling's very first accrual
        // nets to a smaller visible gain than the raw half-weight bump would suggest.
        branches[id] = category ? bumpMomentum(updated, category, false) : updated;
      });
      if (names.length) log.push(`${parent.name} fractured → ${names.join(", ")}`);
      // 2STK.2 §2.2: the self just split. Focus provisionally stays on the
      // continuing lineage (same id as the parent — no reassignment needed for
      // that case), but the player gets a free reassignment to any born fragment
      // before their next turn's actions.
      if (L.id === s.focusId && born.length) pendingFocusChoice = { kind: "fracture", bornIds: [...born] };
    }
  });

  let selectedId = s.selectedId;
  if (!isLeaf(branches, selectedId)) {
    const kids = childrenOf(branches, selectedId);
    if (kids.length) selectedId = kids[0].id;
    else { const living = leavesOf(branches); if (living.length) selectedId = living[0].id; }
  }
  // 2STK.3 §3: momentum decays toward 1 every generation, for every branch (dead
  // branches decay too — cheap, and means a later-revived lineage never carries a
  // frozen-mid-decay artefact if the model changes; living or not, this is a pure
  // per-turn tick like mourning/routes below).
  Object.values(branches).forEach((b) => (branches[b.id] = decayMomentum(b)));
  // 2STK.2: mourning ticks down toward expiry alongside every other per-turn clock.
  const mourning = s.mourning && turn + 1 >= s.mourning.untilTurn ? null : s.mourning;
  // 2STK.5 §5: routes lapse and are renewed by fresh successes — prune expired keys
  // each repool so the record can't grow unbounded across a long run. Expiry is
  // checked against the turn the returned state will be at.
  const liveRoutes: Record<string, number> = {};
  Object.entries(routes).forEach(([k, until]) => { if (turn + 1 < until) liveRoutes[k] = until; });
  return { ...s, branches, nextId, turn: turn + 1, pool: Math.max(0, basePool(branches, s.settings) + contactYield), routes: liveRoutes, touched: {}, appliedRules: {}, selectedId, log, mourning, pendingFocusChoice: pendingFocusChoice ?? s.pendingFocusChoice };
}
