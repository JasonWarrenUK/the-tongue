import { describe, test, expect } from "bun:test";
import { inventoryOf, genStem, blendStems, eraLabels, eventDensityPolicy, protoBlendFor, RENAME_CUT, STAGE_CUT } from "./naming";
import { BY_ID } from "./phonology";
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
    lex: MIXED_LEX, territory: [0], pressure: 0, anchors: [], ...overrides,
  };
}
function anchor(driftFromPrev: number, turn: number): Anchor {
  return { lex: MIXED_LEX, turn, historyIndex: turn, driftFromPrev };
}

describe("naming: inventoryOf", () => {
  test("collects distinct vowel/consonant phone ids from a lexicon", () => {
    const inv = inventoryOf(MIXED_LEX);
    // MIXED_LEX ids: t,a,p,e,k,o,m,s,i,n
    ["t", "p", "k", "m", "s", "n"].forEach((id) => expect(inv.consonants).toContain(id));
    ["a", "e", "o", "i"].forEach((id) => expect(inv.vowels).toContain(id));
  });

  test("falls back to a minimal CV pair for an empty lexicon rather than starving genStem", () => {
    const inv = inventoryOf([]);
    expect(inv.vowels.length).toBeGreaterThan(0);
    expect(inv.consonants.length).toBeGreaterThan(0);
  });
});

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
    const buckets = eventDensityPolicy(anchors);
    const highDriftIncluded = buckets.some((b) => b.anchors.some((a) => a.driftFromPrev === 0.9) && b.anchors.length <= 3);
    expect(highDriftIncluded).toBe(true);
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
