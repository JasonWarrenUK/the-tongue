<script lang="ts">
  import { MediaQuery } from "svelte/reactivity";
  import { game } from "$lib/game.svelte";
  import { BY_ID } from "$lib/engine/phonology";
  import { branchColor } from "$lib/engine/tree";
  import Panel from "$lib/components/Panel.svelte";
  import Header from "$lib/components/Header.svelte";
  import ControlBar from "$lib/components/ControlBar.svelte";
  import MobileHeader from "$lib/components/MobileHeader.svelte";
  import MobileTabBar, { type MobileTab } from "$lib/components/MobileTabBar.svelte";
  import MapView from "$lib/components/MapView.svelte";
  import FamilyTree from "$lib/components/FamilyTree.svelte";
  import IntelMatrix from "$lib/components/IntelMatrix.svelte";
  import WordTable from "$lib/components/WordTable.svelte";
  import PhrasePanel from "$lib/components/PhrasePanel.svelte";
  import Changes from "$lib/components/Changes.svelte";
  import HistoryList from "$lib/components/HistoryList.svelte";
  import FocusDialog from "$lib/components/FocusDialog.svelte";
  import RepairDialog from "$lib/components/RepairDialog.svelte";
  import SilenceScreen from "$lib/components/SilenceScreen.svelte";
  import { MOURN_TURNS } from "$lib/engine/stakes";

  // local-only UI state (README "State Management" — activeTab is a purely-local addition)
  let activeTab = $state<"intel" | "phrases">("intel");
  // mobile shell: one tab pane at a time, below 768px. MediaQuery keeps only one shell
  // in the DOM (no duplicated component instances hidden behind display:none).
  let mobileTab = $state<MobileTab>("langs");
  const mobile = new MediaQuery("(max-width: 767px)", false);
  const graph = (id: string) => BY_ID[id]?.g ?? id;

  const hasWarn = $derived(!game.viewing && !!(game.fracturing || game.assimilatingInto || game.rigidifying || game.aligningToward));
  const contactNames = $derived<[string, string] | null>(game.pendingContact
    ? [game.displayNames[game.pendingContact.aId] ?? game.st.branches[game.pendingContact.aId].name,
       game.displayNames[game.pendingContact.bId] ?? game.st.branches[game.pendingContact.bId].name]
    : null);
  const newWorld = () => game.loadWorld(Math.floor(Math.random() * 99999));
</script>

<!-- ── tiles, shared by both shells ─────────────────────────────────────────── -->

