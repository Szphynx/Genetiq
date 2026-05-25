import type { Nucleotide } from "./types.js";
import type { Rng } from "./rng.js";

export const NUCLEOTIDES: readonly Nucleotide[] = ["A", "C", "G", "T"];

const COMPLEMENT: Record<string, string> = {
  A: "T",
  T: "A",
  C: "G",
  G: "C",
  N: "N",
};

export function complement(base: string): string {
  return COMPLEMENT[base.toUpperCase()] ?? "N";
}

export function reverseComplement(seq: string): string {
  let out = "";
  for (let i = seq.length - 1; i >= 0; i--) out += complement(seq[i]!);
  return out;
}

export function gcContent(seq: string): number {
  if (seq.length === 0) return 0;
  let gc = 0;
  for (let i = 0; i < seq.length; i++) {
    const u = seq[i]!.toUpperCase();
    if (u === "G" || u === "C") gc++;
  }
  return gc / seq.length;
}

export function randomSequence(length: number, rng: Rng): string {
  let out = "";
  for (let i = 0; i < length; i++) out += NUCLEOTIDES[rng.int(0, NUCLEOTIDES.length)]!;
  return out;
}
