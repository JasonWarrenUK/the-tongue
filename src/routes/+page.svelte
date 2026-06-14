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
  import Changes from "$lib/components/Changes.svelte";
  import HistoryList from "$lib/components/HistoryList.svelte";
</script>

<div class="w-full min-h-screen bg-bg text-fg p-5 font-sans text-sm">
  <div class="max-w-5xl mx-auto">
    <Header bind:seed={game.seed} leafCount={game.leaves.length} world={game.st.world}
      onload={() => game.loadWorld(game.seed)} onnew={() => game.loadWorld(Math.floor(Math.random() * 99999))} />

    <ControlBar turn={game.st.turn} pool={game.st.pool} base={game.st.settings.pool}
      willDrift={game.willDrift} log={game.st.log} onend={() => game.endTurn()} ontogglecfg={() => (game.showCfg = !game.showCfg)} />
    {#if game.showCfg}<EconomyCfg settings={game.st.settings} onchange={(k, v) => game.setCfg(k, v)} />{/if}

    <div class="grid lg:grid-cols-2 gap-4 mt-4">
      <Panel title="Map">
        <MapView world={game.st.world} branches={game.st.branches} selectedId={game.st.selectedId}
          pool={game.st.pool} onselect={(id) => game.selectBranch(id)} onexpand={(r) => game.expandInto(r)} />
      </Panel>
      <Panel title="Family tree">
        <FamilyTree branches={game.st.branches} rootId={game.st.rootId} selectedId={game.st.selectedId}
          touched={game.st.touched} onselect={(id) => game.selectBranch(id)} />
      </Panel>
    </div>

    <div class="mt-4"><Panel title="Mutual intelligibility"><IntelMatrix leaves={game.leaves} /></Panel></div>

    <div class="grid md:grid-cols-5 gap-5 mt-4 items-start">
      <div class="md:col-span-3 sticky top-2 z-10 bg-bg self-start">
        <div class="flex items-center justify-between mb-2">
          <h2 class="text-accent font-medium flex items-center gap-2">
            <!-- branchColor generates arbitrary per-branch hues procedurally — not a theme colour -->
            <span class="inline-block w-3 h-3 rounded-sm" style="background:{`hsl(${(game.sel.id * 61 + 25) % 360} 48% 56%)`}"></span>
            {game.sel.name}
            <span class="text-muted font-normal text-xs">· {game.sel.territory.length} region{game.sel.territory.length !== 1 ? "s" : ""} · {game.st.touched[game.st.selectedId] ? "held" : "will drift"}</span>
          </h2>
          {#if game.fracturing}<span class="text-xs text-warn">⚠ will fracture at gen end</span>{/if}
        </div>
        <WordTable lex={game.sel.lex} previewLex={game.previewLex} curHomo={game.curHomo} prevHomo={game.prevHomo} />
      </div>
      <div class="md:col-span-2 space-y-4">
        <Changes candidates={game.candidates} preview={game.preview} stepCost={game.stepCost}
          overheadDue={game.overheadDue} pool={game.st.pool}
          onpreview={(id) => (game.preview = id)} onapply={(id) => game.apply(id)} />
        <HistoryList history={game.sel.history} splitIndex={game.sel.splitIndex} />
      </div>
    </div>
  </div>
</div>
