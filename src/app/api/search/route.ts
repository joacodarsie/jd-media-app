import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface SearchResult {
  kind: "tarea" | "cliente" | "publicacion" | "documento";
  id: string;
  titulo: string;
  subtitle: string;
  href: string;
}

export async function GET(req: Request) {
  await requireUser();
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ results: [] });

  const supabase = createClient();
  const pattern = `%${q}%`;

  const [tasksRes, clientsRes, pubsRes, docsRes] = await Promise.all([
    supabase
      .from("tasks")
      .select("id, titulo, estado, cliente:clients(nombre)")
      .ilike("titulo", pattern)
      .limit(8),
    supabase
      .from("clients")
      .select("id, nombre, estado")
      .ilike("nombre", pattern)
      .limit(6),
    supabase
      .from("publications")
      .select("id, titulo, estado, cliente:clients(nombre)")
      .ilike("titulo", pattern)
      .limit(6),
    supabase
      .from("documents")
      .select("id, titulo, categoria, cliente_id")
      .ilike("titulo", pattern)
      .limit(5),
  ]);

  const results: SearchResult[] = [];

  for (const t of (tasksRes.data ?? []) as unknown as {
    id: string;
    titulo: string;
    estado: string;
    cliente: { nombre: string } | null;
  }[]) {
    results.push({
      kind: "tarea",
      id: t.id,
      titulo: t.titulo,
      subtitle: `Tarea · ${t.estado}${t.cliente ? ` · ${t.cliente.nombre}` : ""}`,
      href: `/tareas/${t.id}`,
    });
  }
  for (const c of (clientsRes.data ?? []) as {
    id: string;
    nombre: string;
    estado: string;
  }[]) {
    results.push({
      kind: "cliente",
      id: c.id,
      titulo: c.nombre,
      subtitle: `Cliente · ${c.estado === "activo" ? "activo" : "inactivo"}`,
      href: `/clientes/${c.id}`,
    });
  }
  for (const p of (pubsRes.data ?? []) as unknown as {
    id: string;
    titulo: string;
    estado: string;
    cliente: { nombre: string } | null;
  }[]) {
    results.push({
      kind: "publicacion",
      id: p.id,
      titulo: p.titulo,
      subtitle: `Publicación · ${p.estado}${p.cliente ? ` · ${p.cliente.nombre}` : ""}`,
      href: `/contenidos`,
    });
  }
  for (const d of (docsRes.data ?? []) as {
    id: string;
    titulo: string;
    categoria: string;
    cliente_id: string | null;
  }[]) {
    results.push({
      kind: "documento",
      id: d.id,
      titulo: d.titulo,
      subtitle: `Documento · ${d.categoria}`,
      href: d.cliente_id ? `/clientes/${d.cliente_id}` : "/documentos",
    });
  }

  return NextResponse.json({ results });
}
