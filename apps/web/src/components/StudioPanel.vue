<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { api } from "@/api";
import { useGenomeStore } from "@/stores/genome";

const store = useGenomeStore();

const ensemblSpecies = ref<Array<{ id: string; commonName: string; species: string }>>([]);
const ensemblPick = ref("human");
const ensemblPerChr = ref(15);

onMounted(async () => {
  ensemblSpecies.value = await api.ensemblSpecies().catch(() => []);
});

const datasetName = ref("Solar System");
const expressionColumn = ref("diameter");
const csv = ref(
  `body,diameter,distance,moons
Mercury,4879,57.9,0
Venus,12104,108.2,0
Earth,12742,149.6,1
Mars,6779,227.9,2
Jupiter,139820,778.5,95
Saturn,116460,1434,146
Uranus,50724,2871,28
Neptune,49244,4495,16`,
);

const partners = computed(() => store.catalog.filter((g) => g.id !== store.current?.id));

function randomizeSeed(): void {
  store.seed = Math.floor(Math.random() * 100000);
}

function onMorphTarget(e: Event): void {
  void store.setMorphTarget((e.target as HTMLSelectElement).value);
}
</script>

<template>
  <div class="panel scroll">
    <section>
      <span class="label">Generative · mutate &amp; evolve</span>
      <p class="hint">
        Variants are deterministic: the same seed always reproduces the same organism, so a
        creation is just a seed + lineage.
      </p>
      <div class="grid">
        <label>
          <span class="label">Seed</span>
          <div class="seed-row">
            <input type="number" v-model.number="store.seed" />
            <button class="ghost" title="Randomise" @click="randomizeSeed">⟳</button>
          </div>
        </label>
        <label>
          <span class="label">Mutations</span>
          <input type="number" v-model.number="store.mutationCount" min="1" max="80" />
        </label>
      </div>
      <button class="primary full" :disabled="store.busy || !store.current" @click="store.makeVariant()">
        ⚡ Generate variant
      </button>
      <div class="grid">
        <label>
          <span class="label">Generations</span>
          <input type="number" v-model.number="store.generations" min="1" max="30" />
        </label>
        <button class="full self-end" :disabled="store.busy || !store.current" @click="store.evolveCurrent()">
          🧬 Evolve lineage
        </button>
      </div>
    </section>

    <section>
      <span class="label">Mix two genomes</span>
      <p class="hint">Cross the current genome with another to inherit genes from both parents.</p>
      <select v-model="store.mixPartner">
        <option value="" disabled>Choose a partner genome…</option>
        <option v-for="p in partners" :key="p.id" :value="p.id">{{ p.name }} · {{ p.species }}</option>
      </select>
      <button
        class="primary full"
        :disabled="store.busy || !store.current || !store.mixPartner"
        @click="store.mixWith(store.mixPartner)"
      >
        ✦ Mix genomes
      </button>
    </section>

    <section>
      <span class="label">Load real genome · Ensembl</span>
      <p class="hint">
        Fetches live data from Ensembl with level-of-detail (a capped sample of genes per
        chromosome). Requires outbound network access to rest.ensembl.org.
      </p>
      <div class="grid">
        <label>
          <span class="label">Species</span>
          <select v-model="ensemblPick">
            <option v-for="s in ensemblSpecies" :key="s.id" :value="s.id">{{ s.commonName }}</option>
          </select>
        </label>
        <label>
          <span class="label">Genes / chr</span>
          <input type="number" v-model.number="ensemblPerChr" min="1" max="40" />
        </label>
      </div>
      <button
        class="full"
        :disabled="store.busy || !ensemblSpecies.length"
        @click="store.loadEnsembl(ensemblPick, ensemblPerChr)"
      >
        🌐 Load from Ensembl
      </button>
    </section>

    <section>
      <span class="label">Morph between genomes</span>
      <p class="hint">Live-blend the current genome's genes toward another. Drag to animate the transformation.</p>
      <select :value="store.morphTargetId" @change="onMorphTarget">
        <option value="">No morph target</option>
        <option v-for="p in partners" :key="p.id" :value="p.id">{{ p.name }} · {{ p.species }}</option>
      </select>
      <div class="morph" :class="{ disabled: !store.morphTargetGenome }">
        <div class="morph__ends mono">
          <span>{{ store.current?.commonName ?? store.current?.name ?? "—" }}</span>
          <span>{{ Math.round(store.morphT * 100) }}%</span>
          <span>{{ store.morphTargetGenome?.commonName ?? store.morphTargetGenome?.name ?? "target" }}</span>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          v-model.number="store.morphT"
          :disabled="!store.morphTargetGenome"
        />
      </div>
    </section>

    <section>
      <span class="label">Create a genome from data</span>
      <p class="hint">Paste any CSV. Each row becomes a gene; numeric columns drive colour, size and structure.</p>
      <input v-model="datasetName" placeholder="Dataset name" />
      <input v-model="expressionColumn" placeholder="Expression column (optional)" />
      <textarea v-model="csv" rows="9" spellcheck="false" />
      <button class="primary full" :disabled="store.busy" @click="store.importCsv(datasetName, csv, expressionColumn)">
        ✚ Generate from dataset
      </button>
    </section>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 22px;
  height: 100%;
  padding: 4px 2px;
}

section {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.hint {
  font-size: 11.5px;
  color: var(--muted);
  margin: 0;
  line-height: 1.5;
}

.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  align-items: end;
}

label {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.seed-row {
  display: flex;
  gap: 6px;
}

.seed-row input {
  flex: 1;
}

.full {
  width: 100%;
}

.self-end {
  align-self: end;
}

.morph.disabled {
  opacity: 0.5;
}

.morph__ends {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: var(--muted);
  margin-bottom: 6px;
}

input[type="range"] {
  width: 100%;
  accent-color: var(--accent);
  padding: 0;
}
</style>
