let counter = 0;

/** Compact, dependency-free, reasonably unique id. */
export function uid(prefix = "id"): string {
  counter = (counter + 1) & 0xffffff;
  const time = Date.now().toString(36);
  const rand = Math.floor(Math.random() * 0xffffff).toString(36);
  return `${prefix}_${time}${rand}${counter.toString(36)}`;
}

/** Deterministic, human-readable slug id from its parts. */
export function slugId(prefix: string, ...parts: Array<string | number>): string {
  const slug = parts
    .join("-")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${prefix}_${slug || "x"}`;
}
