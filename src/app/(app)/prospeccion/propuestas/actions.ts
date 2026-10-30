"use server";

import { normalizarExtras } from "@/lib/propuestas/extras";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createAdmin } from "@/lib/supabase/admin";
import { requireUser, userInRoles } from "@/lib/auth";
import { rubroPorSlug } from "@/lib/propuestas/rubros";
import { urlPropuesta } from "@/lib/propuestas/build";
import type { CuentaPropuesta } from "@/lib/propuestas/inversion";
import { insertarPropuesta, type CrearPropuestaInput } from "@/lib/propuestas/crear";

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

export async function crearPropuesta(input: CrearPropuestaInput) {
  const g = await gate();
  if ("error" in g) return g;
  const r = await insertarPropuesta(input, g.me.id);
  if ("error" in r) return r;
  revalidatePath("/prospeccion/propuestas");
  return { ok: true as const, id: r.id, url: urlPropuesta(origen(), r.token) };
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
    .select("id, empresa, contacto_nombre, campaign_id, instagram, sitio_web")
    .eq("id", contactoId)
    .maybeSingle();
  if (!c) return { error: "No encontré ese contacto." };
  const contacto = c as {
    id: string;
    empresa: string;
    contacto_nombre: string | null;
    campaign_id: string | null;
    instagram: string | null;
    sitio_web: string | null;
  };

  let rubroTexto: string | null = null;
  let ciudad: string | null = null;
  if (contacto.campaign_id) {
    const { data: camp } = await admin
      .from("prospecting_campaigns")
      .select("rubro, ubicacion")
      .eq("id", contacto.campaign_id)
      .maybeSingle();
    const cp = camp as { rubro: string | null; ubicacion: string | null } | null;
    rubroTexto = cp?.rubro ?? null;
    ciudad = cp?.ubicacion ?? null;
  }

  // Con su Instagram y su web la IA puede buscarlo y escribir algo propio
  // (propuesta en frío, 24/9). Sin eso quedaba el texto genérico del rubro.
  const ig = contacto.instagram ? `@${contacto.instagram.replace(/^@/, "")}` : null;
  const r = await crearPropuesta({
    empresa: contacto.empresa,
    contactoNombre: contacto.contacto_nombre,
    rubroTexto,
    contactoId: contacto.id,
    campaignId: contacto.campaign_id,
    instagram: ig,
    sitioWeb: contacto.sitio_web,
    ciudad,
  });
  return "ok" in r ? { ...r, nueva: true as const } : r;
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

/**
 * Guarda el texto editado a mano. Escribe en el MISMO `ia` jsonb que usa el
 * botón de IA: el documento no puede tener dos fuentes de verdad, y así lo que
 * la IA propuso se puede corregir arriba en vez de empezar de cero.
 * Un campo vacío vuelve al texto del rubro.
 */
export async function guardarTextoPropuesta(
  id: string,
  texto: {
    titular?: string;
    diagnostico?: string;
    puntos?: string[];
    ideas?: string[];
    valor?: string;
    frio?: boolean;
    ocultas?: string[];
  },
) {
  const g = await gate();
  if ("error" in g) return g;

  const limpiarLista = (xs?: string[]) =>
    (xs ?? []).map((x) => x.trim()).filter(Boolean).slice(0, 8).map((x) => x.slice(0, 400));

  const ia = {
    titular: texto.titular?.trim().slice(0, 160) || null,
    diagnostico: texto.diagnostico?.trim().slice(0, 1500) || null,
    puntos: limpiarLista(texto.puntos),
    ideas: limpiarLista(texto.ideas),
    generado_at: new Date().toISOString(),
    editado_a_mano: true,
    frio: !!texto.frio,
    valor: texto.valor?.trim().slice(0, 900) || null,
    ocultas: (texto.ocultas ?? []).filter((x) => typeof x === "string").slice(0, 10),
  };

  // Todo vacío = volver al texto del rubro, sin dejar un jsonb fantasma.
  const vacio =
    !ia.titular &&
    !ia.diagnostico &&
    ia.puntos.length === 0 &&
    ia.ideas.length === 0 &&
    !ia.valor &&
    ia.ocultas.length === 0;

  const { error } = await createAdmin()
    .from("proposals")
    .update({ ia: vacio ? null : ia, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/prospeccion/propuestas");
  return { ok: true as const };
}

/**
 * El pack y los extras desde "Editar" en la propia propuesta (24/9): la que
 * sale desde el contacto se crea con el pack del rubro y sin extras.
 */
export async function ajustarPropuesta(
  id: string,
  patch: { packSlug?: string | null; extras?: { slug: string; precio: number }[] | null },
) {
  const g = await gate();
  if ("error" in g) return g;
  const admin = createAdmin();
  const { data } = await admin
    .from("proposals")
    .select("empresa, instagram, cuentas")
    .eq("id", id)
    .maybeSingle();
  if (!data) return { error: "No existe esa propuesta." };
  const row = data as {
    empresa: string;
    instagram: string | null;
    cuentas: CuentaPropuesta[] | null;
  };

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (patch.packSlug) {
    const cuentas = row.cuentas?.length
      ? row.cuentas
      : [{ handle: row.instagram?.trim() || row.empresa, packSlug: patch.packSlug, nota: null }];
    // Con una sola cuenta el pack se cambia acá; con varias, desde el formulario.
    // Elegir un pack de lista saca lo que estaba a medida (volumen y precio).
    // El editor manda el pack en cada guardado: si es el mismo, queda como está.
    if (cuentas.length === 1 && cuentas[0].packSlug !== patch.packSlug)
      cuentas[0] = { handle: cuentas[0].handle, packSlug: patch.packSlug, nota: cuentas[0].nota ?? null };
    update.cuentas = cuentas;
    update.pack_sugerido = patch.packSlug;
  }
  if (patch.extras !== undefined) {
    const x = normalizarExtras(patch.extras);
    update.extras = x.length ? x : null;
  }
  const { error } = await admin.from("proposals").update(update).eq("id", id);
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
