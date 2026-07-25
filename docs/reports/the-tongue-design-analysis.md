# The Tongue: a game-design and player-experience analysis

## The state of play

The Tongue is currently a deterministic sandbox with two player verbs. Each generation you spend influence to apply one of seventeen sound-change rules to a selected branch, or to expand its territory; anything you leave alone drifts on its own, and the end-of-turn resolution handles renaming, spread, assimilation death and fracture. The readouts are a 4×3 map, a family tree, an intelligibility matrix, a word table with live rule previews, and a one-line log.

The engineering underneath is well ahead of the game on top. That is the whole analysis in one sentence, so the rest of this document is about what "the game on top" should be.

## What's already good

Credit first, because several things here are quietly excellent and worth protecting as the design grows.

The erosion/renewal cycle is real systems craft. Most amateur sound-change simulators grind every word down to "a" and stop; the 1ENG.11/12 work (paragoge and unconditioned breaking as bootstrap mechanisms, verified at zero ossified turns over 150-turn sweeps) means the simulation stays alive indefinitely. Players will never know this work exists, which is exactly the sign it was done properly.

The preview interaction is the best moment in the current UX. Hover a rule, watch the lexicon diff, see the homophone dots appear: that is a legible, tactile decision loop, and it should be the model for every future mechanic. The era-naming collapse (Old/Middle/Late, Proto-blends generated from the branches' own phonologies) is a genuinely lovely diegetic touch; it makes the family tree read like a philology textbook about a world that doesn't exist. And full determinism per seed is a strategic asset you haven't spent yet: it makes shareable challenges, daily seeds and replays essentially free.

The spike discipline in the roadmap is also unusually good. The critique below is not "this project is undesigned"; it is "the design effort has all gone into the simulation layer".

## The central problem: a simulator in want of a player

Nothing in The Tongue wants anything, including you. There is no goal, no failure, no score, no horizon. In Caillois's terms it is pure paidia: an open toy with no ludus wrapped around it. That can be a legitimate destination (Dwarf Fortress legends mode, most of SimEarth), and the contemplative pleasure of watching a family diverge is real. But the current design doesn't even commit to being a good toy, because the player's actions barely differ from the system's.

Look at what applying a rule actually is: you do precisely what autonomous drift does, except you pick the rule instead of a weighted roll. The one decision-relevant signal in the UI is the homophone-collision delta, and collisions currently have no mechanical consequence (2LEX.2 is unbuilt), so even that signal is cosmetic. "Touching" a branch to hold off drift only matters if drift outcomes matter, and they don't yet. The honest description of the current loop is: spend points to substitute your aesthetic preference for the RNG's. A player who notices this, and they will within ten minutes, has no reason to keep pressing the button.

The influence economy has the same hollowness. Pool and costs are flat arithmetic over region count, and the tuning panel exposes raw sliders to the player, which is a debug tool wearing a game's clothes. An economy creates decisions when there are competing sinks with different payoff schedules; here both sinks (change, expand) purchase things of no consequence.

Underneath both issues sits an identity problem. The README says "you play as the language community", but after the first fracture you play as every community simultaneously, so fracture costs you nothing, assimilation death loses you nothing you valued, and the intelligibility matrix is a scoreboard for no contest. Loss aversion needs a self to lose something.

## Five more pressure points

**Every force is divergent.** Drift, fracture and assimilation all pull the family apart; the 2GEO.4 spike says as much, and borrowing will be the first convergent force. But the player still has no convergent verb: no standardisation, no prestige register, no reunification pressure. A system where every arrow points the same way produces the same story every run: things fall apart. That is thematically apt and dramatically monotonous.

**The world is inert.** Twelve regions, static edges, no rivals. Once free land runs out, expansion (half your verb set) dies, and the map degenerates into a coloured legend for the tree. Terrain currently biases drift and salience, which is good invisible texture, but nothing on the map ever *happens*.

**Words are inert too.** For a game about language, the language never does anything. Words exist to be edit-distanced. Nobody speaks, nothing is named with them (branch names aside, which is why branch naming is the most charming feature), no text is written in them. The theme is currently rendered as tables of mutating strings, which is the spreadsheet view of a poem.

**The drama is buried in the log.** Fracture and assimilation, the two most consequential events in the simulation, surface as one grey line of text after you press End generation. The renewal work guarantees the simulation always has something to say; the presentation guarantees nobody hears it.

**The roadmap defers the game.** 1ENG.19 through 21 add syntax, word order and inflectional paradigms; 2GLY adds an evolving script. All of it deepens the simulation, none of it answers "why does the player care", and the one task that does (2STK.1, the stakes spike) is blocked behind the borrowing implementation. The design risk is an ever-richer simulation observed through ever-more tables. For what it's worth, 2STK.1 doesn't truly need 2GEO.5: stakes can be designed against the existing state and extended when borrowing lands. I'd unblock it today.

## A frame to hang it on

The title is the design document. Let the player be the Tongue itself: the language as a living thing that rides its speakers, wants to be spoken, and survives by changing. This single move resolves the identity problem (controlling every branch is natural: they are all you), makes death legible (a branch assimilated is a part of you that fell silent), and turns the existing readouts into a self-portrait. It also gives the game its stakes vocabulary for free: a language can want to spread, to endure recognisably, to fragment into a family, to leave a written corpus, to be remembered after death. Those are precisely the ambitions the mechanics below score.

## Concrete mechanics

These are ordered by leverage: theme delivered per unit of engineering.

### 1. The seed text

At world generation, compose a short fixed text from six to eight lexicon concepts: a proverb, a blessing, a boast ("water finds the path; stone remembers the snow"). Render it per branch, every generation, by looking up each concept's current form. No new simulation machinery whatsoever; it is a pure render over existing state. Yet it is the single artefact that tells the entire story at a glance: the proverb starts identical everywhere, then goes strange, then goes foreign. Show it on branch selection; show all living versions side by side at fracture events; make it the shareable image for Milestone 3. When 1ENG.19's word order lands, the text inherits real syntax and the feature deepens for free. This is the cheapest high-impact item in this document and I would build it this week.

### 2. Ambitions

At world generation, draw three seeded ambitions scored at a fixed horizon (say, generation 30, which also gives sessions a shape they currently lack). Every one of these is computable from existing state:

*Babel* wants five living languages with no pair above 30% intelligibility. *The Long Tongue* wants a living branch still at 60%+ intelligibility with its own birth anchor at the horizon (the anchor chain already stores exactly this). *Ozymandias* wants a dead ancestor bearing a Proto- name with three or more living descendants. *Empire* wants one branch holding eight regions. A *Wanderwort* ambition (one of your words present in every living branch) switches on once borrowing ships.

Make them optional and visible, more like Zachtronics achievements than a victory screen, and the contemplative sandbox survives intact underneath. The honest cost: goals convert some players from "watching a language" to "optimising a checklist", and the ambitions must be tuned so the degenerate strategies (spam expansion, never touch anything) don't dominate. That tuning is the 2STK.1 spike's proper subject.

### 3. Drift momentum

Give each branch a decaying per-category momentum: applying a lenition rule nudges that branch's future autonomous drift toward lenition (multiplier capped around 2×, decaying maybe 10% a turn, feeding the existing `biasedMult` path in `driftRule`). This is Sapir's drift as a mechanic, and it transforms the core verb from an edit into an investment: you are no longer picking one change, you are setting a tendency, and branches acquire characters ("the one that's swallowing its codas"). It answers the weak-differentiation problem directly: the player shapes the current where the RNG only floats on it. Risk: positive feedback can make branches one-note; the cap and decay are the guardrails, and the erosion/renewal cycle already prevents the worst outcome. This is my recommended answer to 2STK.1's "directional goals vs prerequisite chains" question: momentum plus ambitions, and skip prerequisite chains entirely (they'd turn phonology into a tech tree, which is the wrong fantasy).

