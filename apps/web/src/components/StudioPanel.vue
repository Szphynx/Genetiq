<script setup lang="ts">
import { computed, ref } from "vue";
import { useGenomeStore } from "@/stores/genome";

const store = useGenomeStore();

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
</style>
