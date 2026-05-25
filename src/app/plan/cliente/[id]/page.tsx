import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { AGENCY } from "@/lib/agency";
import { PrintButton } from "@/components/print-button";
import type { ContentPlanRow, MonthlyContentPlan } from "@/lib/content-plans/schema";

export const dynamic = "force-dynamic";

function fmtDate(iso?: string | null) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

const FORMATO_LABEL: Record<string, string> = {
  reel: "Reel",
  post: "Post",
  carrusel: "Carrusel",
  story: "Story",
  video_largo: "Video largo",
  live: "Live",
  otro: "Otro",
};

export default async function PlanPrintPage({
  params,
}: {
  params: { id: string };
}) {
  await requireUser();
  const supabase = createClient();
  const admin = createAdmin();

  const { data: client } = await supabase
    .from("clients")
    .select("id, nombre, pack")
    .eq("id", params.id)
    .maybeSingle();
  if (!client) notFound();

  const { data: rows } = await admin
    .from("client_content_plans")
    .select(
      "id, cliente_id, periodo_label, status, content, generated_with_model, generated_at, approved_at, approved_by, applied_at, applied_count, applied_temas_indices, created_by, created_at, updated_at"
    )
    .eq("cliente_id", params.id)
    .order("created_at", { ascending: false });

  const all = (rows ?? []) as unknown as ContentPlanRow[];
  const plan = all.find((p) => p.status === "active") ?? all.find((p) => p.status === "draft");
  if (!plan) notFound();

  const c: MonthlyContentPlan = plan.content;
  const fecha = plan.approved_at ?? plan.generated_at ?? plan.created_at;

  return (
    <>
      <style>{`
        @page { size: A4; margin: 18mm 16mm; }
        * { box-sizing: border-box; }
        body { background: #ececec; margin: 0; font-family: 'Inter', system-ui, sans-serif; color: #1a1a1a; }
        .doc { background: white; max-width: 820px; margin: 24px auto; padding: 56px 60px 80px; box-shadow: 0 4px 32px rgba(0,0,0,.08); line-height: 1.55; font-size: 13px; }
        .cover { display: flex; flex-direction: column; justify-content: space-between; min-height: 80vh; padding-bottom: 32px; border-bottom: 3px solid #FFD400; margin-bottom: 36px; page-break-after: always; }
        .cover-top { display: flex; justify-content: space-between; align-items: flex-start; }
        .cover-brand { font-weight: 800; font-size: 18px; }
        .cover-meta { font-size: 11px; color: #707070; text-align: right; line-height: 1.5; }
        .cover-title { font-size: 14px; color: #707070; text-transform: uppercase; letter-spacing: 0.18em; margin-bottom: 12px; }
        .cover-client { font-size: 52px; font-weight: 800; letter-spacing: -0.03em; line-height: 1; margin: 0; }
        .cover-period { margin-top: 16px; font-size: 22px; color: #404040; }
        .cover-foot { display: flex; align-items: flex-end; justify-content: space-between; color: #707070; font-size: 11px; }
        .cover-tag { display: inline-block; padding: 4px 10px; background: #FFD400; color: #1a1a1a; font-weight: 700; font-size: 11px; border-radius: 3px; }

        h2.section-title { font-size: 11px; letter-spacing: 0.2em; color: #707070; text-transform: uppercase; font-weight: 600; margin: 32px 0 4px; }
        h3.section-h { font-size: 22px; font-weight: 800; letter-spacing: -0.01em; margin: 0 0 18px; border-left: 3px solid #FFD400; padding-left: 12px; }

        .bullets { margin: 0; padding: 0; list-style: none; }
        .bullets li { padding: 10px 0 10px 22px; position: relative; border-bottom: 1px solid #f0f0f0; }
        .bullets li:last-child { border-bottom: none; }
        .bullets li:before { content: ""; position: absolute; left: 0; top: 18px; width: 8px; height: 8px; background: #FFD400; border-radius: 1px; }

        .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }
        .card { border: 1px solid #e5e5e5; border-radius: 6px; padding: 14px; }
        .card .ct { font-weight: 700; font-size: 14px; }
        .card .cs { font-size: 12px; color: #555; margin-top: 4px; }
        .card .meta { font-size: 11px; color: #707070; margin-top: 6px; }

        .cadencia-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-top: 10px; }
        .cadencia-cell { background: #fafafa; border: 1px solid #eee; border-radius: 4px; padding: 6px 8px; text-align: center; }
        .cadencia-cell .label { font-size: 10px; color: #707070; text-transform: uppercase; }
        .cadencia-cell .val { font-size: 18px; font-weight: 800; }

        .pilar { margin-bottom: 14px; }
        .pilar-head { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px; }
        .pilar-name { font-weight: 700; font-size: 14px; }
        .pilar-pct { font-weight: 800; color: #1a1a1a; font-size: 16px; }
        .pilar-bar { height: 8px; background: #f0f0f0; border-radius: 4px; overflow: hidden; }
        .pilar-bar-fill { height: 100%; background: #FFD400; }
        .pilar-why { margin-top: 6px; font-size: 11.5px; color: #555; }

        .tema { padding: 14px 0 14px 42px; position: relative; border-bottom: 1px solid #f0f0f0; counter-increment: tn; }
        .tema:last-child { border-bottom: none; }
        .tema:before { content: counter(tn); position: absolute; left: 0; top: 14px; width: 28px; height: 28px; background: #1a1a1a; color: #FFD400; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 12px; }
        .tema-title { font-weight: 700; }
        .tema-desc { margin-top: 4px; color: #404040; }
        .tema-meta { margin-top: 6px; display: flex; gap: 6px; flex-wrap: wrap; }
        .tag { display: inline-block; padding: 2px 8px; font-size: 10px; font-weight: 600; border-radius: 3px; background: #f0f0f0; color: #404040; text-transform: uppercase; letter-spacing: 0.05em; }
        .tag.yellow { background: #fffbe6; color: #92400e; }

        .numlist { margin: 0; padding: 0; list-style: none; counter-reset: tn; }
        .ullist { margin: 0; padding-left: 18px; }
        .ullist li { padding: 4px 0; }

        .section.break-before { page-break-before: always; }

        .print-bar { position: sticky; top: 0; background: #1a1a1a; color: #fff; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; z-index: 10; font-size: 12px; }
        .print-bar button { background: #FFD400; color: #1a1a1a; padding: 6px 14px; border-radius: 4px; font-weight: 700; border: none; cursor: pointer; font-size: 12px; }
        @media print {
          .print-bar { display: none; }
          body { background: white; }
          .doc { box-shadow: none; margin: 0; max-width: 100%; padding: 0; }
        }
      `}</style>

      <div className="print-bar">
        <div>
          <strong>{AGENCY.brand}</strong> · Plan de contenido · {client.nombre}
          {plan.status === "draft" && " · DRAFT"}
        </div>
        <PrintButton />
      </div>

      <div className="doc">
        {/* Portada */}
        <div className="cover">
          <div className="cover-top">
            <div className="cover-brand">{AGENCY.brand}</div>
            <div className="cover-meta">
              {fmtDate(fecha)}<br />
              {plan.status === "active" ? "Plan vigente" : "Vista previa (draft)"}
            </div>
          </div>
          <div>
            <div className="cover-title">Plan de contenido</div>
            <h1 className="cover-client">{client.nombre}</h1>
            <div className="cover-period">{plan.periodo_label}</div>
          </div>
          <div className="cover-foot">
            <span>Estrategia y calendario sugerido para el período</span>
            {client.pack && <span className="cover-tag">Pack {client.pack}</span>}
          </div>
        </div>

        {/* Resumen */}
        {c.resumen_mes?.length > 0 && (
          <div className="section">
            <h2 className="section-title">01 · Resumen del período</h2>
            <h3 className="section-h">Lo crítico de este mes</h3>
            <ul className="bullets">{c.resumen_mes.map((b, i) => <li key={i}>{b}</li>)}</ul>
          </div>
        )}

        {/* Cadencia consolidada (no por red, no redundante) */}
        {c.mix_por_red?.length > 0 && (() => {
          const principal = c.mix_por_red.find((m) => m.rol === "principal") ?? c.mix_por_red[0];
          const cadencia = (principal?.cadencia ?? {}) as Record<string, number>;
          const redes = c.mix_por_red.map((m) => m.red);
          return (
            <div className="section">
              <h2 className="section-title">02 · Cadencia del mes</h2>
              <h3 className="section-h">Qué vas a recibir este mes</h3>
              <div className="cadencia-grid" style={{ gridTemplateColumns: `repeat(${Math.min(4, Object.keys(cadencia).length)}, 1fr)` }}>
                {Object.entries(cadencia).map(([fmt, qty]) => (
                  <div key={fmt} className="cadencia-cell">
                    <div className="label">{FORMATO_LABEL[fmt] ?? fmt}</div>
                    <div className="val">{qty}</div>
                  </div>
                ))}
              </div>
              <p style={{ marginTop: 14, fontSize: 12, color: "#555" }}>
                Cada pieza se publica en <strong style={{ textTransform: "capitalize" }}>{redes.join(", ")}</strong>.
              </p>
            </div>
          );
        })()}

        {/* Pilares */}
        {c.distribucion_pilares?.length > 0 && (
          <div className="section">
            <h2 className="section-title">03 · Distribución por pilar</h2>
            <h3 className="section-h">Sobre qué hablamos este mes</h3>
            {c.distribucion_pilares.map((p, i) => (
              <div key={i} className="pilar">
                <div className="pilar-head">
                  <span className="pilar-name">{p.pilar}</span>
                  <span className="pilar-pct">{p.porcentaje}%</span>
                </div>
                <div className="pilar-bar">
                  <div className="pilar-bar-fill" style={{ width: `${Math.min(100, Math.max(0, p.porcentaje))}%` }} />
                </div>
                <div className="pilar-why">{p.justificacion}</div>
              </div>
            ))}
          </div>
        )}

        {/* Temas */}
        {c.temas_destacados?.length > 0 && (
          <div className="section break-before">
            <h2 className="section-title">04 · Temas destacados</h2>
            <h3 className="section-h">Las piezas concretas del calendario</h3>
            <ol className="numlist">
              {c.temas_destacados.map((t, i) => (
                <li key={i} className="tema">
                  <div className="tema-title">{t.titulo}</div>
                  <div className="tema-desc">{t.descripcion}</div>
                  <div className="tema-meta">
                    {t.fecha && <span className="tag">{t.fecha}</span>}
                    {t.formato && <span className="tag">{FORMATO_LABEL[t.formato] ?? t.formato}</span>}
                    {t.pilar && <span className="tag yellow">{t.pilar}</span>}
                    {t.red_principal && <span className="tag">{t.red_principal}</span>}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}

        {/* Campañas */}
        {c.campanas?.length > 0 && (
          <div className="section">
            <h2 className="section-title">05 · Campañas y lanzamientos</h2>
            <h3 className="section-h">Momentos clave del mes</h3>
            <div className="grid2">
              {c.campanas.map((ca, i) => (
                <div key={i} className="card">
                  <div className="ct">{ca.nombre}</div>
                  <div className="meta">{ca.fechas} · {ca.piezas_estimadas} piezas · {FORMATO_LABEL[ca.formato_principal] ?? ca.formato_principal}</div>
                  <div className="cs" style={{ marginTop: 8 }}><strong>Objetivo:</strong> {ca.objetivo}</div>
                  <div className="cs" style={{ marginTop: 4 }}>{ca.detalle}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cierre */}
        <div style={{ marginTop: 60, paddingTop: 30, borderTop: "3px solid #FFD400", textAlign: "center" }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>
            Arrancamos {plan.periodo_label} 💛
          </div>
          <div style={{ fontSize: 13, color: "#555", maxWidth: 480, margin: "0 auto" }}>
            Cualquier consulta o cambio de planes en el medio del mes, escribinos por WhatsApp y lo ajustamos. Gracias por confiar.
          </div>
          <div style={{ marginTop: 24, fontSize: 11, color: "#707070" }}>
            {AGENCY.brand} · {fmtDate(fecha)}
          </div>
        </div>
      </div>
    </>
  );
}
