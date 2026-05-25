import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Genome } from "@genetiq/core";

/**
 * Persistence for user-created genomes (variants, mixes, procedural datasets).
 * Reference organisms are code-defined and always re-seeded, so only user
 * creations are stored here.
 */
export interface Persistence {
  loadAll(): Genome[];
  save(genomes: Genome[]): void;
  readonly kind: "file" | "memory";
}

class MemoryPersistence implements Persistence {
  readonly kind = "memory" as const;
  loadAll(): Genome[] {
    return [];
  }
  save(): void {
    /* nothing — process-lifetime only */
  }
}

/**
 * Durable JSON-file store with debounced atomic writes. Works on any host with
 * a writable, persistent filesystem (Docker volume, Render/Fly disk, a VPS).
 */
class FilePersistence implements Persistence {
  readonly kind = "file" as const;
  private readonly file: string;
  private pending: Genome[] | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private writable = true;

  constructor(dir: string) {
    this.file = resolve(dir, "catalog.json");
  }

  loadAll(): Genome[] {
    try {
      if (!existsSync(this.file)) return [];
      const parsed = JSON.parse(readFileSync(this.file, "utf8")) as unknown;
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((g): g is Genome => !!g && typeof g === "object" && Array.isArray((g as Genome).chromosomes));
    } catch {
      return [];
    }
  }

  save(genomes: Genome[]): void {
    if (!this.writable) return;
    this.pending = genomes;
    if (this.timer) return;
    this.timer = setTimeout(() => this.flush(), 250);
    // Don't keep the event loop alive just for a pending write.
    this.timer.unref?.();
  }

  private flush(): void {
    this.timer = null;
    const data = this.pending;
    this.pending = null;
    if (!data) return;
    try {
      const tmp = `${this.file}.tmp`;
      writeFileSync(tmp, JSON.stringify(data), "utf8");
      renameSync(tmp, this.file);
    } catch (err) {
      this.writable = false;
      console.warn(`genetiq: persistence disabled (write failed): ${String(err)}`);
    }
  }
}

/**
 * Pick a backend from the environment:
 *   GENETIQ_STORE=memory            → in-memory only
 *   GENETIQ_STORE=file (default)    → JSON file under GENETIQ_DATA_DIR (./.data)
 * Falls back to memory automatically if the data dir isn't writable
 * (e.g. read-only serverless filesystems).
 */
export function createPersistence(): Persistence {
  if (process.env.GENETIQ_STORE === "memory") return new MemoryPersistence();
  const dir = process.env.GENETIQ_DATA_DIR ?? resolve(process.cwd(), ".data");
  try {
    mkdirSync(dir, { recursive: true });
    return new FilePersistence(dir);
  } catch {
    console.warn("genetiq: data dir not writable, using in-memory store");
    return new MemoryPersistence();
  }
}
