/**
 * Aplica el plan de sincronización del catálogo de servicios contra la base.
 *
 * Separado de `sync-web-servicios.ts` a propósito: ahí vive la lectura de la
 * web y la comparación (puro, testeable); acá la escritura.
 */

import { createAdmin } from "@/lib/supabase/admin";
import {
  leerServiciosDeLaWeb,
  planificarSync,
  type PlanDeCambios,
  type ServicioApp,
} from "./sync-web-servicios";
import { leerPacksDeLaWeb } from "./packs-web";

export interface ResultadoSync {
  ok: boolean;
  detectados: number;
  creados: number;
  actualizados: number;
  noEnWeb: string[];
  /** Para mostrarle al usuario qué cambió, en criollo. */
  cambios: string[];
  error?: string;
}

export async function sincronizarServiciosConLaWeb(
  origen: "cron" | "manual"
): Promise<ResultadoSync> {
  const admin = createAdmin();

  const fallar = async (error: string): Promise<ResultadoSync> => {
    await admin.from("services_sync_log").insert({
      origen,
      ok: false,
      error: error.slice(0, 500),
    });
    return {
      ok: false,
      detectados: 0,
      creados: 0,
      actualizados: 0,
      noEnWeb: [],
      cambios: [],
      error,
    };
  };

  let enWeb;
  try {
    enWeb = await leerServiciosDeLaWeb();
  } catch (e) {
    return fallar(e instanceof Error ? e.message : "No se pudo leer la web.");
  }
  if (enWeb.length === 0) {
    return fallar("La web no devolvió servicios. No se tocó el catálogo.");
  }

  const { data: appData, error: readErr } = await admin
    .from("services")
    .select("slug, name, description, active");
  if (readErr) return fallar(`No se pudo leer el catálogo: ${readErr.message}`);

  const enApp = (appData ?? []) as ServicioApp[];
  const plan = planificarSync(enApp, enWeb);

  const ahora = new Date().toISOString();
  const cambios: string[] = [];

  // 1) Nuevos servicios de la web.
  for (const s of plan.crear) {
    const { error } = await admin.from("services").insert({
      slug: s.slug,
      name: s.nombre,
      description: s.descripcion,
      active: true,
      orden: 99,
      web_url: s.url,
      web_synced_at: ahora,
      web_sync_estado: "nuevo_de_web",
    });
    if (error) {
      console.error("[sync-servicios] insert", s.slug, error.message);
      continue;
    }
    cambios.push(`Nuevo servicio desde la web: ${s.nombre}`);
  }

  // 2) Actualizaciones de nombre/descripción.
  for (const u of plan.actualizar) {
    const { error } = await admin
      .from("services")
      .update({
        name: u.nombre,
        description: u.descripcion,
        // Guardamos la anterior por si el copy nuevo queda peor para los prompts.
        description_prev: u.antes.description,
        web_synced_at: ahora,
        web_sync_estado: "ok",
      })
      .eq("slug", u.slug);
    if (error) {
      console.error("[sync-servicios] update", u.slug, error.message);
      continue;
    }
    if (u.antes.name !== u.nombre) {
      cambios.push(`"${u.antes.name}" ahora se llama "${u.nombre}"`);
    } else {
      cambios.push(`Se actualizó la descripción de ${u.nombre}`);
    }
  }

  // 3) Los que coinciden: solo dejamos constancia de que se miraron.
  if (plan.sinCambios.length > 0) {
    await admin
      .from("services")
      .update({ web_synced_at: ahora, web_sync_estado: "ok" })
      .in("slug", plan.sinCambios);
  }

  // 4) Los que ya no están en la web: SE MARCAN, no se borran ni desactivan.
  //    Borrarlos dejaría clientes con un servicio contratado inexistente.
  if (plan.noEnWeb.length > 0) {
    await admin
      .from("services")
      .update({ web_synced_at: ahora, web_sync_estado: "no_en_web" })
      .in("slug", plan.noEnWeb);
    for (const slug of plan.noEnWeb) {
      cambios.push(`"${slug}" ya no aparece en la web — revisalo a mano`);
    }
  }

  // 5) Los packs de gestión de redes con sus precios. Va en la misma corrida
  //    porque es la misma fuente y el mismo motivo: que lo que cotizamos sea lo
  //    que publicamos. Si falla, no invalida la sincronización de servicios.
  try {
    const packs = await leerPacksDeLaWeb();
    for (const p of packs) {
      const { data: antes } = await admin
        .from("agency_packs")
        .select("precio_mensual")
        .eq("slug", p.slug)
        .maybeSingle();

      const { error } = await admin.from("agency_packs").upsert(
        {
          slug: p.slug,
          nombre: p.nombre,
          precio_mensual: p.precio_mensual,
          descripcion: p.descripcion,
          reels: p.reels,
          posts: p.posts,
          dias_historias: p.dias_historias,
          orden: p.orden,
          web_synced_at: ahora,
          updated_at: ahora,
        },
        { onConflict: "slug" }
      );
      if (error) {
        console.error("[sync-servicios] pack", p.slug, error.message);
        continue;
      }

      const precioAntes = (antes as { precio_mensual: number | null } | null)
        ?.precio_mensual;
      if (
        precioAntes !== undefined &&
        Number(precioAntes) !== Number(p.precio_mensual) &&
        p.precio_mensual !== null
      ) {
        cambios.push(
          `Pack ${p.nombre}: $${Number(precioAntes ?? 0).toLocaleString("es-AR")} → $${p.precio_mensual.toLocaleString("es-AR")}`
        );
      }
    }
  } catch (e) {
    console.error("[sync-servicios] packs", e);
    cambios.push(
      `No se pudieron leer los packs de la web (${e instanceof Error ? e.message : "error"}). Los precios quedaron como estaban.`
    );
  }

  const resultado: ResultadoSync = {
    ok: true,
    detectados: enWeb.length,
    creados: plan.crear.length,
    actualizados: plan.actualizar.length,
    noEnWeb: plan.noEnWeb,
    cambios,
  };

  await admin.from("services_sync_log").insert({
    origen,
    ok: true,
    detectados: resultado.detectados,
    creados: resultado.creados,
    actualizados: resultado.actualizados,
    no_en_web: plan.noEnWeb.length,
    detalle: { cambios, noEnWeb: plan.noEnWeb } as unknown as Record<string, unknown>,
  });

  return resultado;
}

export type { PlanDeCambios };
