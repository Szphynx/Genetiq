import type { Chromosome, Gene, GeneBiotype, Genome, Strand } from "@genetiq/core";
import { slugId } from "@genetiq/core";

/**
 * Live Ensembl REST provider (https://rest.ensembl.org).
 *
 * Network shape and mapping are kept separate: the `map*` functions are pure
 * and unit-testable, while `fetchJson` is the only side-effecting part. Full
 * genomes have tens of thousands of genes, so we apply level-of-detail —
 * a capped sample of genes per chromosome for the overview, with a region
 * endpoint for drilling into detail.
 */

const BASE = process.env.GENETIQ_ENSEMBL_BASE ?? "https://rest.ensembl.org";
const TIMEOUT = Number(process.env.GENETIQ_ENSEMBL_TIMEOUT ?? 12000);

export interface EnsemblSpecies {
  id: string;
  ensembl: string;
  commonName: string;
  species: string;
}

export const ENSEMBL_SPECIES: EnsemblSpecies[] = [
  { id: "human", ensembl: "homo_sapiens", commonName: "Human", species: "Homo sapiens" },
  { id: "mouse", ensembl: "mus_musculus", commonName: "Mouse", species: "Mus musculus" },
  { id: "zebrafish", ensembl: "danio_rerio", commonName: "Zebrafish", species: "Danio rerio" },
  { id: "fruitfly", ensembl: "drosophila_melanogaster", commonName: "Fruit fly", species: "Drosophila melanogaster" },
  { id: "chicken", ensembl: "gallus_gallus", commonName: "Chicken", species: "Gallus gallus" },
  { id: "dog", ensembl: "canis_lupus_familiaris", commonName: "Dog", species: "Canis lupus familiaris" },
];

interface EnsemblAssembly {
  assembly_name?: string;
  top_level_region?: Array<{ name: string; length: number; coord_system: string }>;
  karyotype?: string[];
}

interface EnsemblGene {
  id: string;
  external_name?: string;
  description?: string;
  start: number;
  end: number;
  strand: number;
  biotype?: string;
  seq_region_name?: string;
}

const BIOTYPE_MAP: Record<string, GeneBiotype> = {
  protein_coding: "protein_coding",
  lncRNA: "lncRNA",
  lincRNA: "lncRNA",
  miRNA: "miRNA",
  rRNA: "rRNA",
  tRNA: "tRNA",
  snRNA: "snRNA",
  snoRNA: "snoRNA",
};

export function mapBiotype(biotype?: string): GeneBiotype {
  if (!biotype) return "other";
  const mapped = BIOTYPE_MAP[biotype];
  if (mapped) return mapped;
  if (biotype.includes("pseudogene")) return "pseudogene";
  return "other";
}

export function mapChromosomes(
  species: EnsemblSpecies,
  assembly: EnsemblAssembly,
  opts: { maxChromosomes?: number } = {},
): Chromosome[] {
  const regions = (assembly.top_level_region ?? []).filter((r) => r.coord_system === "chromosome");
  let ordered = regions;
  if (assembly.karyotype?.length) {
    const order = new Map(assembly.karyotype.map((n, i) => [n, i] as const));
    ordered = regions
      .filter((r) => order.has(r.name))
      .sort((a, b) => (order.get(a.name) ?? 0) - (order.get(b.name) ?? 0));
  } else {
    ordered = [...regions].sort((a, b) => b.length - a.length);
  }
  if (opts.maxChromosomes) ordered = ordered.slice(0, opts.maxChromosomes);
  return ordered.map((r) => ({
    id: slugId("chr", species.id, r.name),
    name: r.name,
    length: r.length,
    genes: [],
  }));
}

