<script setup lang="ts">
import { computed } from "vue";
import { useGenomeStore } from "@/stores/genome";

const store = useGenomeStore();

const mutationCount = computed(() => store.current?.mutations?.length ?? 0);
const expressionPct = computed(() =>
  Math.round((store.selectedGene?.expression ?? 0) * 100),
);
</script>

<template>
  <div class="panel scroll">
    <div v-if="store.current" class="genome-head">
      <div class="genome-head__title">{{ store.current.name }}</div>
      <div class="genome-head__sub">
        <em>{{ store.current.species }}</em>
        <span v-if="store.current.assembly" class="mono"> · {{ store.current.assembly }}</span>
      </div>
      <div class="stat-row">
        <span class="stat"><b>{{ store.chromosomes.length }}</b> chromosomes</span>
        <span class="stat"><b>{{ store.geneList.length }}</b> genes</span>
        <span class="stat"><b>{{ mutationCount }}</b> mutations</span>
        <span v-if="(store.current.generation ?? 0) > 0" class="stat">gen <b>{{ store.current.generation }}</b></span>
      </div>
    </div>

    <div v-if="store.selectedGene" class="gene">
      <div class="gene__symbol mono">{{ store.selectedGene.symbol }}</div>
      <div class="gene__name">{{ store.selectedGene.name }}</div>

      <div class="kv">
        <span class="label">Biotype</span><span>{{ store.selectedGene.biotype }}</span>
        <span class="label">Strand</span><span class="mono">{{ store.selectedGene.strand }}</span>
        <span class="label">Position</span>
        <span class="mono">{{ store.selectedGene.start.toLocaleString() }}–{{ store.selectedGene.end.toLocaleString() }}</span>
        <span v-if="store.selectedGene.copies && store.selectedGene.copies > 1" class="label">Copies</span>
        <span v-if="store.selectedGene.copies && store.selectedGene.copies > 1" class="mono">×{{ store.selectedGene.copies }}</span>
      </div>

      <div class="expr">
        <span class="label">Expression</span>
        <div class="expr__bar"><div class="expr__fill" :style="{ width: `${expressionPct}%` }" /></div>
      </div>

      <div v-if="store.selectedGene.diseases?.length" class="diseases">
        <span class="label">Associated conditions</span>
        <div v-for="d in store.selectedGene.diseases" :key="d.id" class="disease">
          <div class="disease__name">{{ d.name }}</div>
          <div class="disease__meta">
            <span v-if="d.inheritance">{{ d.inheritance }}</span>
            <span v-if="d.source" class="mono"> · {{ d.source }}</span>
            <span v-if="d.pathogenic" class="tag-path">pathogenic</span>
          </div>
        </div>
      </div>

      <div class="actions">
        <span class="label">Edit gene</span>
        <div class="actions__row">
          <button v-tip="'Apply a random point mutation (substitution)'" @click="store.mutateSelected()">
            ⚡ Mutate
          </button>
          <button v-tip="'Duplicate this gene (copy-number gain)'" @click="store.duplicateSelected()">
            ⧉ Duplicate
          </button>
          <button class="danger" v-tip="'Knock out (delete) this gene'" @click="store.deleteSelected()">
            ⊘ Knockout
          </button>
        </div>
        <button class="ghost full" v-tip="'Revert all edits to the original genome'" @click="store.resetCurrent()">
          ↺ Reset genome
        </button>
      </div>
    </div>

    <div v-else class="empty">
      <p>Click any glowing gene in the 3D scene to inspect it, or pick one below.</p>
    </div>

    <div class="browser">
      <span class="label">Genes</span>
      <div v-for="chr in store.chromosomes" :key="chr.id" class="chr-group">
        <div class="chr-head">
          <button class="chr-name mono" v-tip="'Frame this chromosome'" @click="store.focusChromosome(chr.id)">
            chr {{ chr.name }}
          </button>
          <button
            v-if="store.current?.source === 'ensembl'"
            class="chr-detail"
            v-tip="'Load higher-resolution genes for this chromosome (LOD drill-down)'"
            @click="store.drillChromosome(chr.id)"
          >
            ＋ detail
          </button>
        </div>
        <div class="gene-chips">
          <button
            v-for="g in chr.genes"
            :key="g.id"
            class="gene-chip"
            :class="{ active: g.id === store.selectedGeneId, dead: g.deleted, mut: store.mutatedIds.has(g.id) }"
            @click="store.selectGene(g.id)"
          >
            {{ g.symbol }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 16px;
  height: 100%;
  padding: 4px 2px;
}

