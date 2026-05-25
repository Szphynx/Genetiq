import type { Gene, Genome, Mutation, MutationType } from "./types.js";
import { Rng, hashStringToSeed } from "./rng.js";
import { applyMutations } from "./mutation.js";
import { allGenes, cloneGenome } from "./genome.js";
import { slugId, uid } from "./ids.js";
import { NUCLEOTIDES } from "./sequence.js";

const DEFAULT_TYPES: MutationType[] = [
  "substitution",
  "insertion",
  "deletion",
  "duplication",
  "inversion",
];

export interface VariantOptions {
  seed?: number;
  mutationCount?: number;
  types?: MutationType[];
  name?: string;
}

/** Build a single plausible random mutation for the genome. */
export function randomMutation(
  genome: Genome,
  rng: Rng,
  types: MutationType[] = DEFAULT_TYPES,
): Mutation | null {
  const genes = allGenes(genome).filter((g) => !g.deleted);
  if (genes.length === 0) return null;

  const gene = rng.pick(genes);
  const type = rng.pick(types);
  const position = rng.int(gene.start, gene.end + 1);
  const ref = rng.pick(NUCLEOTIDES);
  let alt = rng.pick(NUCLEOTIDES);
  if (type === "substitution") {
    while (alt === ref) alt = rng.pick(NUCLEOTIDES);
  }

  // Built directly (not via makeMutation) with a deterministic id and no
  // timestamp so the same seed reproduces byte-identical mutations.
  return {
    id: slugId("mut", gene.id, type, String(position), alt),
    type,
    chromosomeId: gene.chromosomeId,
    geneId: gene.id,
    position,
    length: type === "deletion" || type === "insertion" ? rng.int(1, 6) : 1,
    ref,
    alt,
    effect: "unknown",
    source: "generative",
    label: `${type} · ${gene.symbol}`,
  };
}

/** Derive one mutated variant from a parent genome. Deterministic per seed. */
export function generateVariant(parent: Genome, options: VariantOptions = {}): Genome {
  const seed = options.seed ?? hashStringToSeed(`${parent.id}:${Date.now()}`);
  const rng = new Rng(seed);
  const count = options.mutationCount ?? 8;
  const types = options.types ?? DEFAULT_TYPES;

  const mutations: Mutation[] = [];
  for (let i = 0; i < count; i++) {
    const m = randomMutation(parent, rng, types);
    if (m) mutations.push(m);
  }

  const variant = applyMutations(parent, mutations);
  variant.id = uid("var");
  variant.name = options.name ?? `${parent.commonName ?? parent.name} · v${(parent.generation ?? 0) + 1}`;
  variant.kind = "variant";
  variant.parents = [parent.id];
  variant.generation = (parent.generation ?? 0) + 1;
  variant.seed = seed;
  variant.createdAt = new Date().toISOString();
  return variant;
}

/** Produce a lineage of N successive generations. */
export function evolve(
  parent: Genome,
  opts: { generations: number; mutationsPerGen?: number; seed?: number; types?: MutationType[] },
): Genome[] {
  const out: Genome[] = [];
  let current = parent;
  const baseSeed = opts.seed ?? hashStringToSeed(parent.id);
  for (let gen = 0; gen < opts.generations; gen++) {
    current = generateVariant(current, {
      seed: (baseSeed + gen * 2654435761) >>> 0,
      mutationCount: opts.mutationsPerGen ?? 6,
      types: opts.types,
    });
    out.push(current);
  }
  return out;
}

/** Mix two genomes: inherit each gene from either parent (by symbol). */
export function crossover(a: Genome, b: Genome, opts: { seed?: number; name?: string } = {}): Genome {
  const seed = opts.seed ?? hashStringToSeed(`${a.id}x${b.id}`);
  const rng = new Rng(seed);
  const child = cloneGenome(a);

  child.id = uid("mix");
  child.name = opts.name ?? `${a.commonName ?? a.name} × ${b.commonName ?? b.name}`;
  child.kind = "variant";
  child.parents = [a.id, b.id];
  child.generation = Math.max(a.generation ?? 0, b.generation ?? 0) + 1;
  child.seed = seed;
  child.createdAt = new Date().toISOString();
  child.mutations = [];

  const bByName = new Map(b.chromosomes.map((c) => [c.name, c]));
  for (const chr of child.chromosomes) {
    const bChr = bByName.get(chr.name);
    if (!bChr) continue;
    const bGenesBySymbol = new Map(bChr.genes.map((g) => [g.symbol, g]));
    chr.genes = chr.genes.map((g) => {
      const bGene = bGenesBySymbol.get(g.symbol);
      if (bGene && rng.bool(0.5)) {
        return { ...bGene, id: g.id, chromosomeId: chr.id };
      }
      return g;
    });
  }
  return child;
}

export interface MorphPair {
  symbol: string;
  from?: Gene;
  to?: Gene;
}

/** Pair genes by symbol so the renderer can interpolate between two genomes. */
export function pairGenesForMorph(a: Genome, b: Genome): MorphPair[] {
  const map = new Map<string, MorphPair>();
  for (const g of allGenes(a)) map.set(g.symbol, { symbol: g.symbol, from: g });
  for (const g of allGenes(b)) {
    const existing = map.get(g.symbol);
    if (existing) existing.to = g;
    else map.set(g.symbol, { symbol: g.symbol, to: g });
  }
  return [...map.values()];
}
