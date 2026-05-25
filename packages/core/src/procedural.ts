import type { Chromosome, Gene, GeneBiotype, Genome } from "./types.js";
import { Rng, hashStringToSeed } from "./rng.js";
import { slugId, uid } from "./ids.js";

export type Cell = string | number | null;

export interface TableData {
  columns: string[];
  rows: Cell[][];
}

export interface ProceduralSpec {
  name: string;
  /** Column used as gene symbol/label. Defaults to first text column. */
  symbolColumn?: string;
  /** Column whose distinct values become chromosomes. Defaults to chunking. */
  groupColumn?: string;
  /** Numeric column mapped to gene expression (drives size/emissive). */
  expressionColumn?: string;
  /** Chromosomes to chunk rows into when no groupColumn is given. */
  chromosomeCount?: number;
  seed?: number;
}

const SPAN = 100_000; // synthetic bp per gene slot
const GAP = 20_000;

const BIOTYPES: GeneBiotype[] = [
  "protein_coding",
  "lncRNA",
  "miRNA",
  "regulatory",
  "pseudogene",
  "other",
];

function isNumericColumn(rows: Cell[][], i: number): boolean {
  let seen = false;
  for (const r of rows) {
    const v = r[i];
    if (v === null || v === undefined || v === "") continue;
    seen = true;
    if (Number.isNaN(Number(v))) return false;
  }
  return seen;
}

/**
 * Turn any tabular dataset into a genome. Each row becomes a gene; rows group
 * into chromosomes either by a category column or by even chunking. Numeric
 * columns are normalised and mapped to expression / GC content, which the
 * visual layer turns into colour, size and emission — so an arbitrary
 * spreadsheet yields a unique, reproducible 3D "organism".
 */
export function genomeFromTable(table: TableData, spec: ProceduralSpec): Genome {
  const seed = spec.seed ?? hashStringToSeed(spec.name);
  const rng = new Rng(seed);
  const cols = table.columns;
  const colIndex = (name?: string): number => (name ? cols.indexOf(name) : -1);

  const numericIdx = new Set<number>();
  for (let i = 0; i < cols.length; i++) {
    if (isNumericColumn(table.rows, i)) numericIdx.add(i);
  }

  const symbolIdx =
    colIndex(spec.symbolColumn) >= 0
      ? colIndex(spec.symbolColumn)
      : cols.findIndex((_, i) => !numericIdx.has(i));
  const exprIdx = colIndex(spec.expressionColumn);
  const groupIdx = colIndex(spec.groupColumn);

  const ranges = new Map<number, { min: number; max: number }>();
  for (const i of numericIdx) {
    let min = Infinity;
    let max = -Infinity;
    for (const r of table.rows) {
      const v = Number(r[i]);
      if (!Number.isNaN(v)) {
        if (v < min) min = v;
        if (v > max) max = v;
      }
    }
    if (min !== Infinity) ranges.set(i, { min, max });
  }

  const norm = (i: number, raw: Cell | undefined): number => {
    const r = ranges.get(i);
    const v = Number(raw);
    if (!r || Number.isNaN(v) || r.max === r.min) return 0.5;
    return (v - r.min) / (r.max - r.min);
  };

  const groups = new Map<string, number[]>();
  const pushGroup = (key: string, ri: number): void => {
    let arr = groups.get(key);
    if (!arr) {
      arr = [];
      groups.set(key, arr);
    }
    arr.push(ri);
  };

  if (groupIdx >= 0) {
    table.rows.forEach((r, ri) => pushGroup(String(r[groupIdx] ?? "ungrouped"), ri));
  } else {
    const count = Math.max(1, Math.min(spec.chromosomeCount ?? 8, table.rows.length || 1));
    const per = Math.max(1, Math.ceil(table.rows.length / count));
    table.rows.forEach((_, ri) => pushGroup(`set-${Math.floor(ri / per) + 1}`, ri));
  }

  const secondaryNumeric = [...ranges.keys()].find((i) => i !== exprIdx);

  const chromosomes: Chromosome[] = [];
  for (const [key, rowIdxs] of groups) {
    const chrId = slugId("chr", spec.name, key);
    const genes: Gene[] = [];
    let cursor = GAP;

    rowIdxs.forEach((ri, gi) => {
      const row = table.rows[ri]!;
      const rawSymbol = symbolIdx >= 0 ? row[symbolIdx] : undefined;
      const symbol =
        rawSymbol !== null && rawSymbol !== undefined && rawSymbol !== ""
          ? String(rawSymbol)
          : `${key}-${gi + 1}`;

      const start = cursor;
      const end = start + SPAN;
      cursor = end + GAP;

      const expression = exprIdx >= 0 ? norm(exprIdx, row[exprIdx]) : rng.next();
      const gc = secondaryNumeric !== undefined ? norm(secondaryNumeric, row[secondaryNumeric]) : rng.next();
      const biotypeIdx = Math.min(BIOTYPES.length - 1, Math.floor(expression * BIOTYPES.length));

      genes.push({
        id: slugId("gene", spec.name, key, symbol, String(gi)),
        symbol,
        name: symbol,
        chromosomeId: chrId,
        start,
        end,
        strand: rng.bool() ? "+" : "-",
        biotype: BIOTYPES[biotypeIdx]!,
        expression,
        gcContent: gc,
        tags: ["procedural"],
      });
    });

    chromosomes.push({ id: chrId, name: key, length: cursor, genes });
  }

  return {
    id: uid("genome"),
    name: spec.name,
    species: "Synthetic dataset",
    commonName: spec.name,
    kind: "procedural",
    source: "procedural",
    assembly: "GTQ-1",
    description: `Procedural genome generated from a ${table.rows.length}-row dataset.`,
    createdAt: new Date().toISOString(),
    generation: 0,
    seed,
    chromosomes,
    tags: ["procedural"],
  };
}

/** Minimal RFC-4180-ish CSV parser (handles quotes, commas, CRLF). */
export function parseCsv(text: string): TableData {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n").filter((l) => l.length > 0);
  if (lines.length === 0) return { columns: [], rows: [] };

  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]!;
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') {
            cur += '"';
            i++;
          } else {
            inQuotes = false;
          }
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map((s) => s.trim());
  };

  const columns = parseLine(lines[0]!);
  const rows: Cell[][] = lines.slice(1).map((line) => {
    const cells = parseLine(line);
    return columns.map((_, i): Cell => {
      const v = cells[i];
      if (v === undefined || v === "") return null;
      const n = Number(v);
      return !Number.isNaN(n) ? n : v;
    });
  });

  return { columns, rows };
}
