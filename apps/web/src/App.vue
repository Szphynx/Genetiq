<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import type { GeneBiotype } from "@genetiq/core";
import { BIOTYPE_PALETTE, rgbToHex } from "@genetiq/core";
import { useGenomeStore, type Panel } from "@/stores/genome";
import GenomeViewer from "@/components/GenomeViewer.vue";
import TopBar from "@/components/TopBar.vue";
import HudOverlay from "@/components/HudOverlay.vue";
import GenePanel from "@/components/GenePanel.vue";
import StudioPanel from "@/components/StudioPanel.vue";
import GalleryPanel from "@/components/GalleryPanel.vue";

const store = useGenomeStore();

const panelComponent = computed(() =>
  store.activePanel === "studio" ? StudioPanel : store.activePanel === "gallery" ? GalleryPanel : GenePanel,
);

const legend: Array<{ biotype: GeneBiotype; label: string }> = [
  { biotype: "protein_coding", label: "Protein-coding" },
  { biotype: "lncRNA", label: "lncRNA" },
  { biotype: "miRNA", label: "miRNA" },
  { biotype: "regulatory", label: "Regulatory" },
  { biotype: "pseudogene", label: "Pseudogene" },
];

const readout = computed(() => ({
  organism: (store.current?.commonName ?? store.current?.name ?? "no signal").toUpperCase(),
  loci: store.geneList.length,
  backend: (store.backend || "init").toUpperCase(),
}));

const mobileTabs: Array<{ id: Panel; label: string; icon: string }> = [
  { id: "inspect", label: "Inspect", icon: "◎" },
  { id: "studio", label: "Studio", icon: "✦" },
  { id: "gallery", label: "Gallery", icon: "▦" },
];

function openPanel(p: Panel): void {
  if (store.activePanel === p && store.sheetOpen) {
    store.sheetOpen = false;
  } else {
    store.activePanel = p;
    store.sheetOpen = true;
  }
}

const isMobile = ref(false);
let mq: MediaQueryList | null = null;
const onMq = (e: MediaQueryListEvent | MediaQueryList): void => {
  isMobile.value = e.matches;
};

onMounted(() => {
  void store.init();
  mq = window.matchMedia("(max-width: 760px)");
  onMq(mq);
  mq.addEventListener("change", onMq);
});
onBeforeUnmount(() => mq?.removeEventListener("change", onMq));
</script>

<template>
  <div class="app" :class="{ mobile: isMobile }">
    <GenomeViewer />
    <TopBar />

    <div class="hud">
      <span class="hud-corner tl" />
      <span class="hud-corner tr" />
      <span class="hud-corner bl" />
      <span class="hud-corner br" />
      <div class="hud-readout mono">
        <span class="accent">GENETIQ</span>
        <span class="sep">//</span>
        <span>{{ readout.organism }}</span>
        <span class="sep">//</span>
        <span>{{ readout.loci }} LOCI</span>
        <span class="sep hide-sm">//</span>
        <span class="hide-sm">{{ readout.backend }}</span>
      </div>
    </div>

    <HudOverlay />

    <aside class="drawer glass scroll" :class="{ open: store.sheetOpen }">
      <button class="sheet-handle" aria-label="Toggle panel" @click="store.sheetOpen = !store.sheetOpen" />
      <transition name="panel" mode="out-in">
        <component :is="panelComponent" :key="store.activePanel" />
      </transition>
    </aside>

    <nav class="mobile-nav glass">
      <button
        v-for="t in mobileTabs"
        :key="t.id"
        :class="{ active: store.activePanel === t.id && store.sheetOpen }"
        @click="openPanel(t.id)"
      >
        <span class="nav-icon">{{ t.icon }}</span>{{ t.label }}
      </button>
      <button :class="{ active: !store.sheetOpen }" @click="store.sheetOpen = false">
        <span class="nav-icon">⬢</span>Scene
      </button>
    </nav>

    <div class="legend glass">
      <span class="label">Loci classification</span>
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
      <div v-if="store.busy" class="busy mono"><span class="spinner" /> PROCESSING</div>
    </transition>
  </div>
</template>

<style scoped>
.app {
  position: fixed;
  inset: 0;
}

.hud {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 12;
}

