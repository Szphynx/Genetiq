import { reactive, ref, watch } from "vue";
import { defineStore } from "pinia";
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type Settings } from "@/settings";

export const useSettingsStore = defineStore("settings", () => {
  const s = reactive<Settings>(loadSettings());
  const open = ref(false); // settings panel visibility

  watch(s, () => saveSettings(s), { deep: true });

  function reset(): void {
    Object.assign(s, DEFAULT_SETTINGS);
  }

  function toggleTheme(): void {
    s.theme = s.theme === "dossier" ? "holo" : "dossier";
  }

  return { s, open, reset, toggleTheme };
});
