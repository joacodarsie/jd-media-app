import fs from "node:fs";
import path from "node:path";

/**
 * Loader del centro de ayuda. Las paginas viven en `src/content/help/*.md`
 * con frontmatter YAML simple:
 *
 *   ---
 *   title: Mi dia
 *   description: Tu vista principal al entrar.
 *   category: Dia a dia
 *   order: 1
 *   roles: [all]
 *   updated: 2026-05-25
 *   ---
 *
 *   # Mi dia
 *   ... markdown ...
 *
 * Cada cambio relevante en la app debe actualizar la pagina correspondiente
 * en el MISMO PR. Esa es la unica forma de que la guia no se desactualice.
 */

export interface HelpFrontmatter {
  title: string;
  description?: string;
  category?: string;
  order?: number;
  roles?: string[];
  updated?: string;
}

export interface HelpPage extends HelpFrontmatter {
  slug: string;
  content: string;
}

const CONTENT_DIR = path.join(process.cwd(), "src", "content", "help");

/** Parser de frontmatter minimo (YAML subset). Soporta:
 *  key: value
 *  key: [a, b, c]
 *  key: 123
 *  No soporta nested objects ni multiline values — no los necesitamos.
 */
function parseFrontmatter(raw: string): {
  data: Record<string, unknown>;
  body: string;
} {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return { data: {}, body: raw };
  const data: Record<string, unknown> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1];
    const val = kv[2].trim();
    if (val.startsWith("[") && val.endsWith("]")) {
      data[key] = val
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else if (/^-?\d+(\.\d+)?$/.test(val)) {
      data[key] = Number(val);
    } else {
      data[key] = val.replace(/^["']|["']$/g, "");
    }
  }
  return { data, body: m[2] };
}

let cache: HelpPage[] | null = null;

export function getAllHelpPages(): HelpPage[] {
  if (cache) return cache;
  if (!fs.existsSync(CONTENT_DIR)) {
    cache = [];
    return cache;
  }
  const files = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md"));
  const pages: HelpPage[] = files.map((file) => {
    const raw = fs.readFileSync(path.join(CONTENT_DIR, file), "utf8");
    const { data, body } = parseFrontmatter(raw);
    const slug = file.replace(/^\d+-/, "").replace(/\.md$/, "");
    return {
      slug,
      title: (data.title as string) ?? slug,
      description: (data.description as string) ?? undefined,
      category: (data.category as string) ?? "General",
      order: (data.order as number) ?? 999,
      roles: (data.roles as string[]) ?? ["all"],
      updated: (data.updated as string) ?? undefined,
      content: body.trim(),
    };
  });
  pages.sort((a, b) => {
    if ((a.order ?? 999) !== (b.order ?? 999)) {
      return (a.order ?? 999) - (b.order ?? 999);
    }
    return a.title.localeCompare(b.title);
  });
  cache = pages;
  return cache;
}

export function getHelpPage(slug: string): HelpPage | null {
  return getAllHelpPages().find((p) => p.slug === slug) ?? null;
}

export function groupByCategory(pages: HelpPage[]): {
  category: string;
  pages: HelpPage[];
}[] {
  const map = new Map<string, HelpPage[]>();
  for (const p of pages) {
    const cat = p.category ?? "General";
    if (!map.has(cat)) map.set(cat, []);
    map.get(cat)!.push(p);
  }
  // Orden de categorias: por order min de cada categoria
  const cats = Array.from(map.entries()).map(([category, ps]) => ({
    category,
    pages: ps,
    minOrder: Math.min(...ps.map((p) => p.order ?? 999)),
  }));
  cats.sort((a, b) => a.minOrder - b.minOrder);
  return cats.map(({ category, pages }) => ({ category, pages }));
}

/** Filtra paginas visibles para un rol. 'all' siempre visible. */
export function filterByRole(pages: HelpPage[], rol: string): HelpPage[] {
  return pages.filter((p) => {
    const roles = p.roles ?? ["all"];
    return roles.includes("all") || roles.includes(rol);
  });
}
