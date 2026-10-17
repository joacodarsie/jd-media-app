/**
 * Saca las fotos que faltan de cada cuenta (17/10/2026). Lo corre el cron
 * diario; cada cuenta pide como mucho 2 fotos y se procesan pocas por corrida
 * para no pasar el tope de Meta (~200 consultas por hora).
 *
 * Las imágenes se copian al bucket público `cuenta-fotos`: los links de
 * Instagram vencen a los pocos días y el antes tiene que durar para siempre.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { usuarioDe } from "@/lib/diagnostico/puntaje";
import { cuentaConHistorial, CuentaNoDisponible } from "@/lib/diagnostico/instagram-publico";
import { fotosQueFaltan, metricasAFecha, puntajeDeHoy, type FotoExistente } from "./foto";

export interface ResultadoFotos {
  procesadas: { cliente: string; fotos: string[] }[];
  sinCuenta: string[];
  noDisponibles: string[];
  errores: { cliente: string; error: string }[];
}

function hoyCordoba(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Cordoba" });
}

async function copiarImagen(admin: SupabaseClient, url: string, ruta: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return null;
    const tipo = res.headers.get("content-type") ?? "image/jpeg";
    const buf = Buffer.from(await res.arrayBuffer());
    const { error } = await admin.storage.from("cuenta-fotos").upload(ruta, buf, { contentType: tipo, upsert: true });
    if (error) return null;
    return admin.storage.from("cuenta-fotos").getPublicUrl(ruta).data.publicUrl;
  } catch {
    return null;
  }
}

export async function sacarFotosCuentas(
  admin: SupabaseClient,
  opciones: { limite?: number; clienteId?: string } = {}
): Promise<ResultadoFotos> {
  const limite = opciones.limite ?? 4;
  const hoy = hoyCordoba();
  const r: ResultadoFotos = { procesadas: [], sinCuenta: [], noDisponibles: [], errores: [] };

  const { data: base } = await admin
    .from("clients")
    .select("ig_user_id")
    .not("ig_user_id", "is", null)
    .ilike("nombre", "jd media")
    .limit(1)
    .maybeSingle();
  const desde = (base as { ig_user_id: string } | null)?.ig_user_id;
  if (!desde) return r;

  let q = admin.from("clients").select("id, nombre, instagram_url, fecha_inicio").eq("estado", "activo");
  if (opciones.clienteId) q = q.eq("id", opciones.clienteId);
  const { data: clientes } = await q;
  const { data: fotos } = await admin.from("cuenta_fotos").select("client_id, tipo, fecha");
  const porCliente = new Map<string, FotoExistente[]>();
  for (const f of (fotos ?? []) as { client_id: string; tipo: "inicio" | "mensual"; fecha: string }[]) {
    porCliente.set(f.client_id, [...(porCliente.get(f.client_id) ?? []), { tipo: f.tipo, fecha: f.fecha }]);
  }

  // Primero las que todavía no tienen ninguna foto.
  const lista = ((clientes ?? []) as { id: string; nombre: string; instagram_url: string | null; fecha_inicio: string | null }[])
    .sort((a, b) => (porCliente.has(a.id) ? 1 : 0) - (porCliente.has(b.id) ? 1 : 0));

  let hechas = 0;
  for (const c of lista) {
    if (hechas >= limite) break;
    const usuario = c.instagram_url ? usuarioDe(c.instagram_url) : null;
    if (!usuario) { r.sinCuenta.push(c.nombre); continue; }
    const pedir = fotosQueFaltan(porCliente.get(c.id) ?? [], hoy, c.fecha_inicio);
    if (!pedir.length) continue;
    hechas += 1;

    try {
      const reconstruir = pedir.find((p) => !p.real);
      const cuenta = await cuentaConHistorial(desde, usuario, { hasta: reconstruir?.fecha ?? null, paginasMax: 6 });
      const sacadas: string[] = [];
      for (const p of pedir) {
        // Si no se llegó a ver lo publicado antes del arranque, ese inicio no se inventa.
        if (!p.real && !cuenta.completo) continue;
        const m = metricasAFecha(cuenta.historial, p.fecha);
        const grilla = [];
        for (let i = 0; i < m.grilla.length; i++) {
          const g = m.grilla[i];
          const img = await copiarImagen(admin, g.imagen, `${c.id}/${p.fecha}-${p.tipo}/${i}.jpg`);
          if (img) grilla.push({ img, permalink: g.permalink, tipo: g.tipo, fecha: g.fecha });
        }
        const puntaje = p.real ? puntajeDeHoy(cuenta, cuenta.historial, p.fecha) : null;
        const { error } = await admin.from("cuenta_fotos").upsert(
          {
            client_id: c.id,
            tipo: p.tipo,
            fecha: p.fecha,
            real: p.real,
            usuario: cuenta.usuario,
            seguidores: p.real ? cuenta.seguidores : null,
            publicaciones: p.real ? cuenta.publicaciones : m.disponibles,
            posts_mes: m.posts_mes,
            reels: m.reels,
            interaccion: m.interaccion,
            puntaje: puntaje?.puntaje ?? null,
            pilares: puntaje?.pilares ?? null,
            grilla,
          },
          { onConflict: "client_id,tipo,fecha" }
        );
        if (error) throw new Error(error.message);
        sacadas.push(`${p.tipo} ${p.fecha}${p.real ? "" : " (reconstruida)"}`);
      }
      r.procesadas.push({ cliente: c.nombre, fotos: sacadas });
    } catch (e) {
      if (e instanceof CuentaNoDisponible) r.noDisponibles.push(c.nombre);
      else r.errores.push({ cliente: c.nombre, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return r;
}
