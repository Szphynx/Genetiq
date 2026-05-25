<script setup lang="ts">
import { computed } from "vue";
import { useGenomeStore, type Panel } from "@/stores/genome";

const store = useGenomeStore();

const currentId = computed<string>({
  get: () => store.current?.id ?? "",
  set: (v: string) => {
    if (v && v !== store.current?.id) void store.loadGenome(v);
  },
});

const options = computed(() => {
  const list = [...store.references, ...store.creations].map((g) => ({
    id: g.id,
    name: g.name,
    kind: g.kind as string,
  }));
  const cur = store.current;
  if (cur && !list.some((o) => o.id === cur.id)) {
    list.unshift({ id: cur.id, name: cur.name, kind: cur.kind });
  }
  return list;
});

const panels: Array<{ id: Panel; label: string }> = [
  { id: "inspect", label: "Inspect" },
  { id: "studio", label: "Studio" },
  { id: "gallery", label: "Gallery" },
];

function overview(): void {
  void store.selectGene(null);
}
</script>

<template>
  <header class="topbar glass">
    <div class="brand">
      <span class="brand__mark">◈</span>
      <div>
        <div class="brand__name">GENETIQ</div>
        <div class="brand__sub">3D genome studio</div>
      </div>
    </div>

    <div class="selector">
      <span class="label hide-sm">Genome</span>
      <select v-model="currentId" v-tip="'Switch organism or saved creation'">
        <option v-for="o in options" :key="o.id" :value="o.id">
          {{ o.name }}{{ o.kind !== "reference" ? " ·" : "" }} {{ o.kind !== "reference" ? o.kind : "" }}
        </option>
      </select>
    </div>

    <div class="spacer" />

    <button
      class="ghost icon-btn"
      v-tip="'Switch interface theme (Dossier / Holo)'"
      @click="store.toggleTheme()"
    >
      <span class="ico">▣</span><span class="hide-sm"> {{ store.theme === "dossier" ? "Dossier" : "Holo" }}</span>
    </button>
    <button class="ghost icon-btn" v-tip="'Play the cinematic fly-through'" @click="store.playIntro()">
      <span class="ico">▶</span><span class="hide-sm"> Intro</span>
    </button>
    <button class="ghost icon-btn" v-tip="'Frame the whole genome'" @click="overview">
      <span class="ico">⤢</span><span class="hide-sm"> Overview</span>
    </button>

    <nav class="tabs">
      <button
        v-for="p in panels"
        :key="p.id"
        :class="{ active: store.activePanel === p.id }"
        @click="store.activePanel = p.id"
      >
        {{ p.label }}
      </button>
    </nav>
  </header>
</template>

<style scoped>
.topbar {
  position: fixed;
  top: 14px;
  left: 14px;
  right: 14px;
  height: 58px;
  display: flex;
  align-items: center;
  gap: 18px;
  padding: 0 16px;
  z-index: 20;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand__mark {
  font-size: 22px;
  color: var(--accent);
  filter: drop-shadow(0 0 8px rgba(76, 194, 255, 0.7));
}

.brand__name {
  font-weight: 300;
  letter-spacing: 0.34em;
  font-size: 15px;
}

.brand__sub {
  font-size: 9px;
  color: var(--muted);
  letter-spacing: 0.2em;
  text-transform: uppercase;
}

.selector {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 220px;
}

.spacer {
  flex: 1;
}

.tabs {
  display: flex;
  gap: 6px;
}

.tabs button.active {
  color: var(--accent);
  border-color: var(--accent);
  background: rgba(143, 227, 255, 0.12);
  box-shadow: inset 0 0 14px rgba(143, 227, 255, 0.15);
}

.icon-btn .ico {
  font-size: 12px;
}

@media (max-width: 760px) {
  .topbar {
    height: 50px;
    gap: 10px;
    padding: 0 12px;
  }
  .brand__sub {
    display: none;
  }
  .selector {
    min-width: 0;
    flex: 1;
  }
  .hide-sm {
    display: none;
  }
  .tabs {
    display: none;
  }
}
</style>
