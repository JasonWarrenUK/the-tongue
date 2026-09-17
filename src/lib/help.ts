// tweaks-1: plain UI copy for the tutorialisation layer. Deliberately outside
// src/lib/engine/ — the engine stays framework-free and this is display-only prose,
// never consumed by simulation logic.
export interface HelpTopic { title: string; body: string[] }

export const HELP: Record<string, HelpTopic> = {
  intro: {
    title: "Welcome to The Tongue",
    body: [
      "You are a language. Not a person, not a nation: the tongue itself, born from a seed with its own sounds, its own syllable shape and a 32-word vocabulary, spoken across a small map.",
      "Left alone, you drift. Every generation, your sounds shift on their own in small, semi-random ways, nudged by the terrain your speakers live on. Mountains isolate. Open ground invites contact. Either way, change comes whether you steer it or not.",
      "You spend influence to steer it instead: apply a sound change, push your speakers into new territory, or hold your shape against drift for a generation. Influence refills a little each time.",
      "Meanwhile, every other branch of the family is drifting too, changing beside you, sometimes into unrecognisable cousins. Start simple: look at Available Changes, apply one, then end the generation and hear what you've become.",
    ],
  },
  familyTree: {
    title: "About the Family Tree",
    body: [
      "One column per branch, one row per era. A branch renames into a new era (Old, Middle, Late, Proto-) once its vocabulary has drifted far enough from where it last stood.",
      "Click any era to read the branch as it stood then, including the words it used at that point.",
      "The diamond marks the self, the branch you're currently steering. A held branch resisted drift this generation because you spent influence on it.",
    ],
  },
  territory: {
    title: "About Territory",
    body: [
      "The map shows who holds which region. Tap a region you already hold to select that branch, or tap a glowing neighbouring region to expand into it.",
      "Expanding costs influence and grows a branch's reach, but also its exposure: a branch spread across a mountain range or a strait can fracture if the connection between its regions is cut.",
    ],
  },
  intelligibility: {
    title: "About Intelligibility",
    body: [
      "A rough score, out of 100, for how much two living branches' vocabularies still resemble each other.",
      "Green means they'd probably still understand one another. Red means they've drifted far enough apart to be separate languages in every sense that matters.",
      "A linked border (⇄) means the two branches can trade words with each other through contact, borrowing vocabulary across the gap.",
    ],
  },
  lexicon: {
    title: "About the Lexicon",
    body: [
      "The selected branch's current vocabulary: one row per concept, alongside the word it uses for it.",
      "Applying a sound change previews its effect here before you commit influence to it, so you can see exactly which words change and how.",
    ],
  },
  inventory: {
    title: "About the Inventory",
    body: [
      "The full set of vowel and consonant sounds this branch's words are built from, plus its syllable shape.",
      "Sound changes work by shifting, merging or dropping these sounds, so the inventory shrinks or reshapes as a branch evolves.",
    ],
  },
  phrases: {
    title: "About Phrases",
    body: [
      "Example sentences built from the branch's current grammar: word order, whether subjects can be dropped, and how words agree with each other.",
      "Sustained contact with a neighbouring branch can pull word order toward theirs, or fix it in place entirely if agreement marking erodes away.",
    ],
  },
  changes: {
    title: "About Available Changes",
    body: [
      "The sound changes you can currently apply to the selected branch, at the cost shown on each card.",
      "Hover or tap a card to preview its effect on the lexicon before committing. Use Expert or Casual (top right) to switch every card between the technical name and formula, and a plain-English name with a worked example.",
      "Chips on each card show how many words it affects, whether it creates any new collisions between words, and any cost multiplier from momentum or word order.",
    ],
  },
  chronology: {
    title: "About Chronology",
    body: [
      "A running log of every change this branch has undergone: sound changes you applied, drift it underwent on its own (⤳), and any words borrowed from contact with a neighbour (⇄).",
    ],
  },
};
