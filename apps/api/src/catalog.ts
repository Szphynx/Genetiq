import type { Genome, GenomeKind, GenomeSummary } from "@genetiq/core";
import { summarize } from "@genetiq/core";
import { buildSampleGenomes } from "./data/organisms.js";

/**
 * In-memory genome catalog. Seeded with the reference organisms and extended
 * at runtime with user-created genomes (variants, mixes, procedural datasets).
 * Reference genomes are immutable and cannot be deleted.
 *
 * Note: storage is in-process and resets on restart — fine for the MVP; swap
 * for a real datastore behind this same interface later.
 */
export class Catalog {
  private genomes = new Map<string, Genome>();

  constructor() {
    for (const g of buildSampleGenomes()) this.genomes.set(g.id, g);
  }

  list(kind?: GenomeKind): GenomeSummary[] {
    const all = [...this.genomes.values()];
    const filtered = kind ? all.filter((g) => g.kind === kind) : all;
    return filtered
      .map(summarize)
      .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind < b.kind ? -1 : 1));
  }

  get(id: string): Genome | undefined {
    return this.genomes.get(id);
  }

  has(id: string): boolean {
    return this.genomes.has(id);
  }

  add(genome: Genome): GenomeSummary {
    this.genomes.set(genome.id, genome);
    return summarize(genome);
  }

  remove(id: string): boolean {
    const g = this.genomes.get(id);
    if (!g || g.kind === "reference") return false;
    return this.genomes.delete(id);
  }
}
