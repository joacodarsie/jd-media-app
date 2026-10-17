/**
 * Lo que necesita la pantalla de Crecimiento de una cuenta (17/10/2026): la
 * foto de inicio, la más nueva, la comparación entre las dos y la curva de
 * seguidores de los registros diarios de Instagram.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Pilar } from "@/lib/diagnostico/puntaje";
import { comparar, type Comparacion, type CeldaGrilla, type FotoGuardada } from "./foto";

export interface FotoCompleta extends FotoGuardada {
  usuario: string | null;
  pilares: Pilar[] | null;
  grilla: CeldaGrilla[];
}

export interface Crecimiento {
  inicio: FotoCompleta | null;
  hoy: FotoCompleta | null;
  comparaciones: Comparacion[];
  seguidores: { fecha: string; followers: number }[];
  /** Meses desde el inicio (para el título). */
  meses: number | null;
}

const num = (v: unknown) => (v === null || v === undefined ? null : Number(v));

export async function cargarCrecimiento(admin: SupabaseClient, clientId: string): Promise<Crecimiento> {
  const [{ data: fotos }, { data: snaps }] = await Promise.all([
    admin
      .from("cuenta_fotos")
      .select("tipo, fecha, real, usuario, seguidores, publicaciones, posts_mes, reels, interaccion, puntaje, pilares, grilla")
      .eq("client_id", clientId)
      .order("fecha", { ascending: true }),
    admin.from("ig_snapshots").select("fecha, followers").eq("cliente_id", clientId).order("fecha", { ascending: true }),
  ]);
  const lista: FotoCompleta[] = ((fotos ?? []) as Record<string, unknown>[]).map((f) => ({
    tipo: f.tipo as "inicio" | "mensual",
    fecha: f.fecha as string,
    real: !!f.real,
    usuario: (f.usuario as string) ?? null,
    seguidores: num(f.seguidores),
    publicaciones: num(f.publicaciones),
    posts_mes: num(f.posts_mes),
    reels: num(f.reels),
    interaccion: num(f.interaccion),
    puntaje: num(f.puntaje),
    pilares: (f.pilares as Pilar[]) ?? null,
    grilla: (f.grilla as CeldaGrilla[]) ?? [],
  }));
  const inicio = lista.find((f) => f.tipo === "inicio") ?? null;
  const ultima = [...lista].reverse().find((f) => f !== inicio) ?? null;
  const seguidores = ((snaps ?? []) as { fecha: string; followers: number | null }[])
    .filter((s) => (s.followers ?? 0) > 0)
    .map((s) => ({ fecha: s.fecha, followers: Number(s.followers) }));

  // Seguidores del inicio: la foto si fue real, si no el registro diario más
  // cercano posterior al arranque (es la primera vez que se midió).
  let segIniciales: number | null = null;
  if (inicio && !inicio.seguidores && seguidores.length) {
    segIniciales = (seguidores.find((s) => s.fecha >= inicio.fecha) ?? seguidores[0]).followers;
  }

  const comparaciones = inicio && ultima ? comparar(inicio, ultima, segIniciales) : [];
  const meses =
    inicio && ultima
      ? Math.max(0, Math.round((Date.parse(ultima.fecha) - Date.parse(inicio.fecha)) / (30.4 * 86_400_000)))
      : null;
  return { inicio, hoy: ultima, comparaciones, seguidores, meses };
}
