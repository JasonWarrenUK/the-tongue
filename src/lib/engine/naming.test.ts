import { describe, test, expect } from "bun:test";
import { genStem, blendStems, eraLabels, eraStages, eventDensityPolicy, protoBlendFor, eraContexts, RENAME_CUT, STAGE_CUT } from "./naming";
import { BY_ID, inventoryOf } from "./phonology";
import { branchDefaults } from "../../../tests/fixtures/branch";
import type { Anchor, Branch, Lexicon } from "./types";

const MIXED_LEX: Lexicon = [
  { concept: "a", word: ["t", "a", "p", "e"] },
  { concept: "b", word: ["k", "o"] },
  { concept: "c", word: ["m", "a", "t"] },
  { concept: "d", word: ["s", "i", "n"] },
];

function mkBranch(overrides: Partial<Branch> = {}): Branch {
  return {
    id: 0, name: "Aenic", parentId: null, depth: 0, splitIndex: 0, history: [],
    lex: MIXED_LEX, territory: [0], pressure: 0, anchors: [], ...branchDefaults, ...overrides,
  };
}
function anchor(driftFromPrev: number, turn: number): Anchor {
  return { lex: MIXED_LEX, turn, historyIndex: turn, driftFromPrev };
}

// 1ENG.26: inventoryOf's own describe block moved to phonology.test.ts with the
// function (1eng-23 spike §4.1). MIXED_LEX stays here — genStem's block below still
// needs it, so it's duplicated rather than shared across files.

describe("naming: genStem", () => {
  const inv = inventoryOf(MIXED_LEX);

  test("is deterministic for a given (seed, branchId)", () => {
    const a = genStem(inv, 42, 7);
    const b = genStem(inv, 42, 7);
    expect(a).toBe(b);
  });

  test("different branch ids (typically) produce different stems under the same seed", () => {
    const names = new Set(Array.from({ length: 8 }, (_, i) => genStem(inv, 42, i)));
    expect(names.size).toBeGreaterThan(1);
  });

  test("only draws phones present in the given inventory", () => {
    const allowed = new Set([...inv.vowels, ...inv.consonants]);
    for (let id = 0; id < 20; id++) {
      const stem = genStem(inv, 1, id);
      // g (grapheme) is the phone id itself for every phone in this inventory —
      // decompose the stem back into known graphemes greedily (longest-match) to
      // verify every character sequence traces back to an allowed phone.
      let rest = stem.toLowerCase();
      const graphemes = [...allowed].map((pid) => BY_ID[pid].g).sort((a, b) => b.length - a.length);
      while (rest.length) {
        const hit = graphemes.find((g) => rest.startsWith(g));
        expect(hit).toBeTruthy();
        rest = rest.slice(hit!.length);
      }
    }
  });

  test("is title-cased", () => {
    const stem = genStem(inv, 5, 3);
    expect(stem.charAt(0)).toBe(stem.charAt(0).toUpperCase());
  });
});

describe("naming: blendStems", () => {
  test("is deterministic and regular (same inputs -> same output)", () => {
    expect(blendStems("Aenic", "Boran")).toBe(blendStems("Aenic", "Boran"));
  });

  test("produces a Proto-prefixed, hyphenated blend of both stems", () => {
    const blend = blendStems("Aenic", "Boran");
    expect(blend.startsWith("Proto-")).toBe(true);
    expect(blend).toContain("Boran");
  });
});

