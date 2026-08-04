import Link from "next/link";
import { notFound } from "next/navigation";
import { createAdmin } from "@/lib/supabase/admin";
import { AGENCY } from "@/lib/agency";
import { PrintButton } from "@/components/print-button";
import { periodLabel, nextPeriod } from "@/lib/finanzas";
import {
  hasClientReport,
  normalizeClientReport,
} from "@/lib/monthly-diagnostics/schema";

export const dynamic = "force-dynamic";

/**
 * El link se manda por WhatsApp: la previsualización tiene que decir de qué es,
 * no "JD Media" a secas. Y no queremos que un informe de un cliente termine
 * indexado en Google.
 */
export async function generateMetadata({
  params,
}: {
  params: { token: string; periodo: string };
}) {
  const noIndex = { robots: { index: false, follow: false } };
  if (!/^\d{4}-\d{2}$/.test(params.periodo)) return { title: "Informe", ...noIndex };

  const admin = createAdmin();
  const { data: tokenRow } = await admin
    .from("client_portal_tokens")
    .select("cliente_id, revoked_at")
    .eq("token", params.token)
    .maybeSingle();
  if (!tokenRow || tokenRow.revoked_at) return { title: "Informe", ...noIndex };

  const { data: client } = await admin
    .from("clients")
    .select("nombre")
    .eq("id", tokenRow.cliente_id)
    .maybeSingle();

  const nombre = (client as { nombre?: string } | null)?.nombre ?? "tu marca";
  const mes = periodLabel(params.periodo);
  return {
    title: `Informe de ${mes} — ${nombre}`,
    description: `Cómo le fue a ${nombre} en ${mes} y qué viene el mes que sigue. Por ${AGENCY.brand}.`,
    openGraph: {
      title: `Informe de ${mes} — ${nombre}`,
      description: `Cómo le fue a ${nombre} en ${mes} y qué viene el mes que sigue.`,
    },
    ...noIndex,
  };
}

/**
 * Informe mensual que ve EL CLIENTE.
 *
 * Entra con el mismo token del portal (no hay que mandarle otro link): el
 * portal vive en /c/<token> y esto cuelga de ahí como /c/<token>/mes/2026-07.
 *
 * Es un documento de lectura: pensado para leerse en el celular en dos minutos
 * y para guardarse en PDF desde el botón de imprimir. Nada de lo interno del
 * diagnóstico (riesgo de churn, oportunidades de venta) llega hasta acá — lo
 * que se renderiza es la columna `client_report`, que es otro documento.
 */
