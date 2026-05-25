import Fastify from "fastify";
import cors from "@fastify/cors";
import type { Genome, GenomeKind, Mutation, MutationType } from "@genetiq/core";
import {
  applyMutations,
  crossover,
  evolve,
  findGene,
  generateVariant,
  genomeFromTable,
  parseCsv,
} from "@genetiq/core";
import { Catalog } from "./catalog.js";

const catalog = new Catalog();
const app = Fastify({ logger: true });

await app.register(cors, { origin: true });

app.get("/api/health", async () => ({ ok: true, service: "genetiq-api" }));

// --- Catalog & genomes -----------------------------------------------------

app.get("/api/species", async () => catalog.list("reference"));

app.get<{ Querystring: { kind?: GenomeKind } }>("/api/catalog", async (req) =>
  catalog.list(req.query.kind),
);

app.get<{ Params: { id: string } }>("/api/genomes/:id", async (req, reply) => {
  const genome = catalog.get(req.params.id);
  if (!genome) return reply.code(404).send({ error: "genome not found" });
  return genome;
});

app.post<{ Body: Genome }>("/api/genomes", async (req, reply) => {
  const genome = req.body;
  if (!genome?.id || !Array.isArray(genome.chromosomes)) {
    return reply.code(400).send({ error: "invalid genome payload" });
  }
  return catalog.add(genome);
});

app.delete<{ Params: { id: string } }>("/api/genomes/:id", async (req, reply) => {
  if (!catalog.remove(req.params.id)) {
    return reply.code(400).send({ error: "cannot delete (missing or reference genome)" });
  }
  return { ok: true };
});

app.get<{ Params: { id: string; geneId: string } }>(
  "/api/genomes/:id/genes/:geneId",
  async (req, reply) => {
    const genome = catalog.get(req.params.id);
    if (!genome) return reply.code(404).send({ error: "genome not found" });
    const gene = findGene(genome, req.params.geneId);
    if (!gene) return reply.code(404).send({ error: "gene not found" });
    return { gene, genome: { id: genome.id, name: genome.name, assembly: genome.assembly } };
  },
);

// --- Generative ------------------------------------------------------------

interface VariantBody {
  seed?: number;
  mutationCount?: number;
  types?: MutationType[];
  name?: string;
}

app.post<{ Params: { id: string }; Body: VariantBody }>(
  "/api/genomes/:id/variant",
  async (req, reply) => {
    const parent = catalog.get(req.params.id);
    if (!parent) return reply.code(404).send({ error: "genome not found" });
    const variant = generateVariant(parent, req.body ?? {});
    return catalog.add(variant);
  },
);

app.post<{ Params: { id: string }; Body: { generations?: number; mutationsPerGen?: number; seed?: number } }>(
  "/api/genomes/:id/evolve",
  async (req, reply) => {
    const parent = catalog.get(req.params.id);
    if (!parent) return reply.code(404).send({ error: "genome not found" });
    const lineage = evolve(parent, {
      generations: req.body?.generations ?? 4,
      mutationsPerGen: req.body?.mutationsPerGen,
      seed: req.body?.seed,
    });
    return lineage.map((g) => catalog.add(g));
  },
);

app.post<{ Body: { a: string; b: string; seed?: number; name?: string } }>(
  "/api/mix",
  async (req, reply) => {
    const a = catalog.get(req.body?.a ?? "");
    const b = catalog.get(req.body?.b ?? "");
    if (!a || !b) return reply.code(404).send({ error: "parent genome(s) not found" });
    return catalog.add(crossover(a, b, { seed: req.body.seed, name: req.body.name }));
  },
);

app.post<{ Params: { id: string }; Body: { mutations: Mutation[]; name?: string } }>(
  "/api/genomes/:id/mutate",
  async (req, reply) => {
    const parent = catalog.get(req.params.id);
    if (!parent) return reply.code(404).send({ error: "genome not found" });
    const mutated = applyMutations(parent, req.body?.mutations ?? []);
    mutated.id = `mut_${Date.now().toString(36)}`;
    mutated.kind = "variant";
    mutated.parents = [parent.id];
    mutated.name = req.body?.name ?? `${parent.name} (edited)`;
    return catalog.add(mutated);
  },
);

interface ProceduralBody {
  name: string;
  csv?: string;
  symbolColumn?: string;
  groupColumn?: string;
  expressionColumn?: string;
  chromosomeCount?: number;
  seed?: number;
}

app.post<{ Body: ProceduralBody }>("/api/procedural", async (req, reply) => {
  const body = req.body;
  if (!body?.csv) return reply.code(400).send({ error: "csv field required" });
  const table = parseCsv(body.csv);
  if (table.columns.length === 0) return reply.code(400).send({ error: "could not parse csv" });
  const genome = genomeFromTable(table, {
    name: body.name ?? "Dataset",
    symbolColumn: body.symbolColumn,
    groupColumn: body.groupColumn,
    expressionColumn: body.expressionColumn,
    chromosomeCount: body.chromosomeCount,
    seed: body.seed,
  });
  return catalog.add(genome);
});

const port = Number(process.env.PORT ?? 8787);
try {
  await app.listen({ port, host: "0.0.0.0" });
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
