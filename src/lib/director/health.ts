/**
 * Salud integral de cada cuenta para el Director IA: cruza cumplimiento del plan
 * (piezas publicadas vs cuota del pack), crecimiento de Instagram (seguidores) y
 * tareas vencidas, y devuelve un semáforo bien/regular/mal por cuenta. No inventa
 * datos: cada señal sale de algo cargado. Pensado para el seguimiento quincenal.
 */
import { createAdmin } from "@/lib/supabase/admin";
import { PACK_QUOTAS } from "@/lib/content-plans/packs";
import { currentPeriod, nextPeriod } from "@/lib/finanzas";

type Admin = ReturnType<typeof createAdmin>;

export type Semaforo = "bien" | "regular" | "mal";

export interface AccountHealth {
  id: string;
  nombre: string;
  pack: string | null;
  semaforo: Semaforo;
  score: number; // mayor = peor (para ordenar)
  // Cumplimiento del plan (mes en curso)
  planHechas: number;
  planMeta: number; // 0 = pack sin cuota (Personalizado)
  planPct: number | null;
  // Instagram (últimos ~35 días)
  igConectado: boolean;
  igDelta: number | null;
  // Tareas
  tareasVencidas: number;
  // Frases legibles
  buenas: string[];
  alertas: string[];
}

function semaforoDe(score: number): Semaforo {
  if (score >= 3) return "mal";
  if (score >= 1) return "regular";
  return "bien";
}

export interface AccountHealthResult {
  periodo: string;
  cuentas: AccountHealth[];
  resumen: { bien: number; regular: number; mal: number; total: number };
}

