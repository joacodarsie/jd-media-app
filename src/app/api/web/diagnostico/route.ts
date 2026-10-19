import { NextResponse } from "next/server";
import { createHash } from "crypto";
import { createAdmin } from "@/lib/supabase/admin";
import { corsHeaders } from "@/lib/web/cors";
import { diagnosticar, usuarioDe } from "@/lib/diagnostico/puntaje";
import { tareaSeguimientoDiagnostico } from "@/lib/comercial/seguimiento-diagnostico";
import { perfilPublico, CuentaNoDisponible } from "@/lib/diagnostico/instagram-publico";

export const dynamic = "force-dynamic";

/**
 * Diagnóstico gratis de Instagram para jdmedia.com.ar (17/10/2026). La persona
 * pone su @ y recibe un puntaje con 3 mejoras. Sin IA: no cuesta nada por
 * consulta. Topes: la misma cuenta se sirve de caché 24 h, 8 diagnósticos por
 * persona por día y 150 por hora en total (Meta permite ~200). Cada cuenta
 * diagnosticada entra como contacto en Comercial.
 */
const POR_PERSONA_DIA = 8;
const TOTAL_HORA = 150;

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req.headers.get("origin")) });
}

type Fila = { resultado: unknown };

export async function GET(req: Request) {
  const headers = corsHeaders(req.headers.get("origin"));
  const responder = (body: unknown, status = 200) => NextResponse.json(body, { status, headers });
  const usuario = usuarioDe(new URL(req.url).searchParams.get("u") ?? "");
  if (!usuario) return responder({ ok: false, motivo: "usuario", mensaje: "Escribí tu usuario de Instagram, por ejemplo @tumarca." }, 400);

  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "sin-ip";
  const ipHash = createHash("sha256").update(`jdm-diag:${ip}`).digest("hex").slice(0, 32);
  const admin = createAdmin();
  const hace = (ms: number) => new Date(Date.now() - ms).toISOString();

  // La tabla puede no existir todavía: en ese caso se sigue sin caché ni topes.
  let hayTabla = true;
  try {
    const { data: cache, error } = await admin
      .from("diagnosticos_web")
      .select("resultado")
      .eq("usuario", usuario)
      .eq("ok", true)
      .gte("created_at", hace(86_400_000))
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    if (cache) return responder((cache as Fila).resultado);

    const [{ count: mios }, { count: total }] = await Promise.all([
      admin.from("diagnosticos_web").select("id", { count: "exact", head: true }).eq("ip_hash", ipHash).gte("created_at", hace(86_400_000)),
      admin.from("diagnosticos_web").select("id", { count: "exact", head: true }).gte("created_at", hace(3_600_000)),
    ]);
    if ((mios ?? 0) >= POR_PERSONA_DIA)
      return responder({ ok: false, motivo: "limite", mensaje: "Ya hiciste varios diagnósticos hoy. Escribinos y lo vemos juntos." }, 429);
    if ((total ?? 0) >= TOTAL_HORA)
      return responder({ ok: false, motivo: "ocupado", mensaje: "Hay muchos diagnósticos en curso. Probá en unos minutos o escribinos." }, 503);
  } catch {
    hayTabla = false;
  }

  const guardar = async (ok: boolean, puntaje: number | null, resultado: unknown) => {
    if (!hayTabla) return;
    await admin.from("diagnosticos_web").insert({ usuario, ip_hash: ipHash, ok, puntaje, resultado });
  };

  const { data: base } = await admin
    .from("clients")
    .select("ig_user_id")
    .not("ig_user_id", "is", null)
    .ilike("nombre", "jd media")
    .limit(1)
    .maybeSingle();
  const desde = (base as { ig_user_id: string } | null)?.ig_user_id;
  if (!desde) return responder({ ok: false, motivo: "error", mensaje: "El diagnóstico no está disponible ahora. Escribinos y lo hacemos a mano." }, 503);

  try {
    const perfil = await perfilPublico(desde, usuario);
    const diagnostico = diagnosticar(perfil);
    const { posts: _posts, ...resto } = perfil;
    void _posts;
    const resultado = { ok: true, perfil: resto, diagnostico };
    await guardar(true, diagnostico.puntaje, resultado);
    const nuevo = await registrarContacto(admin, perfil.usuario, perfil.nombre, diagnostico.puntaje);
    if (nuevo) await tareaParaComercial(admin, perfil.usuario, perfil.nombre, diagnostico.puntaje, diagnostico.mejoras);
    return responder(resultado);
  } catch (e) {
    if (e instanceof CuentaNoDisponible) {
      await guardar(false, null, null);
      return responder({
        ok: false,
        motivo: "no_disponible",
        mensaje: `No pudimos leer @${usuario}. El diagnóstico funciona con cuentas de empresa o creador que sean públicas.`,
      });
    }
    return responder({ ok: false, motivo: "error", mensaje: "No pudimos hacer el diagnóstico ahora. Probá de nuevo en un rato." }, 502);
  }
}

