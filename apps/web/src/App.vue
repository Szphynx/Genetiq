<script setup lang="ts">
import { onMounted } from "vue";
import type { GeneBiotype } from "@genetiq/core";
import { BIOTYPE_PALETTE, rgbToHex } from "@genetiq/core";
import { useGenomeStore } from "@/stores/genome";
import GenomeViewer from "@/components/GenomeViewer.vue";
import TopBar from "@/components/TopBar.vue";
import GenePanel from "@/components/GenePanel.vue";
import StudioPanel from "@/components/StudioPanel.vue";
import GalleryPanel from "@/components/GalleryPanel.vue";

const store = useGenomeStore();

const legend: Array<{ biotype: GeneBiotype; label: string }> = [
  { biotype: "protein_coding", label: "Protein-coding" },
  { biotype: "lncRNA", label: "lncRNA" },
  { biotype: "miRNA", label: "miRNA" },
  { biotype: "regulatory", label: "Regulatory" },
  { biotype: "pseudogene", label: "Pseudogene" },
];

onMounted(() => void store.init());
</script>

<template>
  <div class="app">
    <GenomeViewer />
    <TopBar />

    <aside class="drawer glass scroll">
      <GenePanel v-show="store.activePanel === 'inspect'" />
      <StudioPanel v-show="store.activePanel === 'studio'" />
      <GalleryPanel v-show="store.activePanel === 'gallery'" />
    </aside>

    <div class="legend glass">
      <span class="label">Legend</span>
      <div v-for="l in legend" :key="l.biotype" class="legend__row">
        <span class="legend__dot" :style="{ background: rgbToHex(BIOTYPE_PALETTE[l.biotype]) }" />
        {{ l.label }}
      </div>
      <div class="legend__row"><span class="legend__dot mut" /> Mutated</div>
      <div class="legend__row"><span class="legend__dot path" /> Pathogenic</div>
    </div>

    <transition name="fade">
      <div v-if="store.status" class="toast">{{ store.status }}</div>
    </transition>
    <transition name="fade">
      <div v-if="store.error" class="toast error" @click="store.error = null">{{ store.error }}</div>
    </transition>
    <transition name="fade">
      <div v-if="store.busy" class="busy"><span class="spinner" /> working…</div>
    </transition>
  </div>
</template>

<style scoped>
.app {
  position: fixed;
  inset: 0;
}

.drawer {
  position: fixed;
  top: 86px;
  right: 14px;
  bottom: 14px;
  width: 360px;
  padding: 16px;
  z-index: 15;
}

.legend {
  position: fixed;
  left: 14px;
  bottom: 14px;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 12px;
  z-index: 15;
}

.legend__row {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--muted);
}

.legend__dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  box-shadow: 0 0 6px currentColor;
}

.legend__dot.mut {
  background: #ff334d;
}

.legend__dot.path {
  background: #ffd84d;
}

.toast {
  position: fixed;
  bottom: 22px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(70, 224, 160, 0.16);
  border: 1px solid rgba(70, 224, 160, 0.4);
  color: #c7ffe6;
  padding: 9px 18px;
  border-radius: 999px;
  font-size: 13px;
  z-index: 30;
  backdrop-filter: blur(8px);
}

.toast.error {
  background: rgba(255, 90, 118, 0.18);
  border-color: rgba(255, 90, 118, 0.5);
  color: #ffc8d1;
  cursor: pointer;
}

.busy {
  position: fixed;
  top: 90px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--muted);
  z-index: 30;
}

.spinner {
  width: 13px;
  height: 13px;
  border: 2px solid rgba(255, 255, 255, 0.2);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
