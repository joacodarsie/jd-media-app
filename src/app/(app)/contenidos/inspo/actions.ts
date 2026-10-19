"use server";

import { revalidatePath } from "next/cache";
import { requireUser, canAccessClient } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { limpiarFuente } from "@/lib/inspo/inspo";
import { actualizarFuentes } from "@/lib/inspo/run";

async function acceso(clienteId: string) {
  const me = await requireUser();
  const ok = await canAccessClient(me.id, me.rol, clienteId, me.rol_secundario);
  if (!ok) throw new Error("Sin acceso a esta cuenta.");
  return me;
}

/** Suma una cuenta de referencia o un hashtag y la trae en el momento. */
export async function agregarFuente(clienteId: string, tipo: "cuenta" | "hashtag", valor: string) {
  const me = await acceso(clienteId);
  const limpio = limpiarFuente(tipo, valor);
  if (!limpio) return { error: tipo === "cuenta" ? "Ese usuario de Instagram no es válido." : "Ese hashtag no es válido." };
  const admin = createAdmin();
  const { data, error } = await admin
    .from("inspo_fuentes")
    .upsert({ cliente_id: clienteId, tipo, valor: limpio, creado_por: me.id }, { onConflict: "cliente_id,tipo,valor" })
    .select("id, cliente_id, tipo, valor")
    .single();
  if (error || !data) return { error: /inspo_fuentes/.test(error?.message ?? "") ? "Falta aplicar la migración 0207." : error?.message ?? "No se pudo guardar." };
  const r = await actualizarFuentes(admin, [data as { id: string; cliente_id: string; tipo: "cuenta" | "hashtag"; valor: string }]);
  revalidatePath("/contenidos/inspo");
  return r.errores.length ? { ok: true as const, aviso: r.errores[0] } : { ok: true as const };
}

export async function quitarFuente(clienteId: string, fuenteId: string) {
  await acceso(clienteId);
  await createAdmin().from("inspo_fuentes").delete().eq("id", fuenteId).eq("cliente_id", clienteId);
  revalidatePath("/contenidos/inspo");
  return { ok: true as const };
}

export async function actualizarInspo(clienteId: string) {
  await acceso(clienteId);
  const admin = createAdmin();
  const { data } = await admin.from("inspo_fuentes").select("id, cliente_id, tipo, valor").eq("cliente_id", clienteId);
  const r = await actualizarFuentes(admin, (data ?? []) as { id: string; cliente_id: string; tipo: "cuenta" | "hashtag"; valor: string }[]);
  revalidatePath("/contenidos/inspo");
  return r;
}

/** «Buscar referencias con IA»: propone cuentas del rubro, verificadas contra Instagram. */
export async function buscarReferenciasIA(clienteId: string) {
  await acceso(clienteId);
  const { autoInspo } = await import("@/lib/inspo/auto-run");
  const r = await autoInspo(createAdmin(), clienteId, { forzar: true });
  revalidatePath("/contenidos/inspo");
  return r;
}