describe("naming: eraLabels perspective-collapse", () => {
  test("a living lineage with no renames since birth shows only its bare stem", () => {
    const b = mkBranch({ anchors: [anchor(0, 0)] }); // birth anchor only
    const labels = eraLabels(b, { alive: true, protoBlend: null });
    expect(labels).toEqual([{ text: "Aenic", bucket: "tip" }]);
  });

  test("a living lineage with renames since birth ends on the bare stem (tip), with era stages before it", () => {
    const b = mkBranch({ anchors: [anchor(0, 0), anchor(0.6, 10), anchor(0.5, 20)] });
    const labels = eraLabels(b, { alive: true, protoBlend: null });
    expect(labels[labels.length - 1]).toEqual({ text: "Aenic", bucket: "tip" });
    expect(labels.length).toBeGreaterThan(1);
    expect(labels[0].text).toContain("Aenic");
  });

  test("a dead lineage's newest stage is labelled Late, not left bare", () => {
    const b = mkBranch({ anchors: [anchor(0, 0), anchor(0.6, 10)] });
    const labels = eraLabels(b, { alive: false, protoBlend: null });
    expect(labels.every((l) => l.bucket !== "tip")).toBe(true);
    expect(labels[labels.length - 1].text.startsWith("Late")).toBe(true);
  });

  test("a qualifying multi-branch root is labelled with the pre-resolved Proto-blend", () => {
    const b = mkBranch({ anchors: [anchor(0, 0), anchor(0.7, 5)] });
    const labels = eraLabels(b, { alive: false, protoBlend: "Proto-Aeno-Boric" });
    expect(labels[0].text).toBe("Proto-Aeno-Boric");
  });

  test("event-density policy keeps a high-drift ancient anchor as a resolved boundary even with many low-drift anchors after it", () => {
    // one sharp ancient discontinuity followed by a long run of near-uniform drift —
    // the sharp one should survive collapse as its own boundary (Egyptian-style),
    // not get smoothed into a single "Old X" blob with everything else.
    const anchors: Anchor[] = [anchor(0, 0), anchor(0.9, 1), ...Array.from({ length: 10 }, (_, i) => anchor(0.05, i + 2))];
    const marks = anchors.map((a, i) => ({ historyIndex: a.historyIndex, driftFromPrev: a.driftFromPrev, anchorIndex: i }));
    const buckets = eventDensityPolicy(marks);
    const highDriftIncluded = buckets.some((b) => b.marks.some((m) => m.driftFromPrev === 0.9) && b.marks.length <= 3);
    expect(highDriftIncluded).toBe(true);
  });
});

describe("naming: eraStages historyIndex ranges (family-tree fork-attachment)", () => {
  test("a living lineage with no renames: the single tip stage owns [0, +Infinity)", () => {
    const b = mkBranch({ anchors: [anchor(0, 0)] }); // birth anchor only, historyIndex 0
    const stages = eraStages(b, { alive: true, protoBlend: null });
    expect(stages).toEqual([{ text: "Aenic", bucket: "tip", loIndex: 0, hiIndex: Infinity, anchorIndex: null }]);
  });

  test("a living lineage with renames: oldest stage's loIndex is forced to 0 despite the birth anchor being sliced off", () => {
    // anchors at historyIndex 0 (birth, sliced off since alive), 10, 20 — the surviving
    // "named" anchors start at historyIndex 10, but a child that split at, say,
    // historyIndex 3 (before ANY anchor froze) must still land in the oldest stage.
    const b = mkBranch({ anchors: [anchor(0, 0), anchor(0.6, 10), anchor(0.5, 20)] });
    const stages = eraStages(b, { alive: true, protoBlend: null });
    expect(stages[0].loIndex).toBe(0);
    // ranges are contiguous: each stage's hiIndex is the next stage's loIndex.
    for (let i = 1; i < stages.length; i++) expect(stages[i].loIndex).toBe(stages[i - 1].hiIndex);
    // the terminal (tip) stage's hiIndex is unbounded.
    expect(stages[stages.length - 1].hiIndex).toBe(Infinity);
  });

  test("each stage's range ends at its OWN last anchor, not the next stage's first", () => {
    // Regression: anchors at historyIndex 0 (birth), 10, 20 must partition as
    // Old [0,10) / Middle [10,20) / tip [20,∞) — the buggy arithmetic gave Old [0,20)
    // and a zero-width Middle [20,20), so a child that split during the Middle era
    // (e.g. splitIndex 15) attached to the Old node in the family tree.
    const b = mkBranch({ anchors: [anchor(0, 0), anchor(0.6, 10), anchor(0.5, 20)] });
    const stages = eraStages(b, { alive: true, protoBlend: null });
    expect(stages.map((s) => [s.loIndex, s.hiIndex])).toEqual([[0, 10], [10, 20], [20, Infinity]]);
  });

  test("a dead lineage's terminal (Late) stage also owns an unbounded upper range", () => {
    const b = mkBranch({ anchors: [anchor(0, 0), anchor(0.6, 10)] });
    const stages = eraStages(b, { alive: false, protoBlend: null });
    expect(stages[stages.length - 1].bucket).toBe("late");
    expect(stages[stages.length - 1].hiIndex).toBe(Infinity);
  });

  test("eraLabels is a lossless projection of eraStages (text/bucket only, ranges dropped)", () => {
    const b = mkBranch({ anchors: [anchor(0, 0), anchor(0.6, 10), anchor(0.5, 20)] });
    const ctx = { alive: true, protoBlend: null };
    const stages = eraStages(b, ctx);
    const labels = eraLabels(b, ctx);
    expect(labels).toEqual(stages.map((s) => ({ text: s.text, bucket: s.bucket })));
  });
});

