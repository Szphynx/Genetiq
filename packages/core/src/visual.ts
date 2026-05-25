import type { Gene, GeneBiotype, MutationEffect } from "./types.js";

export type RGB = [number, number, number];

export interface VisualParams {
  color: RGB; // 0..1 rgb
  emissive: number; // 0..1
  size: number; // relative scale
  highlight: boolean;
}

/** Categorical colour per gene biotype — the base hue of a gene in 3D. */
export const BIOTYPE_PALETTE: Record<GeneBiotype, RGB> = {
  protein_coding: [0.2, 0.65, 1.0],
  lncRNA: [0.65, 0.4, 1.0],
  miRNA: [1.0, 0.55, 0.25],
  rRNA: [0.95, 0.8, 0.25],
  tRNA: [0.3, 0.85, 0.65],
  snRNA: [0.45, 0.75, 0.95],
  snoRNA: [0.55, 0.65, 0.95],
  pseudogene: [0.55, 0.55, 0.6],
  regulatory: [1.0, 0.35, 0.55],
  other: [0.7, 0.72, 0.78],
};

export const NUCLEOTIDE_COLORS: Record<string, RGB> = {
  A: [0.3, 0.8, 0.45],
  T: [0.95, 0.45, 0.4],
  G: [0.35, 0.55, 0.95],
  C: [0.95, 0.78, 0.3],
  N: [0.6, 0.6, 0.6],
};

export const EFFECT_COLORS: Record<MutationEffect, RGB> = {
  silent: [0.6, 0.6, 0.65],
  missense: [1.0, 0.7, 0.2],
  nonsense: [1.0, 0.25, 0.2],
  frameshift: [0.95, 0.3, 0.55],
  inframe: [0.5, 0.8, 0.4],
  regulatory: [0.4, 0.7, 1.0],
  structural: [0.8, 0.4, 1.0],
  unknown: [0.7, 0.7, 0.7],
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function mix(a: RGB, b: RGB, t: number): RGB {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function shift(c: RGB, d: number): RGB {
  return [clamp(c[0] + d, 0, 1), clamp(c[1] + d, 0, 1), clamp(c[2] + d, 0, 1)];
}

export interface GeneVisualOptions {
  selected?: boolean;
  mutated?: boolean;
}

/**
 * Map a gene's biology to render parameters. Biotype sets the base hue; GC
 * content nudges brightness; expression and copy number drive size and
 * emission; mutation/pathogenic/deleted states recolour for instant reading.
 */
export function geneVisual(gene: Gene, opts: GeneVisualOptions = {}): VisualParams {
  let color: RGB = BIOTYPE_PALETTE[gene.biotype] ?? BIOTYPE_PALETTE.other;

  if (gene.gcContent != null) color = shift(color, (gene.gcContent - 0.5) * 0.35);

  const pathogenic = gene.diseases?.some((d) => d.pathogenic) ?? false;
  const copies = gene.copies ?? 1;
  const expression = gene.expression ?? 0.5;

  if (gene.deleted) {
    color = [0.22, 0.05, 0.08];
  } else if (opts.mutated) {
    color = mix(color, [1.0, 0.2, 0.3], 0.6);
  } else if (pathogenic) {
    color = mix(color, [1.0, 0.85, 0.2], 0.35);
  }

  const size = clamp(0.4 + expression * 1.1 + (copies - 1) * 0.25, 0.3, 2.4);
  const emissive = clamp(
    (opts.selected ? 0.9 : 0.12) + (opts.mutated ? 0.5 : 0) + expression * 0.2,
    0,
    1,
  );

  return { color, emissive, size, highlight: !!opts.selected };
}

export function rgbToHex([r, g, b]: RGB): string {
  const h = (x: number): string => Math.round(clamp(x, 0, 1) * 255).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}
