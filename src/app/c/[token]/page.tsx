import { notFound } from "next/navigation";
import { createAdmin } from "@/lib/supabase/admin";
import { igMonthlyForReport, paidMonthlyForReport } from "@/lib/social/report";
import { AGENCY } from "@/lib/agency";
import { periodLabel } from "@/lib/finanzas";
import {
  hasClientReport,
  normalizeClientReport,
} from "@/lib/monthly-diagnostics/schema";
import type { MonthlyContentPlan } from "@/lib/content-plans/schema";
import { isPlanOfPastMonth } from "@/lib/content-plans/staleness";
import { PortalReviewCard } from "@/components/portal-review-card";
import { PortalContent } from "@/components/portal-content";
import { PortalIgChart } from "@/components/portal-ig-chart";

export const dynamic = "force-dynamic";

const FORMATO_LABEL: Record<string, string> = {
  reel: "Reels",
  post: "Posts",
  carrusel: "Carruseles",
  story: "Historias",
  video_largo: "Videos",
  live: "Lives",
  otro: "Otros",
};

interface UpcomingPub {
  id: string;
  titulo: string;
  fecha_publicacion: string | null;
  red: string;
  tipo: string;
  estado: string;
  copy: string | null;
  guion: string | null;
  descripcion: string | null;
  hashtags: string | null;
  asset_url: string | null;
}

// El antes y el después de la cuenta (17/10/2026).
import { cargarCrecimiento } from "@/lib/crecimiento/cargar";
import { CrecimientoVista } from "@/components/crecimiento-vista";
import { CicloNave } from "@/components/ciclo-nave";
import { PortalAccesos } from "@/components/portal-accesos";
import { PortalMaterial } from "@/components/portal-material";
import { PortalMovimiento } from "@/components/portal-movimiento";
import { PortalDeslizar } from "@/components/portal-deslizar";
import { pedirEncuestaEnPortal } from "@/lib/retencion/encuesta-portal";
import { cargarReunionPortal } from "@/lib/retencion/reunion-autoagenda-run";
import { PortalReunion } from "@/components/portal-reunion";
import { PortalTuMes } from "@/components/portal-tu-mes";
import { PortalProduccion } from "@/components/portal-produccion";
import { PortalArranque } from "@/components/portal-arranque";
import { PortalAbono } from "@/components/portal-abono";
import { PortalPlazo } from "@/components/portal-plazo";
import { etiquetaPlazo, plazoAprobacion } from "@/lib/contenidos/aprobacion-tacita";
import { clavePago, mostrarAbono } from "@/lib/portal/tu-abono";
import { mostrarArranque, pasosArranque } from "@/lib/portal/tu-arranque";
import { lineaDeProduccion } from "@/lib/portal/produccion";
import { armarPlacas, hayTuMes, piezaEstrella } from "@/lib/portal/tu-mes";
import { SALUDO, momentoDelDia } from "@/lib/saludo-del-dia";
import { estadoDeRedes, type Credencial } from "@/lib/accesos/portal";
// Programa de referidos (13/10/2026).
import { PortalRecomendar } from "@/components/portal-recomendar";
import { labelEstado, puedeRecomendar, type EstadoReferido } from "@/lib/referidos/referidos";
import { hoyYmd } from "@/lib/dates";

