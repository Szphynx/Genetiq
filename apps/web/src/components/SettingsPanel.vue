<script setup lang="ts">
import { useSettingsStore } from "@/stores/settings";
import type { Settings } from "@/settings";

const settings = useSettingsStore();

// Keys of Settings whose value is a boolean (everything except `theme`).
type BooleanKey = {
  [K in keyof Settings]: Settings[K] extends boolean ? K : never;
}[keyof Settings];

const toggles: Array<{ key: BooleanKey; label: string; desc: string }> = [
  { key: "crt", label: "CRT surface", desc: "Scanlines, dither & flicker" },
  { key: "bloom", label: "Bloom", desc: "Glow on the 3D scene" },
  { key: "grain", label: "Film grain", desc: "Subtle sensor grain" },
  { key: "chromaticAberration", label: "Chromatic aberration", desc: "Lens colour fringing" },
  { key: "printFilter", label: "Print / halftone", desc: "Dithered overlay on the canvas" },
  { key: "introAutoplay", label: "Intro autoplay", desc: "Fly-through on first load" },
  { key: "bootSequence", label: "Boot sequence", desc: "CRT power-on on load" },
  { key: "reducedMotion", label: "Reduced motion", desc: "Stop spin, flicker & animations" },
];
</script>

<template>
  <div v-if="settings.open" class="scrim" @click.self="settings.open = false">
      <div class="settings glass scroll">
        <div class="settings__head">
          <span class="label">Settings</span>
          <button class="ghost" v-tip="'Close'" @click="settings.open = false">✕</button>
        </div>

        <div class="row">
          <div class="row__text">
            <div class="row__label">Theme</div>
            <div class="row__desc">Interface aesthetic</div>
          </div>
          <div class="seg">
            <button :class="{ active: settings.s.theme === 'dossier' }" @click="settings.s.theme = 'dossier'">
              Dossier
            </button>
            <button :class="{ active: settings.s.theme === 'holo' }" @click="settings.s.theme = 'holo'">Holo</button>
          </div>
        </div>

        <div class="row" v-for="t in toggles" :key="t.key">
          <div class="row__text">
            <div class="row__label">{{ t.label }}</div>
            <div class="row__desc">{{ t.desc }}</div>
          </div>
          <button
            class="switch"
            :class="{ on: settings.s[t.key] }"
            role="switch"
            :aria-checked="settings.s[t.key]"
            @click="settings.s[t.key] = !settings.s[t.key]"
          >
            <span class="knob" />
          </button>
        </div>

        <button class="ghost full" v-tip="'Restore default settings'" @click="settings.reset()">
          ↺ Reset to defaults
        </button>
      </div>
  </div>
</template>

<style scoped>
.scrim {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(2px);
  animation: scrimIn 0.2s ease both;
}

.settings {
  animation: settingsIn 0.24s cubic-bezier(0.33, 1, 0.68, 1) both;
}

@keyframes scrimIn {
  from {
    opacity: 0;
  }
}

@keyframes settingsIn {
  from {
    opacity: 0;
    transform: translateY(10px) scale(0.98);
  }
}

.settings {
  width: 420px;
  max-width: 92vw;
  max-height: 84vh;
  padding: 18px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.settings__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 9px 2px;
  border-bottom: 1px solid var(--line);
}

.row__label {
  font-size: 13px;
  color: var(--text);
}

.row__desc {
  font-size: 11px;
  color: var(--muted);
  margin-top: 1px;
}

.seg {
  display: flex;
  gap: 4px;
}

.seg button.active {
  color: var(--accent);
  border-color: var(--accent);
  background: rgba(143, 227, 255, 0.14);
}

.switch {
  width: 44px;
  height: 22px;
  border-radius: 999px;
  border: 1px solid var(--line);
  background: rgba(0, 0, 0, 0.3);
  padding: 0;
  position: relative;
  flex-shrink: 0;
  transition: border-color 0.15s ease, background 0.15s ease;
}

.switch .knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: var(--muted);
  transition: transform 0.18s ease, background 0.18s ease;
}

.switch.on {
  border-color: var(--accent);
  background: rgba(143, 227, 255, 0.2);
}

.switch.on .knob {
  transform: translateX(22px);
  background: var(--accent);
  box-shadow: 0 0 8px var(--accent);
}

.full {
  width: 100%;
  margin-top: 12px;
}
</style>
