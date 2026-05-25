import type { Genome, GenomeKind, GenomeSummary } from "@genetiq/core";
import { summarize } from "@genetiq/core";
import { buildSampleGenomes } from "./data/organisms.js";
import { createPersistence, type Persistence } from "./store.js";

/**
 * Genome catalog. Reference organisms are seeded fresh each start; user
 * creations (variants, mixes, procedural datasets) are loaded from — and
 * persisted to — the datastore so they survive restarts. Reference genomes
 * are immutable and never deleted.
 */
export class Catalog {
  private genomes = new Map<string, Genome>();

  constructor(private readonly persistence: Persistence = createPersistence()) {
    for (const g of buildSampleGenomes()) this.genomes.set(g.id, g);
    for (const g of this.persistence.loadAll()) {
      if (g.kind !== "reference") this.genomes.set(g.id, g);
    }
  }

  get storeKind(): string {
    return this.persistence.kind;
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
    if (genome.kind !== "reference") this.persist();
    return summarize(genome);
  }

  remove(id: string): boolean {
    const g = this.genomes.get(id);
    if (!g || g.kind === "reference") return false;
    this.genomes.delete(id);
    this.persist();
    return true;
  }

  /** Persist only user creations; references are re-seeded from code. */
  private persist(): void {
    const creations = [...this.genomes.values()].filter((g) => g.kind !== "reference");
    this.persistence.save(creations);
  }
}
