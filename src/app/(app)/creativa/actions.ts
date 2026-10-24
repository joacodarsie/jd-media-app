"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { puedeCreativa } from "@/lib/creativa/cargar";
import { ENTREGABLES, MEDIOS, URGENCIAS, type Entregable, type NivelMedio, type Urgencia } from "@/lib/creativa/creativa";

/** Área Creativa (23/10/2026): documentos de campaña y definición creativa de cada cuenta. */

async function quien() {
  const me = await requireUser();
  if (!puedeCreativa(me)) throw new Error("Solo la dirección creativa.");
  return me;
}

function revalidar(clienteId: string) {
  revalidatePath("/creativa");
  revalidatePath(`/creativa/${clienteId}`);
  revalidatePath(`/clientes/${clienteId}`);
  revalidatePath(`/clientes/${clienteId}/onboarding/creativa`);
}

const envolver = async <T,>(fn: () => Promise<T>) => {
  try {
    return await fn();
  } catch (e) {
    return { error: e instanceof Error ? e.message : "No se pudo guardar." };
  }
};

const fechaOk = (s: string | null) => !s || /^\d{4}-\d{2}-\d{2}$/.test(s);
const diasOk = (n: number | null) => n == null || (Number.isInteger(n) && n >= 1 && n <= 730);

export interface DocCampanaInput {
  clienteId: string;
  entregable: Entregable;
  titulo: string;
  storagePath: string;
  fileName: string;
  fileSize: number | null;
  mimeType: string | null;
  inicio: string | null;
  dias: number | null;
}

export async function subirDocumentoCampana(i: DocCampanaInput) {
  return envolver(async () => {
    const me = await quien();
    if (!(i.entregable in ENTREGABLES)) return { error: "Elegí qué documento es." };
    if (!i.titulo.trim()) return { error: "Ponele un nombre." };
    if (!fechaOk(i.inicio) || !diasOk(i.dias)) return { error: "Revisá el inicio y la duración (de 1 a 730 días)." };
    const { error } = await createAdmin().from("documents").insert({
      titulo: i.titulo.trim(),
      categoria: "campana",
      storage_path: i.storagePath,
      file_name: i.fileName,
      file_size: i.fileSize,
      mime_type: i.mimeType,
      subido_por_id: me.id,
      cliente_id: i.clienteId,
      usar_en_ia: true,
      entregable: i.entregable,
      campana_inicio: i.inicio,
      campana_dias: i.dias,
    });
    if (error) return { error: error.message };
    revalidar(i.clienteId);
    return { ok: true as const };
  });
}

export async function editarVigencia(docId: string, inicio: string | null, dias: number | null) {
  return envolver(async () => {
    await quien();
    if (!fechaOk(inicio) || !diasOk(dias)) return { error: "Revisá el inicio y la duración (de 1 a 730 días)." };
    const { data, error } = await createAdmin()
      .from("documents")
      .update({ campana_inicio: inicio, campana_dias: dias })
      .eq("id", docId)
      .not("entregable", "is", null)
      .select("cliente_id")
      .maybeSingle();
    if (error || !data) return { error: error?.message ?? "No encontré el documento." };
    revalidar(String(data.cliente_id));
    return { ok: true as const };
  });
}

/** Si JDmedIA lo usa como referencia al armar los calendarios. */
export async function usarEnJdmedia(docId: string, usar: boolean) {
  return envolver(async () => {
    await quien();
    const { data, error } = await createAdmin().from("documents").update({ usar_en_ia: usar }).eq("id", docId).select("cliente_id").maybeSingle();
    if (error || !data) return { error: error?.message ?? "No encontré el documento." };
    revalidar(String(data.cliente_id));
    return { ok: true as const };
  });
}

export async function borrarDocumentoCampana(docId: string) {
  return envolver(async () => {
    await quien();
    const admin = createAdmin();
    const { data } = await admin.from("documents").select("cliente_id, storage_path").eq("id", docId).not("entregable", "is", null).maybeSingle();
    if (!data) return { error: "No encontré el documento." };
    const { error } = await admin.from("documents").delete().eq("id", docId);
    if (error) return { error: error.message };
    if (data.storage_path) await admin.storage.from("documents").remove([String(data.storage_path)]);
    revalidar(String(data.cliente_id));
    return { ok: true as const };
  });
}

export async function linkDocumento(docId: string) {
  return envolver(async () => {
    await quien();
    const admin = createAdmin();
    const { data } = await admin.from("documents").select("storage_path").eq("id", docId).maybeSingle();
    if (!data?.storage_path) return { error: "No encontré el archivo." };
    const { data: s, error } = await admin.storage.from("documents").createSignedUrl(String(data.storage_path), 600);
    if (error || !s) return { error: error?.message ?? "No se pudo abrir." };
    return { ok: true as const, url: s.signedUrl };
  });
}

export interface DefinicionInput {
  identidad: string;
  tono: string;
  medios: Record<string, NivelMedio>;
  urgencia: Urgencia | null;
  objetivo: string;
}

export async function guardarDefinicion(clienteId: string, d: DefinicionInput) {
  return envolver(async () => {
    const me = await quien();
    if (d.urgencia && !(d.urgencia in URGENCIAS)) return { error: "Urgencia inválida." };
    const medios = Object.fromEntries(
      MEDIOS.map((m) => [m.clave, d.medios[m.clave]]).filter(([, v]) => v && ["alta", "media", "baja", "no"].includes(v as string))
    );
    const { error } = await createAdmin()
      .from("client_onboarding")
      .upsert(
        {
          cliente_id: clienteId,
          dc_identidad: d.identidad.trim() || null,
          dc_tono: d.tono.trim() || null,
          dc_medios: medios,
          dc_urgencia: d.urgencia,
          dc_objetivo: d.objetivo.trim() || null,
          dc_actualizado_at: new Date().toISOString(),
          dc_actualizado_por: me.id,
        },
        { onConflict: "cliente_id" }
      );
    if (error) return { error: error.message };
    revalidar(clienteId);
    return { ok: true as const };
  });
}
