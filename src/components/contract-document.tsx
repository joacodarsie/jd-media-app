import { AGENCY } from "@/lib/agency";
import { SERVICE_TYPE_LABEL } from "@/lib/constants";
import { getDeliverables } from "@/lib/service-deliverables";
import { applyContractDiscount } from "@/lib/payment-reminder";
import type { ClientService } from "@/lib/types";
import { PrintButton } from "@/components/print-button";

// ============================================================================
// Documento de carta acuerdo. Renderiza tanto la carta INDIVIDUAL (1 marca)
// como la UNIFICADA (varias marcas del mismo titular). Es la única fuente de
// verdad de las cláusulas: así la carta individual y la unificada nunca
// divergen en el texto legal.
// ============================================================================

export interface ContractMarca {
  /** Nombre de la marca/cuenta (clients.nombre). */
  nombre: string;
  /** Servicios activos de la cuenta. */
  services: ClientService[];
  moneda: string;
  descuento: { pct: number; monto: number; meses: number };
}

export interface ContractModel {
  numero: string | null;
  fechaInicio: string | null;
  plazoMeses: number;
  diaCobro: number;
  moneda: string;
  observaciones: string | null;
  /** Puesta en marcha por cuenta de gestión de redes (0 = no aplica). */
  puestaEnMarcha: number;
  titular: {
    nombre: string;
    dni_cuit: string | null;
    domicilio: string | null;
    email: string | null;
  };
  marcas: ContractMarca[];
  /** Link "volver" de la barra superior (solo en pantalla). */
  backHref: string;
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

function fmtDate(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function ordinalDia(n: number): string {
  if (n === 1) return "primer";
  return `${n}º`;
}

const esUnico = (s: ClientService) =>
  (s as { facturacion?: string }).facturacion === "unico";

/** Descuento efectivo de una marca sobre su abono mensual. */
function marcaConDescuento(m: ContractMarca): number {
  return applyContractDiscount(marcaTotalMensual(m), {
    contrato_descuento_pct: m.descuento.pct,
    contrato_descuento_monto: m.descuento.monto,
  });
}
function marcaTotalMensual(m: ContractMarca): number {
  return m.services
    .filter((s) => !esUnico(s))
    .reduce((acc, s) => acc + (Number(s.monto_mensual) || 0), 0);
}
function marcaTieneDescuento(m: ContractMarca): boolean {
  return (m.descuento.pct > 0 || m.descuento.monto > 0) && m.descuento.meses > 0;
}
function descTxt(m: ContractMarca): string {
  return m.descuento.monto > 0
    ? `de ${fmtMoney(m.descuento.monto, m.moneda)}`
    : `del ${m.descuento.pct}%`;
}

function ServiceCard({ s, moneda }: { s: ClientService; moneda: string }) {
  const deliverables = getDeliverables(s);
  return (
    <div className="service-card">
      <div className="head">
        <div className="name">{SERVICE_TYPE_LABEL[s.tipo] ?? s.tipo}</div>
        <div className="price">
          {s.monto_mensual
            ? `${fmtMoney(Number(s.monto_mensual), s.moneda || moneda)}${esUnico(s) ? " (pago único)" : " / mes"}`
            : "A convenir"}
        </div>
      </div>
      {s.pack && <div className="pack">Pack: {s.pack}</div>}
      {deliverables.length > 0 && (
        <ul>
          {deliverables.map((d, i) =>
            d.startsWith("## ") ? (
              <li key={i} className="subhead">
                {d.slice(3)}
              </li>
            ) : (
              <li key={i}>{d}</li>
            )
          )}
        </ul>
      )}
      {s.notas && (
        <p
          style={{
            color: "#666",
            fontSize: 11,
            marginTop: 6,
            fontStyle: "italic",
          }}
        >
          {s.notas}
        </p>
      )}
    </div>
  );
}

export function ContractDocument({ model }: { model: ContractModel }) {
  const { marcas, titular, moneda } = model;
  const isUnified = marcas.length > 1;

  // Totales agregados sobre todas las marcas.
  const allServices = marcas.flatMap((m) => m.services);
  const recurrentesAll = allServices.filter((s) => !esUnico(s));
  const unicosAll = allServices.filter((s) => esUnico(s));
  const totalMensual = recurrentesAll.reduce(
    (acc, s) => acc + (Number(s.monto_mensual) || 0),
    0
  );
  const totalUnico = unicosAll.reduce(
    (acc, s) => acc + (Number(s.monto_mensual) || 0),
    0
  );
  const hayMensual = recurrentesAll.length > 0;
  const hayUnico = unicosAll.length > 0;
  const tienePaid = allServices.some((s) => s.tipo === "paid_media");
  const tieneGestionContenido = allServices.some(
    (s) => s.tipo === "gestion_redes" || s.tipo === "edicion_audiovisual"
  );
  const tieneGestionRedes = allServices.some((s) => s.tipo === "gestion_redes");
  // Puesta en marcha: una por cada cuenta de gestión de redes.
  const gestionRedesCount = marcas.filter((m) =>
    m.services.some((s) => s.tipo === "gestion_redes")
  ).length;
  const puestaTotal = model.puestaEnMarcha * gestionRedesCount;

  const hayAlgunDescuento = marcas.some(marcaTieneDescuento);
  // Para la carta individual, el monto con descuento combinado (comportamiento
  // histórico: un solo descuento sobre el total).
  const montoConDescuentoSingle =
    !isUnified && marcaTieneDescuento(marcas[0]) ? marcaConDescuento(marcas[0]) : null;

  const diaCobro = model.diaCobro;
  const plazoMeses = model.plazoMeses;
  const fechaInicio = fmtDate(model.fechaInicio);
  const año = model.fechaInicio
    ? new Date(model.fechaInicio).getFullYear()
    : new Date().getFullYear();

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
          max-width: 780px;
          margin: 24px auto;
          padding: 56px 60px 80px;
          box-shadow: 0 4px 32px rgba(0,0,0,.08);
          line-height: 1.6;
          font-size: 13px;
          color: #232323;
        }

        /* HEADER / portada */
        .brand {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding-bottom: 18px;
          border-bottom: 3px solid #FFD400;
          margin-bottom: 32px;
        }
        .brand .logo {
          font-size: 24px;
          font-weight: 800;
          letter-spacing: -0.5px;
        }
        .brand .logo .accent {
          background: #FFD400;
          color: #000;
          padding: 2px 8px;
          border-radius: 4px;
          margin-right: 4px;
          font-weight: 900;
        }
        .brand .meta {
          text-align: right;
          font-size: 11px;
          color: #555;
          line-height: 1.5;
        }
        .brand .meta .label {
          text-transform: uppercase;
          letter-spacing: 0.08em;
          font-size: 9px;
          color: #888;
          margin-bottom: 2px;
        }
        .brand .meta .value {
          font-weight: 600;
          color: #1a1a1a;
          font-size: 12px;
        }

        h1.title {
          font-size: 26px;
          font-weight: 800;
          margin: 0 0 6px;
          letter-spacing: -0.5px;
        }
        .subtitle {
          color: #666;
          font-size: 12px;
          margin: 0 0 38px;
        }

        /* Secciones */
        section.clause {
          margin-bottom: 22px;
        }
        section.clause h2 {
          font-size: 13px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #1a1a1a;
          margin: 0 0 8px;
          padding-bottom: 4px;
          border-bottom: 1px solid #eaeaea;
        }
        section.clause h2 .num {
          color: #FFD400;
          background: #1a1a1a;
          padding: 1px 6px;
          border-radius: 3px;
          margin-right: 8px;
          font-size: 11px;
          font-weight: 800;
        }
        section.clause p {
          margin: 4px 0;
          color: #2a2a2a;
        }
        section.clause strong { color: #111; }

        /* Tabla de servicios */
        .services {
          margin-top: 8px;
        }
        .marca-group { margin-bottom: 18px; }
        .marca-group .marca-head {
          font-weight: 800;
          font-size: 13px;
          color: #1a1a1a;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin: 0 0 8px;
          padding: 4px 10px;
          background: #FFF7CC;
          border-radius: 4px;
          border-left: 3px solid #FFD400;
        }
        .subtotal-line {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 4px;
          padding: 8px 14px;
          background: #f4f4f4;
          border-radius: 5px;
          font-size: 12px;
        }
        .subtotal-line .label {
          text-transform: uppercase;
          letter-spacing: 0.06em;
          font-size: 10px;
          color: #666;
        }
        .subtotal-line .value { font-weight: 700; color: #1a1a1a; }
        .service-card {
          background: #fafafa;
          border: 1px solid #e9e9e9;
          border-left: 3px solid #FFD400;
          border-radius: 6px;
          padding: 14px 16px;
          margin-bottom: 10px;
          page-break-inside: avoid;
        }
        .service-card .head {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 6px;
        }
        .service-card .name {
          font-weight: 700;
          font-size: 14px;
          color: #1a1a1a;
        }
        .service-card .price {
          font-weight: 700;
          font-size: 14px;
          color: #1a1a1a;
          white-space: nowrap;
        }
        .service-card .pack {
          color: #777;
          font-size: 11px;
          margin-top: -2px;
          margin-bottom: 6px;
        }
        .service-card ul {
          margin: 4px 0 0;
          padding-left: 18px;
          font-size: 12px;
          color: #444;
        }
        .service-card ul li { margin: 2px 0; }
        .service-card ul li.subhead {
          list-style: none;
          margin-left: -18px;
          margin-top: 8px;
          margin-bottom: 2px;
          font-weight: 600;
          font-size: 11px;
          color: #222;
          text-transform: uppercase;
          letter-spacing: 0.03em;
        }
        .service-card ul li.subhead:first-child { margin-top: 0; }

        .total-line {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 12px;
          padding: 12px 16px;
          background: #1a1a1a;
          color: white;
          border-radius: 6px;
        }
        .total-line .label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #FFD400;
        }
        .total-line .value {
          font-weight: 800;
          font-size: 18px;
        }

        .promo {
          background: #FFFBEB;
          border: 1px solid #FFD400;
          border-left: 4px solid #FFD400;
          padding: 10px 14px;
          margin: 10px 0;
          border-radius: 4px;
          font-size: 12px;
        }
        .promo strong { color: #7a5800; }
        .promo ul { margin: 6px 0 0; padding-left: 18px; }
        .promo ul li { margin: 2px 0; }

        .observaciones {
          background: #f7f7f7;
          padding: 12px 14px;
          border-radius: 6px;
          font-size: 12px;
          white-space: pre-line;
        }

        /* Bloque de aceptación digital */
        .aceptacion {
          margin-top: 40px;
          padding: 18px 20px;
          background: #fafafa;
          border: 1px solid #e9e9e9;
          border-left: 3px solid #FFD400;
          border-radius: 6px;
          page-break-inside: avoid;
        }
        .aceptacion .titulo {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #1a1a1a;
          margin-bottom: 8px;
        }
        .aceptacion p {
          margin: 4px 0;
          font-size: 12px;
          color: #2a2a2a;
        }
        .partes {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 32px;
          margin-top: 16px;
          padding-top: 14px;
          border-top: 1px solid #e9e9e9;
        }
        .parte .label {
          font-size: 9px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #888;
          margin-bottom: 4px;
        }
        .parte .name {
          font-weight: 700;
          color: #1a1a1a;
          font-size: 13px;
        }
        .parte .meta {
          color: #555;
          font-size: 11px;
        }

        /* Footer */
        .footer {
          margin-top: 36px;
          padding-top: 12px;
          border-top: 1px solid #eaeaea;
          font-size: 10px;
          color: #888;
          text-align: center;
          letter-spacing: 0.02em;
        }

        /* Barra superior solo en pantalla */
        .print-bar {
          position: sticky;
          top: 0;
          z-index: 10;
          background: #1a1a1a;
          color: white;
          padding: 10px 20px;
          display: flex;
          gap: 12px;
          align-items: center;
          justify-content: space-between;
          font-size: 13px;
        }
        .print-bar a {
          color: white;
          background: transparent;
          border: 1px solid #555;
          padding: 6px 12px;
          border-radius: 5px;
          cursor: pointer;
          font-size: 12px;
          text-decoration: none;
        }
        .print-bar a:hover { background: #333; }

        @media print {
          .print-bar { display: none; }
          body { background: white; }
          .doc {
            box-shadow: none;
            max-width: none;
            margin: 0;
            padding: 0;
          }
        }
      `}</style>

      <div className="print-bar">
        <div>
          <strong>{AGENCY.brand}</strong> · Carta acuerdo{" "}
          {isUnified ? "unificada " : ""}
          {model.numero ?? ""}
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <a href={model.backHref}>← Volver al onboarding</a>
          <PrintButton />
        </div>
      </div>

      <div className="doc">
        {/* HEADER */}
        <header className="brand">
          <div className="logo">
            <span className="accent">JD</span>Media
          </div>
          <div className="meta">
            <div className="label">
              Carta acuerdo{isUnified ? " (unificada)" : ""}
            </div>
            <div className="value">{model.numero ?? `S/N · ${año}`}</div>
            {model.fechaInicio && (
              <>
                <div className="label" style={{ marginTop: 6 }}>
                  Fecha
                </div>
                <div className="value">{fechaInicio}</div>
              </>
            )}
          </div>
        </header>

        <h1 className="title">Acuerdo de Prestación de Servicios</h1>
        <p className="subtitle">
          Entre <strong>{AGENCY.brand}</strong> y <strong>{titular.nombre}</strong>
          {isUnified && (
            <>
              {" "}
              — para las marcas{" "}
              <strong>{marcas.map((m) => m.nombre).join(", ")}</strong>
            </>
          )}
        </p>

        {/* 1. Partes */}
        <section className="clause">
          <h2>
            <span className="num">01</span>Identificación de las partes
          </h2>
          <p>
            <strong>{AGENCY.brand}</strong>, representada por{" "}
            <strong>{AGENCY.legal_name}</strong>, CUIT {AGENCY.cuit}, con
            domicilio en {AGENCY.domicilio}, en adelante &ldquo;La Agencia&rdquo;.
          </p>
          <p>
            <strong>{titular.nombre}</strong>
            {titular.dni_cuit && <>, DNI/CUIT {titular.dni_cuit}</>}
            {titular.domicilio && <>, con domicilio en {titular.domicilio}</>}
            , en adelante &ldquo;El Cliente&rdquo;.
          </p>
          {isUnified && (
            <p>
              El presente acuerdo comprende, de forma unificada, las siguientes
              marcas/cuentas del Cliente:{" "}
              <strong>{marcas.map((m) => m.nombre).join(", ")}</strong>.
            </p>
          )}
        </section>

        {/* 2. Objeto */}
        <section className="clause">
          <h2>
            <span className="num">02</span>Objeto del contrato
          </h2>
          <p>
            La Agencia se compromete a brindar los servicios contratados por el
            Cliente, detallados a continuación, con el alcance específico de cada
            uno.
          </p>
        </section>

        {/* 3. Servicios contratados (con entregables) */}
        <section className="clause">
          <h2>
            <span className="num">03</span>Servicios contratados y alcance
          </h2>
          {allServices.length === 0 ? (
            <p style={{ color: "#a36b00" }}>
              ⚠ Sin servicios cargados. Agregalos en la ficha del cliente antes de
              generar la carta.
            </p>
          ) : (
            <div className="services">
              {!isUnified ? (
                marcas[0].services.map((s) => (
                  <ServiceCard key={s.id} s={s} moneda={moneda} />
                ))
              ) : (
                marcas.map((m) => {
                  const sub = marcaTotalMensual(m);
                  return (
                    <div key={m.nombre} className="marca-group">
                      <div className="marca-head">{m.nombre}</div>
                      {m.services.map((s) => (
                        <ServiceCard key={s.id} s={s} moneda={moneda} />
                      ))}
                      {sub > 0 && (
                        <div className="subtotal-line">
                          <span className="label">Subtotal mensual · {m.nombre}</span>
                          <span className="value">{fmtMoney(sub, moneda)}</span>
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {hayMensual && (
                <div className="total-line">
                  <span className="label">
                    Total mensual{isUnified ? " (todas las marcas)" : ""}
                  </span>
                  <span className="value">{fmtMoney(totalMensual, moneda)}</span>
                </div>
              )}
              {hayUnico && (
                <div className="total-line" style={{ marginTop: hayMensual ? 8 : 12 }}>
                  <span className="label">Pago único</span>
                  <span className="value">{fmtMoney(totalUnico, moneda)}</span>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 4. Honorarios */}
        <section className="clause">
          <h2>
            <span className="num">04</span>Honorarios y forma de pago
          </h2>
          {hayMensual && (
            <p>
              Por los servicios <strong>mensuales</strong> contratados
              {isUnified ? " (todas las marcas)" : ""}, el Cliente abonará la suma
              de <strong>{fmtMoney(totalMensual, moneda)}</strong> por mes, por
              adelantado el {ordinalDia(diaCobro)} día hábil de cada mes, mediante
              transferencia bancaria a los datos provistos por La Agencia.
            </p>
          )}

          {/* Descuento: individual = un solo bloque; unificada = detalle por marca. */}
          {hayMensual && !isUnified && montoConDescuentoSingle !== null && (
            <div className="promo">
              <strong>Promoción inicial:</strong> durante los primeros{" "}
              {marcas[0].descuento.meses}{" "}
              {marcas[0].descuento.meses === 1 ? "mes" : "meses"} de contrato se
              aplicará un descuento {descTxt(marcas[0])}, por lo cual el monto a
              abonar en dicho período será de{" "}
              <strong>{fmtMoney(montoConDescuentoSingle, moneda)}</strong>. A
              partir del mes {marcas[0].descuento.meses + 1}, los honorarios serán
              los establecidos sin descuento.
            </div>
          )}
          {hayMensual && isUnified && hayAlgunDescuento && (
            <div className="promo">
              <strong>Promoción inicial:</strong> se aplican los siguientes
              descuentos sobre el abono, según la marca:
              <ul>
                {marcas.filter(marcaTieneDescuento).map((m) => (
                  <li key={m.nombre}>
                    <strong>{m.nombre}:</strong> descuento {descTxt(m)} durante los
                    primeros {m.descuento.meses}{" "}
                    {m.descuento.meses === 1 ? "mes" : "meses"} (abona{" "}
                    <strong>{fmtMoney(marcaConDescuento(m), m.moneda)}</strong> en
                    ese período). Luego, el abono pleno.
                  </li>
                ))}
              </ul>
            </div>
          )}

          {hayMensual && (
            <p>
              El abono mensual corresponde a la <strong>totalidad</strong> del
              servicio del mes, con independencia del día en que se efectúe el
              pago. Si el contenido previsto para el mes no llegara a completarse
              dentro del período, las piezas pendientes se trasladan y suman a la
              producción del mes siguiente, sin que ello genere costo adicional ni
              reducción del abono.
            </p>
          )}

          {tieneGestionRedes && puestaTotal > 0 && (
            <p>
              <strong>Puesta en marcha (pago único inicial):</strong> al inicio del
              acuerdo, y por única vez, el Cliente abona la suma de{" "}
              <strong>{fmtMoney(model.puestaEnMarcha, moneda)}</strong>
              {gestionRedesCount > 1 ? (
                <>
                  {" "}
                  <strong>por cada cuenta</strong> de gestión de redes ({gestionRedesCount}{" "}
                  cuentas ={" "}
                  <strong>{fmtMoney(puestaTotal, moneda)}</strong> en total)
                </>
              ) : null}{" "}
              en concepto de puesta en marcha de la cuenta, que comprende: manual de
              marca, kit de marca y plantillas de historias; reunión de onboarding;
              armado de los grupos de trabajo; obtención de accesos y creación de las
              cuentas o perfiles que resulten necesarios (Instagram, TikTok u otros); y
              la configuración inicial de las herramientas de campañas (Meta Business).
              En consecuencia, <strong>el primer mes</strong> el Cliente abona el abono
              mensual <strong>más</strong> la puesta en marcha; a partir del{" "}
              <strong>segundo mes</strong>, únicamente el abono mensual.
            </p>
          )}

          {hayUnico && (
            <p>
              Por los servicios de <strong>pago único</strong> contratados
              (proyectos de única vez), el Cliente abonará la suma total de{" "}
              <strong>{fmtMoney(totalUnico, moneda)}</strong>. Salvo acuerdo
              distinto pactado por escrito, se abona el <strong>50%</strong> por
              adelantado para iniciar el trabajo y el <strong>50%</strong> restante
              contra la entrega de los archivos finales aprobados.
            </p>
          )}

          <p>
            <strong>Cláusula de mora:</strong> si un pago no se efectúa dentro de
            los 3 días hábiles posteriores a la fecha de vencimiento, La Agencia
            podrá suspender los servicios hasta que se regularice la situación.
          </p>
          <p>
            <strong>No reembolsos:</strong> los pagos realizados no serán
            reembolsados una vez iniciado el servicio
            {hayMensual ? " del mes correspondiente" : " o entregado el avance"}.
          </p>
        </section>

        {tienePaid && (
          <section className="clause">
            <h2>
              <span className="num">05</span>Inversión publicitaria (Paid Media)
            </h2>
            <p>
              El monto destinado a inversión publicitaria en plataformas (Meta Ads,
              Google Ads u otras) <strong>no</strong> está incluido en los
              honorarios de La Agencia. El Cliente lo abonará directamente a la
              plataforma con su propio medio de pago, o a La Agencia para que ésta
              lo gestione, según lo acordado por escrito en cada caso.
            </p>
          </section>
        )}

        {/* 5/6. Duración */}
        <section className="clause">
          <h2>
            <span className="num">{tienePaid ? "06" : "05"}</span>Duración del
            acuerdo
          </h2>
          <p>
            <strong>Fecha de inicio:</strong> {fechaInicio}
          </p>
          {hayMensual && (
            <>
              <p>
                <strong>Plazo inicial:</strong> {plazoMeses}{" "}
                {plazoMeses === 1 ? "mes" : "meses"}.
              </p>
              <p>
                <strong>Renovación automática:</strong> El contrato de los
                servicios mensuales se renovará automáticamente, salvo aviso por
                escrito con 15 días de anticipación.
              </p>
              <p>
                <strong>Ajuste de tarifas por inflación:</strong> En el contexto
                inflacionario de Argentina, los honorarios mensuales se
                actualizarán <strong>cada 3 meses</strong> tomando como referencia
                la variación del Índice de Precios al Consumidor (IPC) publicado por
                el INDEC para el período transcurrido, o el índice oficial que lo
                reemplace. La Agencia notificará al Cliente el nuevo valor con al
                menos 10 días de anticipación a su entrada en vigencia. Este ajuste
                tiene por único fin mantener el valor real del servicio y no
                constituye un aumento adicional.
              </p>
            </>
          )}
          {hayUnico && (
            <p>
              <strong>Servicios de pago único:</strong> se ejecutan como proyecto
              puntual. El acuerdo respecto de ellos se considera cumplido con la
              entrega de los archivos finales aprobados y el pago total
              correspondiente. El plazo estimado de entrega se acuerda por escrito
              según el alcance del proyecto.
            </p>
          )}
        </section>

        <section className="clause">
          <h2>
            <span className="num">{tienePaid ? "07" : "06"}</span>Obligaciones de
            las partes
          </h2>
          <p>
            <strong>La Agencia:</strong> prestar los servicios contratados con
            profesionalismo, confidencialidad y en los plazos acordados.
          </p>
          <p>
            <strong>El Cliente:</strong> entregar materiales, accesos e información
            en tiempo y forma; brindar las autorizaciones necesarias; y efectuar el
            pago correspondiente en las condiciones establecidas.
          </p>
        </section>

        {tieneGestionContenido && (
          <section className="clause">
            <h2>
              <span className="num">{tienePaid ? "08" : "07"}</span>Material y
              contenido
            </h2>
            <p>
              El Cliente compartirá material crudo (fotos, videos, logos, accesos)
              por los canales acordados. La Agencia es responsable de la edición,
              optimización y publicación según calendario. El material crudo
              entregado y las piezas finales producidas son propiedad del Cliente
              una vez abonados los honorarios del período correspondiente.
            </p>
            <p>
              <strong>Jornadas de producción audiovisual:</strong> la producción
              presencial (jornadas de filmación o fotografía en el domicilio del
              Cliente o en locación) <strong>no</strong> está incluida en el abono
              mensual y constituye un servicio adicional, que se cotiza y abona por
              separado según se acuerde en cada caso.
            </p>
          </section>
        )}

        <section className="clause">
          <h2>
            <span className="num">
              {tienePaid && tieneGestionContenido
                ? "09"
                : tienePaid || tieneGestionContenido
                  ? "08"
                  : "07"}
            </span>
            Propiedad intelectual y uso de materiales
          </h2>
          <p>
            El Cliente es propietario de los materiales una vez abonados los
            honorarios. La Agencia podrá utilizar piezas y resultados en su
            portfolio o material de difusión, salvo objeción expresa por escrito del
            Cliente.
          </p>
        </section>

        <section className="clause">
          <h2>
            <span className="num">
              {tienePaid && tieneGestionContenido
                ? "10"
                : tienePaid || tieneGestionContenido
                  ? "09"
                  : "08"}
            </span>
            Canales de comunicación oficiales
          </h2>
          <p>
            La coordinación oficial del proyecto se realizará por el grupo de
            WhatsApp creado por La Agencia y/o el correo electrónico de contacto.
            Mensajes recibidos por otras vías (DM de redes sociales, llamadas no
            agendadas) podrán no ser atendidos en tiempo y forma.
          </p>
        </section>

        <section className="clause">
          <h2>
            <span className="num">
              {tienePaid && tieneGestionContenido
                ? "11"
                : tienePaid || tieneGestionContenido
                  ? "10"
                  : "09"}
            </span>
            Confidencialidad
          </h2>
          <p>
            Ninguna parte podrá divulgar información sensible obtenida en el marco
            de este acuerdo sin autorización previa de la otra.
          </p>
        </section>

        <section className="clause">
          <h2>
            <span className="num">
              {tienePaid && tieneGestionContenido
                ? "12"
                : tienePaid || tieneGestionContenido
                  ? "11"
                  : "10"}
            </span>
            Limitación de responsabilidad
          </h2>
          <p>
            La Agencia se compromete a aplicar las mejores prácticas y conocimientos
            en marketing digital, pero no puede garantizar resultados específicos
            (ventas, leads, alcance, etc.), ya que éstos dependen de múltiples
            factores externos.
          </p>
          <p>
            La Agencia no será responsable por caídas, cambios de políticas o
            bloqueos de plataformas de terceros (Meta, Google, etc.).
          </p>
        </section>

        <section className="clause">
          <h2>
            <span className="num">
              {tienePaid && tieneGestionContenido
                ? "13"
                : tienePaid || tieneGestionContenido
                  ? "12"
                  : "11"}
            </span>
            Rescisión
          </h2>
          <p>
            Cualquiera de las partes puede rescindir el presente acuerdo con aviso
            por escrito de 15 días. En caso de incumplimiento grave, incluyendo la
            falta de pago, La Agencia podrá rescindir el contrato de manera
            inmediata.
          </p>
        </section>

        <section className="clause">
          <h2>
            <span className="num">
              {tienePaid && tieneGestionContenido
                ? "14"
                : tienePaid || tieneGestionContenido
                  ? "13"
                  : "12"}
            </span>
            Jurisdicción y entrada en vigencia
          </h2>
          <p>
            Cualquier controversia derivada del presente acuerdo será resuelta en
            los {AGENCY.jurisdiccion}. El presente contrato entrará en vigencia a
            partir de la acreditación del pago correspondiente por parte del
            Cliente.
          </p>
        </section>

        {model.observaciones && (
          <section className="clause">
            <h2>
              <span className="num">★</span>Observaciones particulares
            </h2>
            <div className="observaciones">{model.observaciones}</div>
          </section>
        )}

        {/* Bloque de aceptación digital */}
        <div className="aceptacion">
          <div className="titulo">Aceptación del acuerdo</div>
          <p>
            La aceptación del presente acuerdo por parte del Cliente se perfecciona
            mediante la{" "}
            <strong>acreditación del pago del primer honorario</strong>, conforme a
            la cláusula de Entrada en vigencia. Dicho pago implica la conformidad
            expresa con la totalidad de los términos y condiciones descriptos en
            este documento.
          </p>
          <div className="partes">
            <div className="parte">
              <div className="label">La Agencia</div>
              <div className="name">{AGENCY.representante}</div>
              <div className="meta">
                {AGENCY.rol_representante} — {AGENCY.brand}
                <br />
                CUIT {AGENCY.cuit}
              </div>
            </div>
            <div className="parte">
              <div className="label">El Cliente</div>
              <div className="name">{titular.nombre}</div>
              <div className="meta">
                {titular.dni_cuit && <>DNI/CUIT {titular.dni_cuit}</>}
                {titular.email && (
                  <>
                    {titular.dni_cuit ? <br /> : null}
                    {titular.email}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="footer">
          {AGENCY.brand} · {AGENCY.legal_name} · CUIT {AGENCY.cuit} ·{" "}
          {AGENCY.domicilio}
        </div>
      </div>
    </>
  );
}
