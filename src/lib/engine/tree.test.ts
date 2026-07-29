import { describe, test, expect } from "bun:test";
import { buildEraLayout } from "./tree";
import { eraStages } from "./naming";
import { branchDefaults } from "../../../tests/fixtures/branch";
import type { Branch, Anchor, Lexicon } from "./types";

// Family-tree fix: buildEraLayout expands each branch into a chain of era-node rows
// (naming.ts eraStages) and attaches a fracturing child's chain below whichever of the
// PARENT's stages was current at the moment of the split (Branch.splitIndex compared
// against each stage's [loIndex, hiIndex) — see naming.ts eraStages for why the ranges
// are directly comparable to splitIndex).
const LEX: Lexicon = [{ concept: "a", word: ["t", "a"] }];
function anchor(driftFromPrev: number, historyIndex: number): Anchor {
  return { lex: LEX, turn: historyIndex, historyIndex, driftFromPrev };
}
function mkBranch(overrides: Partial<Branch> = {}): Branch {
  return {
    id: 0, name: "Root", parentId: null, depth: 0, splitIndex: 0, history: [],
    lex: LEX, territory: [0], pressure: 0, anchors: [anchor(0, 0)], ...branchDefaults, ...overrides,
  };
}

describe("buildEraLayout: single un-renamed branch", () => {
  test("a lone living branch with no renames gets exactly one node", () => {
    const root = mkBranch();
    const branches = { 0: root };
    const stagesByBranch = { 0: eraStages(root, { alive: true, protoBlend: null }) };
    const layout = buildEraLayout(branches, 0, stagesByBranch);
    expect(layout.nodes.length).toBe(1);
    expect(layout.nodes[0]).toMatchObject({ branchId: 0, stageIndex: 0, isTerminal: true });
    expect(layout.edges).toEqual([]);
  });

  test("every child of a single-stage parent attaches to that one node, regardless of splitIndex", () => {
    const root = mkBranch({ anchors: [anchor(0, 0)] }); // birth anchor only -> single tip stage [0, Infinity)
    const early: Branch = { ...mkBranch({ id: 1, name: "Early", parentId: 0, depth: 1, splitIndex: 2, anchors: [anchor(0, 2)] }) };
    const late: Branch = { ...mkBranch({ id: 2, name: "Late", parentId: 0, depth: 1, splitIndex: 50, anchors: [anchor(0, 50)] }) };
    const branches = { 0: root, 1: early, 2: late };
    const stagesByBranch = {
      0: eraStages(root, { alive: true, protoBlend: null }),
      1: eraStages(early, { alive: true, protoBlend: null }),
      2: eraStages(late, { alive: true, protoBlend: null }),
    };
    const layout = buildEraLayout(branches, 0, stagesByBranch);
    const attachEdges = layout.edges.filter((e) => e.from === "0:0");
    expect(attachEdges.map((e) => e.to).sort()).toEqual(["1:0", "2:0"]);
    // both children start one row below the single parent stage.
    expect(layout.pos["1:0"].row).toBe(1);
    expect(layout.pos["2:0"].row).toBe(1);
  });
});