export function mapGenes(
  species: EnsemblSpecies,
  chr: Chromosome,
  raw: EnsemblGene[],
  cap: number,
): Gene[] {
  const sorted = [...raw].sort((a, b) => {
    const an = a.external_name ? 0 : 1;
    const bn = b.external_name ? 0 : 1;
    if (an !== bn) return an - bn;
    const ap = a.biotype === "protein_coding" ? 0 : 1;
    const bp = b.biotype === "protein_coding" ? 0 : 1;
    if (ap !== bp) return ap - bp;
    return a.start - b.start;
  });
  return sorted.slice(0, Math.max(0, cap)).map((g) => ({
    id: slugId("gene", species.id, g.id),
    symbol: g.external_name ?? g.id,
    name: g.description?.split(" [")[0] ?? g.external_name ?? g.id,
    chromosomeId: chr.id,
    start: g.start,
    end: g.end,
    strand: (g.strand >= 0 ? "+" : "-") as Strand,
    biotype: mapBiotype(g.biotype),
    description: g.description,
    tags: ["ensembl", g.id],
  }));
}

async function fetchJson<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT);
  try {
    const res = await fetch(`${BASE}${path}`, {
      headers: { "content-type": "application/json", accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`Ensembl responded ${res.status} for ${path}`);
    return (await res.json()) as T;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Ensembl request timed out (${path})`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

interface CacheEntry {
  genome: Genome;
  expires: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_TTL = 10 * 60 * 1000;

export interface EnsemblGenomeOptions {
  perChromosome?: number;
  maxChromosomes?: number;
  window?: number;
}

export async function buildEnsemblGenome(
  speciesId: string,
  options: EnsemblGenomeOptions = {},
): Promise<Genome> {
  const species = ENSEMBL_SPECIES.find((s) => s.id === speciesId);
  if (!species) throw new Error(`Unknown Ensembl species: ${speciesId}`);

  const perChromosome = Math.min(40, Math.max(1, options.perChromosome ?? 15));
  const maxChromosomes = Math.min(40, Math.max(1, options.maxChromosomes ?? 24));
  const window = options.window ?? 5_000_000;

  const cacheKey = `${speciesId}:${perChromosome}:${maxChromosomes}:${window}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expires > Date.now()) return cached.genome;

  const assembly = await fetchJson<EnsemblAssembly>(
    `/info/assembly/${species.ensembl}?content-type=application/json`,
  );
  const chromosomes = mapChromosomes(species, assembly, { maxChromosomes });

  // LOD: sample a capped set of genes from the first `window` bp of each
  // chromosome. Sequential to respect Ensembl rate limits.
  for (const chr of chromosomes) {
    const end = Math.min(window, chr.length);
    const raw = await fetchJson<EnsemblGene[]>(
      `/overlap/region/${species.ensembl}/${chr.name}:1-${end}?feature=gene;content-type=application/json`,
    ).catch(() => [] as EnsemblGene[]);
    chr.genes = mapGenes(species, chr, raw, perChromosome);
  }

  const genome: Genome = {
    id: `ensembl-${species.id}`,
    name: species.commonName,
    species: species.species,
    commonName: species.commonName,
    assembly: assembly.assembly_name,
    kind: "reference",
    source: "ensembl",
    description: `Live Ensembl data · LOD: up to ${perChromosome} genes from the first ${Math.round(
      window / 1_000_000,
    )} Mb of each chromosome.`,
    generation: 0,
    chromosomes,
  };

  cache.set(cacheKey, { genome, expires: Date.now() + CACHE_TTL });
  return genome;
}

export async function getRegionGenes(
  speciesId: string,
  chromosome: string,
  start: number,
  end: number,
  cap = 200,
): Promise<Gene[]> {
  const species = ENSEMBL_SPECIES.find((s) => s.id === speciesId);
  if (!species) throw new Error(`Unknown Ensembl species: ${speciesId}`);
  const chr: Chromosome = { id: slugId("chr", species.id, chromosome), name: chromosome, length: end, genes: [] };
  const raw = await fetchJson<EnsemblGene[]>(
    `/overlap/region/${species.ensembl}/${chromosome}:${start}-${end}?feature=gene;content-type=application/json`,
  );
  return mapGenes(species, chr, raw, cap);
}
