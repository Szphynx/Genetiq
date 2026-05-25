import type { Gene, Genome, Mutation } from "./types.js";
import { cloneGenome, findChromosome } from "./genome.js";
import { reverseComplement } from "./sequence.js";
import { uid } from "./ids.js";

export function makeMutation(input: Omit<Mutation, "id"> & { id?: string }): Mutation {
  const { id, createdAt, ...rest } = input;
  return {
    id: id ?? uid("mut"),
    createdAt: createdAt ?? new Date().toISOString(),
    ...rest,
  };
}

function spliceStr(s: string, index: number, removeCount: number, insert: string): string {
  return s.slice(0, index) + insert + s.slice(index + removeCount);
}

function clampIndex(i: number, len: number): number {
  return Math.max(0, Math.min(i, len));
}

function mutateInPlace(genome: Genome, m: Mutation): void {
  const chr = findChromosome(genome, m.chromosomeId);
  if (!chr) return;
  const gene = m.geneId ? chr.genes.find((g) => g.id === m.geneId) : undefined;

  switch (m.type) {
    case "substitution":
      if (gene?.sequence && m.alt) {
        const i = clampIndex(m.position - gene.start, gene.sequence.length);
        gene.sequence = spliceStr(gene.sequence, i, m.ref?.length ?? 1, m.alt);
      }
      break;

    case "insertion":
      if (gene?.sequence && m.alt) {
        const i = clampIndex(m.position - gene.start, gene.sequence.length);
        gene.sequence = spliceStr(gene.sequence, i, 0, m.alt);
      }
      break;

    case "deletion":
      if (gene) {
        if (gene.sequence) {
          const i = clampIndex(m.position - gene.start, gene.sequence.length);
          gene.sequence = spliceStr(gene.sequence, i, m.length ?? m.ref?.length ?? 1, "");
        } else {
          gene.deleted = true;
        }
      }
      break;

    case "duplication":
    case "cnv":
      if (gene) gene.copies = (gene.copies ?? 1) + 1;
      break;

    case "inversion":
      if (gene) {
        gene.strand = gene.strand === "+" ? "-" : "+";
        if (gene.sequence) gene.sequence = reverseComplement(gene.sequence);
      }
      break;

    case "translocation":
      if (gene && m.target) {
        const dest = findChromosome(genome, m.target.chromosomeId);
        if (dest && dest.id !== chr.id) {
          chr.genes = chr.genes.filter((g) => g.id !== gene.id);
          const shift = m.target.position - gene.start;
          dest.genes.push({
            ...gene,
            chromosomeId: dest.id,
            start: gene.start + shift,
            end: gene.end + shift,
          });
        }
      }
      break;
  }
}

/** Apply a batch of mutations, returning a new genome (input is untouched). */
export function applyMutations(genome: Genome, mutations: Mutation[]): Genome {
  const next = cloneGenome(genome);
  for (const m of mutations) mutateInPlace(next, m);
  next.mutations = [...(next.mutations ?? []), ...mutations];
  return next;
}

export function applyMutation(genome: Genome, mutation: Mutation): Genome {
  return applyMutations(genome, [mutation]);
}

/** Hard-remove a gene (the viewer's "delete" action). */
export function removeGene(genome: Genome, geneId: string): Genome {
  const next = cloneGenome(genome);
  for (const chr of next.chromosomes) {
    chr.genes = chr.genes.filter((g) => g.id !== geneId);
  }
  return next;
}

/** Convenience builders for common single-gene mutations. */
export function substitutionAt(gene: Gene, position: number, ref: string, alt: string): Mutation {
  return makeMutation({
    type: "substitution",
    chromosomeId: gene.chromosomeId,
    geneId: gene.id,
    position,
    ref,
    alt,
    length: ref.length,
    source: "manual",
    label: `${ref}→${alt} @ ${gene.symbol}`,
  });
}

export function deleteGeneMutation(gene: Gene): Mutation {
  return makeMutation({
    type: "deletion",
    chromosomeId: gene.chromosomeId,
    geneId: gene.id,
    position: gene.start,
    length: gene.end - gene.start + 1,
    effect: "structural",
    source: "manual",
    label: `delete ${gene.symbol}`,
  });
}

export function duplicateGeneMutation(gene: Gene): Mutation {
  return makeMutation({
    type: "duplication",
    chromosomeId: gene.chromosomeId,
    geneId: gene.id,
    position: gene.start,
    effect: "structural",
    source: "manual",
    label: `duplicate ${gene.symbol}`,
  });
}