describe("naming: eraStages anchorIndex (1ENG.22 era-viewer link back to Anchor.lex)", () => {
  test("a living lineage: stage anchorIndex points past the sliced-off birth anchor", () => {
    // anchors at real indices 0 (birth, sliced off since alive), 1 (historyIndex 10),
    // 2 (historyIndex 20) — stage 0's anchorIndex must be 1, NOT 0, since `named`
    // (branch.anchors.slice(1)) is offset by one from branch.anchors' true indices.
    const b = mkBranch({ anchors: [anchor(0, 0), anchor(0.6, 10), anchor(0.5, 20)] });
    const stages = eraStages(b, { alive: true, protoBlend: null });
    expect(stages[0].anchorIndex).toBe(1);
    expect(stages[1].anchorIndex).toBe(2);
  });

  test("a dead lineage: stage anchorIndex has no offset (birth anchor is NOT sliced off)", () => {
    const b = mkBranch({ anchors: [anchor(0, 0), anchor(0.6, 10)] });
    const stages = eraStages(b, { alive: false, protoBlend: null });
    expect(stages[0].anchorIndex).toBe(0);
    expect(stages[1].anchorIndex).toBe(1);
  });

  test("the living tip stage has anchorIndex null (its lexicon is the branch's current lex, not a frozen anchor)", () => {
    const b = mkBranch({ anchors: [anchor(0, 0), anchor(0.6, 10)] });
    const stages = eraStages(b, { alive: true, protoBlend: null });
    expect(stages[stages.length - 1].bucket).toBe("tip");
    expect(stages[stages.length - 1].anchorIndex).toBeNull();
  });

  test("every non-terminal stage's anchorIndex resolves back to the anchor whose historyIndex equals the stage's hiIndex", () => {
    const b = mkBranch({ anchors: [anchor(0, 0), anchor(0.6, 10), anchor(0.5, 20)] });
    const stages = eraStages(b, { alive: true, protoBlend: null });
    stages.forEach((s) => {
      if (s.anchorIndex === null) return; // the tip stage
      expect(b.anchors[s.anchorIndex].historyIndex).toBe(s.hiIndex);
    });
  });
});

