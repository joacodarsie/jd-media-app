"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import {
  fetchAdAccountData,
  fetchAdSets,
  setEntityStatus,
  setEntityDailyBudget,
  friendlyMetaError,
} from "@/lib/meta/ads";
import { suggestPaidMediaChanges, type ProposedChange } from "@/lib/paid-media/suggest";

const CAN_SEE = ["admin", "coordinador", "paid_media"];
const CAN_APPLY = ["admin", "paid_media"];

async function getAdAccount(admin: ReturnType<typeof createAdmin>, clienteId: string) {
  const { data } = await admin
    .from("client_ads_onboarding")
    .select("meta_ad_account_id, campanas_notas")
    .eq("cliente_id", clienteId)
    .maybeSingle();
  return {
    adAccountId: (data as { meta_ad_account_id?: string } | null)?.meta_ad_account_id ?? null,
    objetivo: (data as { campanas_notas?: string | null } | null)?.campanas_notas ?? null,
  };
}

/** Genera cambios sugeridos (estructurados) para la cuenta. */
export async function suggestChanges(
  clienteId: string
): Promise<{ ok: true; cambios: ProposedChange[] } | { error: string }> {
  const me = await requireUser();
  if (!CAN_SEE.includes(me.rol)) return { error: "Sin acceso." };
  const admin = createAdmin();

  const [{ data: cli }, acc] = await Promise.all([
    admin.from("clients").select("nombre, rubro").eq("id", clienteId).maybeSingle(),
    getAdAccount(admin, clienteId),
  ]);
  if (!cli) return { error: "Cliente no encontrado." };
  if (!acc.adAccountId) return { error: "El cliente no tiene cuenta publicitaria cargada." };

  const c = cli as { nombre: string; rubro: string | null };
  try {
    const [data, adsets] = await Promise.all([
      fetchAdAccountData(acc.adAccountId, "last_30d"),
      fetchAdSets(acc.adAccountId, "last_30d"),
    ]);
    const cambios = await suggestPaidMediaChanges({
      cliente: c.nombre,
      objetivo: acc.objetivo,
      negocio: `${c.nombre}${c.rubro ? ` · ${c.rubro}` : ""}`,
      data,
      adsets,
    });
    return { ok: true, cambios };
  } catch (e) {
    return { error: friendlyMetaError(e) };
  }
}

/** Aplica un cambio en Meta y lo registra (auditoría + rollback). */
export async function applyChange(
  clienteId: string,
  change: ProposedChange
): Promise<{ ok: true } | { error: string }> {
  const me = await requireUser();
  if (!CAN_APPLY.includes(me.rol)) return { error: "No tenés permiso para aplicar cambios." };
  const admin = createAdmin();

  try {
    if (change.tipo === "presupuesto") {
      const nuevo = Number(change.valor_nuevo);
      if (!Number.isFinite(nuevo) || nuevo <= 0) return { error: "Presupuesto inválido." };
      await setEntityDailyBudget(change.target_id, nuevo);
    } else if (change.tipo === "pausar") {
      await setEntityStatus(change.target_id, "PAUSED");
    } else if (change.tipo === "activar") {
      await setEntityStatus(change.target_id, "ACTIVE");
    } else {
      return { error: "Tipo de cambio inválido." };
    }
  } catch (e) {
    return { error: friendlyMetaError(e) };
  }

  // valor_anterior para poder revertir.
  const valorAnterior =
    change.tipo === "presupuesto"
      ? change.valor_actual != null
        ? String(change.valor_actual)
        : null
      : change.tipo === "pausar"
        ? "ACTIVE"
        : "PAUSED";

  await admin.from("paid_media_changes").insert({
    cliente_id: clienteId,
    tipo: change.tipo,
    nivel: change.nivel,
    target_id: change.target_id,
    target_nombre: change.target_nombre,
    valor_anterior: valorAnterior,
    valor_nuevo: change.valor_nuevo != null ? String(change.valor_nuevo) : null,
    motivo: change.motivo,
    estado: "aplicado",
    aplicado_por: me.id,
  });

  revalidatePath(`/clientes/${clienteId}/pauta/analisis`);
  return { ok: true };
}

/** Revierte un cambio aplicado (vuelve al valor anterior). */
export async function rollbackChange(
  changeId: string
): Promise<{ ok: true } | { error: string }> {
  const me = await requireUser();
  if (!CAN_APPLY.includes(me.rol)) return { error: "No tenés permiso para revertir cambios." };
  const admin = createAdmin();

  const { data: row } = await admin
    .from("paid_media_changes")
    .select("*")
    .eq("id", changeId)
    .maybeSingle();
  if (!row) return { error: "Cambio no encontrado." };
  const r = row as {
    cliente_id: string;
    tipo: string;
    target_id: string;
    valor_anterior: string | null;
    estado: string;
  };
  if (r.estado === "revertido") return { error: "Ese cambio ya fue revertido." };

  try {
    if (r.tipo === "presupuesto") {
      const prev = Number(r.valor_anterior);
      if (!Number.isFinite(prev) || prev <= 0)
        return { error: "No hay presupuesto anterior para restaurar." };
      await setEntityDailyBudget(r.target_id, prev);
    } else {
      // pausar/activar: el valor_anterior es el estado al que volvemos.
      const prev = r.valor_anterior === "PAUSED" ? "PAUSED" : "ACTIVE";
      await setEntityStatus(r.target_id, prev);
    }
  } catch (e) {
    return { error: friendlyMetaError(e) };
  }

  await admin
    .from("paid_media_changes")
    .update({ estado: "revertido", revertido_at: new Date().toISOString() })
    .eq("id", changeId);

  revalidatePath(`/clientes/${r.cliente_id}/pauta/analisis`);
  return { ok: true };
}
