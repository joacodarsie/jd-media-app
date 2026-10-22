"use server";

import { randomBytes } from "node:crypto";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { hoyYmd } from "@/lib/dates";
import { linkReunion, mensajeInvitacion, rangoDias } from "@/lib/retencion/invitar-reunion";
import { CAMPO_INVITACION } from "@/lib/retencion/reuniones-del-mes-run";
import { diasDeReunion } from "@/lib/retencion/reunion-autoagenda";

/**
 * Arma la invitación a la reunión mensual para mandar por WhatsApp y deja
 * registrado en el ticket que se invitó (22/10/2026). Si la cuenta todavía no
 * tiene portal, lo crea: el link del mensaje es el portal, donde el cliente
 * elige día y hora. No revoca el portal que ya tenga.
 */
export async function invitarReunion(input: {
  clienteId: string;
  ticketId: string;
}): Promise<{ ok: true; mensaje: string; telefono: string | null } | { ok: false; error: string }> {
  const me = await requireUser();
  const admin = createAdmin();

  const { data: c } = await admin
    .from("clients")
    .select("nombre, contacto_nombre, contacto_telefono")
    .eq("id", input.clienteId)
    .maybeSingle();
  const cli = c as { nombre: string; contacto_nombre: string | null; contacto_telefono: string | null } | null;
  if (!cli) return { ok: false, error: "No encontré la cuenta." };

  const { data: tk } = await admin
    .from("client_portal_tokens")
    .select("token")
    .eq("cliente_id", input.clienteId)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  let token = ((tk ?? []) as { token: string }[])[0]?.token ?? null;
  if (!token) {
    token = randomBytes(16).toString("hex");
    const { error } = await admin.from("client_portal_tokens").insert({ cliente_id: input.clienteId, token, created_by: me.id });
    if (error) return { ok: false, error: "No pude crear el portal de la cuenta." };
  }

  const h = headers();
  const origin = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const hoy = hoyYmd();
  const mensaje = mensajeInvitacion({
    contacto: cli.contacto_nombre,
    cuenta: cli.nombre,
    periodo: hoy.slice(0, 7),
    link: linkReunion(origin, token),
    dias: rangoDias(diasDeReunion(hoy)),
    deParte: me.nombre,
  });

  await admin.from("task_history").insert({
    task_id: input.ticketId,
    user_id: me.id,
    campo: CAMPO_INVITACION,
    valor_anterior: null,
    valor_nuevo: "Le mandó al cliente el link para elegir día y hora",
  });
  revalidatePath("/dashboard");
  return { ok: true, mensaje, telefono: cli.contacto_telefono };
}
