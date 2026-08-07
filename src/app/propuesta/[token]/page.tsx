import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdmin } from "@/lib/supabase/admin";
import {
  armarPropuesta,
  precioAr,
  volumenPack,
  mensajeWhatsapp,
  type PropuestaVista,
  type PackCatalogo,
  type ServicioCatalogo,
} from "@/lib/propuestas/build";
import { INCLUIDO_EN_TODOS, ADICIONALES, LETRA_CHICA } from "@/lib/propuestas/incluido";
import { PropuestaAcciones, BotonPdf } from "@/components/propuesta-acciones";

export const dynamic = "force-dynamic";

/** Datos de la agencia que van en el documento. Fuente: jdmedia.com.ar. */
const AGENCIA = {
  nombre: "JD MEDIA",
  claim: "Estrategia, diseño y contenido que convierte",
  frase: "No hacemos fórmulas. Pensamos marcas.",
  web: "https://jdmedia.com.ar",
  webLabel: "jdmedia.com.ar",
  instagram: "jdmedia.digital",
  whatsapp: "5493513865433",
  whatsappLabel: "+54 9 351 386 5433",
  ciudad: "Córdoba, Argentina",
};

interface ProposalRow {
  id: string;
  token: string;
  empresa: string;
  contacto_nombre: string | null;
  rubro_slug: string | null;
  pack_sugerido: string | null;
  servicios: string[] | null;
  ia: { titular?: string; diagnostico?: string; puntos?: string[] } | null;
  aperturas: number;
}

/** `cache` para que generateMetadata y la página no peguen dos veces a la base. */
const cargar = cache(async (token: string) => {
  const admin = createAdmin();
  const { data } = await admin
    .from("proposals")
    .select("id, token, empresa, contacto_nombre, rubro_slug, pack_sugerido, servicios, ia, aperturas")
    .eq("token", token)
    .maybeSingle();
  if (!data) return null;

  const [{ data: serviciosRaw }, { data: packsRaw }] = await Promise.all([
    admin.from("services").select("slug, name, description, web_url").eq("active", true).order("orden"),
    admin.from("agency_packs").select("slug, nombre, precio_mensual, descripcion, reels, posts, dias_historias, orden"),
  ]);

  return {
    row: data as ProposalRow,
    servicios: (serviciosRaw ?? []) as ServicioCatalogo[],
    packs: (packsRaw ?? []) as PackCatalogo[],
  };
});

export async function generateMetadata({
  params,
}: {
  params: { token: string };
}): Promise<Metadata> {
  const data = await cargar(params.token);
  if (!data) return { title: "Propuesta — JD MEDIA" };
  const title = `Propuesta para ${data.row.empresa} — JD MEDIA`;
  return {
    title,
    description: AGENCIA.claim,
    // Sin indexar: es un documento comercial de un prospecto puntual, no una
    // página de la web.
    robots: { index: false, follow: false },
    // La tarjeta que se ve al pegar el link en WhatsApp (opengraph-image.tsx).
    openGraph: { title, description: AGENCIA.claim, type: "website" },
    twitter: { card: "summary_large_image", title, description: AGENCIA.claim },
  };
}