describe("buildEraLayout: fork-point attachment across multiple parent stages", () => {
  // Parent renamed twice since birth: anchors at historyIndex 0 (birth), 10, 20 ->
  // stages Old [0,10), Middle [10,20), tip [20, Infinity) at rows 0, 1, 2.
  function twoRenameParent(): Branch {
    return mkBranch({ anchors: [anchor(0, 0), anchor(0.6, 10), anchor(0.5, 20)] });
  }

  test("a child that split BEFORE the parent's first rename attaches to the Old stage (row 1)", () => {
    const root = twoRenameParent();
    const child: Branch = mkBranch({ id: 1, name: "EarlyFork", parentId: 0, depth: 1, splitIndex: 3, anchors: [anchor(0, 3)] });
    const branches = { 0: root, 1: child };
    const stagesByBranch = {
      0: eraStages(root, { alive: true, protoBlend: null }),
      1: eraStages(child, { alive: true, protoBlend: null }),
    };
    const layout = buildEraLayout(branches, 0, stagesByBranch);
    expect(layout.edges).toContainEqual({ from: "0:0", to: "1:0" }); // stage 0 = Old
    expect(layout.pos["1:0"].row).toBe(1); // one row below Old (row 0)
  });

  test("a child that split AFTER the parent's last rename attaches to the tip stage (a later row)", () => {
    const root = twoRenameParent();
    const child: Branch = mkBranch({ id: 1, name: "LateFork", parentId: 0, depth: 1, splitIndex: 25, anchors: [anchor(0, 25)] });
    const branches = { 0: root, 1: child };
    const stagesByBranch = {
      0: eraStages(root, { alive: true, protoBlend: null }),
      1: eraStages(child, { alive: true, protoBlend: null }),
    };
    const layout = buildEraLayout(branches, 0, stagesByBranch);
    expect(layout.edges).toContainEqual({ from: "0:2", to: "1:0" }); // stage 2 = tip
    expect(layout.pos["1:0"].row).toBe(3); // one row below tip (row 2)
  });

  test("a child that split DURING a middle era attaches to the Middle stage, not Old", () => {
    // Regression: the buggy eraStages ranges gave Old [0,20) / Middle [20,20), so a
    // splitIndex of 15 (mid-Middle) wrongly attached to the Old node.
    const root = twoRenameParent();
    const child: Branch = mkBranch({ id: 1, name: "MidFork", parentId: 0, depth: 1, splitIndex: 15, anchors: [anchor(0, 15)] });
    const branches = { 0: root, 1: child };
    const stagesByBranch = {
      0: eraStages(root, { alive: true, protoBlend: null }),
      1: eraStages(child, { alive: true, protoBlend: null }),
    };
    const layout = buildEraLayout(branches, 0, stagesByBranch);
    expect(layout.edges).toContainEqual({ from: "0:1", to: "1:0" }); // stage 1 = Middle
    expect(layout.pos["1:0"].row).toBe(2); // one row below Middle (row 1)
  });

  test("early- and late-forking siblings of the same parent attach to visibly different rows", () => {
    const root = twoRenameParent();
    const early: Branch = mkBranch({ id: 1, name: "EarlyFork", parentId: 0, depth: 1, splitIndex: 3, anchors: [anchor(0, 3)] });
    const late: Branch = mkBranch({ id: 2, name: "LateFork", parentId: 0, depth: 1, splitIndex: 25, anchors: [anchor(0, 25)] });
    const branches = { 0: root, 1: early, 2: late };
    const stagesByBranch = {
      0: eraStages(root, { alive: true, protoBlend: null }),
      1: eraStages(early, { alive: true, protoBlend: null }),
      2: eraStages(late, { alive: true, protoBlend: null }),
    };
    const layout = buildEraLayout(branches, 0, stagesByBranch);
    expect(layout.pos["1:0"].row).not.toBe(layout.pos["2:0"].row);
    expect(layout.pos["1:0"].row).toBeLessThan(layout.pos["2:0"].row);
  });
});

describe("buildEraLayout: chain edges within a single branch", () => {
  test("a branch's own stages are linked in sequence, oldest to newest, one row apart", () => {
    const root = mkBranch({ anchors: [anchor(0, 0), anchor(0.6, 10), anchor(0.5, 20)] });
    const branches = { 0: root };
    const stagesByBranch = { 0: eraStages(root, { alive: true, protoBlend: null }) };
    const layout = buildEraLayout(branches, 0, stagesByBranch);
    expect(layout.nodes.length).toBe(3);
    expect(layout.edges).toEqual([{ from: "0:0", to: "0:1" }, { from: "0:1", to: "0:2" }]);
    expect(layout.pos["0:0"].row).toBe(0);
    expect(layout.pos["0:1"].row).toBe(1);
    expect(layout.pos["0:2"].row).toBe(2);
    // only the last stage of a living branch is terminal.
    expect(layout.nodes.map((n) => n.isTerminal)).toEqual([false, false, true]);
  });
});

