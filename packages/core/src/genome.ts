import type { Chromosome, Gene, Genome, GenomeSummary } from "./types.js";

export function cloneGenome(genome: Genome): Genome {
  return structuredClone(genome);
}

export function findChromosome(genome: Genome, chromosomeId: string): Chromosome | undefined {
  return genome.chromosomes.find((c) => c.id === chromosomeId);
}

export function findGene(genome: Genome, geneId: string): Gene | undefined {
  for (const chr of genome.chromosomes) {
    const gene = chr.genes.find((g) => g.id === geneId);
    if (gene) return gene;
  }
  return undefined;
}

export function findGeneBySymbol(genome: Genome, symbol: string): Gene | undefined {
  const target = symbol.toLowerCase();
  for (const chr of genome.chromosomes) {
    const gene = chr.genes.find((g) => g.symbol.toLowerCase() === target);
    if (gene) return gene;
  }
  return undefined;
}

export function allGenes(genome: Genome): Gene[] {
  return genome.chromosomes.flatMap((c) => c.genes);
}

export function genesInRegion(chr: Chromosome, start: number, end: number): Gene[] {
  return chr.genes.filter((g) => g.end >= start && g.start <= end);
}

export function geneCount(genome: Genome): number {
  let n = 0;
  for (const c of genome.chromosomes) n += c.genes.length;
  return n;
}

export function summarize(genome: Genome): GenomeSummary {
  const { chromosomes, mutations: _mutations, ...meta } = genome;
  return {
    ...meta,
    chromosomeCount: chromosomes.length,
    geneCount: geneCount(genome),
  };
}

/** Set of gene ids touched by the genome's recorded mutations. */
export function mutatedGeneIds(genome: Genome): Set<string> {
  const ids = new Set<string>();
  for (const m of genome.mutations ?? []) {
    if (m.geneId) ids.add(m.geneId);
  }
  return ids;
}
