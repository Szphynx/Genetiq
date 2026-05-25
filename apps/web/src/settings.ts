/**
 * User-tweakable visual settings. Defaults live here (the "settings file");
 * runtime changes are persisted to localStorage so they survive reloads.
 */
export type ThemeName = "dossier" | "holo";

export interface Settings {
  theme: ThemeName;
  /** CRT surface: scanlines + dither + flicker overlay. */
  crt: boolean;
  /** Selective bloom/glow on the 3D scene. */
  bloom: boolean;
  /** Film grain post-process. */
  grain: boolean;
  /** Subtle chromatic aberration post-process. */
  chromaticAberration: boolean;
  /** Halftone / print-dither overlay on the 3D canvas. */
  printFilter: boolean;
  /** Auto-play the cinematic fly-through on first load. */
  introAutoplay: boolean;
  /** CRT power-on sequence on load. */
  bootSequence: boolean;
  /** Honour reduced-motion: stop idle spin, flicker and animations. */
  reducedMotion: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: "dossier",
  crt: true,
  bloom: true,
  grain: true,
  chromaticAberration: true,
  printFilter: false,
  introAutoplay: true,
  bootSequence: true,
  reducedMotion: false,
};

const STORAGE_KEY = "genetiq.settings.v1";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return { ...DEFAULT_SETTINGS, ...parsed };
    }
  } catch {
    /* ignore malformed storage */
  }
  return { ...DEFAULT_SETTINGS };
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    /* storage unavailable (private mode etc.) */
  }
}