.hud-corner {
  position: fixed;
  width: 24px;
  height: 24px;
  border-color: var(--line-strong);
  border-style: solid;
  opacity: 0.65;
}

.tl {
  top: 9px;
  left: 9px;
  border-width: 1px 0 0 1px;
}
.tr {
  top: 9px;
  right: 9px;
  border-width: 1px 1px 0 0;
}
.bl {
  bottom: 9px;
  left: 9px;
  border-width: 0 0 1px 1px;
}
.br {
  bottom: 9px;
  right: 9px;
  border-width: 0 1px 1px 0;
}

.hud-readout {
  position: fixed;
  top: 32px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 11px;
  font-size: 10px;
  letter-spacing: 0.24em;
  color: var(--muted);
  align-items: center;
  white-space: nowrap;
  max-width: 92vw;
  overflow: hidden;
}

.hud-readout .accent {
  color: var(--accent);
}
.hud-readout .sep {
  color: var(--accent-dim);
}

.drawer {
  position: fixed;
  top: 86px;
  right: 14px;
  bottom: 50px;
  width: 358px;
  padding: 18px 16px;
  z-index: 15;
}

.sheet-handle {
  display: none;
}

.mobile-nav {
  display: none;
}

.legend {
  position: fixed;
  left: 14px;
  bottom: 50px;
  padding: 13px 15px;
  display: flex;
  flex-direction: column;
  gap: 7px;
  font-size: 11px;
  z-index: 15;
}

.legend__row {
  display: flex;
  align-items: center;
  gap: 9px;
  color: var(--muted);
  letter-spacing: 0.04em;
}

.legend__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  box-shadow: 0 0 5px currentColor;
}
.legend__dot.mut {
  background: #ff5a76;
}
.legend__dot.path {
  background: var(--amber);
}

.toast {
  position: fixed;
  bottom: 78px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(127, 232, 192, 0.1);
  border: 1px solid rgba(127, 232, 192, 0.4);
  color: var(--good);
  padding: 8px 18px;
  border-radius: var(--radius);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  z-index: 30;
  backdrop-filter: blur(8px);
  max-width: 90vw;
  text-align: center;
}

.toast.error {
  background: rgba(255, 122, 144, 0.12);
  border-color: rgba(255, 122, 144, 0.45);
  color: var(--danger);
  cursor: pointer;
}

.busy {
  position: fixed;
  top: 92px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 10px;
  letter-spacing: 0.2em;
  color: var(--accent-dim);
  z-index: 30;
}

.spinner {
  width: 12px;
  height: 12px;
  border: 1px solid rgba(143, 227, 255, 0.25);
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

/* ---------- Mobile: bottom sheet + bottom nav ---------- */
@media (max-width: 760px) {
  .legend {
    display: none;
  }

  .hud-readout {
    top: 30px;
    font-size: 9px;
    gap: 7px;
  }

  .hide-sm {
    display: none;
  }

  .toast {
    bottom: 132px;
  }

  .busy {
    top: 84px;
  }

  .drawer {
    top: auto;
    left: 0;
    right: 0;
    bottom: 56px;
    width: auto;
    height: 70vh;
    padding: 8px 16px 16px;
    border-radius: 14px 14px 0 0;
    transform: translateY(calc(100% + 56px));
    transition: transform 0.36s cubic-bezier(0.33, 1, 0.68, 1);
  }

  .drawer.open {
    transform: translateY(0);
  }

  .sheet-handle {
    display: block;
    width: 44px;
    height: 4px;
    border-radius: 4px;
    border: none;
    background: var(--line-strong);
    margin: 2px auto 10px;
    padding: 0;
  }

  .mobile-nav {
    display: flex;
    position: fixed;
    left: 8px;
    right: 8px;
    bottom: 8px;
    height: 54px;
    padding: 6px;
    gap: 4px;
    z-index: 16;
  }

  .mobile-nav button {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    font-size: 9px;
    letter-spacing: 0.1em;
    border: none;
    background: transparent;
    color: var(--muted);
    padding: 4px;
  }

  .mobile-nav button.active {
    color: var(--accent);
    background: rgba(143, 227, 255, 0.1);
  }

  .nav-icon {
    font-size: 15px;
    line-height: 1;
  }
}
</style>
