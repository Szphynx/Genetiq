<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useGenomeStore } from "@/stores/genome";

const store = useGenomeStore();
const frame = ref(0);
const signal = ref(0.5);
const start = performance.now();
let raf = 0;

function loop(): void {
  frame.value++;
  const t = (performance.now() - start) / 1000;
  signal.value = 0.5 + Math.sin(t * 1.7) * 0.32 + Math.sin(t * 5.3) * 0.12;
  raf = requestAnimationFrame(loop);
}
onMounted(() => {
  raf = requestAnimationFrame(loop);
});
onBeforeUnmount(() => cancelAnimationFrame(raf));

const timecode = computed(() => {
  const total = Math.floor((performance.now() - start) / 1000);
  const mm = String(Math.floor(total / 60) % 60).padStart(2, "0");
  const ss = String(total % 60).padStart(2, "0");
  const ff = String(frame.value % 30).padStart(2, "0");
  return `${mm}:${ss}:${ff}`;
});

const CIRC = 2 * Math.PI * 18;
function arc(pct: number): string {
  const p = Math.max(0, Math.min(1, pct));
  return `${(p * CIRC).toFixed(1)} ${CIRC.toFixed(1)}`;
}

const gauges = computed(() => {
  const muts = store.current?.mutations?.length ?? 0;
  const gen = store.current?.generation ?? 0;
  return [
    { label: "LOCI", value: store.geneList.length, pct: Math.min(1, store.geneList.length / 1600) },
    { label: "MUT", value: muts, pct: Math.min(1, muts / 40) },
    { label: "GEN", value: gen, pct: Math.min(1, gen / 10) },
  ];
});

const tips: Record<string, string> = {
  LOCI: "Genes currently rendered in the scene",
  MUT: "Mutations applied to this genome",
  GEN: "Generative generation of this genome",
};
function gaugeTip(label: string): string {
  return tips[label] ?? label;
}

const ticks = Array.from({ length: 21 }, (_, i) => i);
const caret = computed(() => {
  const y = 100 + Math.sin(frame.value * 0.012) * 86;
  return `10,${(y - 4).toFixed(1)} 17,${y.toFixed(1)} 10,${(y + 4).toFixed(1)}`;
});
</script>

<template>
  <div class="hud-extra">
    <div class="scanline" />

    <svg class="ruler" viewBox="0 0 22 200" preserveAspectRatio="none">
      <line x1="3" y1="2" x2="3" y2="198" class="spine" />
      <line
        v-for="i in ticks"
        :key="i"
        x1="3"
        :y1="i * 9.6 + 4"
        :x2="i % 5 === 0 ? 14 : 8"
        :y2="i * 9.6 + 4"
        class="tick"
      />
      <polygon :points="caret" class="caret" />
    </svg>

    <div class="console mono">
      <div class="gauge" v-for="g in gauges" :key="g.label" v-tip="gaugeTip(g.label)">
        <svg viewBox="0 0 44 44">
          <circle cx="22" cy="22" r="18" class="track" />
          <circle cx="22" cy="22" r="18" class="fill" :stroke-dasharray="arc(g.pct)" />
        </svg>
        <div class="gauge__val">{{ g.value }}</div>
        <div class="gauge__lbl">{{ g.label }}</div>
      </div>

      <div class="telemetry">
        <div class="tele-row">
          <span class="tele-key">T</span><span>{{ timecode }}</span>
        </div>
        <div class="tele-row">
          <span class="tele-key">SIG</span>
          <span class="bar"><i :style="{ width: signal * 100 + '%' }" /></span>
        </div>
        <div class="tele-row dim">
          <span class="tele-key">SYS</span><span>NOMINAL</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hud-extra {
  position: fixed;
  inset: 0;
  pointer-events: none;
  z-index: 11;
}

.scanline {
  position: absolute;
  left: 4%;
  right: 4%;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(143, 227, 255, 0.45), transparent);
  box-shadow: 0 0 10px rgba(143, 227, 255, 0.25);
  animation: scan 7.5s linear infinite;
  opacity: 0.5;
}

@keyframes scan {
  0% {
    top: 8%;
    opacity: 0;
  }
  10% {
    opacity: 0.5;
  }
  90% {
    opacity: 0.5;
  }
  100% {
    top: 92%;
    opacity: 0;
  }
}

.ruler {
  position: absolute;
  left: 8px;
  top: 96px;
  width: 22px;
  height: 240px;
}

.ruler .spine,
.ruler .tick {
  stroke: rgba(143, 227, 255, 0.35);
  stroke-width: 0.8;
}

.ruler .caret {
  fill: var(--accent);
}

.console {
  position: absolute;
  bottom: 14px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 20px;
}

.gauge {
  position: relative;
  width: 44px;
  text-align: center;
}

.gauge svg {
  width: 44px;
  height: 44px;
}

.gauge .track {
  fill: none;
  stroke: rgba(143, 227, 255, 0.12);
  stroke-width: 2;
}

.gauge .fill {
  fill: none;
  stroke: var(--accent);
  stroke-width: 2;
  stroke-linecap: round;
  transform: rotate(-90deg);
  transform-origin: 22px 22px;
  filter: drop-shadow(0 0 3px rgba(143, 227, 255, 0.5));
  transition: stroke-dasharray 0.4s ease;
}

.gauge__val {
  position: absolute;
  top: 14px;
  left: 0;
  right: 0;
  font-size: 11px;
  color: var(--text);
}

.gauge__lbl {
  font-size: 8px;
  letter-spacing: 0.2em;
  color: var(--muted);
  margin-top: 1px;
}

.telemetry {
  display: flex;
  flex-direction: column;
  gap: 3px;
  font-size: 9px;
  letter-spacing: 0.12em;
  color: var(--muted);
  min-width: 130px;
}

.tele-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tele-row.dim {
  color: var(--good);
}

.tele-key {
  color: var(--accent-dim);
  width: 22px;
}

.bar {
  flex: 1;
  height: 3px;
  background: rgba(143, 227, 255, 0.12);
  border-radius: 2px;
  overflow: hidden;
}

.bar i {
  display: block;
  height: 100%;
  background: var(--accent);
}

/* Declutter on phones: keep the scanline, drop the ruler + console. */
@media (max-width: 760px) {
  .ruler,
  .console {
    display: none;
  }
}
</style>
