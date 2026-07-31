import type { AffixState, Branch, FrameWeights, ParadigmCell, WordOrder } from "../../src/lib/engine/types";

// 1ENG.20: a static, deterministic paradigm — all four cells affixal, suffixed (the
// SOV default above), with short unambiguous forms. A static literal rather than
// seedParadigm(...): fixtures should not depend on world-gen, and most tests care
// about paradigm-tick BEHAVIOUR (given some starting state), not genesis derivation
// (morphology.test.ts owns that). Forms are two segments each so a single erosion
// rule can plausibly touch them without immediately hitting cell death by accident.
const paradigmDefaults: Record<ParadigmCell, AffixState> = {
  past: { stage: "affixal", form: ["t", "a"], suffixed: true, clock: 0 },
  p1sg: { stage: "affixal", form: ["m", "e"], suffixed: true, clock: 0 },
  p2: { stage: "affixal", form: ["s", "u"], suffixed: true, clock: 0 },
  p1pl: { stage: "affixal", form: ["n", "o"], suffixed: true, clock: 0 },
};

// 1ENG.19 — shared defaults for the fields every hand-built Branch/World fixture across
// the test suite needs but rarely varies (assimilationPressure/collisionPressure/momentum
// pre-1ENG.19; wordOrder/frameWeights/proDrop from this task). Spread into each test
// file's own local factory literal (`{ ...branchDefaults, id, name, ... }`) rather than
// replacing those factories outright — their constructor signatures differ deliberately
// (positional vs Partial<Branch> overrides) to fit each file's fixture style, and forcing
// one shared signature would churn call sites for no benefit. This spread object is the
// thing that actually repeats; collapsing IT to one place is what pays off the next time
// a Branch field is added.
export const branchDefaults = {
  assimilationPressure: 0,
  collisionPressure: {} as Record<string, number>,
  momentum: {} as Branch["momentum"],
  wordOrder: { basic: "SOV", adj: "AdjN" } as WordOrder,
  frameWeights: [1, 1, 1, 1] as FrameWeights,
  proDrop: false,
  paradigm: paradigmDefaults,
};

// The three 1ENG.19 World fields (wordOrder is the genesis seed the root's own
// wordOrder is copied from — see world.ts). Spread into each file's hand-built `world:`
// literal the same way as branchDefaults above.
export const worldDefaults = {
  wordOrder: { basic: "SOV", adj: "AdjN" } as WordOrder,
};
