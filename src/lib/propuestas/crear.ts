/**
 * El alta de una propuesta en la base. Lo usan la acción del formulario de
 * Prospección y el armador con IA de Comercial (que corre en una ruta, no en
 * una server action), así que no depende de la sesión ni de los headers: el
 * que llama ya validó quién es.
 */

import { normalizarExtras } from "./extras";
import { detectarRubro, rubroPorSlug } from "./rubros";
import { nuevoToken } from "./build";
import type { CuentaPropuesta } from "./inversion";
import { createAdmin } from "@/lib/supabase/admin";

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
  /** Sitio del prospecto: le da contexto real a la IA. */
  sitioWeb?: string | null;
  /** Su Instagram, que para estos rubros dice más que la web. */
  instagram?: string | null;
  /** Ciudad: define si las jornadas de producción llevan traslado. */
  ciudad?: string | null;
  /** Una entrada por cuenta a llevar: {handle, packSlug, nota} y, si es a medida, su volumen y precio. */
  cuentas?: CuentaPropuesta[] | null;
  /** Descuento mensual por llevar varias cuentas. Se ignora si hay una sola. */
  descuentoMonto?: number | null;
  /** Desde cuándo arranca, para el proporcional del primer mes. */
  fechaInicio?: string | null;
  /** Descripción del negocio y transcripción: lo que la IA usa para escribir. */
  contexto?: string | null;
  /** Extras que se suman al pack, con su precio (0185). */
  extras?: { slug: string; precio: number }[] | null;
}

export async function insertarPropuesta(
  input: CrearPropuestaInput,
  creadaPorId: string,
): Promise<{ id: string; token: string } | { error: string }> {

  const empresa = input.empresa?.trim();
  if (!empresa) return { error: "Falta el nombre de la empresa." };

  const ficha = input.rubroSlug ? rubroPorSlug(input.rubroSlug) : detectarRubro(input.rubroTexto);
  const token = nuevoToken();

  const entero = (v: unknown) =>
    typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.round(v) : undefined;
  const cuentas = (input.cuentas ?? [])
    .map((c) => {
      const aMedida = {
        nombre: c.nombre?.trim()?.slice(0, 60) || undefined,
        precio: entero(c.precio),
        reels: entero(c.reels),
        posts: entero(c.posts),
        dias_historias: entero(c.dias_historias),
      };
      return {
        handle: (c.handle ?? "").trim().slice(0, 80),
        packSlug: (c.packSlug ?? "").trim(),
        nota: c.nota?.trim()?.slice(0, 240) || null,
        // Solo lo que vino: el jsonb no se llena de nulls.
        ...Object.fromEntries(Object.entries(aMedida).filter(([, v]) => v !== undefined)),
      };
    })
    .filter((c) => c.handle && c.packSlug);

  const nuevas = {
    ciudad: input.ciudad?.trim()?.slice(0, 120) || null,
    cuentas: cuentas.length ? cuentas : null,
    descuento_monto: Math.max(0, Math.round(input.descuentoMonto ?? 0)),
    fecha_inicio: /^\d{4}-\d{2}-\d{2}$/.test(input.fechaInicio ?? "") ? input.fechaInicio : null,
    contexto: input.contexto?.trim()?.slice(0, 60000) || null,
  };

  const base = {
      token,
      empresa: empresa.slice(0, 160),
      contacto_nombre: input.contactoNombre?.trim()?.slice(0, 120) || null,
      rubro_slug: ficha.slug,
      rubro_texto: input.rubroTexto?.trim()?.slice(0, 300) || null,
      sitio_web: input.sitioWeb?.trim()?.slice(0, 300) || null,
      instagram: input.instagram?.trim()?.slice(0, 120) || null,
      pack_sugerido: input.packSugerido || ficha.pack,
      servicios: ficha.servicios,
      contacto_id: input.contactoId || null,
      campaign_id: input.campaignId || null,
      creada_por_id: creadaPorId,
  };

  const extras = normalizarExtras(input.extras);
  const admin = createAdmin();

  // Los packs con los precios de HOY: lo que se le manda al cliente no cambia
  // aunque después se actualice la lista de precios (0226).
  const { data: packsHoy } = await admin
    .from("agency_packs")
    .select("slug, nombre, precio_mensual, descripcion, reels, posts, dias_historias, orden")
    .order("orden");
  const congelados = packsHoy?.length ? { packs_snapshot: packsHoy } : {};

  let { data, error } = await admin
    .from("proposals")
    .insert({ ...base, ...nuevas, ...congelados, ...(extras.length ? { extras } : {}) })
    .select("id, token")
    .single();

  // Sin la 0226 todavía: se crea igual, con los precios en vivo como antes.
  if (error?.code === "42703" && Object.keys(congelados).length) {
    ({ data, error } = await admin
      .from("proposals")
      .insert({ ...base, ...nuevas, ...(extras.length ? { extras } : {}) })
      .select("id, token")
      .single());
  }

  // 42703 = columna inexistente: la 0159 todavía no se aplicó. La propuesta se
  // crea igual con los campos de siempre.
  if (error?.code === "42703") {
    ({ data, error } = await admin.from("proposals").insert(base).select("id, token").single());
  }

  if (error || !data) {
    return {
      error:
        error?.code === "42P01"
          ? "Falta aplicar la migración 0153 en Supabase."
          : error?.message ?? "No se pudo crear la propuesta.",
    };
  }

  return { id: data.id as string, token: data.token as string };
}