export default async function InformeMensualPage({
  params,
}: {
  params: { token: string; periodo: string };
}) {
  if (!/^\d{4}-\d{2}$/.test(params.periodo)) return notFound();

  const admin = createAdmin();

  const { data: tokenRow } = await admin
    .from("client_portal_tokens")
    .select("id, cliente_id, revoked_at, expires_at")
    .eq("token", params.token)
    .maybeSingle();

  if (!tokenRow || tokenRow.revoked_at) return notFound();
  if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) return notFound();

  const clienteId = tokenRow.cliente_id;

  const [{ data: client }, diagRes] = await Promise.all([
    admin.from("clients").select("id, nombre, rubro").eq("id", clienteId).maybeSingle(),
    admin
      .from("client_monthly_diagnostics")
      .select("client_report, client_report_at")
      .eq("cliente_id", clienteId)
      .eq("periodo", params.periodo)
      .maybeSingle(),
  ]);

  if (!client) return notFound();

  const raw = (diagRes.data as { client_report?: unknown } | null)?.client_report ?? null;
  if (!hasClientReport(raw)) return notFound();
  const r = normalizeClientReport(raw);

  // Marcamos que el cliente lo abrió (no bloqueante).
  await admin
    .from("client_portal_tokens")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", tokenRow.id);

  const mes = periodLabel(params.periodo);
  const mesQueViene = periodLabel(nextPeriod(params.periodo));

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
        .wrap { max-width: 720px; margin: 0 auto; padding: 20px 18px 72px; }

        /* ── Portada ── */
        .hero {
          padding: 44px 28px;
          background: #1a1a1a;
          color: #fff;
          border-radius: 18px;
          margin-bottom: 22px;
          position: relative;
          overflow: hidden;
        }
        .hero:before {
          content: "";
          position: absolute;
          inset: 0;
          background: radial-gradient(ellipse at top right, rgba(255,212,0,.18), transparent 62%);
        }
        .hero-inner { position: relative; }
        .hero-kicker {
          font-size: 10.5px; letter-spacing: .22em; text-transform: uppercase;
          color: #FFD400; font-weight: 700;
        }
        .hero-cliente { margin-top: 10px; font-size: 13px; color: #9a9a9a; letter-spacing: .04em; }
        .hero-mes {
          font-size: 34px; font-weight: 800; letter-spacing: -.025em;
          line-height: 1.05; margin: 2px 0 0;
        }
        .hero-titular {
          margin-top: 20px; padding-top: 20px;
          border-top: 1px solid rgba(255,255,255,.12);
          font-size: 19px; font-weight: 600; line-height: 1.35; color: #FFD400;
        }
        .hero-apertura { margin-top: 12px; font-size: 14.5px; line-height: 1.6; color: #d8d8d8; }

        /* ── Números ── */
        .nums { display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-bottom: 22px; }
        @media (min-width: 620px) { .nums.n3 { grid-template-columns: repeat(3, 1fr); } .nums.n4 { grid-template-columns: repeat(4, 1fr); } }
        .num {
          background: #fff; border: 1px solid #ececec; border-radius: 14px;
          padding: 18px 14px; text-align: center;
          display: flex; flex-direction: column; justify-content: center;
        }
        .num-val { font-size: 27px; font-weight: 800; letter-spacing: -.02em; line-height: 1.1; }
        .num-lbl { margin-top: 6px; font-size: 11.5px; color: #666; line-height: 1.35; }
        .num-det { margin-top: 6px; font-size: 10.5px; font-weight: 700; color: #1a7f4b; }

        /* ── Secciones ── */
        .sec { margin-bottom: 26px; }
        .sec-label {
          font-size: 10.5px; text-transform: uppercase; letter-spacing: .18em;
          color: #999; font-weight: 700; margin-bottom: 4px;
        }
        .sec-title { font-size: 21px; font-weight: 700; letter-spacing: -.015em; margin: 0 0 14px; }

        .block { background: #fff; border: 1px solid #ececec; border-radius: 14px; padding: 16px 18px; margin-bottom: 10px; }
        .block-title { font-size: 15.5px; font-weight: 700; line-height: 1.3; }
        .block-text { margin-top: 6px; font-size: 14px; color: #555; line-height: 1.6; }

        /* Numeradas — para "lo que viene" */
        .step { display: flex; gap: 14px; align-items: flex-start; padding: 14px 0; border-bottom: 1px solid #ededed; }
        .step:last-child { border-bottom: none; }
        .step-n {
          flex: 0 0 26px; height: 26px; border-radius: 999px;
          background: #FFD400; color: #1a1a1a;
          font-size: 12px; font-weight: 800;
          display: flex; align-items: center; justify-content: center;
        }
        .step-body { min-width: 0; }

        /* "Lo que nos dijiste" — el bloque que hace que la reunión valga */
        .escuchamos {
          background: linear-gradient(180deg, #fffdf0 0%, #fff 100%);
          border: 1px solid #f5e6a3; border-radius: 14px; padding: 20px 22px;
        }
        .escuchamos ul { margin: 0; padding: 0; list-style: none; }
        .escuchamos li {
          position: relative; padding-left: 20px; margin-bottom: 12px;
          font-size: 14.5px; line-height: 1.6; color: #3d3d3d;
        }
        .escuchamos li:last-child { margin-bottom: 0; }
        .escuchamos li:before {
          content: ""; position: absolute; left: 0; top: 9px;
          width: 7px; height: 7px; border-radius: 999px; background: #FFD400;
        }

        /* ── Cierre ── */
        .cierre {
          background: #1a1a1a; color: #fff; border-radius: 16px;
          padding: 28px 24px; text-align: center; margin-top: 30px;
        }
        .cierre-text { font-size: 15.5px; line-height: 1.6; color: #e8e8e8; }
        .cierre-firma { margin-top: 16px; font-size: 11px; letter-spacing: .2em; text-transform: uppercase; color: #FFD400; font-weight: 700; }

        .toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
        .back { font-size: 12.5px; color: #777; text-decoration: none; }
        .back:hover { color: #1a1a1a; }
        .footer { margin-top: 34px; text-align: center; color: #999; font-size: 11.5px; }

        /* ── Impresión / guardar como PDF ── */
        @media print {
          body { background: #fff; }
          .wrap { max-width: none; padding: 0; }
          .toolbar, .footer { display: none !important; }
          .hero, .cierre { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .sec, .block, .escuchamos, .num { break-inside: avoid; }
          .sec { margin-bottom: 18px; }
        }
      `}</style>

      <div className="wrap">
        <div className="toolbar">
          <Link href={`/c/${params.token}`} className="back">
            ← Volver a tu panel
          </Link>
          <PrintButton label="Guardar en PDF" />
        </div>

        {/* Portada */}
        <div className="hero">
          <div className="hero-inner">
            <div className="hero-kicker">Informe del mes</div>
            <div className="hero-cliente">{client.nombre}</div>
            <h1 className="hero-mes">{mes}</h1>
            {r.titular && <div className="hero-titular">{r.titular}</div>}
            {r.apertura && <p className="hero-apertura">{r.apertura}</p>}
          </div>
        </div>

        {/* Números del mes */}
        {r.numeros.length > 0 && (
          <div className={`nums ${r.numeros.length === 3 ? "n3" : r.numeros.length >= 4 ? "n4" : ""}`}>
            {r.numeros.map((n, i) => (
              <div key={i} className="num">
                <div className="num-val">{n.valor}</div>
                <div className="num-lbl">{n.etiqueta}</div>
                {n.detalle && <div className="num-det">{n.detalle}</div>}
              </div>
            ))}
          </div>
        )}

        {/* Lo que logramos */}
        {r.logros.length > 0 && (
          <div className="sec">
            <div className="sec-label">Este mes</div>
            <h2 className="sec-title">Lo que logramos</h2>
            {r.logros.map((b, i) => (
              <div key={i} className="block">
                <div className="block-title">{b.titulo}</div>
                {b.detalle && <p className="block-text">{b.detalle}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Lo que aprendimos de su marca */}
        {r.aprendimos.length > 0 && (
          <div className="sec">
            <div className="sec-label">Estrategia</div>
            <h2 className="sec-title">Lo que aprendimos de tu marca</h2>
            {r.aprendimos.map((b, i) => (
              <div key={i} className="block">
                <div className="block-title">{b.titulo}</div>
                {b.detalle && <p className="block-text">{b.detalle}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Lo que planteó en la reunión */}
        {r.te_escuchamos.length > 0 && (
          <div className="sec">
            <div className="sec-label">De nuestra reunión</div>
            <h2 className="sec-title">Lo que nos dijiste</h2>
            <div className="escuchamos">
              <ul>
                {r.te_escuchamos.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* El plan del mes que viene */}
        {r.proximo_mes.length > 0 && (
          <div className="sec">
            <div className="sec-label">Lo que viene</div>
            <h2 className="sec-title">En {mesQueViene} vamos a…</h2>
            <div className="block" style={{ padding: "6px 18px" }}>
              {r.proximo_mes.map((b, i) => (
                <div key={i} className="step">
                  <div className="step-n">{i + 1}</div>
                  <div className="step-body">
                    <div className="block-title">{b.titulo}</div>
                    {b.detalle && <p className="block-text">{b.detalle}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {r.cierre && (
          <div className="cierre">
            <p className="cierre-text">{r.cierre}</p>
            <div className="cierre-firma">Equipo {AGENCY.brand}</div>
          </div>
        )}

        <div className="footer">
          {AGENCY.brand} · Informe de {mes} para {client.nombre}
        </div>
      </div>
    </>
  );
}
