import { notFound } from "next/navigation";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { AGENCY } from "@/lib/agency";
import { ROLE_LABEL } from "@/lib/constants";
import { currentPeriod, fmtARS, periodLabel } from "@/lib/finanzas";
import { buildPeriodPayroll } from "@/lib/payroll-period";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

const fmt = (n: number) => fmtARS(n);

/**
 * Recibo de sueldo imprimible (o "Guardar como PDF") por persona y mes. Detalla
 * a qué corresponde cada parte del pago. Solo admin. Vive fuera del shell de la
 * app para imprimirse limpio.
 */
export default async function ReciboSueldoPage({
  params,
  searchParams,
}: {
  params: { userId: string };
  searchParams: { periodo?: string };
}) {
  await requireRole(["admin"]);
  const admin = createAdmin();
  const periodo =
    searchParams.periodo && /^\d{4}-\d{2}$/.test(searchParams.periodo)
      ? searchParams.periodo
      : currentPeriod();

  const { people, salaryConcepto } = await buildPeriodPayroll(admin, periodo);
  const person = people.find((p) => p.userId === params.userId);
  if (!person) notFound();

  // Todas las líneas en una sola lista ordenada: primero lo automático, después
  // lo manual (comisiones, extras, ajustes).
  const rows = [
    ...person.autoLines.map((l) => ({
      cliente: l.cliente && l.cliente !== "—" ? l.cliente : null,
      concepto: l.concepto,
      monto: l.monto,
    })),
    ...person.manualItems.map((it) => ({
      cliente: it.cliente,
      concepto: it.concepto,
      monto: it.monto,
    })),
  ];

  const hoy = new Date().toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const estado = person.pagado ? "Pagado" : person.registrado ? "Registrado (pendiente de pago)" : "No registrado";

  return (
    <>
      <style>{`
        @page { size: A4; margin: 16mm 16mm; }
        * { box-sizing: border-box; }
        body { background: #ececec; margin: 0;
          font-family: 'Inter','Helvetica Neue',system-ui,-apple-system,sans-serif;
          color: #1a1a1a; }
        .sheet { background: #fff; max-width: 760px; margin: 24px auto;
          padding: 40px 44px; box-shadow: 0 1px 6px rgba(0,0,0,.12); }
        .row { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; }
        table { width: 100%; border-collapse: collapse; }
        td, th { padding: 8px 4px; text-align: left; vertical-align: top; font-size: 13px; }
        thead th { border-bottom: 2px solid #1a1a1a; font-size: 11px; text-transform: uppercase;
          letter-spacing: .04em; color: #555; }
        tbody tr { border-bottom: 1px solid #eee; }
        .num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .toolbar { max-width: 760px; margin: 16px auto 0; display: flex; justify-content: flex-end; }
        @media print { .toolbar { display: none; } body { background: #fff; }
          .sheet { box-shadow: none; margin: 0; max-width: none; padding: 0; } }
      `}</style>

      <div className="toolbar">
        <PrintButton />
      </div>

      <div className="sheet">
        {/* Encabezado */}
        <div className="row" style={{ marginBottom: 4 }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>{AGENCY.brand}</div>
          <div style={{ textAlign: "right", fontSize: 12, color: "#555" }}>
            Recibo de sueldo
            <br />
            <strong style={{ color: "#1a1a1a", textTransform: "capitalize" }}>
              {periodLabel(periodo)}
            </strong>
          </div>
        </div>
        <div style={{ height: 1, background: "#1a1a1a", margin: "10px 0 18px" }} />

        {/* Persona */}
        <div className="row" style={{ marginBottom: 18 }}>
          <div>
            <div style={{ fontSize: 11, color: "#888", textTransform: "uppercase", letterSpacing: ".04em" }}>
              Colaborador/a
            </div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>{person.nombre}</div>
            <div style={{ fontSize: 12, color: "#555" }}>
              {ROLE_LABEL[person.rol as keyof typeof ROLE_LABEL] ?? person.rol}
            </div>
          </div>
          <div style={{ textAlign: "right", fontSize: 12, color: "#555" }}>
            <div>Emitido: {hoy}</div>
            <div>Estado: <strong style={{ color: "#1a1a1a" }}>{estado}</strong></div>
          </div>
        </div>

        {/* Detalle */}
        <table>
          <thead>
            <tr>
              <th>Concepto</th>
              <th>Cliente</th>
              <th className="num">Monto</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>{r.concepto}</td>
                <td style={{ color: "#666" }}>{r.cliente ?? "—"}</td>
                <td className="num" style={{ color: r.monto < 0 ? "#c0392b" : undefined }}>
                  {fmt(r.monto)}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={3} style={{ color: "#888", padding: "16px 4px" }}>
                  Sin conceptos cargados para este mes.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} style={{ paddingTop: 14, fontWeight: 700, fontSize: 15 }}>
                Total {salaryConcepto.toLowerCase()}
              </td>
              <td className="num" style={{ paddingTop: 14, fontWeight: 800, fontSize: 16 }}>
                {fmt(person.total)}
              </td>
            </tr>
          </tfoot>
        </table>

        {/* Datos de pago */}
        <div style={{ marginTop: 28, fontSize: 12, color: "#555", borderTop: "1px solid #eee", paddingTop: 14 }}>
          <div style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: ".04em", color: "#888", marginBottom: 4 }}>
            Datos de transferencia
          </div>
          {person.alias ? (
            <div>
              Alias/CBU: <strong style={{ color: "#1a1a1a" }}>{person.alias}</strong>
              {person.titular ? ` · ${person.titular}` : ""}
            </div>
          ) : (
            <div style={{ color: "#aaa" }}>Sin alias/CBU cargado en el perfil.</div>
          )}
          <div style={{ marginTop: 14, fontSize: 10, color: "#aaa" }}>
            Documento interno generado por {AGENCY.brand} · no es un recibo de sueldo
            de carácter legal/fiscal.
          </div>
        </div>
      </div>
    </>
  );
}
