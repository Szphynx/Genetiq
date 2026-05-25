import type {
  Chromosome,
  DiseaseAssociation,
  Gene,
  GeneBiotype,
  Genome,
  Strand,
} from "@genetiq/core";
import { Rng, hashStringToSeed, slugId } from "@genetiq/core";

/**
 * Curated reference organisms. Human coordinates are real GRCh38 positions;
 * the animal entries are representative curated subsets for visualization and
 * intentionally reuse the canonical (human) gene symbols for orthologues so
 * the "mix two genomes" feature can pair genes across species. They are not a
 * substitute for a full assembly — the Ensembl provider exists for that.
 */

interface GeneSpec {
  symbol: string;
  name: string;
  chr: string;
  start: number;
  end: number;
  strand: Strand;
  biotype?: GeneBiotype;
  expression?: number;
  diseases?: DiseaseAssociation[];
}

interface ChrSpec {
  name: string;
  length: number;
  centromere?: number;
}

interface OrganismSpec {
  id: string;
  species: string;
  commonName: string;
  taxId: number;
  assembly: string;
  description?: string;
  chromosomes: ChrSpec[];
  genes: GeneSpec[];
}

const HUMAN: OrganismSpec = {
  id: "homo-sapiens",
  species: "Homo sapiens",
  commonName: "Human",
  taxId: 9606,
  assembly: "GRCh38",
  description: "Human reference subset — famous disease genes across nine chromosomes.",
  chromosomes: [
    { name: "3", length: 198295559, centromere: 90900000 },
    { name: "4", length: 190214555, centromere: 49700000 },
    { name: "7", length: 159345973, centromere: 60100000 },
    { name: "11", length: 135086622, centromere: 53400000 },
    { name: "13", length: 114364328, centromere: 17700000 },
    { name: "15", length: 101991189, centromere: 17200000 },
    { name: "17", length: 83257441, centromere: 25100000 },
    { name: "19", length: 58617616, centromere: 26200000 },
    { name: "X", length: 156040895, centromere: 61000000 },
  ],
  genes: [
    {
      symbol: "MLH1",
      name: "MutL homolog 1",
      chr: "3",
      start: 36993350,
      end: 37050846,
      strand: "+",
      expression: 0.55,
      diseases: [
        {
          id: "MONDO:0005835",
          name: "Lynch syndrome",
          source: "OMIM",
          inheritance: "autosomal dominant",
          pathogenic: true,
        },
      ],
    },
    {
      symbol: "HTT",
      name: "Huntingtin",
      chr: "4",
      start: 3074681,
      end: 3243960,
      strand: "+",
      expression: 0.6,
      diseases: [
        {
          id: "MONDO:0007739",
          name: "Huntington disease",
          description: "CAG trinucleotide repeat expansion in HTT.",
          source: "OMIM",
          inheritance: "autosomal dominant",
          pathogenic: true,
        },
      ],
    },
    {
      symbol: "CFTR",
      name: "CF transmembrane conductance regulator",
      chr: "7",
      start: 117480025,
      end: 117668665,
      strand: "+",
      expression: 0.5,
      diseases: [
        {
          id: "MONDO:0009061",
          name: "Cystic fibrosis",
          source: "OMIM",
          inheritance: "autosomal recessive",
          pathogenic: true,
        },
      ],
    },
    {
      symbol: "HBB",
      name: "Hemoglobin subunit beta",
      chr: "11",
      start: 5225464,
      end: 5229395,
      strand: "-",
      expression: 0.9,
      diseases: [
        {
          id: "MONDO:0011382",
          name: "Sickle cell disease",
          source: "OMIM",
          inheritance: "autosomal recessive",
          pathogenic: true,
        },
        {
          id: "MONDO:0019402",
          name: "Beta-thalassemia",
          source: "OMIM",
          inheritance: "autosomal recessive",
          pathogenic: true,
        },
      ],
    },
    {
      symbol: "MALAT1",
      name: "Metastasis associated lung adenocarcinoma transcript 1",
      chr: "11",
      start: 65497688,
      end: 65506516,
      strand: "+",
      biotype: "lncRNA",
      expression: 0.95,
    },
    {
      symbol: "BRCA2",
      name: "BRCA2 DNA repair associated",
      chr: "13",
      start: 32315474,
      end: 32400266,
      strand: "+",
      expression: 0.45,
      diseases: [
        {
          id: "MONDO:0012933",
          name: "Hereditary breast-ovarian cancer syndrome",
          source: "OMIM",
          inheritance: "autosomal dominant",
          pathogenic: true,
        },
      ],
    },
    {
      symbol: "FBN1",
      name: "Fibrillin 1",
      chr: "15",
      start: 48408313,
      end: 48645709,
      strand: "-",
      expression: 0.5,
      diseases: [
        {
          id: "MONDO:0007947",
          name: "Marfan syndrome",
          source: "OMIM",
          inheritance: "autosomal dominant",
          pathogenic: true,
        },
      ],
    },
    {
      symbol: "TP53",
      name: "Tumor protein p53",
      chr: "17",
      start: 7668421,
      end: 7687550,
      strand: "-",
      expression: 0.75,
      diseases: [
        {
          id: "MONDO:0018875",
          name: "Li-Fraumeni syndrome",
          source: "OMIM",
          inheritance: "autosomal dominant",
          pathogenic: true,
        },
      ],
    },
    {
      symbol: "BRCA1",
      name: "BRCA1 DNA repair associated",
      chr: "17",
      start: 43044295,
      end: 43125483,
      strand: "-",
      expression: 0.5,
      diseases: [
        {
          id: "MONDO:0012933",
          name: "Hereditary breast-ovarian cancer syndrome",
          source: "OMIM",
          inheritance: "autosomal dominant",
          pathogenic: true,
        },
      ],
    },
    {
      symbol: "MIR21",
      name: "MicroRNA 21",
      chr: "17",
      start: 59841266,
      end: 59841337,
      strand: "+",
      biotype: "miRNA",
      expression: 0.8,
    },
    {
      symbol: "APOE",
      name: "Apolipoprotein E",
      chr: "19",
      start: 44905791,
      end: 44909393,
      strand: "+",
      expression: 0.7,
      diseases: [
        {
          id: "MONDO:0004975",
          name: "Alzheimer disease (late onset, risk)",
          source: "ClinVar",
          inheritance: "risk factor",
          pathogenic: false,
        },
      ],
    },
    {
      symbol: "DMD",
      name: "Dystrophin",
      chr: "X",
      start: 31119219,
      end: 33339388,
      strand: "-",
      expression: 0.4,
      diseases: [
        {
          id: "MONDO:0010679",
          name: "Duchenne muscular dystrophy",
          source: "OMIM",
          inheritance: "X-linked recessive",
          pathogenic: true,
        },
      ],
    },
  ],
};

