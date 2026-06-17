/**
 * Score de riesgo de churn por cliente: cruza señales que ya tenemos para avisar
 * qué cuenta está en peligro ANTES de perderla. No inventa datos: cada señal sale
 * de algo cargado (cobros, producción, seguidores).
 */
import { createAdmin } from "@/lib/supabase/admin";
import { PACK_QUOTAS } from "@/lib/content-plans/packs";
import { isOverdue, currentPeriod, nextPeriod } from "@/lib/finanzas";

type Admin = ReturnType<typeof createAdmin>;

export interface ClientRisk {
  id: string;
  nombre: string;
  pack: string | null;
  score: number;
  nivel: "alto" | "medio" | "bajo";
  señales: string[];
}

function nivelDe(score: number): ClientRisk["nivel"] {
  if (score >= 3) return "alto";
  if (score >= 1) return "medio";
  return "bajo";
}

export async function computeClientsRisk(admin: Admin): Promise<ClientRisk[]> {
  const now = new Date();
  const period = currentPeriod();
  const mStart = `${period}-01`;
  const mEnd = `${nextPeriod(period)}-01`;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const elapsedFrac = now.getDate() / daysInMonth;
  const ig35 = new Date(now.getTime() - 35 * 86_400_000).toISOString().slice(0, 10);

  const { data: clientsRaw } = await admin
    .from("clients")
    .select("id, nombre, pack, ig_user_id")
    .eq("es_interno", false)
    .eq("estado", "activo");
  const clients = (clientsRaw ?? []) as {
    id: string;
    nombre: string;
    pack: string | null;
    ig_user_id: string | null;
  }[];
  if (clients.length === 0) return [];
  const ids = clients.map((c) => c.id);

  const [{ data: invsRaw }, { data: pubsRaw }, { data: snapsRaw }] = await Promise.all([
    admin
      .from("client_invoices")
      .select("cliente_id, fecha_vencimiento, fecha_cobro")
      .in("cliente_id", ids),
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
  ]);

  // Cobros vencidos por cliente.
  const overdueByC = new Map<string, number>();
  for (const i of (invsRaw ?? []) as {
    cliente_id: string;
    fecha_vencimiento: string | null;
    fecha_cobro: string | null;
  }[]) {
    if (isOverdue(i.fecha_vencimiento, i.fecha_cobro))
      overdueByC.set(i.cliente_id, (overdueByC.get(i.cliente_id) ?? 0) + 1);
  }

  // Producción del mes por cliente (publicadas) + rechazos.
  const prodByC = new Map<string, { reels: number; posts: number; rechazos: number }>();
  for (const p of (pubsRaw ?? []) as { cliente_id: string; tipo: string; estado: string }[]) {
    const e = prodByC.get(p.cliente_id) ?? { reels: 0, posts: 0, rechazos: 0 };
    if (p.estado === "rechazado") e.rechazos++;
    else if (p.estado === "publicado") {
      if (p.tipo === "reel" || p.tipo === "video") e.reels++;
      else if (p.tipo === "post" || p.tipo === "carrusel") e.posts++;
    }
    prodByC.set(p.cliente_id, e);
  }

  // Seguidores: primer vs último snapshot (últimos 35 días) por cliente.
  const snapsByC = new Map<string, { fecha: string; followers: number }[]>();
  for (const s of (snapsRaw ?? []) as { cliente_id: string; fecha: string; followers: number }[]) {
    const arr = snapsByC.get(s.cliente_id) ?? [];
    arr.push({ fecha: s.fecha, followers: s.followers });
    snapsByC.set(s.cliente_id, arr);
  }

  const out: ClientRisk[] = clients.map((c) => {
    const señales: string[] = [];
    let score = 0;

    // 1) Cobro vencido (señal fuerte).
    const overdue = overdueByC.get(c.id) ?? 0;
    if (overdue > 0) {
      score += 3;
      señales.push(overdue === 1 ? "Cobro vencido" : `${overdue} cobros vencidos`);
    }

    // 2) Producción atrasada vs el pack (solo packs con cuota, pasada la mitad del mes).
    const quota = c.pack && c.pack !== "Personalizado"
      ? PACK_QUOTAS[c.pack as keyof typeof PACK_QUOTAS]
      : null;
    if (quota && elapsedFrac >= 0.5) {
      const prod = prodByC.get(c.id) ?? { reels: 0, posts: 0, rechazos: 0 };
      const hechas = prod.reels + prod.posts;
      const meta = quota.reels + quota.posts;
      if (meta > 0 && hechas / meta < 0.5) {
        score += 2;
        señales.push(`Producción atrasada (${hechas}/${meta} piezas)`);
      }
    }

    // 3) Perdiendo seguidores (si está conectado IG y hay 2+ snapshots).
    const snaps = snapsByC.get(c.id) ?? [];
    if (snaps.length >= 2) {
      const diff = snaps[snaps.length - 1].followers - snaps[0].followers;
      if (diff < 0) {
        score += 2;
        señales.push(`Perdiendo seguidores (${diff})`);
      }
    }

    // 4) Varios cambios pedidos (rechazos) este mes.
    const rechazos = (prodByC.get(c.id) ?? { rechazos: 0 }).rechazos;
    if (rechazos >= 2) {
      score += 1;
      señales.push(`${rechazos} cambios pedidos este mes`);
    }

    return { id: c.id, nombre: c.nombre, pack: c.pack, score, nivel: nivelDe(score), señales };
  });

  // Mayor riesgo primero.
  out.sort((a, b) => b.score - a.score);
  return out;
}
