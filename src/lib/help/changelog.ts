import fs from "node:fs";
import path from "node:path";

const CHANGELOG_PATH = path.join(
  process.cwd(),
  "src",
  "content",
  "changelog.md"
);

export interface ChangelogEntry {
  date: string; // YYYY-MM-DD
  title: string;
  bodyMarkdown: string;
}

let cache: ChangelogEntry[] | null = null;

/**
 * Parsea el changelog: cada entry empieza con `## YYYY-MM-DD — Titulo`.
 * El cuerpo va hasta el siguiente `## ` o el final.
 */
export function getChangelogEntries(): ChangelogEntry[] {
  if (cache) return cache;
  if (!fs.existsSync(CHANGELOG_PATH)) {
    cache = [];
    return cache;
  }
  const raw = fs.readFileSync(CHANGELOG_PATH, "utf8");

  // Saltar frontmatter si lo hay
  const stripped = raw.replace(/^---[\s\S]*?---\s*/, "");

  const entries: ChangelogEntry[] = [];
  const re = /^##\s+(\d{4}-\d{2}-\d{2})\s*[—–-]\s*(.+?)$/gm;
  const matches: { date: string; title: string; start: number; end: number }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    matches.push({
      date: m[1],
      title: m[2].trim(),
      start: m.index + m[0].length,
      end: -1,
    });
  }
  for (let i = 0; i < matches.length; i++) {
    matches[i].end =
      i + 1 < matches.length ? matches[i + 1].start - matches[i + 1].title.length - 100 : stripped.length;
    // Mejor enfoque: usar el index del siguiente match directamente
  }
  // Re-calc end con el index real del proximo header
  re.lastIndex = 0;
  const headerIndexes: number[] = [];
  while ((m = re.exec(stripped)) !== null) {
    headerIndexes.push(m.index);
  }
  for (let i = 0; i < matches.length; i++) {
    const next = headerIndexes[i + 1] ?? stripped.length;
    matches[i].end = next;
  }

  for (const mt of matches) {
    const body = stripped.slice(mt.start, mt.end).trim();
    // Quitar separadores trailing
    const cleaned = body.replace(/\n---\s*[\s\S]*$/, "").trim();
    entries.push({
      date: mt.date,
      title: mt.title,
      bodyMarkdown: cleaned,
    });
  }

  // Orden descendente (mas nueva primero)
  entries.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  cache = entries;
  return cache;
}

/** ¿Hay entries en los últimos N dias? */
export function hasRecentChanges(daysWindow = 7): boolean {
  const entries = getChangelogEntries();
  if (entries.length === 0) return false;
  const cutoff = new Date(Date.now() - daysWindow * 86400000)
    .toISOString()
    .slice(0, 10);
  return entries[0].date >= cutoff;
}

export function latestEntryDate(): string | null {
  const entries = getChangelogEntries();
  return entries[0]?.date ?? null;
}
