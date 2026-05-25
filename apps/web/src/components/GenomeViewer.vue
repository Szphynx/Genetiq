<script setup lang="ts">
import { onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
import type { Genome } from "@genetiq/core";
import { BIOTYPE_PALETTE, rgbToHex } from "@genetiq/core";
import { GenetiqEngine, type CardScreenInfo } from "@/engine/GenetiqEngine";
import { useGenomeStore } from "@/stores/genome";

const store = useGenomeStore();
const canvas = ref<HTMLCanvasElement | null>(null);
const card = reactive<CardScreenInfo>({ x: 0, y: 0, visible: false });
const ready = ref(false);
let engine: GenetiqEngine | null = null;
let lastRenderedId = "";

function render(): void {
  if (!engine || !ready.value || !store.current) return;
  const g = store.current;
  const reset = g.id !== lastRenderedId;
  lastRenderedId = g.id;
  engine.setData(g, {
    mutatedGeneIds: store.mutatedIds,
    selectedGeneId: store.selectedGeneId,
    resetCamera: reset,
  });
}

onMounted(async () => {
  if (!canvas.value) return;
  engine = new GenetiqEngine(canvas.value);
  await engine.init({
    onPick: (geneId) => {
      void store.selectGene(geneId);
      if (geneId) store.activePanel = "inspect";
    },
    onCard: (info) => Object.assign(card, info),
    onReady: (backend) => {
      store.backend = backend;
      ready.value = true;
      render();
    },
  });
});

watch(
  () => store.current,
  () => render(),
);

watch(
  () => store.selectedGeneId,
  (id, prev) => {
    if (!engine || !ready.value) return;
    engine.setSelected(id);
    if (id && id !== prev) engine.focusGene(id);
    else if (!id && prev) engine.focusOverview();
  },
);

watch(
  () => store.focusChrId,
  (chrId) => {
    if (chrId && engine && ready.value) {
      engine.focusChromosome(chrId);
      store.focusChrId = null;
    }
  },
);

watch(
  () => store.morphTargetGenome,
  (target) => {
    if (!engine || !ready.value) return;
    if (target) engine.prepareMorph(target);
    else engine.clearMorph();
  },
);

watch(
  () => store.morphT,
  (t) => engine?.setMorphT(t),
);

onBeforeUnmount(() => engine?.dispose());

function biotypeColor(): string {
  const g = store.selectedGene;
  if (!g) return "#ffffff";
  return rgbToHex(BIOTYPE_PALETTE[g.biotype] ?? BIOTYPE_PALETTE.other);
}

function chromName(chrId: string): string {
  return store.current?.chromosomes.find((c) => c.id === chrId)?.name ?? "?";
}
</script>

<template>
  <div class="viewer">
    <canvas ref="canvas" />

    <div
      v-if="store.selectedGene && card.visible"
      class="gene-card glass"
      :style="{ left: `${card.x}px`, top: `${card.y}px` }"
    >
      <div class="gene-card__bar" :style="{ background: biotypeColor() }" />
      <div class="gene-card__head">
        <span class="gene-card__symbol mono">{{ store.selectedGene.symbol }}</span>
        <span class="label">{{ store.selectedGene.biotype }}</span>
      </div>
      <div class="gene-card__name">{{ store.selectedGene.name }}</div>
      <div class="gene-card__meta mono">
        chr{{ chromName(store.selectedGene.chromosomeId) }}:{{ store.selectedGene.start.toLocaleString() }}–{{
          store.selectedGene.end.toLocaleString()
        }}
        ({{ store.selectedGene.strand }})
      </div>
      <div
        v-if="store.selectedGene.diseases?.length"
        class="gene-card__diseases"
      >
        <span v-for="d in store.selectedGene.diseases" :key="d.id" class="chip" :class="{ danger: d.pathogenic }">
          {{ d.name }}
        </span>
      </div>
    </div>

  </div>
</template>

<style scoped>
.viewer {
  position: fixed;
  inset: 0;
}

canvas {
  width: 100%;
  height: 100%;
  display: block;
  outline: none;
  touch-action: none;
}

.gene-card {
  position: absolute;
  transform: translate(-50%, calc(-100% - 22px));
  width: 248px;
  padding: 12px 14px 14px;
  pointer-events: none;
  overflow: hidden;
}

/* leader line + node from the card down to the gene */
.gene-card::after {
  content: "";
  position: absolute;
  left: 50%;
  bottom: -22px;
  width: 1px;
  height: 22px;
  background: linear-gradient(var(--line-strong), transparent);
}

.gene-card__bar {
  position: absolute;
  inset: 0 auto 0 0;
  width: 2px;
}

.gene-card__head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}

.gene-card__symbol {
  font-size: 19px;
  font-weight: 300;
  letter-spacing: 0.12em;
  color: var(--accent);
}

.gene-card__name {
  font-size: 12px;
  margin: 5px 0 7px;
  color: var(--text);
  font-weight: 300;
}

.gene-card__meta {
  font-size: 10.5px;
  color: var(--muted);
  letter-spacing: 0.04em;
}

.gene-card__diseases {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 9px;
}

.chip {
  font-size: 10px;
  padding: 2px 8px;
  border-radius: var(--radius);
  background: rgba(143, 227, 255, 0.1);
  border: 1px solid var(--line);
  letter-spacing: 0.04em;
}

.chip.danger {
  background: rgba(255, 122, 144, 0.12);
  border-color: rgba(255, 122, 144, 0.4);
  color: #ffc2cc;
}
</style>
