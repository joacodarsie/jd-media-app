import { NextRequest, NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";
import { planillaAutorizada } from "@/lib/finanzas/planilla-auth";
import { aplicarMovimientos } from "@/lib/finanzas/conciliar-run";
import type { MovimientoPlanilla } from "@/lib/finanzas/conciliar";
import { sendPushToUsers } from "@/lib/push";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * La planilla del dueño manda acá los cobros de clientes y los sueldos que
 * detectó en el banco. La app los marca sola (cobrado / pagado) y le avisa al
 * dueño para que confirme en /finanzas/conciliacion. Contesta, por cada
 * movimiento, qué hizo: el script lo escribe en la columna «¿Está en la app de
 * JD?» y no lo vuelve a mandar.
 */
export async function POST(req: NextRequest) {
  const ok = await planillaAutorizada(req);
  if (ok === null) return NextResponse.json({ error: "Falta la clave de la planilla (0227)" }, { status: 503 });
  if (!ok) return NextResponse.json({ error: "no autorizado" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { movimientos?: MovimientoPlanilla[] };
  const movs = (body.movimientos ?? []).slice(0, 200).map((m) => ({
    clave: String(m.clave ?? "").slice(0, 200),
    fecha: String(m.fecha ?? ""),
    monto: Math.abs(Number(m.monto) || 0),
    categoria: String(m.categoria ?? ""),
    detalle: String(m.detalle ?? ""),
    descripcion: m.descripcion ? String(m.descripcion) : null,
    cuenta: m.cuenta ? String(m.cuenta) : null,
  }));

  const db = createAdmin();
  const resultados = await aplicarMovimientos(db, movs);

  // Un aviso por tanda, con lo que hay para revisar.
  const nuevos = resultados.filter((r) => r.nuevo && (r.estado === "marcado" || r.estado === "sin_match"));
  if (nuevos.length) {
    const marcados = nuevos.filter((r) => r.estado === "marcado");
    const sinMatch = nuevos.length - marcados.length;
    const titulo =
      marcados.length === 1 && !sinMatch
        ? marcados[0].mensaje
        : `Marqué ${marcados.length} ${marcados.length === 1 ? "movimiento" : "movimientos"}${sinMatch ? ` y ${sinMatch} no supe dónde van` : ""}`;
    const { data: admins } = await db.from("users").select("id").eq("rol", "admin").eq("activo", true);
    const ids = ((admins ?? []) as { id: string }[]).map((a) => a.id);
    if (ids.length) {
      await db.from("notifications").insert(
        ids.map((id) => ({
          user_id: id,
          tipo: "recordatorio" as const,
          mensaje: `Planilla: ${titulo}. ¿Está bien?`,
          link: "/finanzas/conciliacion",
          leida: false,
        })),
      );
      await sendPushToUsers(ids, {
        title: "Cobros y pagos detectados",
        body: `${titulo}. Tocá para confirmar.`,
        url: "/finanzas/conciliacion",
        tag: "conciliacion",
      }).catch(() => {});
    }
  }

  return NextResponse.json({ resultados });
}
