import { cache } from "react";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { createAdmin } from "@/lib/supabase/admin";
import {
  armarPropuesta,
  precioAr,
  mensajeWhatsapp,
  partirPunto,
  type PackCatalogo,
  type ServicioCatalogo,
} from "@/lib/propuestas/build";
import {
  armarInversion,
  volumenPrimerMes,
  proporcionalPrimerMes,
  textoJornadas,
  type CuentaPropuesta,
} from "@/lib/propuestas/inversion";
import { INCLUIDO_EN_TODOS, LETRA_CHICA } from "@/lib/propuestas/incluido";
import { CSS_PROPUESTA } from "@/lib/propuestas/estilo";
import { PropuestaAcciones, BotonPdf } from "@/components/propuesta-acciones";
import { BarraPropuesta } from "@/components/propuesta-editor";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/** Datos de la agencia que van en el documento. Fuente: jdmedia.com.ar. */
const AGENCIA = {
  nombre: "JD MEDIA",
  claim: "Estrategia, diseño y contenido que convierte",
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
  rubro_texto: string | null;
  pack_sugerido: string | null;
  servicios: string[] | null;
  instagram: string | null;
  ia: { titular?: string; diagnostico?: string; puntos?: string[]; ideas?: string[] } | null;
  aperturas: number;
  // ── 0159 ──
  cuentas: CuentaPropuesta[] | null;
  descuento_monto: number | null;
  fecha_inicio: string | null;
  ciudad: string | null;
}