export async function computeAccountHealth(admin: Admin): Promise<AccountHealthResult> {
  const now = new Date();
  const period = currentPeriod();
  const mStart = `${period}-01`;
  const mEnd = `${nextPeriod(period)}-01`;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const elapsedFrac = now.getDate() / daysInMonth;
  const today = now.toISOString().slice(0, 10);
  const ig35 = new Date(now.getTime() - 35 * 86_400_000).toISOString().slice(0, 10);

  const { data: clientsRaw } = await admin
    .from("clients")
    .select("id, nombre, pack, ig_user_id")
    .eq("es_interno", false)
    .eq("estado", "activo")
    .order("nombre");
  const clients = (clientsRaw ?? []) as {
    id: string;
    nombre: string;
    pack: string | null;
    ig_user_id: string | null;
  }[];
  const empty: AccountHealthResult = {
    periodo: period,
    cuentas: [],
    resumen: { bien: 0, regular: 0, mal: 0, total: 0 },
  };
  if (clients.length === 0) return empty;
  const ids = clients.map((c) => c.id);

  const [{ data: pubsRaw }, { data: snapsRaw }, { data: tasksRaw }] = await Promise.all([
    admin
      .from("publications")
      .select("cliente_id, tipo, estado")
      .in("cliente_id", ids)
      .gte("fecha_publicacion", mStart)
      .lt("fecha_publicacion", mEnd),
    admin
      .from("ig_snapshots")
      .select("cliente_id, fecha, followers")
      .in("cliente_id", ids)
      .gte("fecha", ig35)
      .order("fecha", { ascending: true }),
    admin
      .from("tasks")
      .select("cliente_id, estado, fecha_limite")
      .in("cliente_id", ids)
      .neq("estado", "completada")
      .neq("estado", "archivada")
      .not("fecha_limite", "is", null)
      .lt("fecha_limite", today),
  ]);

  // Producción del mes por cliente (publicadas).
  const prodByC = new Map<string, { reels: number; posts: number }>();
  for (const p of (pubsRaw ?? []) as { cliente_id: string; tipo: string; estado: string }[]) {
    if (p.estado !== "publicado") continue;
    const e = prodByC.get(p.cliente_id) ?? { reels: 0, posts: 0 };
    if (p.tipo === "reel" || p.tipo === "video") e.reels++;
    else if (p.tipo === "post" || p.tipo === "carrusel") e.posts++;
    prodByC.set(p.cliente_id, e);
  }

  // Seguidores: primer vs último snapshot (últimos 35 días).
  const snapsByC = new Map<string, number[]>();
  for (const s of (snapsRaw ?? []) as { cliente_id: string; followers: number }[]) {
    const arr = snapsByC.get(s.cliente_id) ?? [];
    arr.push(s.followers);
    snapsByC.set(s.cliente_id, arr);
  }

  // Tareas vencidas por cliente.
  const overdueTasksByC = new Map<string, number>();
  for (const t of (tasksRaw ?? []) as { cliente_id: string }[]) {
    if (!t.cliente_id) continue;
    overdueTasksByC.set(t.cliente_id, (overdueTasksByC.get(t.cliente_id) ?? 0) + 1);
  }

  const cuentas: AccountHealth[] = clients.map((c) => {
    const buenas: string[] = [];
    const alertas: string[] = [];
    let score = 0;

    // 1) Cumplimiento del plan.
    const quota =
      c.pack && c.pack !== "Personalizado"
        ? PACK_QUOTAS[c.pack as keyof typeof PACK_QUOTAS]
        : null;
    const prod = prodByC.get(c.id) ?? { reels: 0, posts: 0 };
    const planHechas = prod.reels + prod.posts;
    const planMeta = quota ? quota.reels + quota.posts : 0;
    const planPct = planMeta > 0 ? planHechas / planMeta : null;
    if (planMeta > 0) {
      // Solo evaluamos atraso pasada ~la mitad del mes: al principio es normal
      // tener pocas piezas y no queremos falsos rojos.
      const esperado = planMeta * elapsedFrac;
      if (elapsedFrac < 0.45) {
        buenas.push(`Plan en curso (${planHechas}/${planMeta})`);
      } else if (planHechas < esperado * 0.5) {
        score += 2;
        alertas.push(`Plan muy atrasado (${planHechas}/${planMeta} piezas)`);
      } else if (planHechas < esperado * 0.85) {
        score += 1;
        alertas.push(`Plan un poco atrasado (${planHechas}/${planMeta})`);
      } else {
        buenas.push(`Plan al día (${planHechas}/${planMeta})`);
      }
    }

    // 2) Instagram (crecimiento).
    const snaps = snapsByC.get(c.id) ?? [];
    const igConectado = !!c.ig_user_id && snaps.length >= 2;
    let igDelta: number | null = null;
    if (igConectado) {
      igDelta = snaps[snaps.length - 1] - snaps[0];
      if (igDelta < 0) {
        score += 2;
        alertas.push(`Perdiendo seguidores (${igDelta})`);
      } else if (igDelta > 0) {
        buenas.push(`Creciendo (+${igDelta} seguidores)`);
      }
    }

    // 3) Tareas vencidas.
    const tareasVencidas = overdueTasksByC.get(c.id) ?? 0;
    if (tareasVencidas >= 3) {
      score += 2;
      alertas.push(`${tareasVencidas} tareas vencidas`);
    } else if (tareasVencidas >= 1) {
      score += 1;
      alertas.push(`${tareasVencidas} tarea(s) vencida(s)`);
    }

    return {
      id: c.id,
      nombre: c.nombre,
      pack: c.pack,
      semaforo: semaforoDe(score),
      score,
      planHechas,
      planMeta,
      planPct,
      igConectado,
      igDelta,
      tareasVencidas,
      buenas,
      alertas,
    };
  });

  // Peor primero.
  cuentas.sort((a, b) => b.score - a.score || a.nombre.localeCompare(b.nombre, "es"));

  const resumen = {
    bien: cuentas.filter((c) => c.semaforo === "bien").length,
    regular: cuentas.filter((c) => c.semaforo === "regular").length,
    mal: cuentas.filter((c) => c.semaforo === "mal").length,
    total: cuentas.length,
  };

  return { periodo: period, cuentas, resumen };
}
