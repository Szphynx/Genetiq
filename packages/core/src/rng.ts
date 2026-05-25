/**
 * Deterministic seeded RNG (mulberry32). Generative output must be
 * reproducible: the same seed always yields the same variant, so a creation
 * can be saved as just a seed + lineage and faithfully recreated.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** Float in [0, 1). */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) | 0;
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Integer in [minInclusive, maxExclusive). */
  int(minInclusive: number, maxExclusive: number): number {
    return Math.floor(this.next() * (maxExclusive - minInclusive)) + minInclusive;
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error("Rng.pick: empty array");
    return arr[this.int(0, arr.length)]!;
  }

  bool(probabilityTrue = 0.5): boolean {
    return this.next() < probabilityTrue;
  }

  /** Float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }
}

/** FNV-1a hash → 32-bit seed. Lets us derive a stable seed from any string. */
export function hashStringToSeed(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