### 4. Intelligibility as a live resource

Each generation, seed one contact event between two bordering branches: a trade, a marriage, a warning of danger. Success probability equals their mutual intelligibility (rolled with `hashRand`, so determinism holds); success pays influence, failure costs it or feeds assimilation pressure. Suddenly the matrix is a board state under management rather than a wall chart: do you keep the dialect chain connected so the mountain branch can still talk to the coast, or let it snap and eat the failures? This is the missing convergent incentive, and it reuses `intelligibility()` wholesale. It pairs naturally with borrowing when 2GEO.5 lands (successful contact could be what licenses a borrowing event).

### 5. Living toponymy

When a branch first claims a region, name it: a compound of two terrain-salient concepts in that branch's current forms. Store the name as word ids and let it drift under the branch's subsequent sound changes like any other word (mechanically, place names can simply be extra lexicon entries flagged out of the intelligibility calculation). The map stops being twelve circles and becomes a linguistic landscape; when territory changes hands or a branch dies, the old names remain as fossils under new pronunciation, which is exactly how real maps work (every -chester and -thorpe in England is this mechanic). Modest engineering, large thematic return, and it finally gives the map something to say between fractures.

### 6. A world that pushes back

Two tiers. The cheap tier is seeded generational events drawn from a small table: a pass opens or freezes (flip one edge's passability, which can trigger fracture or new contact on demand), a plague empties a region, a prestige court arises and makes one branch a preferred borrowing source. Edge-flipping alone would fix the static-world problem, since fracture and contact are where all the drama lives. The expensive tier is a rival family: a second, autonomous language seeded across the map, giving expansion an opponent, assimilation a genuine threat, and borrowing a direction (substrate and superstrate). The rival is the biggest single swing available to this design and I would not attempt it until ambitions and contact events have proven the stakes layer works.

### 7. The chronicle

Replace the one-line log with a generated chronicle that narrates each resolution in era-named prose: "Generation 12. In the mountains the speech of Boran broke in two; the northern tongue took to softening its stops. Old Aenic was heard no more." Fracture and assimilation deserve interstitial moments, and the chronicle doubles as the run's exportable history. This is presentation rather than mechanics, but it is where the simulation's existing richness finally becomes audible, and it costs a string-template module.

### 8. Loss with residue

When a branch dies, its final lexicon is already frozen in the tree. Let living branches spend influence to revive a dead relative's word (to resolve a homophone collision, or purely for flavour once 2LEX.2 gives collisions teeth): learned borrowing from an archive, the Cornish-revival move. Death then leaves something behind other than a grey node, and the player gets one more reason to care which branches die. This one waits on 2LEX.2 to matter mechanically, so schedule it behind the collision work.

## Roadmap implications

Three concrete edits to the current plan. First, unblock and run 2STK.1 now, with momentum-plus-ambitions as the proposed answer; it is the most important unstarted task in the project and its dependency on 2GEO.5 is soft. Second, insert the seed text and the chronicle ahead of the glyph chain: 2GLY is four tasks of spectacle that will photograph beautifully but deliver less theme per week than either, and glyphs will land better inside a game that already has stakes. Third, retire the economy panel from the player surface (keep it behind a dev flag) and replace it with difficulty presets once the economy actually purchases consequences.

The deeper sequencing point: the simulation layer is already good enough to carry a game. Morphology, syntax and glyphs will make it a better simulation; ambitions, contact and the seed text will make it a game at all. Do one of the latter before the next one of the former, and The Tongue stops being a very good engine idling in a car park.