const MOUSE: OrganismSpec = {
  id: "mus-musculus",
  species: "Mus musculus",
  commonName: "Mouse",
  taxId: 10090,
  assembly: "GRCm39",
  description: "Representative curated subset (orthologue symbols) for cross-species mixing.",
  chromosomes: [
    { name: "4", length: 150000000 },
    { name: "6", length: 149700000 },
    { name: "7", length: 144900000 },
    { name: "11", length: 122000000 },
    { name: "17", length: 95300000 },
    { name: "X", length: 169500000 },
  ],
  genes: [
    { symbol: "MLH1", name: "MutL homolog 1 (Mlh1)", chr: "4", start: 100000000, end: 100040000, strand: "-", expression: 0.5 },
    { symbol: "HTT", name: "Huntingtin (Htt)", chr: "4", start: 18000000, end: 18170000, strand: "+", expression: 0.6 },
    { symbol: "CFTR", name: "CF transmembrane conductance regulator (Cftr)", chr: "6", start: 18200000, end: 18350000, strand: "+", expression: 0.45 },
    { symbol: "HBB", name: "Hemoglobin subunit beta (Hbb-b1)", chr: "7", start: 103800000, end: 103810000, strand: "-", expression: 0.9 },
    { symbol: "BRCA1", name: "BRCA1 (Brca1)", chr: "11", start: 101400000, end: 101470000, strand: "-", expression: 0.5 },
    { symbol: "TP53", name: "Transformation related protein 53 (Trp53)", chr: "11", start: 69400000, end: 69420000, strand: "-", expression: 0.75 },
    { symbol: "FBN1", name: "Fibrillin 1 (Fbn1)", chr: "17", start: 32000000, end: 32230000, strand: "-", expression: 0.5 },
    { symbol: "DMD", name: "Dystrophin (Dmd)", chr: "X", start: 81000000, end: 83100000, strand: "-", expression: 0.4 },
  ],
};

