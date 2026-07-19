/**
 * 2LEX.1 severity v2: generate the within-class semantic-relatedness table.
 *
 * Provenance: ConceptNet Numberbatch 19.08 English embeddings
 * (https://conceptnet.s3.amazonaws.com/downloads/2019/numberbatch/numberbatch-en-19.08.txt.gz),
 * cosine similarity per pair, negatives clamped to 0, rounded to 4 dp.
 *
 * Only within-class pairs are scored (cross-class collisions are tolerated by
 * the class gate and never consulted): C(32,2)+C(9,2)+C(3,2)+C(4,2) = 541 pairs
 * over the 48 concepts of the 1ENG.14/1ENG.15 substrate.
 *
 * Usage:  bun run 2lex-1-semantic-distance-gen.ts [path/to/numberbatch-en-19.08.txt.gz]
 * Downloads the embeddings (~310 MB) if no local path is given. Output is
 * written beside this script as 2lex-1-semantic-distance.json; deterministic
 * (same embeddings file → byte-identical output).
 */
/// <reference types="bun-types" />
const NUMBERBATCH_URL =
  "https://conceptnet.s3.amazonaws.com/downloads/2019/numberbatch/numberbatch-en-19.08.txt.gz";

const CLASSES: Record<string, string[]> = {
  noun: "water fire stone tree leaf root seed fish bird dog wolf hand eye ear tooth bone blood skin meat sun moon star sky rain wind hill river path house night day snow".split(" "),
  verb: "eat drink see sleep die give go say finish".split(" "),
  pronoun: "i you we".split(" "), // concept "I" maps to Numberbatch token "i"
  adjective: "big small new old".split(" "),
};
const WORDS = new Set(Object.values(CLASSES).flat());

async function loadVectors(gzPath: string | undefined): Promise<Map<string, number[]>> {
  const stream = gzPath
    ? Bun.file(gzPath).stream()
    : ((await fetch(NUMBERBATCH_URL)).body as ReadableStream<Uint8Array>);
  // casts: lib.dom's DecompressionStream/TextDecoderStream generics disagree with
  // bun-types' stream Uint8Array parameterisation; runtime behaviour is standard and verified.
  const gunzip = new DecompressionStream("gzip") as unknown as ReadableWritablePair<Uint8Array, Uint8Array>;
  const decode = new TextDecoderStream() as unknown as ReadableWritablePair<string, Uint8Array>;
  const lines = stream.pipeThrough(gunzip).pipeThrough(decode);
  const vecs = new Map<string, number[]>();
  let buf = "";
  for await (const chunk of lines) {
    buf += chunk;
    const parts = buf.split("\n");
    buf = parts.pop() ?? "";
    for (const line of parts) {
      const sp = line.indexOf(" ");
      if (sp < 1) continue;
      const w = line.slice(0, sp);
      if (WORDS.has(w) && !vecs.has(w)) {
        vecs.set(w, line.slice(sp + 1).trim().split(" ").map(Number));
        if (vecs.size === WORDS.size) return vecs;
      }
    }
  }
  return vecs;
}

function cosine(a: number[], b: number[]): number {
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < a.length; i++) { num += a[i] * b[i]; da += a[i] * a[i]; db += b[i] * b[i]; }
  return num / (Math.sqrt(da) * Math.sqrt(db));
}

const vecs = await loadVectors(process.argv[2]);
const missing = [...WORDS].filter((w) => !vecs.has(w));
if (missing.length) { console.error(`missing vectors: ${missing.join(", ")}`); process.exit(1); }

const table: Record<string, number> = {};
for (const words of Object.values(CLASSES)) {
  for (let i = 0; i < words.length; i++) {
    for (let j = i + 1; j < words.length; j++) {
      const [a, b] = [words[i], words[j]].sort();
      table[`${a}|${b}`] = Math.max(0, Math.round(cosine(vecs.get(a)!, vecs.get(b)!) * 1e4) / 1e4);
    }
  }
}

const sorted = Object.fromEntries(Object.entries(table).sort(([a], [b]) => a.localeCompare(b)));
const outPath = new URL("./2lex-1-semantic-distance.json", import.meta.url).pathname;
await Bun.write(outPath, JSON.stringify(sorted, null, 1) + "\n");
console.log(`wrote ${Object.keys(sorted).length} pairs to ${outPath}`);