export default async function PropuestaPage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams?: { preview?: string };
}) {
  const data = await cargar(params.token);
  if (!data) notFound();

  const { row, servicios, packs } = data;

  // Contar la apertura. `?preview=1` es cuando la mira alguien del equipo: no
  // ensucia el dato, que existe justamente para saber si el prospecto la abrió.
  if (!searchParams?.preview) {
    const ahora = new Date().toISOString();
    // Con await: en serverless la request se corta al devolver el HTML y un
    // update lanzado sin esperar se pierde a veces. Es una escritura chica.
    await createAdmin()
      .from("proposals")
      .update({
        aperturas: (row.aperturas ?? 0) + 1,
        ultima_apertura_at: ahora,
        ...(row.aperturas ? {} : { primera_apertura_at: ahora }),
      })
      .eq("id", row.id);
  }

  const p = armarPropuesta({
    empresa: row.empresa,
    contactoNombre: row.contacto_nombre,
    rubroSlug: row.rubro_slug,
    packSugerido: row.pack_sugerido,
    servicios: row.servicios,
    catalogo: servicios,
    packs,
    ia: row.ia,
  });

  const hoy = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(new Date());
  const waHref = `https://wa.me/${AGENCIA.whatsapp}?text=${encodeURIComponent(mensajeWhatsapp(p.empresa))}`;

  return (
    <div className="min-h-screen bg-[#0A0A0B] text-white [color-scheme:dark] print:bg-white print:text-black">
      {/* La marca es amarilla sobre negro: en la impresión hay que forzar que
          los fondos salgan, si no el PDF sale en blanco y pierde todo. */}
      <style>{`
        @media print {
          @page { size: A4; margin: 14mm; }
          .no-print { display: none !important; }
          .print-break { break-before: page; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
        }
      `}</style>

      <div className="mx-auto max-w-3xl px-5 py-10 sm:px-8 sm:py-14">
        {/* ── Portada ── */}
        <header>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2.5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#FFD400] text-sm font-black tracking-tight text-black">
                JD
              </span>
              <span className="text-sm font-semibold uppercase tracking-[0.2em] text-white/70 print:text-black/70">
                {AGENCIA.nombre}
              </span>
            </div>
            <span className="text-xs uppercase tracking-widest text-white/40 print:text-black/50">
              {hoy}
            </span>
          </div>

          <p className="mt-12 text-sm font-medium uppercase tracking-[0.18em] text-[#FFD400]">
            Propuesta para
          </p>
          <h1 className="mt-2 text-4xl font-black leading-[1.05] tracking-tight sm:text-6xl">
            {p.empresa}
          </h1>
          <p className="mt-6 max-w-xl text-xl font-medium leading-snug text-white/85 sm:text-2xl print:text-black/80">
            {p.titular}
          </p>
          {p.contactoNombre && (
            <p className="mt-5 text-sm text-white/50 print:text-black/60">
              Preparada para {p.contactoNombre}.
            </p>
          )}
        </header>

        <Linea />

        {/* ── El diagnóstico ── */}
        <Seccion numero="01" titulo={p.personalizada ? "Lo que nos contaste" : "Lo que vemos en tu rubro"}>
          <p className="text-lg leading-relaxed text-white/80 print:text-black/80">{p.diagnostico}</p>

          {p.puntosIa.length > 0 && (
            <div className="mt-7 rounded-2xl border border-[#FFD400]/25 bg-[#FFD400]/[0.06] p-5 print:border-black/20 print:bg-black/[0.03]">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#FFD400]">
                Cómo lo resolvemos en tu caso
              </p>
              <ul className="mt-4 space-y-3">
                {p.puntosIa.map((punto, i) => (
                  <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-white/85 print:text-black/80">
                    <span className="mt-1 shrink-0 text-[#FFD400]">✦</span>
                    <span>{punto}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Seccion>

        {/* ── Qué proponemos ── */}
        <Seccion numero="02" titulo="Qué proponemos">
          <div className="grid gap-3 sm:grid-cols-2">
            {p.sugeridos.map((s) => (
              <div
                key={s.slug}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 print:border-black/15 print:bg-transparent"
              >
                <h3 className="text-base font-bold">{s.name}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60 print:text-black/70">
                  {limpiar(s.description)}
                </p>
              </div>
            ))}
          </div>
          {p.servicios.length > p.sugeridos.length && (
            <p className="mt-5 text-sm text-white/45 print:text-black/60">
              La agencia también hace{" "}
              <span className="text-white/70 print:text-black/80">
                {p.servicios
                  .filter((s) => !p.sugeridos.some((x) => x.slug === s.slug))
                  .map((s) => s.name)
                  .join(", ")}
              </span>
              . Se puede sumar cuando haga falta.
            </p>
          )}
        </Seccion>

        {/* ── Ideas concretas ── */}
        <Seccion numero="03" titulo="Ideas que arrancaríamos el primer mes">
          <p className="mb-5 text-sm text-white/50 print:text-black/60">
            No son ideas sueltas: es el tipo de contenido que funciona en {p.rubro.nombre}.
          </p>
          <ul className="space-y-3">
            {p.ideas.map((idea, i) => (
              <li key={i} className="flex gap-4 rounded-xl border border-white/10 p-4 print:border-black/15">
                <span className="text-sm font-black text-[#FFD400]">{String(i + 1).padStart(2, "0")}</span>
                <span className="text-[15px] leading-relaxed text-white/80 print:text-black/80">{idea}</span>
              </li>
            ))}
          </ul>
        </Seccion>

        {/* ── Cómo trabajamos ──
            Antes esto eran dos secciones (el proceso y el arranque) que decían
            media cosa cada una y repetían lo de la aprobación del calendario.
            Contado como una línea de tiempo se lee de un saque y se entiende
            qué pasa desde que dice que sí. */}
        <Seccion numero="04" titulo="Cómo trabajamos">
          <ol className="relative space-y-5 border-l border-white/10 pl-6 print:border-black/20">
            {[
              [
                "Reunión de 15 minutos",
                "Nos contás el negocio y te decimos con qué arrancaríamos. De ahí sale el plan del primer mes.",
              ],
              [
                "Semana 1: se ordena",
                "Diagnóstico, manual de marca, perfiles y el calendario del mes. Esa semana no se publica: se ordena.",
              ],
              [
                "Vos aprobás, nosotros producimos",
                "Ves el calendario completo antes de que se produzca nada. Community manager, diseñador y editor asignados a tu cuenta.",
              ],
              [
                "Se publica en fecha",
                "Todo sale el día que estaba planificado, en Instagram, Facebook y TikTok. Y las campañas de Meta se ajustan cada semana.",
              ],
              [
                "Reporte mensual",
                "Qué se publicó, qué funcionó y qué cambiamos el mes que viene. Con números, no con sensaciones.",
              ],
            ].map(([t, d], i) => (
              <li key={t} className="relative">
                <span className="absolute -left-[31px] top-1 grid h-5 w-5 place-items-center rounded-full bg-[#FFD400] text-[10px] font-black text-black">
                  {i + 1}
                </span>
                <h3 className="text-base font-bold">{t}</h3>
                <p className="mt-1 text-sm leading-relaxed text-white/60 print:text-black/70">{d}</p>
              </li>
            ))}
          </ol>
          <p className="mt-6 rounded-xl border border-[#FFD400]/25 bg-[#FFD400]/[0.06] p-4 text-sm leading-relaxed text-white/80 print:border-black/20 print:bg-transparent print:text-black/75">
            <b className="text-white print:text-black">Y tenés tu propia plataforma:</b> entrás
            cuando querés, ves el calendario del mes, aprobás cada pieza y mirás los resultados de
            tus redes. No tenés que esperar a que te mandemos nada.
          </p>
        </Seccion>

        {/* ── Inversión ── */}
        <Seccion numero="05" titulo="Inversión" className="print-break">
          {/* La aclaración de arriba es la que evita que el pack se lea como
              "tantos reels por tanta plata" y se compare contra un freelance
              que cobra por pieza. El precio cubre el servicio entero. */}
          <p className="mb-5 rounded-xl border border-white/10 bg-white/[0.03] p-4 text-[15px] leading-relaxed text-white/75 print:border-black/15 print:bg-transparent print:text-black/75">
            Estos son los planes del servicio de{" "}
            <b className="text-white print:text-black">Gestión de Redes</b>. No es un
            precio por pieza: el abono cubre el servicio completo —estrategia, manual de
            marca, producción, publicación, gestión de la pauta en Meta y reporte—, y lo
            que cambia entre un plan y otro es el volumen de contenido.
          </p>

          <div className="space-y-3">
            {p.packs.map((pack) => {
              const esRecomendado = pack.slug === p.packRecomendado?.slug;
              const volumen = volumenPack(pack);
              return (
                <div
                  key={pack.slug}
                  className={`rounded-2xl border p-5 ${
                    esRecomendado
                      ? "border-[#FFD400] bg-[#FFD400]/[0.07] print:bg-black/[0.04]"
                      : "border-white/10 bg-white/[0.02] print:border-black/15 print:bg-transparent"
                  }`}
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h3 className="flex items-center gap-2 text-lg font-bold">
                      {pack.nombre}
                      {esRecomendado && (
                        <span className="rounded-full bg-[#FFD400] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-black">
                          Recomendado para vos
                        </span>
                      )}
                    </h3>
                    <p className="text-xl font-black tabular-nums">
                      {precioAr(pack.precio_mensual)}
                      {pack.precio_mensual != null && (
                        <span className="ml-1 text-xs font-medium text-white/50 print:text-black/60">/mes</span>
                      )}
                    </p>
                  </div>
                  {volumen && (
                    <p className="mt-2 text-sm font-medium text-[#FFD400]">{volumen}</p>
                  )}
                  <p className="mt-1.5 text-sm leading-relaxed text-white/60 print:text-black/70">
                    {pack.descripcion}
                  </p>
                </div>
              );
            })}
          </div>
          {/* Lo que incluye el servicio, sí o sí, en cualquiera de los planes. */}
          <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.02] p-5 print:border-black/15 print:bg-transparent">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#FFD400]">
              Incluido en todos los planes
            </p>
            {/* Denso a propósito: son 16 ítems y en lista con viñetas ocupaban
                media pantalla. Agrupados y separados por puntos se barren de
                un vistazo, que es lo que hace alguien leyendo en el celular. */}
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {INCLUIDO_EN_TODOS.map((grupo) => (
                <div key={grupo.titulo}>
                  <h4 className="flex items-center gap-1.5 text-sm font-bold">
                    <span className="text-[#FFD400]">✦</span>
                    {grupo.titulo}
                  </h4>
                  <p className="mt-1 text-[13px] leading-relaxed text-white/60 print:text-black/70">
                    {grupo.items.join(" · ")}
                  </p>
                </div>
              ))}
            </div>
            {ADICIONALES.length > 0 && (
              <p className="mt-5 border-t border-white/10 pt-4 text-[13px] leading-relaxed text-white/55 print:border-black/15 print:text-black/70">
                <b className="text-white/80 print:text-black">Aparte del abono:</b>{" "}
                {ADICIONALES.join(" ")}
              </p>
            )}
          </div>

          {/* La letra chica adelante y no escondida: es lo que evita la discusión
              a mitad de camino (sobre todo el presupuesto de pauta). */}
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {LETRA_CHICA.map((l) => (
              <div
                key={l.titulo}
                className="rounded-xl border border-white/10 p-4 print:border-black/15"
              >
                <h4 className="text-sm font-bold">{l.titulo}</h4>
                <p className="mt-1.5 text-[13px] leading-relaxed text-white/60 print:text-black/70">
                  {l.texto}
                </p>
              </div>
            ))}
          </div>

          <p className="mt-4 text-xs leading-relaxed text-white/40 print:text-black/60">
            Precios mensuales vigentes a {hoy}, publicados en{" "}
            <a href={AGENCIA.web} className="text-white/70 underline print:text-black/70">
              {AGENCIA.webLabel}
            </a>
            . {otrosServicios(p)} <b className="text-white/60 print:text-black/70">
              El primer mes se cobra proporcional
            </b>{" "}
            a los días desde que arrancás; después la factura sale el 25 y vence el 1°.
          </p>
        </Seccion>

        {/* ── Quiénes somos ── */}
        <Seccion numero="06" titulo="Quiénes somos">
          <p className="text-lg leading-relaxed text-white/80 print:text-black/80">
            {AGENCIA.frase} Agencia de {AGENCIA.ciudad}, con equipo propio de estrategia,
            community management, diseño, edición audiovisual y pauta. Hoy llevamos las redes de
            marcas de gastronomía, salud, automotor, indumentaria, construcción, turismo y eventos.
          </p>
          {p.experiencia && (
            <p className="mt-4 rounded-xl border border-[#FFD400]/25 bg-[#FFD400]/[0.06] p-4 text-[15px] text-white/85 print:border-black/20 print:bg-black/[0.03] print:text-black/80">
              <span className="mr-1.5 text-[#FFD400]">✦</span>
              {p.experiencia}
            </p>
          )}
        </Seccion>

        {/* ── Cierre ── */}
        <div className="mt-14 rounded-3xl border border-[#FFD400]/30 bg-gradient-to-b from-[#FFD400]/10 to-transparent p-7 text-center print:border-black/20 print:from-transparent">
          <h2 className="text-2xl font-black leading-tight sm:text-3xl">
            ¿Coordinamos 15 minutos?
          </h2>
          <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-white/65 print:text-black/70">
            Te mostramos cómo lo haríamos puntualmente para {p.empresa}, con el calendario del
            primer mes sobre la mesa.
          </p>
          <PropuestaAcciones waHref={waHref} web={AGENCIA.web} />
          <p className="mt-6 text-xs text-white/40 print:text-black/60">
            {AGENCIA.whatsappLabel} · {AGENCIA.webLabel} · @{AGENCIA.instagram}
          </p>
        </div>

        <footer className="mt-10 flex items-center justify-between border-t border-white/10 pt-5 text-xs text-white/35 print:border-black/15 print:text-black/50">
          <span>
            {AGENCIA.nombre} — {AGENCIA.ciudad}
          </span>
          <BotonPdf />
        </footer>
      </div>
    </div>
  );
}

/**
 * Los otros servicios de la agencia se cotizan aparte: hay que decirlo o el
 * prospecto asume que un sitio web o el branding entran en el abono.
 */
function otrosServicios(p: PropuestaVista): string {
  // `paid_media` queda afuera a propósito: la gestión de las campañas de Meta
  // YA entra en el abono, así que listarlo acá como "aparte" se contradice con
  // lo que dice el bloque de incluidos.
  const otros = p.servicios
    .filter((s) => s.slug !== "gestion_redes" && s.slug !== "paid_media")
    .map((s) => s.name);
  if (otros.length === 0) return "";
  return `${otros.join(", ")} se cotizan aparte, según lo que necesites.`;
}

/** Las descripciones de la web traen la coletilla de SEO; en la propuesta sobra. */
function limpiar(desc: string | null): string {
  if (!desc) return "";
  return desc.replace(/\s*JD MEDIA,?\s*(Córdoba)?\.?\s*$/i, "").trim();
}

function Linea() {
  return <div className="mt-12 h-px w-full bg-gradient-to-r from-[#FFD400]/60 to-transparent" />;
}

function Seccion({
  numero,
  titulo,
  children,
  className = "",
}: {
  numero: string;
  titulo: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`mt-12 ${className}`}>
      <div className="mb-5 flex items-baseline gap-3">
        <span className="text-xs font-black tracking-widest text-[#FFD400]">{numero}</span>
        <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">{titulo}</h2>
      </div>
      {children}
    </section>
  );
}
