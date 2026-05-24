import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { AGENCY } from "@/lib/agency";
import { PrintButton } from "@/components/print-button";
import type { DiagnosticContent, DiagnosticRow } from "@/lib/diagnostics/schema";

export const dynamic = "force-dynamic";

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

const AREA_LABEL: Record<string, string> = {
  diseno: "Diseño",
  community: "Community",
  produccion: "Producción",
  paid: "Paid Media",
  estrategia: "Estrategia",
  desarrollo: "Desarrollo",
  otro: "Otro",
};

export default async function DiagnosticoPrintPage({
  params,
}: {
  params: { id: string };
}) {
  await requireUser();
  const supabase = createClient();
  const admin = createAdmin();

  const { data: client } = await supabase
    .from("clients")
    .select("id, nombre, rubro")
    .eq("id", params.id)
    .maybeSingle();
  if (!client) notFound();

  // Versión aprobada más reciente; si no hay, el último draft (vista previa).
  const { data: rows } = await admin
    .from("client_diagnostics")
    .select(
      "id, cliente_id, version, status, content, approved_at, generated_at, created_at"
    )
    .eq("cliente_id", params.id)
    .order("version", { ascending: false });

  const all = (rows ?? []) as unknown as DiagnosticRow[];
  const diag = all.find((d) => d.status === "approved") ?? all.find((d) => d.status === "draft");
  if (!diag) notFound();

  const c = diag.content as DiagnosticContent;
  const fechaInforme = diag.approved_at ?? diag.generated_at ?? diag.created_at;

  return (
    <>
      <style>{`
        @page { size: A4; margin: 18mm 16mm; }
        * { box-sizing: border-box; }
        body {
          background: #ececec;
          margin: 0;
          font-family: 'Inter', 'Helvetica Neue', system-ui, -apple-system, sans-serif;
          color: #1a1a1a;
          -webkit-font-smoothing: antialiased;
        }
        .doc {
          background: white;
          max-width: 820px;
          margin: 24px auto;
          padding: 56px 60px 80px;
          box-shadow: 0 4px 32px rgba(0,0,0,.08);
          line-height: 1.55;
          font-size: 13px;
          color: #232323;
        }

        .cover {
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 86vh;
          padding-bottom: 32px;
          border-bottom: 3px solid #FFD400;
          margin-bottom: 36px;
          page-break-after: always;
        }
        .cover-top {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .cover-brand {
          font-weight: 800;
          font-size: 18px;
          letter-spacing: -0.01em;
        }
        .cover-meta {
          font-size: 11px;
          color: #707070;
          text-align: right;
          line-height: 1.5;
        }
        .cover-title {
          font-size: 14px;
          color: #707070;
          text-transform: uppercase;
          letter-spacing: 0.18em;
          margin-bottom: 12px;
        }
        .cover-client {
          font-size: 56px;
          font-weight: 800;
          letter-spacing: -0.03em;
          line-height: 1;
          margin: 0;
          color: #1a1a1a;
        }
        .cover-rubro {
          margin-top: 14px;
          font-size: 17px;
          color: #404040;
        }
        .cover-foot {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          color: #707070;
          font-size: 11px;
        }
        .cover-version {
          display: inline-block;
          padding: 4px 10px;
          background: #FFD400;
          color: #1a1a1a;
          font-weight: 700;
          font-size: 11px;
          border-radius: 3px;
        }

        h2.section-title {
          font-size: 11px;
          letter-spacing: 0.2em;
          color: #707070;
          text-transform: uppercase;
          font-weight: 600;
          margin: 32px 0 4px;
        }
        h3.section-h {
          font-size: 22px;
          font-weight: 800;
          letter-spacing: -0.01em;
          margin: 0 0 18px;
          color: #1a1a1a;
        }
        .accent { color: #1a1a1a; border-left: 3px solid #FFD400; padding-left: 12px; }

        .bullets { margin: 0; padding: 0; list-style: none; }
        .bullets li {
          padding: 10px 0 10px 22px;
          position: relative;
          border-bottom: 1px solid #f0f0f0;
        }
        .bullets li:last-child { border-bottom: none; }
        .bullets li:before {
          content: "";
          position: absolute;
          left: 0;
          top: 18px;
          width: 8px;
          height: 8px;
          background: #FFD400;
          border-radius: 1px;
        }

        .numlist { margin: 0; padding: 0; list-style: none; counter-reset: n; }
        .numlist li {
          counter-increment: n;
          padding: 14px 0 14px 42px;
          position: relative;
          border-bottom: 1px solid #f0f0f0;
        }
        .numlist li:last-child { border-bottom: none; }
        .numlist li:before {
          content: counter(n);
          position: absolute;
          left: 0;
          top: 14px;
          width: 28px;
          height: 28px;
          background: #1a1a1a;
          color: #FFD400;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 12px;
        }
        .numlist .item-title { font-weight: 700; color: #1a1a1a; }
        .numlist .item-desc { margin-top: 4px; color: #404040; }
        .numlist .item-extra { margin-top: 6px; color: #707070; font-size: 11px; font-style: italic; }

        .twocol { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .card {
          border: 1px solid #e5e5e5;
          border-radius: 6px;
          padding: 12px 14px;
        }
        .card .ct { font-weight: 700; margin-bottom: 4px; color: #1a1a1a; }
        .card .cs { font-size: 12px; color: #555; }
        .card .meta { font-size: 11px; color: #707070; margin-top: 6px; }

        .kv { display: grid; grid-template-columns: 160px 1fr; gap: 6px 14px; font-size: 12.5px; }
        .kv .k { color: #707070; }
        .kv .v { color: #1a1a1a; }

        .tag {
          display: inline-block;
          padding: 2px 8px;
          font-size: 10px;
          font-weight: 600;
          border-radius: 3px;
          background: #f0f0f0;
          color: #404040;
          margin-right: 4px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .tag.alta { background: #fee2e2; color: #991b1b; }
        .tag.media { background: #fef3c7; color: #92400e; }
        .tag.baja { background: #e5e7eb; color: #374151; }

        .pillar {
          border: 1px solid #e5e5e5;
          border-radius: 6px;
          padding: 14px;
          background: #fafafa;
        }
        .pillar .pn { font-weight: 800; font-size: 14px; color: #1a1a1a; }
        .pillar .pd { font-size: 12px; color: #555; margin-top: 4px; }
        .pillar ul { margin: 8px 0 0; padding-left: 18px; font-size: 11.5px; color: #707070; }

        .quote {
          font-style: italic;
          color: #1a1a1a;
          padding: 12px 16px;
          background: #fffbe6;
          border-left: 3px solid #FFD400;
          border-radius: 0 4px 4px 0;
          margin: 14px 0;
        }

        .section { page-break-inside: avoid; }
        .section.break-before { page-break-before: always; }

        /* Top print bar (oculta al imprimir) */
        .print-bar {
          position: sticky;
          top: 0;
          background: #1a1a1a;
          color: #fff;
          padding: 10px 16px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          z-index: 10;
          font-size: 12px;
        }
        .print-bar a, .print-bar button {
          background: #FFD400;
          color: #1a1a1a;
          padding: 6px 14px;
          border-radius: 4px;
          font-weight: 700;
          border: none;
          cursor: pointer;
          font-size: 12px;
        }
        @media print {
          .print-bar { display: none; }
          body { background: white; }
          .doc { box-shadow: none; margin: 0; max-width: 100%; padding: 0; }
        }
      `}</style>

      <div className="print-bar">
        <div>
          <strong>{AGENCY.brand}</strong> · Diagnóstico inicial · {client.nombre}
          {diag.status === "draft" && " · DRAFT (vista previa)"}
        </div>
        <PrintButton />
      </div>

      <div className="doc">
        {/* PORTADA */}
        <div className="cover">
          <div className="cover-top">
            <div className="cover-brand">{AGENCY.brand}</div>
            <div className="cover-meta">
              {fmtDate(fechaInforme)}<br />
              Versión {diag.version}
            </div>
          </div>
          <div>
            <div className="cover-title">Diagnóstico inicial</div>
            <h1 className="cover-client">{client.nombre}</h1>
            {client.rubro && <div className="cover-rubro">{client.rubro}</div>}
          </div>
          <div className="cover-foot">
            <span>Análisis estratégico y plan de acción · primer trimestre</span>
            <span className="cover-version">v{diag.version}</span>
          </div>
        </div>

        {/* 1. RESUMEN EJECUTIVO */}
        <div className="section">
          <h2 className="section-title">01 · Resumen ejecutivo</h2>
          <h3 className="section-h accent">Lo crítico a primera vista</h3>
          <ul className="bullets">
            {c.resumen_ejecutivo.bullets.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </div>

        {/* 2. CONTEXTO */}
        <div className="section">
          <h2 className="section-title">02 · Contexto del negocio</h2>
          <h3 className="section-h accent">{c.contexto.que_es}</h3>
          <div className="kv">
            <div className="k">Etapa</div><div className="v">{c.contexto.etapa}</div>
            <div className="k">Historia</div><div className="v">{c.contexto.historia}</div>
            <div className="k">Brecha actual</div><div className="v">{c.contexto.brecha_actual}</div>
          </div>
        </div>

        {/* 3. MODELO DE NEGOCIO */}
        <div className="section">
          <h2 className="section-title">03 · Modelo de negocio</h2>
          <h3 className="section-h accent">Qué venden y cómo</h3>
          <div className="kv">
            <div className="k">Productos/servicios</div>
            <div className="v">
              {c.modelo_negocio.productos_servicios.map((p, i) => (
                <div key={i}>· {p.nombre}{p.ticket ? ` — ${p.ticket}` : ""}</div>
              ))}
            </div>
            <div className="k">Modalidad</div><div className="v">{c.modelo_negocio.modalidad}</div>
            <div className="k">Canales actuales</div><div className="v">{c.modelo_negocio.canales_actuales.join(" · ")}</div>
            <div className="k">Cómo se vende hoy</div><div className="v">{c.modelo_negocio.como_se_vende_hoy.join(" · ")}</div>
            <div className="k">Quién atiende</div><div className="v">{c.modelo_negocio.operativo.quien_atiende}</div>
            <div className="k">Horarios</div><div className="v">{c.modelo_negocio.operativo.horarios}</div>
          </div>
        </div>

        {/* 4. PÚBLICO OBJETIVO */}
        <div className="section break-before">
          <h2 className="section-title">04 · Público objetivo</h2>
          <h3 className="section-h accent">A quién le hablamos</h3>
          <div className="quote">{c.publico_objetivo.insight_clave}</div>
          <div className="twocol">
            {c.publico_objetivo.segmentos.map((s, i) => (
              <div key={i} className="card">
                <div className="ct">{s.nombre}</div>
                <div className="cs">{s.perfil}</div>
                <div className="meta"><strong>Plan típico:</strong> {s.plan_tipico}</div>
                <div className="meta"><strong>Valor:</strong> {s.valor}</div>
              </div>
            ))}
          </div>
          {c.publico_objetivo.anti_publico && (
            <div className="kv" style={{ marginTop: 16 }}>
              <div className="k">Anti-público</div>
              <div className="v">{c.publico_objetivo.anti_publico}</div>
            </div>
          )}
        </div>

        {/* 5. MARCA */}
        <div className="section">
          <h2 className="section-title">05 · Marca e identidad</h2>
          <h3 className="section-h accent">Personalidad y voz</h3>
          <div className="kv">
            <div className="k">Personalidad</div>
            <div className="v">{c.marca.personalidad.map((p, i) => <span key={i} className="tag">{p}</span>)}</div>
            <div className="k">Percepción deseada</div><div className="v">{c.marca.percepcion_deseada}</div>
            <div className="k">Registro</div><div className="v">{c.marca.tono_voz.registro}{c.marca.tono_voz.humor ? " · con humor" : ""}</div>
            <div className="k">Manual de marca</div><div className="v">
              Logo: {c.marca.estado_manual.logo ? "✓" : "✗"} · Colores: {c.marca.estado_manual.colores ? "✓" : "✗"} · Tipografías: {c.marca.estado_manual.tipografias ? "✓" : "✗"}
              {c.marca.estado_manual.observaciones && <> — {c.marca.estado_manual.observaciones}</>}
            </div>
            {c.marca.tono_voz.frases_representativas.length > 0 && (
              <>
                <div className="k">Frases que los representan</div>
                <div className="v">{c.marca.tono_voz.frases_representativas.map((f, i) => <div key={i}>· “{f}”</div>)}</div>
              </>
            )}
          </div>
        </div>

        {/* 6. DIFERENCIALES */}
        <div className="section">
          <h2 className="section-title">06 · Diferenciales</h2>
          <h3 className="section-h accent">Lo que la marca hace mejor</h3>
          <ol className="numlist">
            {c.diferenciales.map((d, i) => (
              <li key={i}>
                <div className="item-title">{d.titulo}</div>
                <div className="item-desc">{d.descripcion}</div>
              </li>
            ))}
          </ol>
        </div>

        {/* 7. PROBLEMAS */}
        <div className="section break-before">
          <h2 className="section-title">07 · Problemas detectados</h2>
          <h3 className="section-h accent">Qué está roto hoy</h3>
          <ol className="numlist">
            {c.problemas.map((p, i) => (
              <li key={i}>
                <div className="item-title">{p.titulo}</div>
                <div className="item-desc">{p.descripcion}</div>
                {p.evidencia && <div className="item-extra">Evidencia: {p.evidencia}</div>}
              </li>
            ))}
          </ol>
        </div>

        {/* 8. COMPETENCIA Y REFERENCIAS */}
        <div className="section">
          <h2 className="section-title">08 · Competencia y referencias</h2>
          <h3 className="section-h accent">Contexto competitivo</h3>
          {c.competencia_referencias.competidores.length > 0 && (
            <>
              <div style={{ fontWeight: 600, margin: "10px 0 6px", fontSize: 12 }}>Competidores</div>
              <div className="twocol">
                {c.competencia_referencias.competidores.map((co, i) => (
                  <div key={i} className="card">
                    <div className="ct">{co.nombre}</div>
                    <div className="meta"><strong>+</strong> {co.fortalezas}</div>
                    <div className="meta"><strong>−</strong> {co.debilidades}</div>
                  </div>
                ))}
              </div>
            </>
          )}
          {c.competencia_referencias.inspo.length > 0 && (
            <>
              <div style={{ fontWeight: 600, margin: "16px 0 6px", fontSize: 12 }}>Marcas inspo</div>
              <div className="twocol">
                {c.competencia_referencias.inspo.map((m, i) => (
                  <div key={i} className="card">
                    <div className="ct">{m.nombre}</div>
                    <div className="cs">{m.que_tomar}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* 9. OBJETIVOS */}
        <div className="section">
          <h2 className="section-title">09 · Objetivos del primer trimestre</h2>
          <h3 className="section-h accent">A dónde queremos llegar</h3>
          <ol className="numlist">
            {c.objetivos_trimestre.map((o, i) => (
              <li key={i}>
                <div className="item-title">{o.titulo}</div>
                <div className="item-desc">{o.descripcion}</div>
              </li>
            ))}
          </ol>
        </div>

        {/* 10. PILARES */}
        <div className="section break-before">
          <h2 className="section-title">10 · Pilares de contenido</h2>
          <h3 className="section-h accent">Sobre qué vamos a hablar</h3>
          <div className="twocol">
            {c.pilares_contenido.map((p, i) => (
              <div key={i} className="pillar">
                <div className="pn">{i + 1}. {p.nombre}</div>
                <div className="pd">{p.descripcion}</div>
                {p.ejemplos.length > 0 && (
                  <ul>{p.ejemplos.map((e, j) => <li key={j}>{e}</li>)}</ul>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 11. PLAN DE ACCIÓN */}
        <div className="section">
          <h2 className="section-title">11 · Plan de acción</h2>
          <h3 className="section-h accent">Qué vamos a hacer, en orden</h3>
          <ol className="numlist">
            {c.plan_accion.map((a, i) => (
              <li key={i}>
                <div className="item-title">
                  {a.titulo}{" "}
                  <span className={`tag ${a.prioridad}`}>{a.prioridad}</span>
                  <span className="tag">{AREA_LABEL[a.area_sugerida] ?? a.area_sugerida}</span>
                </div>
                <div className="item-desc">{a.descripcion}</div>
              </li>
            ))}
          </ol>
        </div>

        {/* 12. RECURSOS */}
        <div className="section">
          <h2 className="section-title">12 · Recursos y limitaciones</h2>
          <h3 className="section-h accent">Lo que entra al juego</h3>
          <div className="twocol">
            <div className="card">
              <div className="ct">Lo que aporta el cliente</div>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12 }}>
                {c.recursos_limitaciones.aporta_cliente.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
            <div className="card">
              <div className="ct">Líneas rojas</div>
              <ul style={{ margin: "8px 0 0", paddingLeft: 18, fontSize: 12 }}>
                {c.recursos_limitaciones.lineas_rojas.map((r, i) => <li key={i}>{r}</li>)}
              </ul>
            </div>
          </div>
        </div>

        {/* 13. PRÓXIMOS PASOS */}
        <div className="section">
          <h2 className="section-title">13 · Próximos pasos</h2>
          <h3 className="section-h accent">Por dónde arrancamos</h3>
          <ol className="numlist">
            {c.proximos_pasos.map((p, i) => (
              <li key={i}>
                <div className="item-title">{p}</div>
              </li>
            ))}
          </ol>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 60, paddingTop: 20, borderTop: "2px solid #FFD400", fontSize: 11, color: "#707070", textAlign: "center" }}>
          {AGENCY.brand} · {AGENCY.legal_name} · {AGENCY.domicilio} · {fmtDate(fechaInforme)}
        </div>
      </div>
    </>
  );
}
