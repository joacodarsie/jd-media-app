/**
 * Lado impuro del historial de pases de cuentas: leer la tabla y anotar cada
 * cambio de responsable. La lógica de "quién la llevaba en tal mes" es pura y
 * vive en `asignaciones.ts`.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { hoyYmd } from "@/lib/dates";
import type { Asignacion, RolDeCuenta } from "./asignaciones";

/** Roles de la ficha del cliente que se pagan por mes y por eso llevan historial. */
export const ROLES_CON_HISTORIAL: { rol: RolDeCuenta; campo: string }[] = [
  { rol: "cm", campo: "cm_id" },
  { rol: "media_buyer", campo: "media_buyer_id" },
];

/**
 * Trae el historial completo. Si la migración 0158 todavía no está aplicada
 * devuelve vacío, y el cálculo de sueldos cae al responsable actual de la ficha
 * (el comportamiento de siempre).
 */
export async function cargarAsignaciones(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, any, any>
): Promise<Asignacion[]> {
  const { data, error } = await admin
    .from("client_assignments")
    .select("cliente_id, rol, user_id, desde, hasta");
  if (error) return []; // 42P01: la tabla no existe todavía
  return ((data ?? []) as { cliente_id: string; rol: string; user_id: string; desde: string; hasta: string | null }[]).map(
    (r) => ({
      clienteId: r.cliente_id,
      rol: r.rol as RolDeCuenta,
      userId: r.user_id,
      desde: r.desde,
      hasta: r.hasta,
    })
  );
}

/**
 * Anota un pase: cierra el tramo del anterior el día previo y abre el del
 * nuevo. `desde` permite fechar el pase cuando ya venía hecho en la realidad y
 * recién ahora se carga en el sistema.
 *
 * Idempotente: si el que figura vigente ya es el nuevo responsable, no hace
 * nada. Silencioso si la migración no está aplicada — nunca tiene que hacer
 * fallar el guardado de la ficha del cliente.
 */
export async function anotarPaseDeCuenta(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  admin: SupabaseClient<any, any, any>,
  input: {
    clienteId: string;
    rol: RolDeCuenta;
    nuevoUserId: string | null;
    /** "YYYY-MM-DD". Por defecto, hoy. */
    desde?: string;
    /**
     * Quién la llevaba hasta ahora. Solo se usa si la cuenta todavía no tiene
     * historial (se creó después de la 0158): sin esto, sus meses viejos
     * quedarían sin nadie cobrando.
     */
    anteriorUserId?: string | null;
    /** "YYYY-MM-DD" de arranque de la cuenta, para fechar ese primer tramo. */
    clienteDesde?: string | null;
    nota?: string;
  }
): Promise<void> {
  const desde = input.desde ?? hoyYmd();

  const { data, error } = await admin
    .from("client_assignments")
    .select("id, user_id, desde")
    .eq("cliente_id", input.clienteId)
    .eq("rol", input.rol)
    .is("hasta", null)
    .order("desde", { ascending: false });
  if (error) return; // tabla ausente: se ignora

  const vigentes = (data ?? []) as { id: string; user_id: string; desde: string }[];
  if (vigentes.length === 1 && vigentes[0].user_id === input.nuevoUserId) return;

  // El día anterior al pase es el último del anterior.
  const d = new Date(`${desde}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  const hasta = d.toISOString().slice(0, 10);

  // Cuenta sin historial (creada después de la 0158): se siembra el tramo del
  // anterior para que sus meses ya liquidados sigan siendo suyos.
  if (vigentes.length === 0 && input.anteriorUserId) {
    const arranque = input.clienteDesde ?? "2020-01-01";
    await admin.from("client_assignments").insert({
      cliente_id: input.clienteId,
      rol: input.rol,
      user_id: input.anteriorUserId,
      desde: arranque <= hasta ? arranque : hasta,
      hasta,
      nota: "tramo previo, reconstruido al anotar el pase",
    });
  }

  for (const v of vigentes) {
    if (v.desde > hasta) {
      // El tramo abierto empezó después del pase: nunca existió de verdad.
      await admin.from("client_assignments").delete().eq("id", v.id);
    } else {
      await admin.from("client_assignments").update({ hasta }).eq("id", v.id);
    }
  }

  if (input.nuevoUserId) {
    await admin.from("client_assignments").insert({
      cliente_id: input.clienteId,
      rol: input.rol,
      user_id: input.nuevoUserId,
      desde,
      nota: input.nota ?? null,
    });
  }
}
