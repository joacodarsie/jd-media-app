import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AGENCY } from "@/lib/agency";
import { SERVICE_TYPE_LABEL } from "@/lib/constants";
import type { ClientService } from "@/lib/types";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

interface ClientFull {
  id: string;
  nombre: string;
  contacto_nombre: string | null;
  contacto_dni_cuit: string | null;
  contacto_domicilio: string | null;
  contacto_email: string | null;
  contrato_numero: string | null;
  contrato_fecha_inicio: string | null;
  contrato_plazo_meses: number | null;
  contrato_dia_cobro: number | null;
  contrato_moneda: string | null;
  contrato_descuento_pct: number | null;
  contrato_descuento_meses: number | null;
  contrato_observaciones: string | null;
}

function fmtMoney(n: number, moneda: string) {
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: moneda || "ARS",
      maximumFractionDigits: 0,
    }).format(n);
  } catch {
    return `${moneda} ${n.toLocaleString("es-AR")}`;
  }
}

function fmtNumber(n: number) {
  return n.toLocaleString("es-AR");
}

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function ordinalDia(n: number): string {
  if (n === 1) return "primer";
  return `${n}º`;
}

export default async function CartaAcuerdoPage({
  params,
}: {
  params: { id: string };
}) {
  await requireUser();
  const supabase = createClient();

  const [{ data: client }, { data: services }] = await Promise.all([
    supabase
      .from("clients")
      .select(
        "id, nombre, contacto_nombre, contacto_dni_cuit, contacto_domicilio, contacto_email, contrato_numero, contrato_fecha_inicio, contrato_plazo_meses, contrato_dia_cobro, contrato_moneda, contrato_descuento_pct, contrato_descuento_meses, contrato_observaciones"
      )
      .eq("id", params.id)
      .maybeSingle(),
    supabase
      .from("client_services")
      .select("*")
      .eq("cliente_id", params.id)
      .eq("activo", true)
      .order("tipo"),
  ]);

  if (!client) notFound();
  const c = client as ClientFull;
  const svc = (services ?? []) as ClientService[];

  const moneda = c.contrato_moneda ?? "ARS";
  const totalMensual = svc.reduce((acc, s) => acc + (Number(s.monto_mensual) || 0), 0);
  const tienePaid = svc.some((s) => s.tipo === "paid_media");
  const tieneGestionContenido = svc.some(
    (s) => s.tipo === "gestion_redes" || s.tipo === "edicion_audiovisual"
  );
  const diaCobro = c.contrato_dia_cobro ?? 1;
  const plazoMeses = c.contrato_plazo_meses ?? 3;
  const fechaInicio = fmtDate(c.contrato_fecha_inicio);

  const descPct = c.contrato_descuento_pct ?? 0;
  const descMeses = c.contrato_descuento_meses ?? 0;
  const hayDescuento = descPct > 0 && descMeses > 0;
  const montoConDescuento = hayDescuento
    ? totalMensual * (1 - descPct / 100)
    : null;

  return (
    <>
      {/* CSS print-friendly + estilos puros (sin Tailwind dependencies para garantizar render limpio) */}
      <style>{`
        @page { size: A4; margin: 20mm 18mm; }
        body { background: #f4f4f4; }
        .doc { background: white; max-width: 760px; margin: 24px auto; padding: 48px 56px; box-shadow: 0 1px 12px rgba(0,0,0,.06); color: #1a1a1a; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; line-height: 1.55; font-size: 14px; }
        .doc h1 { font-size: 22px; text-align: center; margin: 0 0 8px; }
        .doc .subtitle { text-align: center; color: #555; margin: 0 0 28px; font-size: 13px; }
        .doc h2 { font-size: 15px; margin: 24px 0 6px; }
        .doc p { margin: 6px 0; }
        .doc ol > li { margin-bottom: 16px; }
        .doc table { width: 100%; border-collapse: collapse; margin-top: 6px; }
        .doc th, .doc td { text-align: left; padding: 8px 10px; border: 1px solid #e3e3e3; font-size: 13px; }
        .doc th { background: #f7f7f7; font-weight: 600; }
        .doc .total { font-weight: 700; }
        .doc .muted { color: #666; }
        .doc .firmas { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-top: 60px; }
        .doc .firma { border-top: 1px solid #999; padding-top: 6px; font-size: 12px; color: #444; }
        .doc .promo { background: #fff8e1; border-left: 4px solid #f59e0b; padding: 10px 12px; margin: 8px 0; border-radius: 4px; }
        .print-bar { position: sticky; top: 0; z-index: 10; background: #111; color: white; padding: 8px 16px; display: flex; gap: 12px; align-items: center; justify-content: space-between; font-size: 13px; }
        .print-bar a, .print-bar button { color: white; background: transparent; border: 1px solid #555; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; text-decoration: none; }
        .print-bar button:hover, .print-bar a:hover { background: #333; }
        @media print {
          .print-bar { display: none; }
          body { background: white; }
          .doc { box-shadow: none; max-width: none; margin: 0; padding: 0; }
        }
      `}</style>

      <div className="print-bar">
        <div>
          <strong>{AGENCY.brand}</strong> · Carta acuerdo {c.contrato_numero ?? ""}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href={`/clientes/${c.id}`}>← Volver al cliente</a>
          <PrintButton />
        </div>
      </div>

      <div className="doc">
        <h1>Acuerdo de Prestación de Servicios – {AGENCY.brand}</h1>
        <p className="subtitle">
          {c.contrato_numero ? <>Nº {c.contrato_numero} · </> : null}
          {fechaInicio !== "—" ? <>Fecha: {fechaInicio}</> : null}
        </p>

        <ol>
          <li>
            <h2>Identificación de las partes</h2>
            <p>
              <strong>{AGENCY.brand}</strong>, representada por{" "}
              <strong>{AGENCY.legal_name}</strong>, CUIT {AGENCY.cuit}, con
              domicilio en {AGENCY.domicilio}, en adelante &ldquo;La Agencia&rdquo;.
            </p>
            <p>
              <strong>{c.contacto_nombre ?? c.nombre}</strong>
              {c.contacto_dni_cuit && <> , DNI/CUIT {c.contacto_dni_cuit}</>}
              {c.contacto_domicilio && <>, con domicilio en {c.contacto_domicilio}</>}, en
              adelante &ldquo;El Cliente&rdquo;.
            </p>
          </li>

          <li>
            <h2>Objeto del contrato</h2>
            <p>
              La Agencia se compromete a brindar los servicios contratados por el
              Cliente, detallados a continuación. Los alcances específicos de cada
              servicio forman parte integrante del presente acuerdo.
            </p>
          </li>

          <li>
            <h2>Servicios contratados</h2>
            {svc.length === 0 ? (
              <p className="muted">
                (Sin servicios cargados. Agregalos en la ficha del cliente antes de
                generar la carta).
              </p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Servicio</th>
                    <th>Pack / detalle</th>
                    <th style={{ textAlign: "right", width: 140 }}>
                      Mensual ({moneda})
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {svc.map((s) => (
                    <tr key={s.id}>
                      <td>{SERVICE_TYPE_LABEL[s.tipo] ?? s.tipo}</td>
                      <td>
                        {s.pack ?? "—"}
                        {s.notas && (
                          <div className="muted" style={{ fontSize: 12 }}>
                            {s.notas}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {s.monto_mensual
                          ? fmtMoney(Number(s.monto_mensual), s.moneda || moneda)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                  <tr>
                    <td colSpan={2} className="total">
                      Total mensual
                    </td>
                    <td className="total" style={{ textAlign: "right" }}>
                      {fmtMoney(totalMensual, moneda)}
                    </td>
                  </tr>
                </tbody>
              </table>
            )}
          </li>

          <li>
            <h2>Honorarios y forma de pago</h2>
            <p>
              El Cliente abonará la suma de <strong>{fmtMoney(totalMensual, moneda)}</strong>{" "}
              ({fmtNumber(totalMensual)} {moneda === "ARS" ? "pesos argentinos" : moneda})
              por los servicios contratados, por adelantado el {ordinalDia(diaCobro)} día
              hábil de cada mes, mediante transferencia bancaria.
            </p>

            {hayDescuento && montoConDescuento !== null && (
              <div className="promo">
                <strong>Promoción:</strong> durante los primeros {descMeses} meses de
                contrato se aplicará un descuento del {descPct}%, por lo cual el
                monto a abonar en dicho período será de{" "}
                <strong>{fmtMoney(montoConDescuento, moneda)}</strong>. A partir del
                mes {descMeses + 1}, los honorarios serán los establecidos sin
                descuento.
              </div>
            )}

            <p>
              Si el servicio inicia en fecha distinta al primer día del mes, se
              abonará un monto proporcional por el período restante hasta el fin de
              ese mes. Desde entonces, el pago será mensual y por adelantado.
            </p>
            <p>
              <strong>Cláusula de mora:</strong> si el pago no se efectúa dentro de
              los 3 días hábiles posteriores a la fecha de vencimiento establecida,
              la Agencia podrá suspender los servicios hasta que se regularice la
              situación.
            </p>
            <p>
              <strong>No reembolsos:</strong> los pagos realizados no serán
              reembolsados una vez iniciado el mes de servicio.
            </p>
          </li>

          {tienePaid && (
            <li>
              <h2>Inversión publicitaria (Paid Media)</h2>
              <p>
                El monto destinado a inversión publicitaria en plataformas (Meta
                Ads, Google Ads u otras) <strong>no</strong> está incluido en los
                honorarios de la Agencia. El Cliente abonará dicho monto
                directamente a la plataforma correspondiente con su propio medio
                de pago, o a la Agencia para que ésta lo gestione, según lo
                acordado por escrito en cada caso.
              </p>
            </li>
          )}

          <li>
            <h2>Duración</h2>
            <p>
              <strong>Fecha de inicio:</strong> {fechaInicio}
              <br />
              <strong>Plazo inicial:</strong> {plazoMeses} {plazoMeses === 1 ? "mes" : "meses"}.
              <br />
              <strong>Renovación automática:</strong> El contrato se renovará
              automáticamente, salvo aviso con 15 días de anticipación.
              <br />
              <strong>Revisión de tarifas:</strong> Las tarifas podrán
              actualizarse cada 3 meses, avisando al Cliente con 10 días de
              anticipación.
            </p>
          </li>

          <li>
            <h2>Obligaciones de las partes</h2>
            <p>
              <strong>La Agencia:</strong> prestar los servicios contratados con
              profesionalismo, confidencialidad y en los plazos acordados.
            </p>
            <p>
              <strong>El Cliente:</strong> entregar materiales, accesos e
              información en tiempo y forma; brindar las autorizaciones necesarias
              y efectuar el pago correspondiente en las condiciones establecidas.
            </p>
          </li>

          {tieneGestionContenido && (
            <li>
              <h2>Material y contenido</h2>
              <p>
                El Cliente compartirá material crudo (fotos, videos, logos,
                accesos) por los canales acordados. La Agencia es responsable de
                la edición, optimización y publicación según calendario. El
                material crudo entregado y las piezas finales producidas son
                propiedad del Cliente una vez abonados los honorarios del período
                correspondiente.
              </p>
            </li>
          )}

          <li>
            <h2>Propiedad intelectual y uso de materiales</h2>
            <p>
              El Cliente es propietario de los materiales una vez abonados los
              honorarios. La Agencia podrá utilizar piezas y resultados en su
              portfolio o material de difusión, salvo objeción expresa por escrito
              del Cliente.
            </p>
          </li>

          <li>
            <h2>Canales de comunicación oficiales</h2>
            <p>
              La coordinación oficial del proyecto se realizará por el grupo de
              WhatsApp creado por la Agencia y/o el correo electrónico de
              contacto. Mensajes recibidos por otras vías (DM de redes sociales,
              llamadas no agendadas) podrán no ser atendidos en tiempo y forma.
            </p>
          </li>

          <li>
            <h2>Confidencialidad</h2>
            <p>
              Ninguna parte podrá divulgar información sensible obtenida en el
              marco de este acuerdo sin autorización previa de la otra.
            </p>
          </li>

          <li>
            <h2>Limitación de responsabilidad</h2>
            <p>
              La Agencia se compromete a aplicar las mejores prácticas y
              conocimientos en marketing digital, pero no puede garantizar
              resultados específicos (ventas, leads, alcance, etc.), ya que éstos
              dependen de múltiples factores externos.
            </p>
            <p>
              La Agencia no será responsable por caídas, cambios de políticas o
              bloqueos de plataformas de terceros (Meta, Google, etc.).
            </p>
          </li>

          <li>
            <h2>Rescisión</h2>
            <p>
              Cualquiera de las partes puede rescindir el presente acuerdo con
              aviso de 15 días. En caso de incumplimiento grave, incluyendo la
              falta de pago, la Agencia podrá rescindir el contrato de manera
              inmediata.
            </p>
          </li>

          <li>
            <h2>Jurisdicción</h2>
            <p>
              Cualquier controversia derivada del presente acuerdo será resuelta
              en los {AGENCY.jurisdiccion}.
            </p>
          </li>

          <li>
            <h2>Entrada en vigencia</h2>
            <p>
              El presente contrato entrará en vigencia a partir de la acreditación
              del pago correspondiente por parte del Cliente.
            </p>
          </li>

          {c.contrato_observaciones && (
            <li>
              <h2>Observaciones particulares</h2>
              <p style={{ whiteSpace: "pre-line" }}>{c.contrato_observaciones}</p>
            </li>
          )}
        </ol>

        <div className="firmas">
          <div className="firma">
            {AGENCY.representante}
            <br />
            {AGENCY.rol_representante} — {AGENCY.brand}
          </div>
          <div className="firma">
            {c.contacto_nombre ?? c.nombre}
            <br />
            El Cliente
          </div>
        </div>
      </div>
    </>
  );
}

