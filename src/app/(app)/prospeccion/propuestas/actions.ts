"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createAdmin } from "@/lib/supabase/admin";
import { requireUser, userInRoles } from "@/lib/auth";
import { detectarRubro, rubroPorSlug } from "@/lib/propuestas/rubros";
import { nuevoToken, urlPropuesta } from "@/lib/propuestas/build";

const PUEDEN = ["admin", "coordinador", "comercial", "prospecting"];

async function gate() {
  const me = await requireUser();
  if (!userInRoles(me, PUEDEN))
    return { error: "Solo el equipo comercial puede armar propuestas." as const };
  return { me };
}

/** El origen real desde donde se está usando la app (dominio propio o vercel). */
function origen(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export interface CrearPropuestaInput {
  empresa: string;
  contactoNombre?: string | null;
  /** Texto libre del rubro (el de la campaña). Se usa para elegir la ficha. */
  rubroTexto?: string | null;
  /** Ficha elegida a mano; si viene, gana sobre la detección. */
  rubroSlug?: string | null;
  packSugerido?: string | null;
  contactoId?: string | null;
  campaignId?: string | null;
}

export async function crearPropuesta(input: CrearPropuestaInput) {
  const g = await gate();
  if ("error" in g) return g;

  const empresa = input.empresa?.trim();
  if (!empresa) return { error: "Falta el nombre de la empresa." };

  const ficha = input.rubroSlug ? rubroPorSlug(input.rubroSlug) : detectarRubro(input.rubroTexto);
  const token = nuevoToken();

  const { data, error } = await createAdmin()
    .from("proposals")
    .insert({
      token,
      empresa: empresa.slice(0, 160),
      contacto_nombre: input.contactoNombre?.trim()?.slice(0, 120) || null,
      rubro_slug: ficha.slug,
      rubro_texto: input.rubroTexto?.trim()?.slice(0, 300) || null,
      pack_sugerido: input.packSugerido || ficha.pack,
      servicios: ficha.servicios,
      contacto_id: input.contactoId || null,
      campaign_id: input.campaignId || null,
      creada_por_id: g.me.id,
    })
    .select("id, token")
    .single();

  if (error) {
    return {
      error:
        error.code === "42P01"
          ? "Falta aplicar la migración 0153 en Supabase."
          : error.message,
    };
  }

  revalidatePath("/prospeccion/propuestas");
  return { ok: true as const, id: data.id, url: urlPropuesta(origen(), data.token) };
}

/**
 * Propuesta para un contacto de prospección: saca la empresa, la persona y el
 * rubro de la campaña. Si ya tiene una, devuelve la misma (no duplica links).
 */
export async function propuestaParaContacto(contactoId: string) {
  const g = await gate();
  if ("error" in g) return g;
  const admin = createAdmin();

  const { data: yaHay } = await admin
    .from("proposals")
    .select("id, token")
    .eq("contacto_id", contactoId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (yaHay) {
    return {
      ok: true as const,
      id: (yaHay as { id: string }).id,
      url: urlPropuesta(origen(), (yaHay as { token: string }).token),
      yaExistia: true,
    };
  }

  const { data: c } = await admin
    .from("prospecting_contacts")
    .select("id, empresa, contacto_nombre, campaign_id")
    .eq("id", contactoId)
    .maybeSingle();
  if (!c) return { error: "No encontré ese contacto." };
  const contacto = c as {
    id: string;
    empresa: string;
    contacto_nombre: string | null;
    campaign_id: string | null;
  };

  let rubroTexto: string | null = null;
  if (contacto.campaign_id) {
    const { data: camp } = await admin
      .from("prospecting_campaigns")
      .select("rubro")
      .eq("id", contacto.campaign_id)
      .maybeSingle();
    rubroTexto = (camp as { rubro: string | null } | null)?.rubro ?? null;
  }

  return crearPropuesta({
    empresa: contacto.empresa,
    contactoNombre: contacto.contacto_nombre,
    rubroTexto,
    contactoId: contacto.id,
    campaignId: contacto.campaign_id,
  });
}

export async function actualizarPropuesta(
  id: string,
  patch: { rubroSlug?: string; packSugerido?: string },
) {
  const g = await gate();
  if ("error" in g) return g;
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.rubroSlug) {
    const ficha = rubroPorSlug(patch.rubroSlug);
    update.rubro_slug = ficha.slug;
    update.servicios = ficha.servicios;
    update.pack_sugerido = patch.packSugerido ?? ficha.pack;
  }
  if (patch.packSugerido) update.pack_sugerido = patch.packSugerido;

  const { error } = await createAdmin().from("proposals").update(update).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/prospeccion/propuestas");
  return { ok: true as const };
}

/** Saca el bloque de la IA y vuelve al texto del rubro. */
export async function quitarPersonalizacion(id: string) {
  const g = await gate();
  if ("error" in g) return g;
  const { error } = await createAdmin()
    .from("proposals")
    .update({ ia: null, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/prospeccion/propuestas");
  return { ok: true as const };
}

export async function borrarPropuesta(id: string) {
  const g = await gate();
  if ("error" in g) return g;
  const { error } = await createAdmin().from("proposals").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/prospeccion/propuestas");
  return { ok: true as const };
}
