/**
 * El ejecutor del reconocimiento por calendario: lee los eventos del mes de
 * las cuentas de Google conectadas y registra las reuniones que ya se dieron.
 *
 * La decisión de QUÉ evento es una reunión vive en `reunion-desde-calendario.ts`
 * (puro y testeado); acá solo se habla con Google y con la base.
 *
 * Al insertar en `client_meetings`, el trigger de la migración 0182 completa
 * solo el ticket de esa reunión. O sea: se agenda el meet, se da, y la app se
 * entera sin que nadie cargue nada.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { listEvents, type GoogleCalendarConnection } from "@/lib/google-calendar";
import {
  reunionesDesdeCalendario,
  type EventoCalendario,
} from "./reunion-desde-calendario";

export async function runReunionesDesdeCalendario(
  admin: SupabaseClient,
  periodo: string
): Promise<{ periodo: string; registradas: number; detalle: string[] }> {
  const [{ data: connsRaw }, { data: clientsRaw }, { data: meetingsRaw }] = await Promise.all([
    admin.from("google_calendar_connections").select("*"),
    admin.from("clients").select("id, nombre").eq("estado", "activo").eq("es_interno", false),
    admin.from("client_meetings").select("cliente_id").eq("periodo", periodo),
  ]);

  const conns = (connsRaw ?? []) as GoogleCalendarConnection[];
  const cuentas = (clientsRaw ?? []) as { id: string; nombre: string }[];
  const yaRegistradas = ((meetingsRaw ?? []) as { cliente_id: string }[]).map((m) => m.cliente_id);
  if (conns.length === 0 || cuentas.length === 0) {
    return { periodo, registradas: 0, detalle: [] };
  }

  const desde = `${periodo}-01T00:00:00Z`;
  const [y, m] = periodo.split("-").map(Number);
  const hasta = new Date(Date.UTC(y, m, 1)).toISOString();

  // Un calendario caído no puede frenar al resto: cada uno se pide aparte.
  const listas = await Promise.all(
    conns.map((c) =>
      listEvents(c, desde, hasta).catch((err) => {
        console.error(`reunión desde calendario · ${c.google_email}:`, err);
        return [];
      })
    )
  );
  const eventos = listas.flat() as EventoCalendario[];

  const detectadas = reunionesDesdeCalendario({
    eventos,
    cuentas,
    yaRegistradas,
    periodo,
    ahora: new Date().toISOString(),
  });
  if (detectadas.length === 0) return { periodo, registradas: 0, detalle: [] };

  const { error } = await admin.from("client_meetings").insert(
    detectadas.map((r) => ({
      cliente_id: r.cliente_id,
      periodo: r.periodo,
      fecha: r.fecha,
      notas: `Registrada automáticamente desde el calendario: "${r.evento}" (${r.fecha}).`,
      registrado_por: null,
    }))
  );
  if (error) throw new Error(error.message);

  const nombre = new Map(cuentas.map((c) => [c.id, c.nombre]));
  return {
    periodo,
    registradas: detectadas.length,
    detalle: detectadas.map((r) => `${nombre.get(r.cliente_id) ?? r.cliente_id} (${r.fecha})`),
  };
}