const DOG: OrganismSpec = {
  id: "canis-familiaris",
  species: "Canis lupus familiaris",
  commonName: "Dog",
  taxId: 9615,
  assembly: "ROS_Cfam_1.0",
  description: "Representative curated subset (orthologue symbols) for cross-species mixing.",
  chromosomes: [
    { name: "5", length: 89200000 },
    { name: "9", length: 61500000 },
    { name: "14", length: 60800000 },
    { name: "26", length: 39200000 },
    { name: "X", length: 124000000 },
  ],
  genes: [
    { symbol: "CFTR", name: "CF transmembrane conductance regulator (canine)", chr: "14", start: 12000000, end: 12150000, strand: "+", expression: 0.45 },
    { symbol: "HBB", name: "Hemoglobin subunit beta (canine)", chr: "5", start: 41000000, end: 41010000, strand: "-", expression: 0.9 },
    { symbol: "BRCA1", name: "BRCA1 (canine)", chr: "9", start: 23000000, end: 23070000, strand: "-", expression: 0.5 },
    { symbol: "TP53", name: "Tumor protein p53 (canine)", chr: "5", start: 32500000, end: 32520000, strand: "-", expression: 0.75 },
    { symbol: "FBN1", name: "Fibrillin 1 (canine)", chr: "26", start: 8000000, end: 8230000, strand: "-", expression: 0.5 },
    { symbol: "APOE", name: "Apolipoprotein E (canine)", chr: "9", start: 50000000, end: 50004000, strand: "+", expression: 0.7 },
    { symbol: "DMD", name: "Dystrophin (canine)", chr: "X", start: 27000000, end: 29100000, strand: "-", expression: 0.4 },
  ],
};

function buildGenome(spec: OrganismSpec): Genome {
  const chromosomes: Chromosome[] = spec.chromosomes.map((c) => ({
    id: slugId("chr", spec.id, c.name),
    name: c.name,
    length: c.length,
    centromere: c.centromere,
    genes: [],
  }));
  const byName = new Map(chromosomes.map((c) => [c.name, c]));

  for (const g of spec.genes) {
    const chr = byName.get(g.chr);
    if (!chr) continue;
    const rng = new Rng(hashStringToSeed(spec.id + g.symbol));
    const gene: Gene = {
      id: slugId("gene", spec.id, g.symbol),
      symbol: g.symbol,
      name: g.name,
      chromosomeId: chr.id,
      start: g.start,
      end: g.end,
      strand: g.strand,
      biotype: g.biotype ?? "protein_coding",
      description: g.name,
      gcContent: 0.35 + rng.next() * 0.3,
      expression: g.expression ?? 0.3 + rng.next() * 0.6,
      diseases: g.diseases,
    };
    chr.genes.push(gene);
  }

  for (const c of chromosomes) c.genes.sort((a, b) => a.start - b.start);

  return {
    id: spec.id,
    name: spec.commonName,
    species: spec.species,
    commonName: spec.commonName,
    taxId: spec.taxId,
    assembly: spec.assembly,
    kind: "reference",
    source: "sample",
    description: spec.description,
    generation: 0,
    chromosomes,
  };
}

export function buildSampleGenomes(): Genome[] {
  return [HUMAN, MOUSE, DOG].map(buildGenome);
}