export default async function PortalPage({ params }: { params: { token: string } }) {
  const admin = createAdmin();

  const { data: tokenRow } = await admin
    .from("client_portal_tokens")
    .select("id, cliente_id, revoked_at, expires_at")
    .eq("token", params.token)
    .maybeSingle();

  if (!tokenRow || tokenRow.revoked_at) return notFound();
  if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) return notFound();

  // Touch last_seen (no bloqueante si falla)
  await admin
    .from("client_portal_tokens")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", tokenRow.id);

  const cliente_id = tokenRow.cliente_id;
  const crecimiento = await cargarCrecimiento(admin, cliente_id).catch(() => null);

  // Cargar plan vigente + pubs (previas y próximas, para un calendario completo)
  const now = new Date();
  const in8Weeks = new Date(now.getTime() + 56 * 24 * 60 * 60 * 1000);
  // Mostramos también lo ya publicado de los últimos ~4 meses, así el cliente ve
  // el historial además de lo que viene.
  const ago4Months = new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000);

  const [{ data: client }, { data: plan }, { data: pubs }, { data: reviewPubs }] = await Promise.all([
    admin.from("clients").select("id, nombre, rubro, pack").eq("id", cliente_id).maybeSingle(),
    admin
      .from("client_content_plans")
      .select("periodo_label, content, approved_at")
      .eq("cliente_id", cliente_id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("publications")
      .select("id, titulo, fecha_publicacion, red, tipo, estado, copy, guion, descripcion, hashtags, asset_url")
      .eq("cliente_id", cliente_id)
      .gte("fecha_publicacion", ago4Months.toISOString())
      .lte("fecha_publicacion", in8Weeks.toISOString())
      // Mostramos todo lo planificado/publicado, salvo lo rechazado y lo que ya
      // está en la tarjeta de revisión de arriba.
      .not("estado", "in", "(rechazado,revision_cliente)")
      .order("fecha_publicacion", { ascending: true })
      .limit(120),
    admin
      .from("publications")
      .select("id, titulo, copy, guion, descripcion, red, tipo, fecha_publicacion, asset_url, cliente_revision_iniciada_at, updated_at")
      .eq("cliente_id", cliente_id)
      .eq("estado", "revision_cliente")
      .order("fecha_publicacion", { ascending: true, nullsFirst: false })
      .limit(20),
  ]);

  if (!client) return notFound();

  // Resultados del mes en curso (Instagram + paid) + lectura IA, si hay.
  const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [igM, paidM, { data: monthlyRow }, { data: igHistRaw }] = await Promise.all([
    igMonthlyForReport(admin, cliente_id, mesActual),
    paidMonthlyForReport(admin, cliente_id, mesActual),
    admin
      .from("client_monthly_reports")
      .select("ai_resultados")
      .eq("cliente_id", cliente_id)
      .eq("year_month", mesActual)
      .maybeSingle(),
    // Historial completo de seguidores para el gráfico de evolución (los
    // snapshots son 1 por día; el componente muestrea si crece mucho).
    admin
      .from("ig_snapshots")
      .select("fecha, followers")
      .eq("cliente_id", cliente_id)
      .gt("followers", 0)
      .order("fecha", { ascending: true }),
  ]);
  const aiResultados = (monthlyRow as { ai_resultados?: string | null } | null)?.ai_resultados ?? null;
  const fmtN = (n: number) => Math.round(n).toLocaleString("es-AR");
  const igCells = igM.hasData
    ? ([
        igM.followersEnd != null ? { lbl: "Seguidores", val: fmtN(igM.followersEnd) } : null,
        igM.seguidoresNuevos != null ? { lbl: "Nuevos", val: `+${fmtN(igM.seguidoresNuevos)}` } : null,
        igM.reach != null ? { lbl: "Alcance", val: fmtN(igM.reach) } : null,
        igM.interactions != null ? { lbl: "Interacciones", val: fmtN(igM.interactions) } : null,
      ].filter(Boolean) as { lbl: string; val: string }[])
    : [];
  const paidCells = paidM.hasData
    ? ([
        { lbl: "Inversión", val: `${paidM.moneda} ${fmtN(paidM.spend)}` },
        { lbl: "Conversiones", val: fmtN(paidM.conversions) },
        paidM.costPerConv != null ? { lbl: "Costo/conv", val: `${paidM.moneda} ${fmtN(paidM.costPerConv)}` } : null,
        { lbl: "Clicks", val: fmtN(paidM.clicks) },
      ].filter(Boolean) as { lbl: string; val: string }[])
    : [];
  // Último informe mensual con contenido listo para mostrar. Si la migración
  // 0148 todavía no está aplicada, la query falla en silencio y no se muestra.
  const { data: informeRows } = await admin
    .from("client_monthly_diagnostics")
    .select("periodo, client_report")
    .eq("cliente_id", cliente_id)
    .not("client_report", "is", null)
    .order("periodo", { ascending: false })
    .limit(12);
  // Los períodos que tienen informe listo, para la lista de reportes.
  const periodosConInforme = new Set(
    ((informeRows ?? []) as { periodo: string; client_report: unknown }[])
      .filter((x) => hasClientReport(x.client_report))
      .map((x) => x.periodo)
  );
  const informeRow = (informeRows ?? [])[0] as
    | { periodo: string; client_report: unknown }
    | undefined;
  const ultimoInforme =
    informeRow && hasClientReport(informeRow.client_report)
      ? {
          periodo: informeRow.periodo,
          titular: normalizeClientReport(informeRow.client_report).titular,
        }
      : null;

  const igHist = (igHistRaw ?? []) as { fecha: string; followers: number }[];
  const igDelta =
    igHist.length >= 2 ? igHist[igHist.length - 1].followers - igHist[0].followers : 0;
  const hayResultados =
    igCells.length > 0 || paidCells.length > 0 || !!aiResultados || igHist.length >= 2;

  // Un plan de un mes ya pasado ("Junio 2026" mirado en julio) confunde: el
  // cliente lo lee como lo vigente aunque el calendario de abajo ya tenga el
  // mes nuevo. Si el label nombra un mes anterior, no se muestra.
  const planContent: MonthlyContentPlan | null =
    plan?.content && !isPlanOfPastMonth(plan.periodo_label)
      ? (plan.content as MonthlyContentPlan)
      : null;
  const upcoming = (pubs ?? []) as UpcomingPub[];
  const toReview = (reviewPubs ?? []) as Array<{
    id: string;
    titulo: string;
    copy: string | null;
    guion: string | null;
    descripcion: string | null;
    red: string;
    tipo: string;
    fecha_publicacion: string | null;
    asset_url: string | null;
  }>;

  // Cadencia consolidada (red principal)
  // «Recomendanos»: solo a quien ya lleva 2 meses (ya sabe cómo trabajamos).
  // Si la migración 0198 no está, no se muestra.
  const { data: refRow } = await admin.from("clients").select("ref_code, fecha_inicio, canva_plantillas_url").eq("id", cliente_id).maybeSingle();
  const ref = refRow as { ref_code: string | null; fecha_inicio: string | null; canva_plantillas_url?: string | null } | null;
  // Qué cuentas ya cargó (sin las contraseñas: al portal nunca vuelven).
  const { data: credRow } = await admin.from("clients").select("credenciales").eq("id", cliente_id).maybeSingle();
  const estadoCuentas = estadoDeRedes(((credRow as { credenciales: Credencial[] | null } | null)?.credenciales ?? []) as Credencial[]);
  // El ciclo quincenal solo aplica a las cuentas con gestión de redes.
  const { count: conRedes } = await admin
    .from("client_services")
    .select("id", { count: "exact", head: true })
    .eq("cliente_id", cliente_id)
    .eq("activo", true)
    .eq("tipo", "gestion_redes");
  // «Tu material» (18/10/2026): mientras el arranque espera sus fotos y videos
  // (el paso del contenido crudo sigue abierto), se le piden acá.
  let material: { driveUrl: string | null; avisado: boolean } | null = null;
  const enArranque =
    !!ref?.fecha_inicio && (conRedes ?? 0) > 0 &&
    Date.now() - new Date(ref.fecha_inicio + "T12:00:00-03:00").getTime() < 30 * 86_400_000;
  if (enArranque) {
    const { data: madre } = await admin
      .from("tasks")
      .select("id")
      .eq("cliente_id", cliente_id)
      .is("parent_id", null)
      .like("titulo", "Onboarding 15 días — %")
      .neq("estado", "archivada")
      .limit(1)
      .maybeSingle();
    if (madre) {
      const { data: paso } = await admin
        .from("tasks")
        .select("estado")
        .eq("parent_id", (madre as { id: string }).id)
        .eq("titulo", "Contenido crudo ordenado en carpetas")
        .limit(1)
        .maybeSingle();
      const abierto = paso && !["completada", "archivada"].includes((paso as { estado: string }).estado);
      if (abierto) {
        const hace3 = new Date(Date.now() - 3 * 86_400_000).toISOString();
        const [{ data: drv }, { data: av }] = await Promise.all([
          admin.from("clients").select("drive_url").eq("id", cliente_id).maybeSingle(),
          admin.from("tasks").select("id").eq("cliente_id", cliente_id).like("rutina_key", "material:%").gte("created_at", hace3).limit(1),
        ]);
        material = { driveUrl: (drv as { drive_url: string | null } | null)?.drive_url ?? null, avisado: !!av?.length };
      }
    }
  }
  // La encuesta del mes, adentro del portal (19/10/2026): por WhatsApp nadie
  // la contestó nunca. Sin la tabla, no se muestra.
  const { data: encRow, error: encErr } = await admin
    .from("client_satisfaction")
    .select("id")
    .eq("cliente_id", cliente_id)
    .eq("periodo", hoyYmd().slice(0, 7))
    .maybeSingle();
  const pedirEncuesta = !encErr && pedirEncuestaEnPortal({ fechaInicio: ref?.fecha_inicio ?? null, hoy: hoyYmd(), yaRespondio: !!encRow });
  // «Tu arranque»: los 6 pasos del primer mes, para las cuentas con redes (19/10/2026).
  const arranque = await (async () => {
    if (!ref?.fecha_inicio || !(conRedes ?? 0)) return null;
    const dias = (Date.now() - Date.parse(`${ref.fecha_inicio}T12:00:00-03:00`)) / 86_400_000;
    if (dias > 45) return null;
    const [{ data: madre }, { data: mat }, { data: logo }, { count: publicadas }] = await Promise.all([
      admin.from("tasks").select("id").eq("cliente_id", cliente_id).is("parent_id", null).like("titulo", "Onboarding 15 días — %").neq("estado", "archivada").limit(1).maybeSingle(),
      admin.from("tasks").select("id").eq("cliente_id", cliente_id).like("rutina_key", "material:%").limit(1),
      admin.from("clients").select("logo_url").eq("id", cliente_id).maybeSingle(),
      admin.from("publications").select("id", { count: "exact", head: true }).eq("cliente_id", cliente_id).eq("estado", "publicado"),
    ]);
    const { data: pasosRaw } = madre
      ? await admin.from("tasks").select("titulo, estado").eq("parent_id", (madre as { id: string }).id)
      : { data: [] };
    const cerrado = (t: string) =>
      ((pasosRaw ?? []) as { titulo: string; estado: string }[]).some((x) => x.titulo === t && x.estado === "completada");
    const pasos = pasosArranque({
      accesosCompletos: !Object.values(estadoCuentas).some((e) => e === "falta"),
      materialAvisado: !!mat?.length,
      materialOrdenado: cerrado("Contenido crudo ordenado en carpetas"),
      diagnosticoHecho: cerrado("Reunión de diagnóstico"),
      calendarioAprobado: cerrado("Calendario de contenidos para aprobar") || !!plan?.approved_at,
      tieneLogo: !!(logo as { logo_url?: string | null } | null)?.logo_url,
      primeraPublicada: (publicadas ?? 0) > 0,
    });
    return mostrarArranque(ref.fecha_inicio, hoyYmd(), pasos) ? pasos : null;
  })().catch(() => null);
  // «Tu abono del mes» del 1 al 10 (19/10/2026). Se esconde si ya figura cobrado.
  const abono = await (async () => {
    const periodo = hoyYmd().slice(0, 7);
    const [{ data: inv }, { data: av }] = await Promise.all([
      admin.from("client_invoices").select("fecha_cobro").eq("cliente_id", cliente_id).eq("periodo", periodo),
      admin.from("tasks").select("id").eq("rutina_key", clavePago(cliente_id, periodo)).limit(1),
    ]);
    const filas = (inv ?? []) as { fecha_cobro: string | null }[];
    const pagado = filas.length > 0 && filas.every((x) => !!x.fecha_cobro);
    if (!mostrarAbono({ hoy: hoyYmd(), fechaInicio: ref?.fecha_inicio ?? null, pagado })) return null;
    return { mes: periodLabel(periodo).replace(/ de \d{4}$/, "").toLowerCase(), avisado: !!av?.length };
  })().catch(() => null);
  // Su reunión mensual: la elige él (19/10/2026).
  const reunion = await cargarReunionPortal(admin, cliente_id, hoyYmd()).catch(() => null);
  // «Tu mes en JD Media»: el resumen del mes cerrado en historias (19/10/2026).
  const tuMes = await (async () => {
    const d = new Date(Date.parse(`${hoyYmd().slice(0, 7)}-15T12:00:00Z`) - 30 * 86_400_000);
    const mesPrev = d.toISOString().slice(0, 7);
    const [{ data: pubs }, igPrev] = await Promise.all([
      admin
        .from("publications")
        .select("tipo")
        .eq("cliente_id", cliente_id)
        .eq("estado", "publicado")
        .gte("fecha_publicacion", `${mesPrev}-01`)
        .lt("fecha_publicacion", `${hoyYmd().slice(0, 7)}-01`),
      igMonthlyForReport(admin, cliente_id, mesPrev).catch(() => null),
    ]);
    const tipos = ((pubs ?? []) as { tipo: string }[]).map((x) => x.tipo);
    const estrella = piezaEstrella(igPrev?.media ?? []);
    const mesLabel = d.toLocaleDateString("es-AR", { month: "long", timeZone: "UTC" });
    const placas = armarPlacas({
      nombre: client?.nombre ?? "",
      mesLabel,
      publicadas: {
        reels: tipos.filter((t) => t === "reel" || t === "video").length,
        posts: tipos.filter((t) => t === "post" || t === "carrusel").length,
        historias: tipos.filter((t) => t === "historia").length,
      },
      ig: igPrev?.hasData ? igPrev : null,
      estrella: estrella
        ? { caption: estrella.caption, permalink: estrella.permalink, reach: estrella.reach, likes: estrella.like_count, comentarios: estrella.comments_count }
        : null,
    });
    return hayTuMes(placas) ? { placas, mesLabel } : null;
  })().catch(() => null);
  // Sus plantillas de Canva, para sumar contenido por su cuenta (0200).
  const plantillasCanva = ref?.canva_plantillas_url ?? null;
  const mostrarRecomendar = !!ref?.ref_code && puedeRecomendar(ref.fecha_inicio, hoyYmd());
  const { data: misReferidos } = mostrarRecomendar
    ? await admin
        .from("referidos")
        .select("estado, nuevo:clients!referidos_nuevo_id_fkey(nombre)")
        .eq("recomienda_id", cliente_id)
        .order("created_at")
    : { data: [] };
  const recomendados = ((misReferidos ?? []) as unknown as { estado: EstadoReferido; nuevo: { nombre: string } | null }[]).map((r) => ({
    nombre: r.nuevo?.nombre ?? "Una marca",
    estado: labelEstado(r.estado),
  }));

  const principal = planContent?.mix_por_red?.find((m) => m.rol === "principal") ?? planContent?.mix_por_red?.[0];
  const cadencia = (principal?.cadencia ?? {}) as Record<string, number>;
  const redes = planContent?.mix_por_red?.map((m) => m.red) ?? [];

  return (
    <>
      {/* Como HTML crudo: con {`...`} el server escapa las comillas y React tira error de hidratación. */}
      <style dangerouslySetInnerHTML={{ __html: `
        * { box-sizing: border-box; }
        body {
          margin: 0;
          background: linear-gradient(180deg, #fefefe 0%, #f7f7f5 100%);
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          color: #1a1a1a;
          -webkit-font-smoothing: antialiased;
        }
        .wrap {
          max-width: 760px;
          margin: 0 auto;
          padding: 24px 20px 80px;
        }
        .hero {
          padding: 40px 24px;
          background: #1a1a1a;
          color: #fff;
          border-radius: 16px;
          margin-bottom: 24px;
          position: relative;
          overflow: hidden;
        }
        .hero:before {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at top right, rgba(255,212,0,.15), transparent 60%);
        }
        .hero-saludo { font-size: 13px; color: rgba(255,255,255,.75); margin-bottom: 14px; font-weight: 500; padding-right: 64px; }
        .hero-astro { position: absolute; right: 18px; top: 14px; font-size: 52px; line-height: 1; filter: drop-shadow(0 0 20px rgba(255,212,0,.5)); animation: pm-astro 6s ease-in-out infinite; }
        @keyframes pm-astro { 0%,100% { transform: translateY(0) rotate(0); } 50% { transform: translateY(6px) rotate(6deg); } }
        .hero--manana { background: linear-gradient(135deg, #2a2412 0%, #1a1a1a 60%); }
        .hero--tarde { background: linear-gradient(135deg, #14233a 0%, #1a1a1a 60%); }
        .hero--atardecer { background: linear-gradient(135deg, #3a1f2a 0%, #241a2e 50%, #1a1a1a 100%); }
        .hero--noche, .hero--madrugada { background: linear-gradient(135deg, #1d2140 0%, #15172b 60%); }
        .hero--noche:after, .hero--madrugada:after { content: ""; position: absolute; inset: 0; pointer-events: none; opacity: .5;
          background-image: radial-gradient(rgba(255,255,255,.8) 1px, transparent 1.5px); background-size: 34px 34px;
          -webkit-mask-image: linear-gradient(90deg, transparent, #000 70%); mask-image: linear-gradient(90deg, transparent, #000 70%); }
        @media (prefers-reduced-motion: reduce) { .hero-astro { animation: none; } }
        .hero-brand { font-size: 11px; letter-spacing: 0.2em; color: #FFD400; text-transform: uppercase; margin-bottom: 8px; }
        .hero-title { font-size: 32px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.05; margin: 0; }
        .hero-rubro { margin-top: 6px; font-size: 14px; color: #aaa; }
        .hero-pack { margin-top: 16px; display: inline-block; padding: 4px 10px; background: #FFD400; color: #1a1a1a; font-weight: 700; font-size: 11px; border-radius: 999px; }

        /* Aprobar deslizando (18/10/2026) */
        .pd-abrir { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%; margin: 0 0 14px; padding: 13px 16px; border: 0; border-radius: 12px; background: #1a1a1a; color: #fff; font: 700 14px Inter, system-ui, sans-serif; cursor: pointer; }
        .pd-abrir span { animation: pd-dedo 1.8s ease-in-out infinite; display: inline-block; }
        @keyframes pd-dedo { 0%,100% { transform: translateX(-4px); } 50% { transform: translateX(6px); } }
        .pd-fondo { position: fixed; inset: 0; z-index: 60; background: #111; color: #fff; display: flex; flex-direction: column; align-items: center; padding: 16px 16px 24px; animation: pd-entra .3s ease both; overflow: hidden; touch-action: none; }
        @keyframes pd-entra { from { opacity: 0; transform: scale(.98); } }
        .pd-arriba { width: 100%; max-width: 420px; display: flex; justify-content: space-between; align-items: center; font: 600 13px Inter, sans-serif; color: rgba(255,255,255,.6); }
        .pd-arriba button { background: rgba(255,255,255,.1); color: #fff; border: 0; width: 34px; height: 34px; border-radius: 50%; font-size: 15px; cursor: pointer; }
        .pd-mazo { position: relative; width: 100%; max-width: 380px; flex: 1; max-height: 560px; margin: 14px 0; }
        .pd-carta { position: absolute; inset: 0; background: #fff; color: #111; border-radius: 22px; overflow: hidden; display: flex; flex-direction: column; box-shadow: 0 30px 60px rgba(0,0,0,.45); cursor: grab; user-select: none; touch-action: none; }
        .pd-carta:active { cursor: grabbing; }
        .pd-quieta { transition: transform .35s cubic-bezier(.2,.8,.2,1); }
        .pd-sale { transition: transform .32s ease-in; }
        .pd-atras { transform: scale(.94) translateY(14px); opacity: .55; cursor: default; }
        .pd-img { width: 100%; flex: 1; min-height: 0; object-fit: cover; pointer-events: none; }
        .pd-sin-img { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 14px; background: linear-gradient(160deg, #fff7d6, #f4f4f1); font-size: 64px; }
        .pd-sin-img a { font: 700 14px Inter, sans-serif; color: #111; background: #FFD400; padding: 10px 16px; border-radius: 999px; text-decoration: none; }
        .pd-info { padding: 14px 18px 18px; }
        .pd-meta { font: 600 11px Inter, sans-serif; text-transform: uppercase; letter-spacing: .08em; color: #888; }
        .pd-titulo { font: 800 17px Inter, sans-serif; margin-top: 4px; }
        .pd-copy { margin-top: 6px; font-size: 13px; line-height: 1.45; color: #555; max-height: 5.8em; overflow: auto; white-space: pre-wrap; }
        .pd-sello { position: absolute; top: 22px; z-index: 2; font: 900 22px Inter, sans-serif; letter-spacing: .08em; padding: 4px 12px; border: 4px solid; border-radius: 10px; pointer-events: none; }
        .pd-sello-si { left: 18px; color: #16a34a; border-color: #16a34a; transform: rotate(-14deg); background: rgba(255,255,255,.85); }
        .pd-sello-no { right: 18px; color: #ea580c; border-color: #ea580c; transform: rotate(14deg); background: rgba(255,255,255,.85); }
        .pd-botones { display: flex; gap: 28px; }
        .pd-botones button { width: 74px; height: 74px; border-radius: 50%; border: 0; font-size: 28px; font-weight: 900; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; transition: transform .15s ease; }
        .pd-botones button span { font-size: 10px; font-weight: 700; }
        .pd-botones button:active { transform: scale(.9); }
        .pd-no { background: #fff; color: #ea580c; }
        .pd-si { background: #FFD400; color: #111; box-shadow: 0 0 30px rgba(255,212,0,.4); }
        .pd-ayuda { margin-top: 12px; font-size: 12px; color: rgba(255,255,255,.45); text-align: center; }
        .pd-error { color: #fca5a5; font-size: 13px; margin: 0 0 8px; }
        .pd-cambios { width: 100%; max-width: 380px; }
        .pd-cambios textarea { width: 100%; border-radius: 14px; border: 0; padding: 12px 14px; font: 14px Inter, sans-serif; resize: none; }
        .pd-cambios-botones { display: flex; gap: 10px; margin-top: 10px; }
        .pd-cambios-botones button { flex: 1; padding: 12px; border-radius: 12px; border: 0; font: 700 14px Inter, sans-serif; cursor: pointer; background: rgba(255,255,255,.12); color: #fff; }
        .pd-cambios-botones .pd-mandar { background: #FFD400; color: #111; }
        .pd-fin { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; animation: pd-entra .4s ease both; }
        .pd-fin-emoji { font-size: 72px; animation: pd-salta .7s cubic-bezier(.34,1.56,.64,1) both; }
        @keyframes pd-salta { from { transform: scale(.3) rotate(-20deg); opacity: 0; } }
        .pd-fin h2 { font: 800 26px Inter, sans-serif; margin: 12px 0 6px; }
        .pd-fin p { margin: 0; color: rgba(255,255,255,.75); }
        .pd-fin .pd-sub { margin-top: 4px; font-size: 13px; color: rgba(255,255,255,.5); }
        .pd-cerrar { margin-top: 22px; padding: 13px 22px; border: 0; border-radius: 999px; background: #FFD400; color: #111; font: 800 14px Inter, sans-serif; cursor: pointer; }
        @media (prefers-reduced-motion: reduce) { .pd-abrir span, .pd-fondo, .pd-fin, .pd-fin-emoji { animation: none; } }
        .card { background: #fff; border: 1px solid #ececec; border-radius: 14px; padding: 20px; margin-bottom: 16px; }
        /* Movimiento (18/10/2026): ver components/portal-movimiento. */
        .card { transition: box-shadow .25s ease, transform .25s ease; }
        .card:hover { box-shadow: 0 10px 30px -12px rgba(0,0,0,.18); }
        .pm-vivo .card { opacity: 0; transform: translateY(14px); transition: opacity .6s ease, transform .6s cubic-bezier(.2,.8,.2,1), box-shadow .25s ease; }
        .pm-vivo .card.pm-visto { opacity: 1; transform: none; }
        .pm-vivo .card .pilar-bar-fill { transform: scaleX(0); transform-origin: left; transition: transform 1s cubic-bezier(.2,.8,.2,1) .2s; }
        .pm-vivo .card.pm-visto .pilar-bar-fill { transform: none; }
        .hero { animation: pm-hero .7s cubic-bezier(.2,.8,.2,1) both; }
        .hero:before { inset: -25%; animation: pm-brillo 9s ease-in-out infinite alternate; }
        @keyframes pm-hero { from { opacity: 0; transform: translateY(10px) scale(.99); } to { opacity: 1; transform: none; } }
        @keyframes pm-brillo { from { transform: translate(0,0); } to { transform: translate(-12%, 8%); } }
        @media (prefers-reduced-motion: reduce) { .hero, .hero:before { animation: none; } }
        /* Tu mes en JD Media (19/10/2026) */
        .tm-abrir { display: flex; align-items: center; gap: 14px; width: 100%; margin: 0 0 16px; padding: 14px 16px; border: 0; border-radius: 16px; cursor: pointer; text-align: left; font-family: inherit; color: #fff; background: linear-gradient(120deg, #1a1a1a 0%, #3a2f05 55%, #1a1a1a 100%); background-size: 200% 100%; animation: tm-brillo 6s ease-in-out infinite alternate; box-shadow: 0 10px 30px -14px rgba(0,0,0,.5); transition: transform .2s ease; }
        .tm-abrir:hover { transform: translateY(-2px); }
        .tm-abrir b { display: block; font-size: 15px; }
        .tm-abrir small { display: block; font-size: 12px; color: rgba(255,255,255,.65); margin-top: 2px; }
        .tm-play { width: 42px; height: 42px; flex: 0 0 auto; border-radius: 50%; background: #FFD400; color: #111; display: flex; align-items: center; justify-content: center; font-size: 15px; box-shadow: 0 0 0 0 rgba(255,212,0,.6); animation: tm-pulso 2.2s ease-out infinite; }
        @keyframes tm-brillo { from { background-position: 0% 0; } to { background-position: 100% 0; } }
        @keyframes tm-pulso { 0% { box-shadow: 0 0 0 0 rgba(255,212,0,.55); } 80%, 100% { box-shadow: 0 0 0 14px rgba(255,212,0,0); } }
        .tm-fondo { position: fixed; inset: 0; z-index: 70; background: #000; display: flex; align-items: center; justify-content: center; animation: pd-entra .3s ease both; }
        .tm-placa { position: relative; width: 100%; height: 100%; max-width: 430px; max-height: 860px; overflow: hidden; display: flex; flex-direction: column; transition: background .5s ease; }
        @media (min-width: 600px) { .tm-placa { border-radius: 24px; height: 92vh; } }
        .tm-barras { position: absolute; top: 12px; left: 12px; right: 12px; display: flex; gap: 4px; z-index: 4; }
        .tm-barras span { flex: 1; height: 3px; border-radius: 3px; background: rgba(127,127,127,.35); overflow: hidden; }
        .tm-barras i { display: block; height: 100%; width: 100%; background: currentColor; transform: scaleX(0); transform-origin: left; }
        .tm-barras i.tm-llena { transform: none; }
        .tm-barras i.tm-corre { animation: tm-barra linear forwards; }
        @keyframes tm-barra { to { transform: scaleX(1); } }
        .tm-cerrar { position: absolute; top: 24px; right: 14px; z-index: 5; background: rgba(127,127,127,.25); color: inherit; border: 0; width: 34px; height: 34px; border-radius: 50%; font-size: 14px; cursor: pointer; }
        .tm-contenido { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 60px 28px; gap: 10px; }
        .tm-contenido > * { animation: tm-sube .7s cubic-bezier(.2,.8,.2,1) both; }
        .tm-contenido > *:nth-child(2) { animation-delay: .12s; }
        .tm-contenido > *:nth-child(3) { animation-delay: .24s; }
        .tm-contenido > *:nth-child(4) { animation-delay: .36s; }
        .tm-contenido > *:nth-child(5) { animation-delay: .48s; }
        @keyframes tm-sube { from { opacity: 0; transform: translateY(24px) scale(.97); } }
        .tm-titulo-gigante { font-size: 54px; font-weight: 900; letter-spacing: -.04em; line-height: .95; margin: 6px 0; }
        .tm-numero { font-size: 84px; font-weight: 900; letter-spacing: -.05em; line-height: 1; font-variant-numeric: tabular-nums; }
        .tm-titulo { font-size: 26px; font-weight: 800; margin: 0; letter-spacing: -.02em; }
        .tm-sub { font-size: 15px; opacity: .75; margin: 0; max-width: 300px; line-height: 1.45; }
        .tm-chico { font-size: 13px; opacity: .7; letter-spacing: .04em; }
        .tm-emoji { font-size: 64px; animation: pd-salta .7s cubic-bezier(.34,1.56,.64,1) both !important; }
        .tm-cita { font-size: 18px; font-weight: 600; line-height: 1.4; margin: 4px 0; max-width: 320px; }
        .tm-link { position: relative; z-index: 3; margin-top: 10px; display: inline-block; padding: 12px 20px; border-radius: 999px; background: #FFD400; color: #111; font: 800 14px Inter, sans-serif; text-decoration: none; border: 0; cursor: pointer; }
        .tm-link-sec { background: transparent; color: inherit; border: 1px solid currentColor; margin-top: 6px; }
        .tm-zona { position: absolute; top: 60px; bottom: 0; z-index: 2; background: transparent; border: 0; cursor: pointer; -webkit-tap-highlight-color: transparent; }
        .tm-izq { left: 0; width: 30%; }
        .tm-der { right: 0; width: 70%; }
        @media (prefers-reduced-motion: reduce) { .tm-abrir, .tm-play, .tm-contenido > *, .tm-barras i.tm-corre { animation: none; } }
        /* Tu contenido, en vivo (19/10/2026) */
        .pp-resumen { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 13px; color: #555; margin-bottom: 14px; }
        .pp-resumen b { color: #111; font-size: 15px; }
        .pp-sep { color: #bbb; }
        .pp-vivo { margin-left: auto; display: inline-flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: #16a34a; }
        .pp-vivo i { width: 8px; height: 8px; border-radius: 50%; background: #16a34a; animation: pp-late 1.6s ease-in-out infinite; }
        @keyframes pp-late { 0%,100% { box-shadow: 0 0 0 0 rgba(22,163,74,.5); } 50% { box-shadow: 0 0 0 6px rgba(22,163,74,0); } }
        .pp-lista { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: minmax(0, 1fr); gap: 10px; }
        .pp-pieza { padding: 12px 14px 26px; border: 1px solid #f0f0f0; border-radius: 12px; animation: tm-sube .5s cubic-bezier(.2,.8,.2,1) both; }
        .pp-arriba { display: flex; justify-content: space-between; gap: 10px; font-size: 13px; margin-bottom: 12px; }
        .pp-titulo { flex: 1; font-weight: 700; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .pp-fecha { color: #888; flex: 0 0 auto; text-transform: capitalize; }
        .pp-linea { position: relative; height: 4px; margin: 0 22px; border-radius: 4px; background: #eee; }
        .pp-relleno { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 4px; background: linear-gradient(90deg, #ffd400, #f5b400); transform-origin: left; animation: pp-llena .9s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes pp-llena { from { transform: scaleX(0); } }
        .pp-paso { position: absolute; top: 50%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; }
        .pp-paso i { width: 12px; height: 12px; border-radius: 50%; background: #fff; border: 2px solid #ddd; }
        .pp-paso small { position: absolute; top: 14px; font-size: 10px; color: #aaa; white-space: nowrap; }
        .pp-hecho i { background: #ffd400; border-color: #ffd400; }
        .pp-ahora i { background: #111; border-color: #111; box-shadow: 0 0 0 4px rgba(255,212,0,.45); animation: pp-late2 1.8s ease-in-out infinite; }
        .pp-ahora small { color: #111; font-weight: 700; }
        @keyframes pp-late2 { 0%,100% { box-shadow: 0 0 0 3px rgba(255,212,0,.5); } 50% { box-shadow: 0 0 0 7px rgba(255,212,0,.1); } }
        @media (prefers-reduced-motion: reduce) { .pp-vivo i, .pp-pieza, .pp-relleno, .pp-ahora i { animation: none; } }
        /* Tu arranque (19/10/2026) */
        .ta-card { border-color: #f1e3a0; }
        .ta-completo { background: linear-gradient(180deg, #ecfdf3 0%, #fff 70%); border-color: #bbe7c8; }
        .ta-barra { height: 8px; border-radius: 8px; background: #f0f0f0; overflow: hidden; margin: 8px 0 16px; }
        .ta-barra span { display: block; height: 100%; border-radius: 8px; background: linear-gradient(90deg, #ffd400, #16a34a); transform-origin: left; animation: pp-llena 1.1s cubic-bezier(.2,.8,.2,1) .2s both; }
        .ta-pasos { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
        .ta-pasos li { display: flex; align-items: center; gap: 10px; font-size: 14px; color: #555; animation: tm-sube .45s cubic-bezier(.2,.8,.2,1) both; }
        .ta-check { width: 26px; height: 26px; flex: 0 0 auto; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 800; background: #f3f3f3; color: #999; }
        .ta-hecho { color: #111; }
        .ta-hecho .ta-texto { text-decoration: line-through; text-decoration-color: rgba(0,0,0,.25); }
        .ta-hecho .ta-check { background: #16a34a; color: #fff; animation: pr-pop .5s cubic-bezier(.34,1.56,.64,1) both; }
        .ta-tuyo { color: #111; font-weight: 600; }
        .ta-tuyo .ta-check { background: #FFD400; color: #111; box-shadow: 0 0 0 4px rgba(255,212,0,.25); }
        .ta-chip { margin-left: auto; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: .08em; background: #111; color: #FFD400; padding: 3px 8px; border-radius: 999px; }
        @media (prefers-reduced-motion: reduce) { .ta-barra span, .ta-pasos li, .ta-hecho .ta-check { animation: none; } }
        /* Tu abono del mes (19/10/2026) */
        .ab-card { border-color: #d7e6ff; background: linear-gradient(180deg, #f3f8ff 0%, #fff 70%); }
        .ab-datos { display: grid; gap: 6px; margin-bottom: 12px; }
        .ab-fila { display: flex; align-items: center; gap: 10px; width: 100%; padding: 10px 12px; border-radius: 12px; border: 1px solid #e6edf8; background: #fff; font-family: inherit; text-align: left; cursor: pointer; transition: transform .15s ease, border-color .15s ease; }
        .ab-fila:hover { transform: translateY(-1px); border-color: #9ec0f5; }
        .ab-fija { cursor: default; }
        .ab-fija:hover { transform: none; border-color: #e6edf8; }
        .ab-label { width: 54px; flex: 0 0 auto; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #888; }
        .ab-valor { flex: 1; min-width: 0; font-weight: 700; font-size: 14px; color: #111; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-variant-numeric: tabular-nums; }
        .ab-copiar { color: #3b82f6; display: inline-flex; }
        .ab-pague { display: inline-flex; align-items: center; gap: 8px; padding: 11px 18px; border-radius: 12px; border: 0; background: #111; color: #fff; font: 700 14px Inter, system-ui, sans-serif; cursor: pointer; }
        .ab-pague:disabled { opacity: .6; }
        /* Plazo de aprobación tácita (19/10/2026) */
        .pz-caja { display: flex; gap: 12px; align-items: flex-start; padding: 12px 14px; margin: 0 0 14px; border-radius: 12px; background: #fff; border: 1px dashed #f3c94b; }
        .pz-urgente { border-style: solid; border-color: #f59e0b; background: #fff7e0; }
        .pz-reloj { font-size: 22px; line-height: 1; animation: pz-gira 2.4s ease-in-out infinite; }
        @keyframes pz-gira { 0%, 40% { transform: rotate(0); } 50%, 90% { transform: rotate(180deg); } 100% { transform: rotate(360deg); } }
        .pz-titulo { font-weight: 700; font-size: 14px; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
        .pz-falta { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: .06em; background: #111; color: #FFD400; padding: 2px 8px; border-radius: 999px; font-variant-numeric: tabular-nums; }
        .pz-texto { font-size: 13px; color: #555; margin-top: 3px; line-height: 1.45; }
        @media (prefers-reduced-motion: reduce) { .pz-reloj { animation: none; } }
        .pr-card { border-color: #e9e3c6; background: linear-gradient(180deg, #fffdf3 0%, #fff 70%); }
        .pr-dias { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 12px; }
        .pr-dia { flex: 0 0 auto; width: 58px; padding: 8px 0; border-radius: 14px; border: 1px solid #eee; background: #fff; display: flex; flex-direction: column; align-items: center; gap: 2px; cursor: pointer; font-family: inherit; transition: transform .15s ease, background .2s ease, border-color .2s ease; }
        .pr-dia span { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: .06em; }
        .pr-dia b { font-size: 20px; font-weight: 800; color: #111; }
        .pr-dia:hover { transform: translateY(-2px); }
        .pr-activo { background: #111; border-color: #111; }
        .pr-activo span { color: #FFD400; }
        .pr-activo b { color: #fff; }
        .pr-horas { display: flex; flex-wrap: wrap; gap: 8px; }
        .pr-hora { min-width: 72px; padding: 10px 14px; border-radius: 12px; border: 1px solid #f1e3a0; background: #fffbe6; font: 700 14px Inter, system-ui, sans-serif; color: #111; cursor: pointer; display: inline-flex; justify-content: center; animation: pr-entra .35s cubic-bezier(.2,.8,.2,1) both; transition: transform .15s ease, background .15s ease; }
        .pr-hora:hover { background: #FFD400; transform: translateY(-2px); }
        .pr-hora:disabled { opacity: .6; cursor: default; }
        @keyframes pr-entra { from { opacity: 0; transform: translateY(6px) scale(.96); } }
        .pr-gira { animation: pr-gira 1s linear infinite; }
        @keyframes pr-gira { to { transform: rotate(360deg); } }
        .pr-listo { display: flex; align-items: center; gap: 12px; padding: 12px 14px; border-radius: 14px; background: #e9f9ef; color: #0f5132; animation: pr-entra .4s ease both; }
        .pr-check { width: 34px; height: 34px; border-radius: 50%; background: #16a34a; color: #fff; display: flex; align-items: center; justify-content: center; flex: 0 0 auto; animation: pr-pop .5s cubic-bezier(.34,1.56,.64,1) both; }
        @keyframes pr-pop { from { transform: scale(.2); } }
        @media (prefers-reduced-motion: reduce) { .pr-hora, .pr-listo, .pr-check { animation: none; } }
        .enc-cara { transition: transform .15s ease, background .15s ease; }
        .enc-cara:hover { transform: scale(1.12); background: #fffbe6 !important; }
        .card-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.15em; color: #888; margin-bottom: 6px; }
        .card-title { font-size: 20px; font-weight: 700; margin: 0 0 12px; }

        .cadencia { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; }
        @media (min-width: 600px) { .cadencia { grid-template-columns: repeat(4, 1fr); } }
        .cadencia-cell { padding: 12px; background: #fafafa; border-radius: 10px; text-align: center; }
        .cadencia-cell .lbl { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.1em; }
        .cadencia-cell .val { font-size: 24px; font-weight: 800; margin-top: 4px; }

        .pilar { margin-bottom: 12px; }
        .pilar-row { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
        .pilar-name { font-weight: 600; font-size: 14px; }
        .pilar-pct { font-weight: 800; font-size: 16px; }
        .pilar-bar { height: 8px; background: #f0f0f0; border-radius: 4px; overflow: hidden; }
        .pilar-bar-fill { height: 100%; background: #FFD400; }

        .tema { padding: 14px; border: 1px solid #eee; border-radius: 10px; margin-bottom: 10px; background: #fff; }
        .tema-head { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; flex-wrap: wrap; }
        .tema-title { font-weight: 700; font-size: 15px; }
        .tema-tags { display: flex; gap: 4px; flex-wrap: wrap; }
        .tag { padding: 2px 8px; background: #f3f3f3; color: #555; font-size: 10px; font-weight: 600; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.05em; }
        .tag.yellow { background: #fffbe6; color: #92400e; }
        .tema-desc { margin-top: 6px; font-size: 13px; color: #555; line-height: 1.5; }

        .pub-list { list-style: none; margin: 0; padding: 0; }
        .pub { padding: 12px 0; border-bottom: 1px solid #f0f0f0; }
        .pub:last-child { border-bottom: none; }
        .pub-date { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.05em; }
        .pub-title { font-weight: 600; margin-top: 4px; }
        .pub-meta { font-size: 11px; color: #777; margin-top: 2px; }

        .empty { text-align: center; padding: 40px 20px; color: #999; font-size: 14px; }

        @keyframes portalFade { from { opacity: 0; } to { opacity: 1; } }
        @keyframes portalUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .portal-backdrop { animation: portalFade .18s ease; }
        .portal-sheet { animation: portalUp .28s cubic-bezier(.22,1,.36,1); }
        @media (min-width: 600px) {
          .portal-backdrop { align-items: center !important; }
          .portal-sheet { border-radius: 18px !important; animation: portalFade .2s ease; }
        }
        .footer { margin-top: 40px; text-align: center; padding: 24px 0; color: #888; font-size: 12px; border-top: 1px solid #ececec; }
      ` }} />

      <div className="wrap">
        <PortalMovimiento />
        {(() => {
          // El saludo según la hora de Córdoba y lo que sale esta semana (18/10/2026).
          const horaCba = Number(new Intl.DateTimeFormat("es-AR", { hour: "numeric", hour12: false, timeZone: "America/Argentina/Cordoba" }).format(new Date())) % 24;
          const momento = momentoDelDia(horaCba);
          const en7 = Date.now() + 7 * 86_400_000;
          const semana = ((pubs ?? []) as { fecha_publicacion: string | null; estado: string }[]).filter((x) => {
            const t = x.fecha_publicacion ? new Date(x.fecha_publicacion).getTime() : 0;
            return t >= Date.now() - 3_600_000 && t <= en7 && x.estado !== "publicado";
          }).length;
          return (
            <div className={`hero hero--${momento}`}>
              <span className="hero-astro" aria-hidden="true">{SALUDO[momento].emoji}</span>
              <div style={{ position: "relative" }}>
                <div className="hero-saludo">
                  {momento === "madrugada" ? "Hola" : SALUDO[momento].saludo}, {client.nombre}
                  {semana > 0 ? ` · Esta semana ${semana === 1 ? "sale 1 pieza" : `salen ${semana} piezas`}` : ""}
                </div>
            <h1 className="hero-title">{client.nombre}</h1>
            {client.rubro && <div className="hero-rubro">{client.rubro}</div>}
            {client.pack && <span className="hero-pack">Pack {client.pack}</span>}
              </div>
            </div>
          );
        })()}

        {abono && (
          <PortalAbono
            token={params.token}
            mes={abono.mes}
            hastaDia={5}
            alias={AGENCY.bank.alias}
            cvu={AGENCY.bank.cvu}
            titular={AGENCY.bank.titular}
            avisado={abono.avisado}
          />
        )}

        {arranque && <PortalArranque pasos={arranque} cartaHref={`/contrato/cliente/${cliente_id}?token=${params.token}`} />}

        {tuMes && <PortalTuMes placas={tuMes.placas} mesLabel={tuMes.mesLabel} refCode={mostrarRecomendar ? ref?.ref_code ?? null : null} />}

        {/* Tu reunión del mes: el cliente elige el día y la hora. */}
        {reunion && (
          <div className="card pr-card">
            <div className="card-label">Tu reunión del mes</div>
            <h2 className="card-title" style={{ marginBottom: 4 }}>
              {reunion.estado === "agendada" ? "Nos vemos pronto" : "Elegí cuándo nos juntamos"}
            </h2>
            <p style={{ fontSize: 13, color: "#666", margin: "0 0 14px", lineHeight: 1.5 }}>
              30 minutos por videollamada para ver los resultados del mes y planear el que viene
              {reunion.estado === "elegir" && reunion.conQuien ? `, con ${reunion.conQuien}` : ""}.
            </p>
            <PortalReunion
              token={params.token}
              turnos={reunion.estado === "elegir" ? reunion.turnos : []}
              agendada={reunion.estado === "agendada" ? reunion.etiqueta : null}
            />
          </div>
        )}

        {/* La encuesta del mes: un toque en la carita y abre la encuesta con esa nota. */}
        {pedirEncuesta && (
          <div className="card" style={{ textAlign: "center" }}>
            <div className="card-label">30 segundos</div>
            <h2 className="card-title" style={{ marginBottom: 4 }}>¿Cómo venimos este mes?</h2>
            <p style={{ fontSize: 13, color: "#666", margin: "0 0 14px" }}>Tu opinión la lee todo el equipo y nos ayuda a mejorar el mes que viene.</p>
            <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap" }}>
              {["😞", "😕", "😐", "🙂", "😍"].map((cara, i) => (
                <a
                  key={cara}
                  href={`/encuesta/${params.token}?p=${i + 1}`}
                  aria-label={`${i + 1} de 5`}
                  className="enc-cara"
                  style={{ fontSize: 32, width: 56, height: 56, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 14, background: "#fafafa", border: "1px solid #eee", textDecoration: "none" }}
                >
                  {cara}
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Pendientes de revisión — se muestra primero porque es lo urgente */}
        {toReview.length > 0 && (
          <div className="card" style={{ borderColor: "#fde68a", background: "linear-gradient(180deg, #fffbeb 0%, #fff 100%)" }}>
            <div className="card-label" style={{ color: "#92400e" }}>
              Necesitamos tu mirada
            </div>
            <h2 className="card-title">
              {toReview.length === 1
                ? "Una pieza para revisar"
                : `${toReview.length} piezas para revisar`}
            </h2>
            <p style={{ fontSize: 13, color: "#555", margin: "0 0 16px", lineHeight: 1.5 }}>
              Aprobá si todo va bien, o pedinos cambios con un click. Lo que respondas acá
              llega directo al equipo.
            </p>
            {/* La aprobación tácita de la carta acuerdo, con cuenta regresiva (19/10/2026). */}
            {(() => {
              const plazos = (toReview as unknown as { fecha_publicacion: string | null; cliente_revision_iniciada_at?: string | null; updated_at?: string | null }[])
                .filter((x) => x.fecha_publicacion)
                .map((x) => plazoAprobacion(x.fecha_publicacion!, x.cliente_revision_iniciada_at ?? x.updated_at ?? null))
                .filter((d) => d.getTime() > Date.now())
                .sort((a, b) => a.getTime() - b.getTime());
              return plazos[0] ? <PortalPlazo hastaIso={plazos[0].toISOString()} etiqueta={etiquetaPlazo(plazos[0])} cartaHref={`/contrato/cliente/${cliente_id}?token=${params.token}`} /> : null;
            })()}
            <PortalDeslizar piezas={toReview} token={params.token} />
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {toReview.map((p) => (
                <PortalReviewCard key={p.id} pub={p} token={params.token} />
              ))}
            </div>
          </div>
        )}

        {/* Informe del último mes cerrado — el documento que sale de la reunión */}
        {ultimoInforme && (
          <a
            href={`/c/${params.token}/mes/${ultimoInforme.periodo}`}
            className="card"
            style={{
              display: "block",
              textDecoration: "none",
              color: "inherit",
              background: "#1a1a1a",
              borderColor: "#1a1a1a",
            }}
          >
            <div className="card-label" style={{ color: "#FFD400" }}>
              Informe del mes
            </div>
            <h2 className="card-title" style={{ color: "#fff", marginBottom: 8 }}>
              {ultimoInforme.titular || `Cómo te fue en ${periodLabel(ultimoInforme.periodo)}`}
            </h2>
            <p style={{ fontSize: 13, color: "#b5b5b5", margin: 0, lineHeight: 1.5 }}>
              Los resultados de {periodLabel(ultimoInforme.periodo)} y qué viene ahora →
            </p>
          </a>
        )}

        {/* Dónde estamos con su cuenta y qué le toca a él (17/10/2026). */}
        {ref?.fecha_inicio && (conRedes ?? 0) > 0 && (
          <div style={{ marginBottom: 16 }}>
            <CicloNave inicio={ref.fecha_inicio} hoy={hoyYmd()} portal />
          </div>
        )}

        {/* Tus reportes: todo en este mismo link, mes por mes (17/10/2026). */}
        {(() => {
          const inicio = (ref?.fecha_inicio ?? mesActual).slice(0, 7);
          const meses: string[] = [];
          for (let i = 0; i < 6; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            if (ym < inicio) break;
            meses.push(ym);
          }
          if (!meses.length) return null;
          return (
            <div className="card" id="reportes">
              <div className="card-label">Tus reportes</div>
              <h2 className="card-title">Mes a mes</h2>
              <div style={{ display: "grid", gap: 8 }}>
                {meses.map((ym) => {
                  const periodoInforme = [...periodosConInforme].find((p) => p.startsWith(ym));
                  return (
                    <div key={ym} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, padding: "10px 12px", border: "1px solid #ececec", borderRadius: 12 }}>
                      <span style={{ fontWeight: 700, fontSize: 14 }}>
                        {periodLabel(ym)}
                        {ym === mesActual && <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 600, color: "#888" }}>en curso</span>}
                      </span>
                      <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {periodoInforme && (
                          <a href={`/c/${params.token}/mes/${periodoInforme}`} style={{ fontSize: 12, fontWeight: 700, background: "#FFD400", color: "#000", borderRadius: 999, padding: "6px 12px", textDecoration: "none" }}>
                            Informe del mes →
                          </a>
                        )}
                        <a href={`/reporte/cliente/${cliente_id}?mes=${ym}&token=${params.token}`} style={{ fontSize: 12, fontWeight: 700, background: "#111", color: "#fff", borderRadius: 999, padding: "6px 12px", textDecoration: "none" }}>
                          Números y publicaciones →
                        </a>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}

        {/* Tu material: lo que el arranque necesita de su lado (18/10/2026). */}
        {material && (
          <div className="card">
            <div className="card-label">Para arrancar</div>
            <h2 className="card-title">Necesitamos tus fotos y videos</h2>
            <p style={{ fontSize: 13, color: "#666", margin: "0 0 12px", lineHeight: 1.5 }}>
              Con tu material salen tus primeras publicaciones: productos, el local, tu equipo, lo que tengas. Subilo a tu carpeta y avisanos acá; tu equipo lo revisa ese mismo día. Según tu{" "}
              <a href={`/contrato/cliente/${cliente_id}?token=${params.token}`} target="_blank" rel="noreferrer" style={{ color: "inherit", fontWeight: 700 }}>
                carta acuerdo
              </a>
              , va dentro de los 2 días de aprobado el calendario.
            </p>
            <PortalMaterial token={params.token} driveUrl={material.driveUrl} avisado={material.avisado} />
          </div>
        )}

        {/* Tus cuentas: el cliente carga sus accesos (pedido de Luz, 17/10/2026).
            Solo aparece mientras falte alguna red: cuando está todo, no ocupa lugar. */}
        {Object.values(estadoCuentas).some((e) => e === "falta") && (
        <div className="card">
          <div className="card-label">Tus cuentas</div>
          <h2 className="card-title">Tus redes y accesos</h2>
          <p style={{ fontSize: 13, color: "#666", margin: "0 0 12px", lineHeight: 1.5 }}>
            Para manejar tus redes, tu equipo necesita poder entrar. Marcá cuáles tenés y dejanos el usuario y la contraseña; las que no tengas, las creamos nosotros.
          </p>
          <PortalAccesos token={params.token} estado={estadoCuentas} />
        </div>
        )}

        {/* Resultados del mes — Instagram + pauta, en vivo */}
        {hayResultados && (
          <div className="card">
            <div className="card-label">Resultados de este mes</div>
            <h2 className="card-title">Cómo venís</h2>
            {igCells.length > 0 && (
              <>
                <p style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 8px" }}>
                  Instagram
                </p>
                <div className="cadencia" style={{ marginBottom: paidCells.length > 0 ? 16 : 0 }}>
                  {igCells.map((c) => (
                    <div key={c.lbl} className="cadencia-cell">
                      <div className="lbl">{c.lbl}</div>
                      <div className="val">{c.val}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {igHist.length >= 2 && (
              <div style={{ margin: "4px 0 16px" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "baseline",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 8,
                    margin: "0 0 4px",
                  }}
                >
                  <p style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em", margin: 0 }}>
                    Evolución de seguidores
                  </p>
                  {igDelta > 0 && (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#1a1a1a",
                        background: "#FFD400",
                        borderRadius: 999,
                        padding: "2px 10px",
                      }}
                    >
                      +{fmtN(igDelta)} seguidores
                    </span>
                  )}
                </div>
                <PortalIgChart points={igHist} />
              </div>
            )}
            {paidCells.length > 0 && (
              <>
                <p style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 8px" }}>
                  Publicidad
                </p>
                <div className="cadencia">
                  {paidCells.map((c) => (
                    <div key={c.lbl} className="cadencia-cell">
                      <div className="lbl">{c.lbl}</div>
                      <div className="val">{c.val}</div>
                    </div>
                  ))}
                </div>
              </>
            )}
            {aiResultados && (
              <div style={{ marginTop: 16, fontSize: 14, lineHeight: 1.6, color: "#444", whiteSpace: "pre-line" }}>
                {aiResultados}
              </div>
            )}
          </div>
        )}

        {/* Tu crecimiento: el antes y el después con las fotos automáticas del Instagram. */}
        {crecimiento && (crecimiento.inicio || crecimiento.hoy) && (
          <div className="card">
            <div className="card-label">Tu crecimiento</div>
            <CrecimientoVista datos={crecimiento} nombre={client.nombre} portal />
          </div>
        )}

        {planContent ? (
          <>
            {/* Resumen del mes */}
            {planContent.resumen_mes && planContent.resumen_mes.length > 0 && (
              <div className="card">
                <div className="card-label">{plan?.periodo_label ?? "Plan vigente"}</div>
                <h2 className="card-title">Lo importante de este mes</h2>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {planContent.resumen_mes.map((b, i) => (
                    <li key={i} style={{ padding: "8px 0 8px 18px", position: "relative", fontSize: 14, lineHeight: 1.5 }}>
                      <span style={{ position: "absolute", left: 0, top: 14, width: 6, height: 6, background: "#FFD400", borderRadius: 2 }} />
                      {b}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Objetivos del mes: qué vamos a buscar y medir. Es lo que más
                piden los clientes al aprobar el plan — claridad de estrategia. */}
            {planContent.kpis_objetivo && planContent.kpis_objetivo.length > 0 && (
              <div className="card">
                <div className="card-label">Estrategia</div>
                <h2 className="card-title">🎯 Objetivos del mes</h2>
                <p style={{ margin: "0 0 10px", fontSize: 13, color: "#666", lineHeight: 1.5 }}>
                  Esto es lo que buscamos con el contenido de este mes y lo que
                  vamos a medir en el reporte.
                </p>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {planContent.kpis_objetivo.map((k, i) => (
                    <li key={i} style={{ padding: "8px 0 8px 18px", position: "relative", fontSize: 14, lineHeight: 1.5 }}>
                      <span style={{ position: "absolute", left: 0, top: 14, width: 6, height: 6, background: "#FFD400", borderRadius: 2 }} />
                      {k}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Cadencia */}
            {Object.keys(cadencia).length > 0 && (
              <div className="card">
                <div className="card-label">Cadencia del mes</div>
                <h2 className="card-title">Lo que vas a recibir</h2>
                <div className="cadencia">
                  {Object.entries(cadencia).map(([fmt, qty]) => (
                    <div key={fmt} className="cadencia-cell">
                      <div className="lbl">{FORMATO_LABEL[fmt] ?? fmt}</div>
                      <div className="val">{qty}</div>
                    </div>
                  ))}
                </div>
                {redes.length > 0 && (
                  <p style={{ marginTop: 14, marginBottom: 0, fontSize: 12, color: "#666" }}>
                    Se publica en <strong style={{ textTransform: "capitalize" }}>{redes.join(", ")}</strong>
                  </p>
                )}
              </div>
            )}

            {/* Distribución por pilar */}
            {planContent.distribucion_pilares && planContent.distribucion_pilares.length > 0 && (
              <div className="card">
                <div className="card-label">De qué vamos a hablar</div>
                <h2 className="card-title">Pilares del mes</h2>
                {planContent.distribucion_pilares.map((p, i) => (
                  <div key={i} className="pilar">
                    <div className="pilar-row">
                      <span className="pilar-name">{p.pilar}</span>
                      <span className="pilar-pct">{p.porcentaje}%</span>
                    </div>
                    <div className="pilar-bar">
                      <div className="pilar-bar-fill" style={{ width: `${Math.min(100, Math.max(0, p.porcentaje))}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Fechas especiales del mes: efemérides para saludar, contenido
                o promos puntuales. Da contexto y sensación de estrategia. */}
            {planContent.efemerides && planContent.efemerides.length > 0 && (
              <div className="card">
                <div className="card-label">Calendario</div>
                <h2 className="card-title">📅 Fechas especiales del mes</h2>
                <p style={{ margin: "0 0 10px", fontSize: 13, color: "#666", lineHeight: 1.5 }}>
                  Fechas que tenemos en cuenta este mes para el contenido. Algunas
                  son ideales para una promo puntual: si te interesa alguna, avisanos.
                </p>
                <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
                  {planContent.efemerides.map((e, i) => (
                    <li
                      key={i}
                      style={{
                        padding: "10px 0",
                        borderBottom:
                          i < planContent.efemerides!.length - 1 ? "1px solid #f0f0f0" : "none",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ fontWeight: 600, fontSize: 14 }}>{e.nombre}</span>
                        <span style={{ fontSize: 12, color: "#999" }}>{e.fecha}</span>
                        {e.tipo === "comercial" && (
                          <span style={{ fontSize: 11, color: "#B45309", background: "#FEF3C7", padding: "1px 6px", borderRadius: 8 }}>
                            promo
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, color: "#666", marginTop: 2, lineHeight: 1.5 }}>{e.idea}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Temas destacados */}
            {planContent.temas_destacados && planContent.temas_destacados.length > 0 && (
              <div className="card">
                <div className="card-label">Ideas concretas</div>
                <h2 className="card-title">Las piezas del mes</h2>
                {planContent.temas_destacados.map((t, i) => (
                  <div key={i} className="tema">
                    <div className="tema-head">
                      <div className="tema-title">{i + 1}. {t.titulo}</div>
                      <div className="tema-tags">
                        {t.formato && <span className="tag">{t.formato}</span>}
                        {t.pilar && <span className="tag yellow">{t.pilar}</span>}
                        {t.fecha && <span className="tag">{t.fecha}</span>}
                      </div>
                    </div>
                    <div className="tema-desc">{t.descripcion}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Campañas */}
            {planContent.campanas && planContent.campanas.length > 0 && (
              <div className="card">
                <div className="card-label">Momentos clave</div>
                <h2 className="card-title">Campañas del mes</h2>
                {planContent.campanas.map((c, i) => (
                  <div key={i} style={{ paddingBottom: 12, marginBottom: 12, borderBottom: i < planContent.campanas.length - 1 ? "1px solid #f0f0f0" : "none" }}>
                    <div style={{ fontWeight: 700, fontSize: 15 }}>{c.nombre}</div>
                    <div style={{ fontSize: 12, color: "#777", marginTop: 2 }}>{c.fechas}</div>
                    <div style={{ fontSize: 13, color: "#555", marginTop: 6, lineHeight: 1.5 }}>{c.detalle}</div>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="card">
            <div className="empty">
              Todavía no hay un plan de contenido activo para este período. En cuanto lo aprobemos, va a aparecer acá.
            </div>
          </div>
        )}

        {/* Calendario de contenidos — todo lo planificado, en vivo */}
        {/* Tu contenido, en vivo: la línea de producción de lo que viene (19/10/2026). */}
        {(() => {
          const linea = lineaDeProduccion(upcoming, hoyYmd());
          if (!linea.piezas.length) return null;
          return (
            <div className="card">
              <div className="card-label">Tu contenido, en vivo</div>
              <h2 className="card-title">Lo que estamos preparando</h2>
              <PortalProduccion {...linea} />
            </div>
          );
        })()}

        {upcoming.length > 0 && (
          <div className="card">
            <div className="card-label">Calendario de contenidos</div>
            <h2 className="card-title">Tu calendario</h2>
            <p style={{ fontSize: 13, color: "#555", margin: "0 0 16px", lineHeight: 1.5 }}>
              Lo que viene y lo que ya publicamos. Tocá una pieza para verla en
              detalle (texto, imagen y más) y dejar tu comentario — le llega al
              equipo al instante. Usá las flechas para ver otros meses.
            </p>
            <PortalContent pubs={upcoming} token={params.token} />
          </div>
        )}

        {plantillasCanva && (
          <a
            href={plantillasCanva}
            target="_blank"
            rel="noreferrer"
            className="card"
            style={{ display: "block", textDecoration: "none", color: "inherit" }}
          >
            <div className="card-label">Tus plantillas</div>
            <h2 className="card-title">Plantillas de Canva de tu marca</h2>
            <p style={{ fontSize: 13, color: "#555", margin: 0, lineHeight: 1.5 }}>
              Las mismas que usa tu equipo, con tus colores y tipografías. Tocá acá, elegí «Usar plantilla» y se
              crea tu propia copia para sumar contenido cuando quieras →
            </p>
          </a>
        )}

        {mostrarRecomendar && ref?.ref_code && <PortalRecomendar code={ref.ref_code} recomendados={recomendados} />}

        <div className="footer">
          {AGENCY.brand} · {AGENCY.legal_name}
          <br />
          ¿Querés cambiar algo? Hablanos por WhatsApp.
          <br />
          <a href={`/contrato/cliente/${cliente_id}?token=${params.token}`} target="_blank" rel="noreferrer" style={{ color: "inherit", fontWeight: 600 }}>
            📄 Tu carta acuerdo
          </a>
        </div>
      </div>
    </>
  );
}
