/**
 * Referencias de inspo automáticas (19/10/2026). Para una cuenta:
 * 1. Lo que cargó el equipo manda: si ya tiene 5 o más referencias, no se toca.
 * 2. Las cuentas que nombró el cliente en su reunión de diagnóstico (los @ de
 *    la transcripción) entran como «del cliente».
 * 3. La IA propone candidatas del rubro; cada una se VERIFICA contra Instagram
 *    (existe, es de empresa, está activa, tiene público) y quedan las de mejor
 *    interacción, como «sugeridas por IA».
 */
import Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AI_MODEL_SMART } from "@/lib/ai/models";
import { trackAiUsage } from "@/lib/ai/usage";
import { actualizarFuentes, graph, igDeJdMedia, type Fuente } from "./run";
import { elegirCandidatas, handlesDelTexto, leerRespuestaIA, promptReferencias, type Candidata } from "./sugerir";

const OBJETIVO = 6;

async function verificar(desde: string, usuario: string): Promise<Candidata | null> {
  try {
    const r = await graph<{ business_discovery?: { username: string; followers_count?: number; media?: { data?: Candidata["media"] } } }>(desde, {
      fields: `business_discovery.username(${usuario}){username,followers_count,media.limit(12){timestamp,like_count,comments_count}}`,
    });
    const bd = r.business_discovery;
    return bd ? { usuario: bd.username.toLowerCase(), seguidores: bd.followers_count ?? 0, media: bd.media?.data ?? [] } : null;
  } catch {
    return null; // no existe, es personal o privada
  }
}

async function pedirALaIA(prompt: string): Promise<string[]> {
  if (!process.env.ANTHROPIC_API_KEY) return [];
  try {
    const msg = await new Anthropic().messages.create({ model: AI_MODEL_SMART, max_tokens: 600, messages: [{ role: "user", content: prompt }] });
    void trackAiUsage({ ruta: "inspo/referencias", modelo: AI_MODEL_SMART, usage: msg.usage });
    return leerRespuestaIA(msg.content.map((b) => (b.type === "text" ? b.text : "")).join(""));
  } catch {
    return [];
  }
}

export async function autoInspo(
  admin: SupabaseClient,
  clienteId: string,
  opts: { forzar?: boolean } = {}
): Promise<{ agregadas: string[]; motivo?: string; detalle?: string }> {
  const desde = await igDeJdMedia(admin);
  if (!desde) return { agregadas: [], motivo: "La cuenta de JD Media no tiene Instagram conectado." };
  const [{ data: c }, { data: fRaw }, { data: dRaw }] = await Promise.all([
    admin.from("clients").select("nombre, rubro, notas, ig_username").eq("id", clienteId).maybeSingle(),
    admin.from("inspo_fuentes").select("valor").eq("cliente_id", clienteId),
    admin.from("client_diagnostics").select("transcript_text").eq("cliente_id", clienteId).order("created_at", { ascending: false }).limit(2),
  ]);
  const cli = c as { nombre: string; rubro: string | null; notas: string | null; ig_username: string | null } | null;
  if (!cli) return { agregadas: [], motivo: "No encontré la cuenta." };
  const ya = new Set(((fRaw ?? []) as { valor: string }[]).map((f) => f.valor));
  const propia = cli.ig_username?.replace(/^@/, "").toLowerCase() ?? null;
  if (!opts.forzar && ya.size >= 5) return { agregadas: [], motivo: "Ya tiene referencias cargadas." };
  const faltan = Math.max(0, OBJETIVO - ya.size) || (opts.forzar ? 3 : 0);
  if (!faltan) return { agregadas: [] };

  const transcript = ((dRaw ?? []) as { transcript_text: string | null }[]).map((d) => d.transcript_text ?? "").join("\n");
  const nuevas: { usuario: string; origen: "cliente" | "ia" }[] = [];
  let detalle = "";

  // 2. Las que nombró el cliente.
  for (const h of handlesDelTexto(`${transcript}\n${cli.notas ?? ""}`)) {
    if (nuevas.length >= faltan || ya.has(h) || h === propia) continue;
    const v = await verificar(desde, h);
    if (v && v.media.length) nuevas.push({ usuario: v.usuario, origen: "cliente" });
  }

  // 3. Las que propone la IA, verificadas.
  if (nuevas.length < faltan) {
    const propuestas = (await pedirALaIA(promptReferencias({ nombre: cli.nombre, rubro: cli.rubro, notas: cli.notas, ig: propia, contexto: transcript || null }))).filter(
      (u) => !ya.has(u) && u !== propia && !nuevas.some((n) => n.usuario === u)
    );
    const verificadas: Candidata[] = [];
    for (const u of propuestas.slice(0, 20)) {
      const v = await verificar(desde, u);
      if (v) verificadas.push(v);
    }
    const elegidas = elegirCandidatas(verificadas, Date.now(), faltan - nuevas.length);
    for (const v of elegidas) nuevas.push({ usuario: v.usuario, origen: "ia" });
    // Para entender qué pasó: cuántas propuso la IA, cuántas existen en Instagram y cuántas quedaron.
    detalle = `la IA propuso ${propuestas.length}, existen ${verificadas.length}, quedaron ${elegidas.length}`;
  }
  if (!nuevas.length) return { agregadas: [], motivo: `No encontramos cuentas que valgan la pena para este rubro (${detalle}).`, detalle };

  const { data: insertadas } = await admin
    .from("inspo_fuentes")
    .upsert(
      nuevas.map((n) => ({ cliente_id: clienteId, tipo: "cuenta", valor: n.usuario, origen: n.origen })),
      { onConflict: "cliente_id,tipo,valor", ignoreDuplicates: true }
    )
    .select("id, cliente_id, tipo, valor");
  await actualizarFuentes(admin, (insertadas ?? []) as Fuente[]);
  return { agregadas: nuevas.map((n) => `@${n.usuario}${n.origen === "cliente" ? " (del cliente)" : ""}`), detalle };
}

/** Cron: a las cuentas con redes que todavía no tienen ninguna referencia, de a dos por día. */
export async function runInspoAuto(admin: SupabaseClient, max = 2) {
  const [{ data: svc }, { data: con }] = await Promise.all([
    admin.from("client_services").select("cliente_id, cliente:clients(estado, es_interno)").eq("activo", true).eq("tipo", "gestion_redes"),
    admin.from("inspo_fuentes").select("cliente_id"),
  ]);
  const tienen = new Set(((con ?? []) as { cliente_id: string }[]).map((x) => x.cliente_id));
  const sin = [
    ...new Set(
      ((svc ?? []) as unknown as { cliente_id: string; cliente: { estado: string; es_interno: boolean } | null }[])
        .filter((s) => s.cliente?.estado === "activo" && !s.cliente.es_interno && !tienen.has(s.cliente_id))
        .map((s) => s.cliente_id)
    ),
  ].slice(0, max);
  const r: Record<string, string[] | string> = {};
  for (const id of sin) {
    const x = await autoInspo(admin, id);
    r[id] = x.agregadas.length ? x.agregadas : x.motivo ?? "nada";
  }
  return r;
}
