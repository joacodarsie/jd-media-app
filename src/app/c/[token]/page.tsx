import { notFound } from "next/navigation";
import { createAdmin } from "@/lib/supabase/admin";
import { igMonthlyForReport, paidMonthlyForReport } from "@/lib/social/report";
import { AGENCY } from "@/lib/agency";
import type { MonthlyContentPlan } from "@/lib/content-plans/schema";
import { PortalReviewCard } from "@/components/portal-review-card";
import { PortalContent } from "@/components/portal-content";

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
      .select("id, titulo, copy, guion, descripcion, red, tipo, fecha_publicacion, asset_url")
      .eq("cliente_id", cliente_id)
      .eq("estado", "revision_cliente")
      .order("fecha_publicacion", { ascending: true, nullsFirst: false })
      .limit(20),
  ]);

  if (!client) return notFound();

  // Resultados del mes en curso (Instagram + paid) + lectura IA, si hay.
  const mesActual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [igM, paidM, { data: monthlyRow }] = await Promise.all([
    igMonthlyForReport(admin, cliente_id, mesActual),
    paidMonthlyForReport(admin, cliente_id, mesActual),
    admin
      .from("client_monthly_reports")
      .select("ai_resultados")
      .eq("cliente_id", cliente_id)
      .eq("year_month", mesActual)
      .maybeSingle(),
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
  const hayResultados = igCells.length > 0 || paidCells.length > 0 || !!aiResultados;

  const planContent: MonthlyContentPlan | null = plan?.content
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
  const principal = planContent?.mix_por_red?.find((m) => m.rol === "principal") ?? planContent?.mix_por_red?.[0];
  const cadencia = (principal?.cadencia ?? {}) as Record<string, number>;
  const redes = planContent?.mix_por_red?.map((m) => m.red) ?? [];

  return (
    <>
      <style>{`
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
        .hero-brand { font-size: 11px; letter-spacing: 0.2em; color: #FFD400; text-transform: uppercase; margin-bottom: 8px; }
        .hero-title { font-size: 32px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.05; margin: 0; }
        .hero-rubro { margin-top: 6px; font-size: 14px; color: #aaa; }
        .hero-pack { margin-top: 16px; display: inline-block; padding: 4px 10px; background: #FFD400; color: #1a1a1a; font-weight: 700; font-size: 11px; border-radius: 999px; }

        .card { background: #fff; border: 1px solid #ececec; border-radius: 14px; padding: 20px; margin-bottom: 16px; }
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
      `}</style>

      <div className="wrap">
        <div className="hero">
          <div style={{ position: "relative" }}>
            <div className="hero-brand">{AGENCY.brand}</div>
            <h1 className="hero-title">{client.nombre}</h1>
            {client.rubro && <div className="hero-rubro">{client.rubro}</div>}
            {client.pack && <span className="hero-pack">Pack {client.pack}</span>}
          </div>
        </div>

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
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {toReview.map((p) => (
                <PortalReviewCard key={p.id} pub={p} token={params.token} />
              ))}
            </div>
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

        <div className="footer">
          {AGENCY.brand} · {AGENCY.legal_name}
          <br />
          ¿Querés cambiar algo? Hablanos por WhatsApp.
        </div>
      </div>
    </>
  );
}