const cargar = cache(async (token: string) => {
  const admin = createAdmin();
  // Las columnas de la 0159 pueden no estar aplicadas todavía: si la consulta
  // falla por eso, se reintenta con el set viejo y el documento sale igual.
  const campos =
    "id, token, empresa, contacto_nombre, rubro_slug, rubro_texto, pack_sugerido, servicios, instagram, ia, aperturas";
  let data: ProposalRow | null = null;
  const conNuevas = await admin
    .from("proposals")
    .select(`${campos}, cuentas, descuento_monto, fecha_inicio, ciudad`)
    .eq("token", token)
    .maybeSingle();
  if (conNuevas.error) {
    const viejo = await admin.from("proposals").select(campos).eq("token", token).maybeSingle();
    data = viejo.data as ProposalRow | null;
  } else {
    data = conNuevas.data as ProposalRow | null;
  }
  if (!data) return null;

  const [{ data: serviciosRaw }, { data: packsRaw }] = await Promise.all([
    admin.from("services").select("slug, name, description, web_url").eq("active", true).order("orden"),
    admin
      .from("agency_packs")
      .select("slug, nombre, precio_mensual, descripcion, reels, posts, dias_historias, orden"),
  ]);

  return {
    row: data,
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
    robots: { index: false, follow: false },
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

  // `?preview=1` es cuando la mira alguien del equipo: no ensucia el contador,
  // que existe justamente para saber si la abrió el prospecto.
  if (!searchParams?.preview) {
    const ahora = new Date().toISOString();
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

  // Las cuentas: lo que se cargó en la propuesta o, si la 0159 no está aplicada,
  // una sola con el pack sugerido.
  const cuentas: CuentaPropuesta[] =
    Array.isArray(row.cuentas) && row.cuentas.length > 0
      ? row.cuentas
      : [
          {
            handle: row.instagram?.trim() || row.empresa,
            packSlug: p.packRecomendado?.slug ?? "presencia",
          },
        ];

  const inv = armarInversion(cuentas, packs, row.descuento_monto ?? 0);
  const mes1 = volumenPrimerMes(inv.lineas);
  const prop = proporcionalPrimerMes(inv.total, row.fecha_inicio);
  const variasCuentas = inv.lineas.length > 1;

  const hoy = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(new Date());
  const waHref = `https://wa.me/${AGENCIA.whatsapp}?text=${encodeURIComponent(mensajeWhatsapp(p.empresa))}`;
  const soyDelEquipo = await haySesion();

  const referencia = `${p.empresa} · Propuesta de trabajo`;
  const cabecera = (
    <div className="top">
      <div className="marca">
        <span className="jd">JD</span>
        <span className="nom">JD Media</span>
      </div>
      <span className="fecha">
        Propuesta para {p.empresa}
        {p.contactoNombre ? ` · ${p.contactoNombre}` : ""} · {hoy}
      </span>
    </div>
  );
  const pie = (n: number, de: number) => (
    <>
      <div className="empuja" />
      <div className="pie">
        <span>{referencia}</span>
        <span>
          Página {n} de {de}
        </span>
      </div>
    </>
  );

  const hojas = 4;

  return (
    <div className="min-h-screen bg-[#0A0A0B] [color-scheme:dark]">
      <style>{CSS_PROPUESTA}</style>

      <div className="doc mx-auto max-w-3xl">
        {soyDelEquipo && (
          <div className="no-print px-4 pt-4">
            <BarraPropuesta
              propuestaId={row.id}
              personalizada={p.personalizada}
              texto={{
                titular: p.titular,
                diagnostico: p.diagnostico,
                puntos: p.puntosIa,
                ideas: p.ideas,
              }}
            />
          </div>
        )}

        {/* ══════════ 1 · el encuadre ══════════ */}
        <div className="hoja">
          {cabecera}

          <div className="eyebrow">Propuesta de trabajo</div>
          <h1>{p.empresa}</h1>
          <p className="subtitulo">
            Gestión de redes y publicidad en Meta
            {cuentas.length > 1 ? ` para ${cuentas.map((c) => c.handle).join(" y ")}` : ""}
          </p>
          <p className="lead">
            {p.diagnostico}{" "}
            <b>Entendemos hacia dónde estás llevando la marca y queremos acompañarte en ese camino.</b>{" "}
            Acá está cómo trabajaríamos, qué se entrega cada mes y cuál sería la inversión.
          </p>

          <div className="linea" />

          <section>
            <div className="cab">
              <span className="n">01</span>
              <h2>Lo que vamos a hacer</h2>
            </div>
            <div className="pasos">
              {p.puntosIa.map((punto, i) => {
                const { titulo, texto } = partirPunto(punto);
                return (
                  <div className="paso" key={i}>
                    <span className="i">{i + 1}</span>
                    <div>
                      {titulo && <h4>{titulo}</h4>}
                      <p style={titulo ? undefined : { marginTop: 0 }}>{texto}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section>
            <div className="cab">
              <span className="n">02</span>
              <h2>El equipo que te devuelve el tiempo</h2>
            </div>
            <p className="lead" style={{ marginTop: 0 }}>
              <b>Community manager, diseñador gráfico, editor audiovisual y un especialista en Meta Ads</b>{" "}
              asignados a la cuenta, con dos coordinadoras arriba: una cuida la estética y que la
              estrategia se cumpla, la otra que cada pieza salga en tiempo y forma. Grupo de WhatsApp
              directo con el equipo, y acceso a la plataforma de JD MEDIA para aprobar el calendario y
              ver los resultados cuando quieras.
            </p>
          </section>

          {pie(1, hojas)}
        </div>

        {/* ══════════ 2 · qué incluye e ideas ══════════ */}
        <div className="hoja">
          {cabecera}

          <section>
            <div className="cab">
              <span className="n">03</span>
              <h2>Todo lo que incluye el abono</h2>
            </div>
            <div className="grupos">
              {INCLUIDO_EN_TODOS.map((g) => (
                <div className="grupo" key={g.titulo}>
                  <h4>
                    <span>✦</span>
                    {g.titulo}
                  </h4>
                  <p>{g.items.join(" · ")}.</p>
                </div>
              ))}
            </div>
          </section>

          {p.ideas.length > 0 && (
            <section>
              <div className="cab">
                <span className="n">04</span>
                <h2>Con qué arrancamos</h2>
                <span className="aside">Primeras piezas</span>
              </div>
              <ul className="vinetas">
                {p.ideas.slice(0, 4).map((idea, i) => (
                  <li key={i}>{idea}</li>
                ))}
              </ul>
            </section>
          )}

          {pie(2, hojas)}
        </div>

        {/* ══════════ 3 · las cuentas y el primer mes ══════════ */}
        <div className="hoja">
          {cabecera}

          <section>
            <div className="cab">
              <span className="n">05</span>
              <h2>{variasCuentas ? "Las cuentas" : "La cuenta"}</h2>
              {variasCuentas && <span className="aside">Precio por cuenta</span>}
            </div>
            <div className={`cuentas ${inv.lineas.length >= 3 ? "de3" : inv.lineas.length === 2 ? "de2" : ""}`}>
              {inv.lineas.map((l, i) => (
                <div className={`cuenta ${i === 0 && variasCuentas ? "fuerte" : ""}`} key={l.handle + i}>
                  <div className="handle">{l.handle}</div>
                  <div className="rol">Pack {l.packNombre}</div>
                  <div className="precio">
                    {precioAr(l.precio)}
                    {l.precio != null && <small>/mes</small>}
                  </div>
                  {l.volumen && <div className="vol">{l.volumen}</div>}
                  {l.nota && <p className="desc">{l.nota}</p>}
                </div>
              ))}
            </div>
            <div className="aviso">
              <b>Publicamos también en Facebook y TikTok.</b> Son canales de tráfico orgánico que la
              mayoría de las marcas está dejando sin usar, y el contenido ya está producido.
            </div>
          </section>

          {mes1.length > 0 && (
            <section>
              <div className="cab">
                <span className="n">06</span>
                <h2>Qué se entrega el primer mes</h2>
              </div>
              <div className="etapas">
                <div className="etapa">
                  <div className="w">Primera semana</div>
                  <h4>Se ordena, todavía no se publica</h4>
                  <ul>
                    <li>Reunión de onboarding con todo el equipo.</li>
                    <li>Informe de diagnóstico y plan de acción.</li>
                    <li>Manual de marca y moodboard de cada cuenta.</li>
                    <li>Rediseño de perfiles, biografías, destacadas y links.</li>
                    <li>Calendario del mes, para que lo apruebes antes de producir.</li>
                  </ul>
                </div>
                <div className="etapa marcada">
                  <div className="w">Semanas 2, 3 y 4</div>
                  <h4>Sale el contenido</h4>
                  <ul>
                    {mes1.map((m) => (
                      <li key={m.handle}>
                        {variasCuentas ? <b>{m.handle}: </b> : null}
                        {m.texto}.
                      </li>
                    ))}
                    <li>Las campañas de Meta al aire y optimizándose cada semana.</li>
                    <li>Reporte de cierre con las métricas del mes.</li>
                  </ul>
                </div>
              </div>
              <div className="aviso">
                <b>Por qué el primer mes entrega tres semanas:</b> la primera se usa para armar las
                bases y no se publica; reemplaza el cargo de puesta en marcha, que no cobramos.{" "}
                <b>Desde el segundo mes, {variasCuentas ? "los packs van completos" : "el pack va completo"}.</b>
              </div>
            </section>
          )}

          {pie(3, hojas)}
        </div>

        {/* ══════════ 4 · la inversión ══════════ */}
        <div className="hoja">
          {cabecera}

          <section>
            <div className="cab">
              <span className="n">07</span>
              <h2>La inversión</h2>
              {variasCuentas && <span className="aside">Todas las cuentas</span>}
            </div>

            <div className="tabla">
              {inv.lineas.map((l, i) => (
                <div className="fila" key={l.handle + i}>
                  <div className="q">
                    <div className="t">
                      {l.handle} — Pack {l.packNombre}
                    </div>
                    {l.volumen && <div className="s">{l.volumen}</div>}
                  </div>
                  <div className="m">{precioAr(l.precio)}</div>
                </div>
              ))}

              {inv.hayDescuento && (
                <>
                  <div className="fila sub">
                    <div className="q">
                      <div className="t">Subtotal</div>
                    </div>
                    <div className="m">{precioAr(inv.subtotal)}</div>
                  </div>
                  <div className="fila rebaja">
                    <div className="q">
                      <div className="t">Descuento por llevar las {inv.lineas.length} cuentas</div>
                      <div className="s">Se mantiene mientras sigan activas.</div>
                    </div>
                    <div className="m">– {precioAr(inv.descuento)}</div>
                  </div>
                </>
              )}

              <div className="fila total">
                <div className="q">
                  <div className="t">Total mensual</div>
                  <div className="s">
                    {variasCuentas ? "Todas las cuentas, todo incluido. " : "Todo incluido. "}
                    La inversión en pauta va aparte.
                  </div>
                </div>
                <div className="m">
                  {inv.hayDescuento && <span className="tachado">{precioAr(inv.subtotal)}</span>}
                  {precioAr(inv.total)}
                </div>
              </div>
            </div>

            {prop && (
              <div className="arranque">
                <div>
                  <div className="k">Lo que se abona ahora</div>
                  <div className="v">{precioAr(prop.monto)}</div>
                </div>
                <div className="d">
                  {capitalizar(prop.mes)} va <b>proporcional a los días que quedan</b> ({prop.dias} de{" "}
                  {prop.diasDelMes}). Después, <b>{precioAr(inv.total)} el 1° de cada mes</b>.
                </div>
              </div>
            )}

            <div className="claras">
              {LETRA_CHICA.map((l) => (
                <div key={l.titulo}>
                  <b>{l.titulo}.</b> {l.texto}
                </div>
              ))}
            </div>

            <p className="nota">
              <b>Cómo se cobra:</b> mes adelantado, el 1° de cada mes
              {prop ? "" : "; si se arranca un día distinto, el primer mes va proporcional a los días trabajados"}.{" "}
              <b>Aparte del abono:</b> {textoJornadas(row.ciudad)} Diseño gráfico, desarrollo web y
              campañas de mayor escala se cotizan cuando hagan falta. Precios vigentes a {hoy},
              publicados en{" "}
              <a href={AGENCIA.web} target="_blank" rel="noreferrer">
                {AGENCIA.webLabel}
              </a>
              .
            </p>
          </section>

          <div className="cierre">
            <h2>Próximos pasos</h2>
            <p>
              Con tu confirmación arrancamos: la primera semana es de{" "}
              <b>onboarding, diagnóstico y calendario</b>, y el contenido empieza a salir la semana
              siguiente. Quedamos a disposición para cualquier consulta o ajuste.
            </p>
            <div className="datos">
              {AGENCIA.whatsappLabel} · {AGENCIA.webLabel} · @{AGENCIA.instagram}
            </div>
            <div className="no-print">
              <PropuestaAcciones waHref={waHref} web={AGENCIA.web} />
            </div>
          </div>

          {pie(4, hojas)}
        </div>

        <div className="no-print flex justify-end px-6 pb-8">
          <BotonPdf />
        </div>
      </div>
    </div>
  );
}

function capitalizar(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * ¿La está mirando alguien del equipo? La página es pública, así que esto NO
 * puede redirigir al login: solo decide si se muestra la barra de editar.
 */
async function haySesion(): Promise<boolean> {
  try {
    const {
      data: { user },
    } = await createClient().auth.getUser();
    return !!user;
  } catch {
    return false;
  }
}
