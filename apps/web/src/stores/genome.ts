import { computed, shallowRef, ref } from "vue";
import { defineStore } from "pinia";
import type { Gene, Genome, GenomeSummary, MutationType } from "@genetiq/core";
import {
  NUCLEOTIDES,
  applyMutation,
  cloneGenome,
  crossover,
  deleteGeneMutation,
  duplicateGeneMutation,
  evolve as evolveGenome,
  findGene,
  generateVariant,
  genomeFromTable,
  mutatedGeneIds,
  parseCsv,
  substitutionAt,
} from "@genetiq/core";
import { api } from "@/api";

export type Panel = "inspect" | "studio" | "gallery";

const DEFAULT_GENOME = "homo-sapiens";

export const useGenomeStore = defineStore("genome", () => {
  const catalog = ref<GenomeSummary[]>([]);
  const current = shallowRef<Genome | null>(null);
  const selectedGene = shallowRef<Gene | null>(null);
  const selectedGeneId = ref<string | null>(null);

  const activePanel = ref<Panel>("inspect");
  const sheetOpen = ref(false); // mobile bottom-sheet open state
  const backend = ref<string>("");

  type Theme = "dossier" | "holo";
  const storedTheme =
    typeof localStorage !== "undefined" ? (localStorage.getItem("genetiq-theme") as Theme | null) : null;
  const theme = ref<Theme>(storedTheme === "holo" ? "holo" : "dossier");
  function setTheme(t: Theme): void {
    theme.value = t;
    try {
      localStorage.setItem("genetiq-theme", t);
    } catch {
      /* ignore */
    }
  }
  function toggleTheme(): void {
    setTheme(theme.value === "dossier" ? "holo" : "dossier");
  }
  const busy = ref(false);
  const status = ref<string>("");
  const error = ref<string | null>(null);

  // Studio params
  const seed = ref(7);
  const mutationCount = ref(10);
  const generations = ref(5);
  const mixPartner = ref<string>("");

  // Live morph (visual interpolation toward another genome)
  const morphTargetId = ref<string>("");
  const morphTargetGenome = shallowRef<Genome | null>(null);
  const morphT = ref(0);

  // Camera drill-down request (consumed by the viewer)
  const focusChrId = ref<string | null>(null);
  // Cinematic intro trigger (bumped to replay)
  const introNonce = ref(0);

  const mutatedIds = computed(() => (current.value ? mutatedGeneIds(current.value) : new Set<string>()));
  const chromosomes = computed(() => current.value?.chromosomes ?? []);
  const geneList = computed(() => chromosomes.value.flatMap((c) => c.genes));
  const references = computed(() => catalog.value.filter((g) => g.kind === "reference"));
  const creations = computed(() => catalog.value.filter((g) => g.kind !== "reference"));

  function flash(msg: string): void {
    status.value = msg;
    window.setTimeout(() => {
      if (status.value === msg) status.value = "";
    }, 2600);
  }

  async function run<T>(label: string, fn: () => Promise<T>): Promise<T | undefined> {
    busy.value = true;
    error.value = null;
    try {
      const result = await fn();
      if (label) flash(label);
      return result;
    } catch (e) {
      error.value = e instanceof Error ? e.message : String(e);
      return undefined;
    } finally {
      busy.value = false;
    }
  }

  async function refreshCatalog(): Promise<void> {
    const list = await api.catalog();
    if (list) catalog.value = list;
  }

  async function init(): Promise<void> {
    await run("", async () => {
      await refreshCatalog();
      const deepLink = new URLSearchParams(window.location.search).get("genome");
      await loadGenome(deepLink && catalog.value.some((c) => c.id === deepLink) ? deepLink : DEFAULT_GENOME);
    });
  }

  function focusChromosome(chromosomeId: string): void {
    focusChrId.value = chromosomeId;
  }

  function playIntro(): void {
    introNonce.value++;
  }

  /** LOD drill-down: fetch a detailed region for an Ensembl chromosome. */
  async function drillChromosome(chromosomeId: string): Promise<void> {
    const genome = current.value;
    if (!genome || genome.source !== "ensembl") return;
    const chr = genome.chromosomes.find((c) => c.id === chromosomeId);
    if (!chr) return;
    const speciesId = genome.id.replace(/^ensembl-/, "");
    await run(`Loaded detail for chr ${chr.name}`, async () => {
      const window = Math.min(chr.length, 20_000_000);
      const genes = await api.ensemblRegion(speciesId, chr.name, 1, window, 200);
      const next = cloneGenome(genome);
      const target = next.chromosomes.find((c) => c.id === chromosomeId);
      if (target) target.genes = genes;
      replaceCurrent(next);
    });
  }

  function resetMorph(): void {
    morphTargetId.value = "";
    morphTargetGenome.value = null;
    morphT.value = 0;
  }

  async function loadGenome(id: string): Promise<void> {
    await run("", async () => {
      const genome = await api.genome(id);
      selectedGeneId.value = null;
      selectedGene.value = null;
      resetMorph();
      current.value = genome;
    });
  }

  /** Load a genome object we already have client-side (variant/mix/procedural). */
  function adoptGenome(genome: Genome): void {
    selectedGeneId.value = null;
    selectedGene.value = null;
    resetMorph();
    current.value = genome;
  }

  async function setMorphTarget(id: string): Promise<void> {
    morphT.value = 0;
    if (!id) {
      morphTargetId.value = "";
      morphTargetGenome.value = null;
      return;
    }
    await run("", async () => {
      const genome = await api.genome(id);
      morphTargetId.value = id;
      morphTargetGenome.value = genome;
    });
  }

  async function selectGene(geneId: string | null): Promise<void> {
    selectedGeneId.value = geneId;
    if (!geneId || !current.value) {
      selectedGene.value = null;
      return;
    }
    activePanel.value = "inspect";
    sheetOpen.value = true; // reveal the inspector (matters on mobile)
    const local = findGene(current.value, geneId);
    selectedGene.value = local ?? null;
    // Enrich from the backend when the genome is a stored reference.
    if (local && current.value.kind === "reference") {
      const detail = await api.gene(current.value.id, geneId).catch(() => null);
      if (detail && selectedGeneId.value === geneId) selectedGene.value = detail.gene;
    }
  }

  function replaceCurrent(next: Genome): void {
    current.value = next;
    if (selectedGeneId.value) selectedGene.value = findGene(next, selectedGeneId.value) ?? null;
  }

  function mutateSelected(): void {
    const genome = current.value;
    const gene = selectedGene.value;
    if (!genome || !gene) return;
    const ref = NUCLEOTIDES[Math.floor(Math.random() * NUCLEOTIDES.length)]!;
    let alt = NUCLEOTIDES[Math.floor(Math.random() * NUCLEOTIDES.length)]!;
    while (alt === ref) alt = NUCLEOTIDES[Math.floor(Math.random() * NUCLEOTIDES.length)]!;
    const pos = gene.start + Math.floor((gene.end - gene.start) / 2);
    replaceCurrent(applyMutation(genome, substitutionAt(gene, pos, ref, alt)));
    flash(`Point mutation in ${gene.symbol}`);
  }

  function duplicateSelected(): void {
    const genome = current.value;
    const gene = selectedGene.value;
    if (!genome || !gene) return;
    replaceCurrent(applyMutation(genome, duplicateGeneMutation(gene)));
    flash(`Duplicated ${gene.symbol}`);
  }

  function deleteSelected(): void {
    const genome = current.value;
    const gene = selectedGene.value;
    if (!genome || !gene) return;
    replaceCurrent(applyMutation(genome, deleteGeneMutation(gene)));
    flash(`Knocked out ${gene.symbol}`);
  }

  async function resetCurrent(): Promise<void> {
    const genome = current.value;
    if (!genome) return;
    const inCatalog = (id?: string): boolean => !!id && catalog.value.some((c) => c.id === id);
    const id = inCatalog(genome.id)
      ? genome.id
      : inCatalog(genome.parents?.[0])
        ? genome.parents![0]!
        : DEFAULT_GENOME;
    await loadGenome(id);
  }

  async function makeVariant(): Promise<void> {
    const parent = current.value;
    if (!parent) return;
    await run("Variant generated", async () => {
      const variant = generateVariant(parent, {
        seed: seed.value,
        mutationCount: mutationCount.value,
      });
      adoptGenome(variant);
      await api.saveGenome(variant);
      await refreshCatalog();
    });
  }

  async function evolveCurrent(): Promise<void> {
    const parent = current.value;
    if (!parent) return;
    await run(`Evolved ${generations.value} generations`, async () => {
      const lineage = evolveGenome(parent, { generations: generations.value, seed: seed.value });
      for (const g of lineage) await api.saveGenome(g);
      const last = lineage[lineage.length - 1];
      if (last) adoptGenome(last);
      await refreshCatalog();
    });
  }

  async function mixWith(partnerId: string): Promise<void> {
    const a = current.value;
    if (!a || !partnerId) return;
    await run("Genomes mixed", async () => {
      const b = await api.genome(partnerId);
      const mixed = crossover(a, b, { seed: seed.value });
      adoptGenome(mixed);
      await api.saveGenome(mixed);
      await refreshCatalog();
    });
  }

  async function importCsv(name: string, csv: string, expressionColumn?: string): Promise<void> {
    await run("Dataset genome created", async () => {
      const table = parseCsv(csv);
      const genome = genomeFromTable(table, { name: name || "Dataset", expressionColumn });
      adoptGenome(genome);
      await api.saveGenome(genome);
      await refreshCatalog();
    });
  }

  async function loadEnsembl(species: string, perChromosome: number): Promise<void> {
    await run("Loaded live Ensembl genome", async () => {
      const summary = await api.ensemblLoad({ species, perChromosome });
      await refreshCatalog();
      await loadGenome(summary.id);
    });
  }

  async function saveCurrent(): Promise<void> {
    const genome = current.value;
    if (!genome) return;
    await run("Saved to gallery", async () => {
      await api.saveGenome(genome);
      await refreshCatalog();
    });
  }

  async function deleteFromCatalog(id: string): Promise<void> {
    await run("Removed from gallery", async () => {
      await api.deleteGenome(id);
      await refreshCatalog();
    });
  }

  return {
    catalog, current, selectedGene, selectedGeneId, activePanel, sheetOpen, backend, busy, status, error,
    theme, setTheme, toggleTheme,
    seed, mutationCount, generations, mixPartner,
    morphTargetId, morphTargetGenome, morphT, focusChrId, introNonce,
    mutatedIds, chromosomes, geneList, references, creations,
    init, loadGenome, adoptGenome, selectGene, refreshCatalog, setMorphTarget,
    focusChromosome, drillChromosome, playIntro,
    mutateSelected, duplicateSelected, deleteSelected, resetCurrent,
    makeVariant, evolveCurrent, mixWith, importCsv, loadEnsembl, saveCurrent, deleteFromCatalog,
  };
});