/** La cuenta diagnosticada entra como contacto en Comercial (sin duplicar). */
async function registrarContacto(admin: ReturnType<typeof createAdmin>, usuario: string, nombre: string | null, puntaje: number): Promise<boolean> {
  try {
    const hoy = new Date().toLocaleDateString("es-AR", { timeZone: "America/Argentina/Cordoba" });
    const linea = `${hoy}: pidió el diagnóstico de Instagram en la web (${puntaje}/100). Puede no ser el dueño de la cuenta.`;
    const etiqueta = `@${usuario}`;
    const { data: existe } = await admin.from("leads").select("id, notas").eq("nombre", etiqueta).eq("origen", "web").limit(1).maybeSingle();
    if (existe) {
      const notas = (existe as { notas: string | null }).notas ?? "";
      if (notas.includes(`${hoy}: pidió el diagnóstico`)) return false;
      await admin.from("leads").update({ notas: [notas, linea].filter(Boolean).join("\n") }).eq("id", (existe as { id: string }).id);
      return false;
    }
    await admin.from("leads").insert({ nombre: etiqueta, empresa: nombre, origen: "web", notas: linea });
    return true;
  } catch {
    // Que falle el registro no frena el diagnóstico.
    return false;
  }
}

/**
 * Contacto nuevo del diagnóstico → tarea para comercial con lo que le falta y
 * el mensaje listo (19/10/2026). No a las cuentas que ya son clientes.
 */
async function tareaParaComercial(
  admin: ReturnType<typeof createAdmin>,
  usuario: string,
  nombre: string | null,
  puntaje: number,
  mejoras: string[]
) {
  try {
    const { data: cliente } = await admin.from("clients").select("id").ilike("ig_username", usuario).limit(1);
    if (cliente?.length) return;
    const clave = `diag-web:${usuario.toLowerCase()}`;
    const { data: ya } = await admin.from("tasks").select("id").eq("rutina_key", clave).limit(1);
    if (ya?.length) return;
    const { data: us } = await admin.from("users").select("id, rol, rol_secundario, area").eq("activo", true);
    const lista = (us ?? []) as { id: string; rol: string; rol_secundario: string | null; area: string | null }[];
    const quien =
      lista.find((u) => u.area === "Comercial" && u.rol === "coordinador") ??
      lista.find((u) => u.rol === "comercial" || u.rol_secundario === "comercial") ??
      lista.find((u) => u.rol === "admin");
    if (!quien) return;
    const t = tareaSeguimientoDiagnostico({ usuario, nombre, puntaje, mejoras });
    const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Cordoba" });
    await admin.from("tasks").insert({
      titulo: t.titulo,
      descripcion: t.descripcion,
      asignado_a_id: quien.id,
      creado_por_id: quien.id,
      area: "Comercial",
      prioridad: "alta",
      estado: "pendiente",
      fecha_limite: hoy,
      rutina_key: clave,
    });
  } catch {
    // Que falle no frena el diagnóstico.
  }
}