describe("buildEraLayout: columns", () => {
  test("every stage of one branch shares the same column (a straight vertical chain)", () => {
    const root = mkBranch({ anchors: [anchor(0, 0), anchor(0.6, 10)] });
    const branches = { 0: root };
    const stagesByBranch = { 0: eraStages(root, { alive: true, protoBlend: null }) };
    const layout = buildEraLayout(branches, 0, stagesByBranch);
    const cols = layout.nodes.map((n) => layout.pos[n.key].col);
    expect(new Set(cols).size).toBe(1);
  });

  test("a parent's post-fork stages never collide with a kid's chain (rename-after-fracture)", () => {
    // Regression: the parent's column was the midpoint of its kids' columns, so the
    // instant a fractured parent renamed, its tip node dropped into the same row band
    // as its kids — with a single kid, onto the identical (col, row) as the kid's
    // first node. Every branch must own a column no other branch's nodes sit in.
    const root = mkBranch({ anchors: [anchor(0, 0), anchor(0.6, 10)] }); // Old [0,10) + tip
    const kid: Branch = mkBranch({ id: 1, name: "Kid", parentId: 0, depth: 1, splitIndex: 3, anchors: [anchor(0, 3)] });
    const branches = { 0: root, 1: kid };
    const stagesByBranch = {
      0: eraStages(root, { alive: true, protoBlend: null }),
      1: eraStages(kid, { alive: true, protoBlend: null }),
    };
    const layout = buildEraLayout(branches, 0, stagesByBranch);
    const cells = layout.nodes.map((n) => `${layout.pos[n.key].col},${layout.pos[n.key].row}`);
    expect(new Set(cells).size).toBe(cells.length); // no two nodes share a (col, row)
    const colOf = (id: number) => layout.pos[`${id}:0`].col;
    expect(colOf(0)).not.toBe(colOf(1));
  });

  test("siblings lay out in fork order, not id order (late-spawned early fork sits left)", () => {
    // Regression: kids were sorted by id, so a branch created late in the game but
    // forked from the parent's OLD era landed to the right of younger-era siblings,
    // its attach edge crossing their whole subtree ("Old Ruram past Middle Talen").
    const root = mkBranch({ anchors: [anchor(0, 0), anchor(0.6, 10), anchor(0.5, 20)] });
    const midFork: Branch = mkBranch({ id: 1, name: "MidFork", parentId: 0, depth: 1, splitIndex: 15, anchors: [anchor(0, 15)] });
    const earlyFork: Branch = mkBranch({ id: 2, name: "EarlyFork", parentId: 0, depth: 1, splitIndex: 3, anchors: [anchor(0, 3)] });
    const branches = { 0: root, 1: midFork, 2: earlyFork };
    const stagesByBranch = {
      0: eraStages(root, { alive: true, protoBlend: null }),
      1: eraStages(midFork, { alive: true, protoBlend: null }),
      2: eraStages(earlyFork, { alive: true, protoBlend: null }),
    };
    const layout = buildEraLayout(branches, 0, stagesByBranch);
    // early fork (id 2) left of the trunk, mid fork (id 1) right of it.
    expect(layout.pos["2:0"].col).toBeLessThan(layout.pos["0:0"].col);
    expect(layout.pos["0:0"].col).toBeLessThan(layout.pos["1:0"].col);
  });

  test("sibling branches get distinct columns", () => {
    const root = mkBranch({ anchors: [anchor(0, 0)] });
    const a: Branch = mkBranch({ id: 1, name: "A", parentId: 0, depth: 1, splitIndex: 0, anchors: [anchor(0, 0)] });
    const b: Branch = mkBranch({ id: 2, name: "B", parentId: 0, depth: 1, splitIndex: 0, anchors: [anchor(0, 0)] });
    const branches = { 0: root, 1: a, 2: b };
    const stagesByBranch = {
      0: eraStages(root, { alive: true, protoBlend: null }),
      1: eraStages(a, { alive: true, protoBlend: null }),
      2: eraStages(b, { alive: true, protoBlend: null }),
    };
    const layout = buildEraLayout(branches, 0, stagesByBranch);
    expect(layout.pos["1:0"].col).not.toBe(layout.pos["2:0"].col);
  });
});
