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
  // Recolectar todos los headers con su indice y contenido.
  const headers: {
    date: string;
    title: string;
    bodyStart: number;
    headerStart: number;
  }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(stripped)) !== null) {
    headers.push({
      date: m[1],
      title: m[2].trim(),
      headerStart: m.index,
      bodyStart: m.index + m[0].length,
    });
  }
  // El cuerpo de cada entry va desde su bodyStart hasta el headerStart del proximo.
  for (let i = 0; i < headers.length; i++) {
    const end = headers[i + 1]?.headerStart ?? stripped.length;
    const body = stripped.slice(headers[i].bodyStart, end).trim();
    // Quitar bloques --- finales (separadores markdown).
    const cleaned = body.replace(/\n---\s*[\s\S]*$/, "").trim();
    entries.push({
      date: headers[i].date,
      title: headers[i].title,
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
