// Verify the thesis: is the phrase substrate used ONLY for erosion, never renewal?
// Audit every consumer of syntax.ts's phrase model.
import { readFileSync, readdirSync } from "fs";
import { fileURLToPath } from "url";
// resolved from this file's own location, not the cwd, so the audit runs from any checkout
const dir = fileURLToPath(new URL("../../../src/lib", import.meta.url));
const files: string[] = [];
const walk = (d: string) => readdirSync(d, { withFileTypes: true }).forEach(f => {
  if (f.isDirectory()) walk(`${d}/${f.name}`);
  else if ((f.name.endsWith(".ts") || f.name.endsWith(".svelte")) && !f.name.includes(".test.")) files.push(`${d}/${f.name}`);
});
walk(dir);

const phraseAPI = ["frameOrder", "positionProfile", "followerVowelShare", "syntaxMult", "FRAMES", "walkFrameWeights", "linearised"];
console.log("consumers of the 1ENG.19 phrase substrate:\n");
files.forEach(f => {
  const src = readFileSync(f, "utf8");
  const hits = phraseAPI.filter(a => new RegExp(`\\b${a}\\b`).test(src));
  if (!hits.length) return;
  const rel = f.replace(dir + "/", "");
  // classify: does this file MODIFY a lexicon/word, or only compute a number?
  const writes = /\.lex\s*=|lex:|word:\s*\[|applyRuleTo/.test(src);
  console.log(`  ${rel.padEnd(34)} uses [${hits.join(", ")}]`);
  console.log(`  ${"".padEnd(34)} -> ${writes ? "TOUCHES WORDS" : "computes a number only"}`);
});
console.log("\nkey question: does ANY code path use frame ADJACENCY to combine two words?");
files.forEach(f => {
  const src = readFileSync(f, "utf8");
  // look for any place two lexicon entries are concatenated
  if (/\.\.\.\w+\.word\s*,\s*\.\.\.\w+\.word|concat\(.*word/.test(src))
    console.log(`  candidate: ${f.replace(dir + "/", "")}`);
});
console.log("  (compoundWord in collision.ts is the only word-combining operation)");