describe("naming: eraContexts (whole-tree alive/protoBlend pass, 1ENG.22)", () => {
  // two dead ancestors (root, mid) each with two living descendant leaves that have
  // diverged past STAGE_CUT from each other, plus one leaf that hasn't diverged from
  // its sibling — exercises isLeaf, the descendant-leaf walk, and protoBlendFor's own
  // tie-break all in one tree.
  const veryDivergent: Lexicon = MIXED_LEX.map((e) => ({ concept: e.concept, word: [...e.word].reverse() }));

  function fourBranchTree(): Record<number, Branch> {
    const root = mkBranch({ id: 0, name: "Root", parentId: null, territory: [], anchors: [anchor(0, 0)] });
    const mid = mkBranch({ id: 1, name: "Mid", parentId: 0, territory: [], anchors: [anchor(0, 0)] });
    const leafA = mkBranch({ id: 2, name: "Aenic", parentId: 1, lex: MIXED_LEX, territory: [0, 1], anchors: [anchor(0, 0)] });
    const leafB = mkBranch({ id: 3, name: "Boran", parentId: 1, lex: veryDivergent, territory: [2], anchors: [anchor(0, 0)] });
    return { 0: root, 1: mid, 2: leafA, 3: leafB };
  }

  test("agrees with the old per-branch isLeaf/protoBlendFor composition", () => {
    const branches = fourBranchTree();
    const ctx = eraContexts(branches);
    Object.values(branches).forEach((b) => {
      const alive = b.territory.length > 0;
      expect(ctx[b.id].alive).toBe(alive);
      const expectedProto = alive
        ? null
        : protoBlendFor(Object.values(branches).filter((l) => l.territory.length > 0 && descendsFromById(branches, l.id, b.id)));
      expect(ctx[b.id].protoBlend).toBe(expectedProto);
    });
  });

  test("dead branches with no diverged descendants get a null protoBlend", () => {
    const branches = fourBranchTree();
    const ctx = eraContexts(branches);
    // leafA/leafB are alive, so only root/mid are eligible for a Proto-blend at all.
    expect(ctx[0].alive).toBe(false);
    expect(ctx[1].alive).toBe(false);
    expect(ctx[0].protoBlend).not.toBeNull(); // root sees both diverged leaves
    expect(ctx[1].protoBlend).not.toBeNull(); // mid sees both diverged leaves too
  });

  test("preserves protoBlendFor's territory-size tie-break when two pairs share intelligibility", () => {
    // two independent dead roots, each parenting a pair of equally-divergent leaves but
    // with different combined territory sizes — protoBlendFor should still pick each
    // root's own worst/largest pair independently (no cross-root interference from the
    // single shared descendant-leaf pass).
    const smallRoot = mkBranch({ id: 10, name: "Small", parentId: null, territory: [], anchors: [anchor(0, 0)] });
    const smallA = mkBranch({ id: 11, name: "Aenic", parentId: 10, lex: MIXED_LEX, territory: [0], anchors: [anchor(0, 0)] });
    const smallB = mkBranch({ id: 12, name: "Boran", parentId: 10, lex: veryDivergent, territory: [1], anchors: [anchor(0, 0)] });
    const branches = { 10: smallRoot, 11: smallA, 12: smallB };
    const ctx = eraContexts(branches);
    expect(ctx[10].protoBlend).toBe(protoBlendFor([smallA, smallB]));
  });

  // local descendsFrom, independent of tree.ts, so this test doesn't rely on the same
  // helper the implementation uses to check its own output.
  function descendsFromById(br: Record<number, Branch>, id: number, ancestorId: number): boolean {
    let cur: Branch | undefined = br[id];
    while (cur) { if (cur.id === ancestorId) return true; cur = cur.parentId === null ? undefined : br[cur.parentId]; }
    return false;
  }
});

describe("naming: eraContexts never reads Anchor.lex (1ENG.22 heap regression guard)", () => {
  test("throws if anchors is accessed at all — guards against reintroducing the reactive proxy blow-up", () => {
    const base = mkBranch({ id: 0, anchors: [anchor(0, 0)] });
    const poisoned: Branch = new Proxy(base, {
      get(target, prop, receiver) {
        if (prop === "anchors") throw new Error("eraContexts must never read Branch.anchors");
        return Reflect.get(target, prop, receiver);
      },
    });
    expect(() => eraContexts({ 0: poisoned })).not.toThrow();
  });
});

describe("naming: protoBlendFor", () => {
  const veryDivergent: Lexicon = MIXED_LEX.map((e) => ({ concept: e.concept, word: [...e.word].reverse() }));

  test("returns null with fewer than two descendant leaves", () => {
    expect(protoBlendFor([mkBranch({ name: "Aenic" })])).toBeNull();
  });

  test("returns null when descendants haven't diverged past STAGE_CUT (still dialects, not separate languages)", () => {
    const a = mkBranch({ id: 1, name: "Aenic", lex: MIXED_LEX });
    const b = mkBranch({ id: 2, name: "Boran", lex: MIXED_LEX.map((e) => ({ concept: e.concept, word: [...e.word] })) });
    expect(protoBlendFor([a, b])).toBeNull();
  });

  test("blends the two most mutually-unintelligible descendant stems", () => {
    const a = mkBranch({ id: 1, name: "Aenic", lex: MIXED_LEX, territory: [0, 1, 2] });
    const b = mkBranch({ id: 2, name: "Boran", lex: veryDivergent, territory: [3, 4] });
    const blend = protoBlendFor([a, b]);
    expect(blend).not.toBeNull();
    expect(blend).toContain("Boran");
  });
});

describe("naming: cutoffs sanity", () => {
  test("RENAME_CUT is finer-grained (higher) than STAGE_CUT", () => {
    expect(RENAME_CUT).toBeGreaterThan(STAGE_CUT);
  });
});
