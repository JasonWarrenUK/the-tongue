<script lang="ts">
  import { game } from "$lib/game.svelte";
  import Panel from "$lib/components/Panel.svelte";
  import Header from "$lib/components/Header.svelte";
  import ControlBar from "$lib/components/ControlBar.svelte";
  import EconomyCfg from "$lib/components/EconomyCfg.svelte";
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
</script>

<div class="w-full min-h-screen bg-bg text-fg p-5 font-sans text-sm">
  <div class="max-w-5xl mx-auto">
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
      <SilenceScreen turn={game.st.turn} onnew={() => game.loadWorld(Math.floor(Math.random() * 99999))} />
    {/if}

    <Header bind:seed={game.seed} leafCount={game.leaves.length} world={game.st.world}
      inv={game.liveInventory} selName={game.displayNames[game.sel.id] ?? game.sel.name}
      onload={() => game.loadWorld(game.seed)} onnew={() => game.loadWorld(Math.floor(Math.random() * 99999))} />

    <ControlBar turn={game.st.turn} pool={game.st.pool} base={game.st.settings.pool}
      willDrift={game.willDrift} log={game.st.log}
      contact={game.pendingContact}
      contactNames={game.pendingContact
        ? [game.displayNames[game.pendingContact.aId] ?? game.st.branches[game.pendingContact.aId].name,
           game.displayNames[game.pendingContact.bId] ?? game.st.branches[game.pendingContact.bId].name]
        : null}
      onend={() => game.endTurn()} ontogglecfg={() => (game.showCfg = !game.showCfg)} />
    {#if game.showCfg}<EconomyCfg settings={game.st.settings} onchange={(k, v) => game.setCfg(k, v)} />{/if}

    <div class="grid lg:grid-cols-2 gap-4 mt-4">
      <Panel title="Map">
        <MapView world={game.st.world} branches={game.st.branches} selectedId={game.st.selectedId}
          pool={game.st.pool} onselect={(id) => game.selectBranch(id)} onexpand={(r) => game.expandInto(r)} />
      </Panel>
      <Panel title="Mutual intelligibility"><IntelMatrix leaves={game.leaves} displayNames={game.displayNames} openRoutes={game.openRoutes} /></Panel>
    </div>

    <!-- the tree grows a column per branch and a row per era — it needs the full page
         width far sooner than the map or the matrix do. -->
    <div class="mt-4"><Panel title="Family tree">
      <FamilyTree branches={game.st.branches} selectedId={game.st.selectedId} focusId={game.st.focusId}
        touched={game.st.touched} eraGraph={game.eraGraph} viewing={game.viewing}
        onselect={(id, stageIndex) => game.viewEra(id, stageIndex)} />
    </Panel></div>

    <div class="grid md:grid-cols-5 gap-5 mt-4 items-start">
      <div class="md:col-span-3 sticky top-2 z-10 bg-bg self-start">
        {#if game.viewing}
          <!-- 1ENG.22 era-viewer: a read-only look at a frozen earlier era. Live facts
               (region count, will-drift/held, fracture/assimilation warnings) are
               deliberately hidden here — they describe the branch NOW, not the era
               being shown, and would be lies painted over history. -->
          {@const v = game.viewing}
          {@const anchor = game.viewedStage?.anchorIndex != null ? game.st.branches[v.branchId]?.anchors[game.viewedStage.anchorIndex] : null}
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-accent font-medium flex items-center gap-2">
              <span class="inline-block w-3 h-3 rounded-sm" style="background:{`hsl(${(v.branchId * 61 + 25) % 360} 48% 56%)`}"></span>
              <span>{game.viewedStage?.text}</span>
              {#if anchor}<span class="text-muted font-normal text-xs">· frozen at turn {anchor.turn}</span>{/if}
            </h2>
            <button class="text-xs text-accent underline" onclick={() => game.selectBranch(v.branchId)}>
              ← back to {game.displayNames[v.branchId] ?? game.st.branches[v.branchId]?.name}
            </button>
          </div>
          <WordTable lex={game.viewedLex ?? []} previewLex={null} curHomo={game.viewedHomo ?? new Set()}
            prevHomo={null} severeConcepts={new Set()} pressureLabel={{}} />
        {:else}
          <div class="flex items-center justify-between mb-2">
            <h2 class="text-accent font-medium flex items-center gap-2">
              <!-- branchColor generates arbitrary per-branch hues procedurally — not a theme colour -->
              <span class="inline-block w-3 h-3 rounded-sm" style="background:{`hsl(${(game.sel.id * 61 + 25) % 360} 48% 56%)`}"></span>
              <span title={game.selEra.map((s) => s.text).join(" → ")}>{game.selEra[game.selEra.length - 1]?.text ?? game.sel.name}</span>
              {#if game.isFocal}<span class="text-positive text-xs" title="the self">◆ self</span>{/if}
              <span class="text-muted font-normal text-xs">· {game.sel.territory.length} region{game.sel.territory.length !== 1 ? "s" : ""} · {game.st.touched[game.st.selectedId] ? "held" : "will drift"}</span>
            </h2>
            {#if game.fracturing}<span class="text-xs text-warn">⚠ will fracture at gen end</span>{/if}
            {#if game.assimilatingInto}<span class="text-xs text-warn">⚠ assimilating into {game.assimilatingInto} — drift or expand to resist</span>{/if}
          </div>
          <WordTable lex={game.sel.lex} previewLex={game.previewLex} curHomo={game.curHomo} prevHomo={game.prevHomo}
            severeConcepts={game.severeConcepts} pressureLabel={game.pressureLabel} />
        {/if}
      </div>
      <div class="md:col-span-2 space-y-4">
        <!-- 1ENG.20: gated like Changes below, not rendered unconditionally as before —
             anchors freeze a lexicon snapshot but no paradigm snapshot, so under
             game.viewing there is no frozen grammar to show; rendering the LIVE
             paradigm against a dead lexicon would be a lie about which era it's from.
             (Pre-existing inconsistency: PhrasePanel used to render regardless.) -->
        {#if !game.viewing}
          <Panel title="Phrases">
            <PhrasePanel lex={game.sel.lex} order={game.sel.wordOrder} weights={game.sel.frameWeights}
              proDrop={game.sel.proDrop} paradigm={game.sel.paradigm} />
          </Panel>
          <Changes candidates={game.candidates} preview={game.preview} stepCost={game.stepCost}
            overheadDue={game.overheadDue} pool={game.st.pool} reach={game.reach} isFocal={game.isFocal}
            onpreview={(id) => (game.preview = id)} onapply={(id) => game.apply(id)} />
        {/if}
        <HistoryList history={game.sel.history} splitIndex={game.sel.splitIndex} />
      </div>
    </div>
  </div>
</div>