{#snippet treeTile()}
  <Panel title="Family tree" span>
    {#snippet aside()}
      <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-accent"></span>the self</span>
      <span class="inline-flex items-center gap-1.5"><span class="w-2 h-2 rounded-full bg-barrier"></span>held this generation</span>
      <span>a column per branch · a row per era · click an era to read it</span>
    {/snippet}
    <FamilyTree branches={game.st.branches} selectedId={game.st.selectedId} focusId={game.st.focusId}
      touched={game.st.touched} eraGraph={game.eraGraph} viewing={game.viewing}
      onselect={(id, stageIndex) => game.viewEra(id, stageIndex)} />
  </Panel>
{/snippet}

{#snippet territoryTile()}
  <Panel title="Territory">
    {#snippet aside()}<span>tap your land to select · tap a glowing region to expand</span>{/snippet}
    <MapView world={game.st.world} branches={game.st.branches} selectedId={game.st.selectedId}
      pool={game.st.pool} onselect={(id) => game.selectBranch(id)} onexpand={(r) => game.expandInto(r)}
      radius={mobile.current ? 9 : 6.2} zoomable={mobile.current} />
  </Panel>
{/snippet}

{#snippet intelTile()}
  <Panel title="Intelligibility">
    <IntelMatrix leaves={game.leaves} displayNames={game.displayNames} openRoutes={game.openRoutes} />
  </Panel>
{/snippet}

{#snippet phrasesBody()}
  {#if game.viewing}
    <p class="text-text-muted text-[13px] italic p-5">No paradigm was frozen with this era — the living grammar would be a lie about which century you are reading.</p>
  {:else}
    <PhrasePanel lex={game.sel.lex} order={game.sel.wordOrder} weights={game.sel.frameWeights}
      proDrop={game.sel.proDrop} paradigm={game.sel.paradigm}
      orderPressure={game.sel.orderPressure} aligningToward={game.aligningToward} />
  {/if}
{/snippet}

{#snippet secondaryTile()}
  <section class="bg-surface border border-border rounded-lg overflow-hidden flex flex-col">
    <div class="flex gap-0.5 px-2.5 pt-1.5 border-b border-border-subtle">
      <button onclick={() => (activeTab = "intel")}
        class="px-3.5 py-2 border-0 border-b-2 bg-transparent text-[13px] {activeTab === 'intel' ? 'border-accent font-semibold text-text' : 'border-transparent font-normal text-text-muted'}">Intelligibility</button>
      <button onclick={() => (activeTab = "phrases")}
        class="px-3.5 py-2 border-0 border-b-2 bg-transparent text-[13px] {activeTab === 'phrases' ? 'border-accent font-semibold text-text' : 'border-transparent font-normal text-text-muted'}">Phrases</button>
    </div>
    <div class="p-4">
      {#if activeTab === "intel"}
        <IntelMatrix leaves={game.leaves} displayNames={game.displayNames} openRoutes={game.openRoutes} />
      {:else}
        {@render phrasesBody()}
      {/if}
    </div>
  </section>
{/snippet}

{#snippet lexiconTile(fill: boolean)}
  {#if game.viewing}
    {@const v = game.viewing}
    {@const anchor = game.viewedStage?.anchorIndex != null ? game.st.branches[v.branchId]?.anchors[game.viewedStage.anchorIndex] : null}
    <Panel noPadding grow={fill} title={game.viewedStage?.text ?? ""}>
      {#snippet titlePrefix()}
        <span class="w-2.75 h-2.75 rounded-sm shrink-0" style="background:{branchColor(v.branchId)}"></span>
      {/snippet}
      {#snippet aside()}
        {#if anchor}<span class="italic">frozen at turn {anchor.turn}</span>{/if}
        <button class="ml-auto text-accent hover:underline" onclick={() => game.selectBranch(v.branchId)}>← back to {game.displayNames[v.branchId] ?? game.st.branches[v.branchId]?.name}</button>
      {/snippet}
      <WordTable lex={game.viewedLex ?? []} previewLex={null} curHomo={game.viewedHomo ?? new Set()}
        prevHomo={null} severeConcepts={new Set()} pressureLabel={{}} {fill} />
    </Panel>
  {:else}
    <Panel noPadding grow={fill} title={game.selEra[game.selEra.length - 1]?.text ?? game.sel.name}
      titleHint={game.selEra.map((s) => s.text).join(" → ")}>
      {#snippet titlePrefix()}
        <span class="w-2.75 h-2.75 rounded-sm shrink-0" style="background:{branchColor(game.sel.id)}"></span>
      {/snippet}
      {#snippet aside()}
        {#if game.isFocal}<span class="px-2 py-0.5 rounded-full border border-accent-border text-accent" title="the self">◆ self</span>{/if}
        <span>{game.sel.territory.length} region{game.sel.territory.length !== 1 ? "s" : ""} · {game.st.touched[game.st.selectedId] ? "held" : "will drift"}</span>
      {/snippet}
      <WordTable lex={game.sel.lex} previewLex={game.previewLex} curHomo={game.curHomo} prevHomo={game.prevHomo}
        severeConcepts={game.severeConcepts} pressureLabel={game.pressureLabel} {fill} />
    </Panel>
  {/if}
{/snippet}

{#snippet inventoryTile()}
  <!-- inventoryOf is a pure function of a lexicon, so under game.viewing this shows the
       ERA'S OWN inventory (game.viewedInventory) rather than hiding the tile like Phrases
       does — an anchor's frozen lex is a complete record, unlike a missing paradigm. -->
  {#if game.viewing && game.viewedInventory}
    {@const v = game.viewing}
    <Panel title="{game.viewedStage?.text ?? game.st.branches[v.branchId]?.name} · inventory">
      {#snippet titlePrefix()}
        <span class="w-2.75 h-2.75 rounded-sm shrink-0" style="background:{branchColor(v.branchId)}"></span>
      {/snippet}
      {#snippet aside()}<span>the phonemes this era actually spoke, from its frozen lexicon</span>{/snippet}
      <div class="font-mono text-[13px]" style="line-height:1.7">
        <div><span class="text-text-faint">syl </span>{game.st.world.tmpl.label}</div>
        <div><span class="text-text-faint">V &nbsp;&nbsp;</span>{game.viewedInventory.vowels.map(graph).join(" ")}</div>
        <div><span class="text-text-faint">C &nbsp;&nbsp;</span>{game.viewedInventory.consonants.map(graph).join(" ")}</div>
      </div>
    </Panel>
  {:else}
    <Panel title="{game.displayNames[game.sel.id] ?? game.sel.name} · inventory">
      {#snippet titlePrefix()}
        <span class="w-2.75 h-2.75 rounded-sm shrink-0" style="background:{branchColor(game.sel.id)}"></span>
      {/snippet}
      {#snippet aside()}<span>the selected branch's live phoneme set, not the genesis record</span>{/snippet}
      <div class="font-mono text-[13px]" style="line-height:1.7">
        <div><span class="text-text-faint">syl </span>{game.st.world.tmpl.label}</div>
        <div><span class="text-text-faint">V &nbsp;&nbsp;</span>{game.liveInventory.vowels.map(graph).join(" ")}</div>
        <div><span class="text-text-faint">C &nbsp;&nbsp;</span>{game.liveInventory.consonants.map(graph).join(" ")}</div>
      </div>
    </Panel>
  {/if}
{/snippet}

{#snippet changesTile()}
  {#if game.viewing}
    {@const v = game.viewing}
    <div class="bg-surface-sunken border border-dashed border-input-border rounded-lg p-5 flex flex-col gap-2 justify-center">
      <h2 class="font-serif text-base font-semibold text-text-muted m-0">Reading a closed era</h2>
      <p class="text-[13px] text-text-muted m-0">Changes can only be applied to a living tip.
        <button class="text-accent hover:underline" onclick={() => game.selectBranch(v.branchId)}>Return to {game.displayNames[v.branchId] ?? game.st.branches[v.branchId]?.name}</button> to keep steering.</p>
    </div>
  {:else}
    <Panel title="Available changes">
      {#snippet aside()}
        {#if game.overheadDue > 0}<span>first change here <span class="font-mono text-text">+{game.overheadDue}</span> overhead</span>{/if}
        {#if !game.isFocal}<span class="text-warn" title="cost multiplier for acting outside the self">reach ×{game.reach.toFixed(1)}</span>{/if}
      {/snippet}
      <Changes candidates={game.candidates} preview={game.preview} stepCost={game.stepCost}
        overheadDue={game.overheadDue} pool={game.st.pool} reach={game.reach} isFocal={game.isFocal}
        onpreview={(id) => (game.preview = id)} onapply={(id) => game.apply(id)} />
    </Panel>
  {/if}
{/snippet}

{#snippet warnings()}
  {#if hasWarn}
    <div class="flex flex-col gap-2">
      {#if game.fracturing}
        <div class="text-xs text-warn bg-warn-bg border border-warn-border rounded-lg px-3 py-2.5" style="line-height:1.5">⚠ will fracture at gen end</div>
      {/if}
      {#if game.assimilatingInto}
        <div class="text-xs text-warn bg-warn-bg border border-warn-border rounded-lg px-3 py-2.5" style="line-height:1.5">⚠ assimilating into {game.assimilatingInto} — drift or expand to resist</div>
      {/if}
      {#if game.rigidifying}
        <div class="text-xs text-warn bg-warn-bg border border-warn-border rounded-lg px-3 py-2.5" style="line-height:1.5">⚠ word order fixing to SVO — renew the paradigm to resist</div>
      {/if}
      {#if game.aligningToward}
        <div class="text-xs text-warn bg-warn-bg border border-warn-border rounded-lg px-3 py-2.5" style="line-height:1.5">⚠ word order aligning toward {game.aligningToward}</div>
      {/if}
    </div>
  {/if}
{/snippet}

{#snippet languagesBlock()}
  <div class="shrink-0">
    <div class="text-[11px] tracking-[0.1em] uppercase text-text-faint mb-2.5">Languages</div>
    <div class="flex flex-col gap-1">
      {#each game.leaves.slice().sort((a, b) => a.id - b.id) as b (b.id)}
        {@const isSel = b.id === game.st.selectedId}
        <button onclick={() => game.selectBranch(b.id)}
          class="flex items-center gap-2.5 w-full text-left px-2.5 py-2 rounded-md border {isSel ? 'bg-accent-bg border-accent-rail' : 'bg-transparent border-transparent hover:border-[#c9c0ac]'}">
          <span class="w-2.25 h-2.25 rounded-sm shrink-0" style="background:{branchColor(b.id)}"></span>
          <span class="flex-1 min-w-0">
            <span class="block text-[13px] {isSel ? 'font-semibold' : 'font-normal'}">{game.displayNames[b.id] ?? b.name}</span>
            <span class="block text-[11px] text-text-muted">{b.territory.length} region{b.territory.length !== 1 ? "s" : ""} · {game.st.touched[b.id] ? "held" : "will drift"}</span>
          </span>
          {#if b.id === game.st.focusId}<span class="text-[11px] text-accent" title="the self">◆</span>{/if}
        </button>
      {/each}
    </div>
  </div>

{/snippet}

{#snippet chronologyBlock()}
  {#if game.sel.history.length}
    <div class="shrink-0 border-t border-border pt-4 flex flex-col min-h-0">
      <HistoryList history={game.sel.history} splitIndex={game.sel.splitIndex} />
    </div>
  {/if}
{/snippet}

{#snippet contextBar()}
  <ControlBar log={game.st.log} contact={game.pendingContact} {contactNames}
    settings={game.st.settings} showCfg={game.showCfg} onchange={(k, v) => game.setCfg(k, v)} />
{/snippet}

<!-- ── overlays ─────────────────────────────────────────────────────────────── -->

{#if game.pendingFocus}
  <FocusDialog choice={game.pendingFocus} focusId={game.st.focusId} branches={game.st.branches}
    displayNames={game.displayNames} mournTurns={MOURN_TURNS} onfracture={(id) => game.chooseFracture(id)}
    onsuccessor={(id) => game.chooseSuccessor(id)} onsilence={() => game.electSilence()} />
{/if}
{#if game.pendingRepair}
  <RepairDialog pending={game.pendingRepair} lex={game.sel.lex} order={game.st.world.compoundOrder}
    cost={game.repairCost} affordable={game.canRepair}
    onrepair={(modifier) => game.repairCollision(modifier)} ontolerate={() => game.tolerateCollision()} />
{/if}
{#if game.ended}
  <SilenceScreen turn={game.st.turn} onnew={newWorld} />
{/if}

<!-- ── shells ───────────────────────────────────────────────────────────────── -->

{#if mobile.current}
  <div class="h-dvh flex flex-col bg-bg text-text font-sans text-sm overflow-hidden">
    <MobileHeader bind:seed={game.seed} leafCount={game.leaves.length} turn={game.st.turn} pool={game.st.pool}
      base={game.st.settings.pool} willDrift={game.willDrift}
      onload={() => game.loadWorld(game.seed)} onnew={newWorld}
      onend={() => game.endTurn()} ontogglecfg={() => (game.showCfg = !game.showCfg)} />
    {#if game.st.log.length || game.pendingContact || game.showCfg}
      <div class="shrink-0">{@render contextBar()}</div>
    {/if}
    <!-- [&>*]:shrink-0 — tiles are overflow:hidden, so as flex items their min-height
         would otherwise resolve to 0 and the column would squash them instead of scrolling -->
    <main class="flex-1 min-h-0 overflow-y-auto p-3 flex flex-col gap-3 [&>*]:shrink-0">
      {#if mobileTab === "tree"}
        {@render treeTile()}
      {:else if mobileTab === "map"}
        {@render territoryTile()}
        {@render intelTile()}
      {:else if mobileTab === "lexicon"}
        {@render lexiconTile(false)}
        {@render inventoryTile()}
        <Panel title="Phrases">{@render phrasesBody()}</Panel>
      {:else if mobileTab === "changes"}
        {@render changesTile()}
      {:else}
        <div class="bg-surface-sunken border border-border rounded-lg p-4 flex flex-col gap-4.5">
          {@render languagesBlock()}
          {@render warnings()}
          {@render chronologyBlock()}
        </div>
      {/if}
    </main>
    <MobileTabBar bind:tab={mobileTab} warn={hasWarn} />
  </div>
{:else}
  <div class="min-h-screen bg-bg text-text font-sans text-sm">
    <Header bind:seed={game.seed} leafCount={game.leaves.length} turn={game.st.turn} pool={game.st.pool}
      base={game.st.settings.pool} willDrift={game.willDrift}
      onload={() => game.loadWorld(game.seed)} onnew={newWorld}
      onend={() => game.endTurn()} ontogglecfg={() => (game.showCfg = !game.showCfg)} />
    {@render contextBar()}
    <div class="flex items-start">
      <div class="flex-1 min-w-0 p-5 grid gap-4 content-start" style="grid-template-columns:repeat(auto-fit,minmax(400px,1fr))">
        {@render treeTile()}
        {@render territoryTile()}
        {@render secondaryTile()}
        {@render inventoryTile()}
        {@render changesTile()}
      </div>
      <!-- sticky, viewport-tall, scrolls on its own; the lexicon (the tall element) lives
           here and takes whatever height languages/warnings/chronology leave over -->
      <aside class="w-[308px] shrink-0 sticky top-0 h-screen border-l border-border bg-surface-sunken p-5 flex flex-col gap-4.5 overflow-y-auto">
        {@render languagesBlock()}
        {@render warnings()}
        {@render lexiconTile(true)}
        {@render chronologyBlock()}
      </aside>
    </div>
  </div>
{/if}
