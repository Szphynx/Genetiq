<script setup lang="ts">
import { useGenomeStore } from "@/stores/genome";

const store = useGenomeStore();

const kindColor: Record<string, string> = {
  reference: "var(--accent)",
  variant: "var(--amber)",
  procedural: "var(--good)",
};
</script>

<template>
  <div class="panel scroll">
    <span class="label">Catalog · {{ store.catalog.length }} genomes</span>
    <p class="hint">Reference organisms plus every variant, mix and dataset you create. Click to load.</p>

    <div class="list">
      <div
        v-for="g in store.catalog"
        :key="g.id"
        class="item"
        :class="{ active: g.id === store.current?.id }"
        v-tip="'Load ' + g.name + ' into the viewer'"
        @click="store.loadGenome(g.id)"
      >
        <div class="item__dot" :style="{ background: kindColor[g.kind] ?? 'var(--muted)' }" />
        <div class="item__body">
          <div class="item__name">{{ g.name }}</div>
          <div class="item__meta">
            <em>{{ g.species }}</em>
            <span class="mono"> · {{ g.geneCount }} genes · {{ g.chromosomeCount }} chr</span>
            <span v-if="(g.generation ?? 0) > 0" class="mono"> · gen {{ g.generation }}</span>
          </div>
        </div>
        <span class="item__kind" :style="{ color: kindColor[g.kind] ?? 'var(--muted)' }">{{ g.kind }}</span>
        <button
          v-if="g.kind !== 'reference'"
          class="del"
          v-tip="'Remove from the catalog'"
          @click.stop="store.deleteFromCatalog(g.id)"
        >
          ✕
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  padding: 4px 2px;
}

.hint {
  font-size: 11.5px;
  color: var(--muted);
  margin: 0 0 4px;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 11px;
  border: 1px solid var(--line);
  border-radius: 11px;
  background: rgba(255, 255, 255, 0.02);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.item:hover {
  border-color: var(--line-strong);
  background: rgba(76, 194, 255, 0.07);
}

.item.active {
  border-color: var(--accent);
}

.item__dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: 0 0 8px currentColor;
}

.item__body {
  flex: 1;
  min-width: 0;
}

.item__name {
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item__meta {
  font-size: 11px;
  color: var(--muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item__kind {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.1em;
}

.del {
  padding: 2px 7px;
  font-size: 11px;
}
</style>
