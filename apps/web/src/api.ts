import type { Gene, Genome, GenomeSummary, MutationType } from "@genetiq/core";

const BASE = "/api";

async function jsonFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "content-type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export interface GeneDetail {
  gene: Gene;
  genome: { id: string; name: string; assembly?: string };
}

export const api = {
  health: () => jsonFetch<{ ok: boolean }>(`${BASE}/health`),
  catalog: (kind?: string) =>
    jsonFetch<GenomeSummary[]>(`${BASE}/catalog${kind ? `?kind=${kind}` : ""}`),
  species: () => jsonFetch<GenomeSummary[]>(`${BASE}/species`),
  genome: (id: string) => jsonFetch<Genome>(`${BASE}/genomes/${id}`),
  gene: (genomeId: string, geneId: string) =>
    jsonFetch<GeneDetail>(`${BASE}/genomes/${genomeId}/genes/${geneId}`),
  saveGenome: (genome: Genome) =>
    jsonFetch<GenomeSummary>(`${BASE}/genomes`, { method: "POST", body: JSON.stringify(genome) }),
  deleteGenome: (id: string) =>
    jsonFetch<{ ok: boolean }>(`${BASE}/genomes/${id}`, { method: "DELETE" }),
  variant: (id: string, opts: { seed?: number; mutationCount?: number; types?: MutationType[] }) =>
    jsonFetch<GenomeSummary>(`${BASE}/genomes/${id}/variant`, {
      method: "POST",
      body: JSON.stringify(opts),
    }),
  evolve: (id: string, opts: { generations: number; mutationsPerGen?: number; seed?: number }) =>
    jsonFetch<GenomeSummary[]>(`${BASE}/genomes/${id}/evolve`, {
      method: "POST",
      body: JSON.stringify(opts),
    }),
  mix: (a: string, b: string, seed?: number) =>
    jsonFetch<GenomeSummary>(`${BASE}/mix`, {
      method: "POST",
      body: JSON.stringify({ a, b, seed }),
    }),
  procedural: (body: {
    name: string;
    csv: string;
    expressionColumn?: string;
    groupColumn?: string;
    seed?: number;
  }) => jsonFetch<GenomeSummary>(`${BASE}/procedural`, { method: "POST", body: JSON.stringify(body) }),
};