.genome-head__title {
  font-size: 18px;
  font-weight: 300;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.genome-head__sub {
  font-size: 12px;
  color: var(--muted);
  margin-top: 2px;
}

.stat-row {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: 10px;
  font-size: 12px;
  color: var(--muted);
}

.stat b {
  color: var(--text);
}

.gene {
  border-top: 1px solid var(--line);
  padding-top: 14px;
}

.gene__symbol {
  font-size: 25px;
  font-weight: 200;
  letter-spacing: 0.14em;
  color: var(--accent);
}

.gene__name {
  font-size: 13px;
  color: var(--muted);
  margin-bottom: 12px;
}

.kv {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 14px;
  font-size: 13px;
  align-items: center;
}

.expr {
  margin: 14px 0;
}

.expr__bar {
  height: 7px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
  overflow: hidden;
  margin-top: 5px;
}

.expr__fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--good));
}

.diseases {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 14px;
}

.disease {
  background: rgba(255, 90, 118, 0.08);
  border: 1px solid rgba(255, 90, 118, 0.22);
  border-radius: 10px;
  padding: 8px 10px;
}

.disease__name {
  font-size: 13px;
  font-weight: 600;
}

.disease__meta {
  font-size: 11px;
  color: var(--muted);
  margin-top: 2px;
  display: flex;
  gap: 4px;
  align-items: center;
}

.tag-path {
  color: #ffb3c0;
  border: 1px solid rgba(255, 90, 118, 0.4);
  border-radius: 999px;
  padding: 0 6px;
  font-size: 10px;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.actions__row {
  display: flex;
  gap: 8px;
}

.actions__row button {
  flex: 1;
  font-size: 10px;
  letter-spacing: 0.03em;
  padding: 8px 4px;
  white-space: nowrap;
}

.full {
  width: 100%;
}

.empty {
  color: var(--muted);
  font-size: 13px;
  border: 1px dashed var(--line);
  border-radius: 12px;
  padding: 14px;
}

.browser {
  border-top: 1px solid var(--line);
  padding-top: 12px;
}

.chr-group {
  margin-top: 8px;
}

.chr-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 8px;
}

.chr-name {
  font-size: 11px;
  color: var(--muted);
  background: transparent;
  border: none;
  padding: 2px 0;
  cursor: pointer;
}

.chr-name:hover {
  color: var(--accent);
  background: transparent;
}

.chr-detail {
  font-size: 10px;
  padding: 2px 7px;
}

.gene-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 5px;
}

.gene-chip {
  font-size: 11px;
  padding: 3px 8px;
}

.gene-chip.active {
  border-color: var(--accent);
  color: var(--accent);
}

.gene-chip.mut {
  border-color: rgba(255, 90, 118, 0.5);
}

.gene-chip.dead {
  opacity: 0.4;
  text-decoration: line-through;
}

/* ---- Dossier theme: subject-file data table ---- */
:global([data-theme="dossier"]) .genome-head__title {
  font-family: var(--font-display);
  font-size: 15px;
  letter-spacing: 0.06em;
}

:global([data-theme="dossier"]) .gene__symbol {
  font-family: var(--font-display);
  font-size: 20px;
}

:global([data-theme="dossier"]) .stat {
  border: 1px solid var(--line);
  padding: 2px 7px;
}

:global([data-theme="dossier"]) .kv {
  gap: 0;
  border: 1px solid var(--line);
  font-size: 15px;
}

:global([data-theme="dossier"]) .kv > * {
  padding: 3px 9px;
  border-bottom: 1px solid rgba(122, 182, 255, 0.22);
}

:global([data-theme="dossier"]) .kv > .label {
  background: rgba(122, 182, 255, 0.12);
  color: var(--text);
  border-right: 1px solid rgba(122, 182, 255, 0.22);
  display: flex;
  align-items: center;
}

:global([data-theme="dossier"]) .kv > :not(.label) {
  text-align: right;
}

:global([data-theme="dossier"]) .disease {
  border-radius: 0;
  background: rgba(122, 182, 255, 0.06);
  border-color: var(--line);
}

:global([data-theme="dossier"]) .empty {
  border-radius: 0;
}

:global([data-theme="dossier"]) .expr__bar {
  border-radius: 0;
  border: 1px solid var(--line);
  background: transparent;
}
</style>
