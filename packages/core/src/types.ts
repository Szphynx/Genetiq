/**
 * Genetiq core domain model.
 *
 * The model is intentionally hierarchical so the renderer can pick a level of
 * detail: Genome → Chromosome → Gene → (optional) sequence. Real genomes are
 * billions of base pairs, so we never require full sequences — genes carry
 * positions and lightweight attributes that drive both biology and visuals.
 */

export type Strand = "+" | "-";

export type Nucleotide = "A" | "C" | "G" | "T" | "N";

export type GeneBiotype =
  | "protein_coding"
  | "lncRNA"
  | "miRNA"
  | "rRNA"
  | "tRNA"
  | "snRNA"
  | "snoRNA"
  | "pseudogene"
  | "regulatory"
  | "other";

export interface DiseaseAssociation {
  id: string;
  name: string;
  description?: string;
  source?: string; // e.g. "OMIM", "ClinVar", "MONDO"
  inheritance?: string; // e.g. "autosomal dominant"
  pathogenic?: boolean;
}

export interface Gene {
  id: string;
  symbol: string;
  name: string;
  chromosomeId: string;
  start: number; // 1-based bp, inclusive
  end: number; // bp, inclusive
  strand: Strand;
  biotype: GeneBiotype;
  description?: string;
  /** Normalised 0..1 GC content, used for hue mapping when available. */
  gcContent?: number;
  /** Normalised 0..1 expression level, used for size/emissive mapping. */
  expression?: number;
  diseases?: DiseaseAssociation[];
  /** Optional nucleotide sequence. Usually absent for full genomes. */
  sequence?: string;
  tags?: string[];
  /** Copy number; >1 means duplicated/amplified by a mutation. */
  copies?: number;
  /** True when a mutation flagged this gene as removed (soft delete). */
  deleted?: boolean;
}

export type CytoStain =
  | "gneg"
  | "gpos25"
  | "gpos50"
  | "gpos75"
  | "gpos100"
  | "acen"
  | "gvar"
  | "stalk";

export interface CytoBand {
  name: string; // e.g. "p36.33"
  start: number;
  end: number;
  stain: CytoStain;
}

export interface Chromosome {
  id: string;
  name: string; // "1".."22", "X", "Y", "MT"
  length: number; // bp
  centromere?: number; // bp position of centromere
  bands?: CytoBand[];
  genes: Gene[];
}

export type GenomeKind = "reference" | "variant" | "procedural";

export type GenomeSource = "sample" | "ensembl" | "procedural" | "user";

export interface GenomeMeta {
  id: string;
  name: string;
  species: string; // scientific name, e.g. "Homo sapiens"
  commonName?: string; // e.g. "Human"
  taxId?: number;
  assembly?: string; // e.g. "GRCh38"
  kind: GenomeKind;
  source?: GenomeSource;
  description?: string;
  createdAt?: string;
  /** Lineage: 1 parent for a mutation line, 2 for a crossover/mix. */
  parents?: string[];
  /** Generative generation index (reference genomes are 0). */
  generation?: number;
  /** RNG seed used to derive a generative genome (for reproducibility). */
  seed?: number;
  tags?: string[];
}

export interface Genome extends GenomeMeta {
  chromosomes: Chromosome[];
  /** Mutations applied to derive this genome from its parent(s). */
  mutations?: Mutation[];
}

/** A genome stripped of chromosomes — used for catalog/index listings. */
export type GenomeSummary = GenomeMeta & {
  chromosomeCount: number;
  geneCount: number;
};

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export type MutationType =
  | "substitution" // SNP: single/short base change
  | "insertion"
  | "deletion"
  | "duplication" // duplicate a gene (copy number up)
  | "inversion" // flip a segment / strand
  | "translocation" // relocate a gene/segment
  | "cnv"; // broader copy-number variation

export type MutationEffect =
  | "silent"
  | "missense"
  | "nonsense"
  | "frameshift"
  | "inframe"
  | "regulatory"
  | "structural"
  | "unknown";

export type MutationSource = "medical" | "generative" | "manual";

export interface Mutation {
  id: string;
  type: MutationType;
  chromosomeId: string;
  /** Affected gene, when the mutation is gene-scoped. */
  geneId?: string;
  position: number; // bp
  length?: number; // affected length in bp
  ref?: string; // reference allele/sequence
  alt?: string; // alternate allele/sequence
  effect?: MutationEffect;
  pathogenic?: boolean;
  source?: MutationSource;
  label?: string;
  /** Free-form destination for translocations (chromosomeId + position). */
  target?: { chromosomeId: string; position: number };
  createdAt?: string;
}
