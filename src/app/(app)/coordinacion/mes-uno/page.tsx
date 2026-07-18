import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { mergeSettings, type AgencySettings } from "@/lib/coordinacion";

export const dynamic = "force-dynamic";

const ars = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;
const pctTxt = (n: number) => `${Math.round(n * 100)}%`;

/**
 * "Mes 1 de un cliente" (solo dueño): qué se cobra y qué se paga el primer mes
 * de una cuenta de gestión de redes, por pack, EN VIVO desde las tarifas
 * (agency_settings). Es el modelo del Excel FNA hecho pantalla: si cambian las
 * tarifas en Coordinación, esto se actualiza solo.
 */
export default async function MesUnoPage() {
  await requireRole(["admin"]);
  const admin = createAdmin();
  const { data: settingsRow } = await admin
    .from("agency_settings")
    .select("packs, rates")
    .eq("id", 1)
    .maybeSingle();
  const settings: AgencySettings = mergeSettings(settingsRow);
  const r = settings.rates;
  const plus = r.plus_primer_mes ?? 0;

  const rows = settings.packs.map((p) => {
    const portadas = (p as { portadas?: number }).portadas ?? p.reels;
    const diseno = p.posts * r.diseno_pieza;
    const portadasCosto = portadas * r.portada_reel;
    const edicion = p.reels * r.edicion_reel;
    const cm = r.cm[p.id as keyof typeof r.cm] ?? 0;
    const paid = r.media_buyer[p.id as keyof typeof r.media_buyer] ?? 0;
    const luz = Math.round(p.precio * (r.comision_coordinacion ?? 0));
    const leo = Math.round(p.precio * (r.comision_coord_general ?? 0));
    const cdv = Math.round(p.precio * (r.comision_cierre ?? 0));
    const cdvLead = Math.round(p.precio * (r.comision_lead_propio ?? 0));
    const brisaM1 = Math.round(
      (diseno + portadasCosto + (r.manual_marca ?? 0)) * (r.comision_coord_diseno ?? 0)
    );
    const brisaM2 = Math.round(
      (diseno + portadasCosto) * (r.comision_coord_diseno ?? 0)
    );

    const items1: [string, number][] = [
      [`Diseño (${p.posts} carruseles/posteos × ${ars(r.diseno_pieza)})`, diseno],
      [`Portadas (${portadas} × ${ars(r.portada_reel)})`, portadasCosto],
      [`Edición (${p.reels} reels × ${ars(r.edicion_reel)})`, edicion],
      [`Manual de marca (único)`, r.manual_marca ?? 0],
      [`Comisión cierre (${pctTxt(r.comision_cierre ?? 0)})`, cdv],
      [`Comisión Luz (${pctTxt(r.comision_coordinacion ?? 0)})`, luz],
      [`Sueldo CM`, cm],
      [`Sueldo Paid Media`, paid],
      [`Comisión Brisa (${pctTxt(r.comision_coord_diseno ?? 0)} del diseño)`, brisaM1],
      [`Plus 1er mes (CM ${ars(plus)} + Paid ${ars(plus)})`, plus * 2],
      [`Comisión Leo (${pctTxt(r.comision_coord_general ?? 0)})`, leo],
    ];
    const items2: [string, number][] = [
      [`Diseño (${p.posts} × ${ars(r.diseno_pieza)})`, diseno],
      [`Portadas (${portadas} × ${ars(r.portada_reel)})`, portadasCosto],
      [`Edición (${p.reels} × ${ars(r.edicion_reel)})`, edicion],
      [`Comisión Luz (${pctTxt(r.comision_coordinacion ?? 0)})`, luz],
      [`Sueldo CM`, cm],
      [`Sueldo Paid Media`, paid],
      [`Comisión Brisa (${pctTxt(r.comision_coord_diseno ?? 0)} del diseño)`, brisaM2],
      [`Comisión Leo (${pctTxt(r.comision_coord_general ?? 0)})`, leo],
    ];
    const total1 = items1.reduce((a, [, v]) => a + v, 0);
    const total2 = items2.reduce((a, [, v]) => a + v, 0);
    return { pack: p, items1, items2, total1, total2, cdvLead };
  });

  return (
    <div className="mt-4 space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Mes 1 de un cliente</h1>
        <p className="text-muted-foreground">
          Qué se cobra y qué se paga el primer mes de una cuenta de gestión de
          redes, según las tarifas vigentes. Si editás las tarifas, esto se
          actualiza solo.
        </p>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="mb-2 font-semibold">💰 Qué se le cobra al cliente</h2>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>
            <b>Abono del pack</b> — si entra un día distinto al 1°, se cobra el{" "}
            <b>proporcional</b> de los días restantes del mes.
          </li>
          <li>
            <b>Puesta en marcha</b> — pago único de{" "}
            <b>{ars(r.puesta_en_marcha ?? 0)}</b> al firmar (manual + kit +
            onboarding + accesos + setup de Meta).
          </li>
          <li>
            <b>Semana 1 sin publicación</b> — la primera semana es de armado
            (manual, calendario, portadas, biografías). El contenido del pack se
            divide en 4 semanas y el mes 1 se publica el equivalente a{" "}
            <b>3 semanas</b>. Está en la carta acuerdo.
          </li>
        </ul>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        {rows.map(({ pack, items1, items2, total1, total2, cdvLead }) => (
          <div key={pack.id} className="rounded-lg border bg-card p-4">
            <div className="mb-1 flex items-baseline justify-between">
              <h2 className="text-lg font-bold">{pack.id}</h2>
              <div className="text-lg font-bold tabular-nums">{ars(pack.precio)}</div>
            </div>
            <p className="mb-3 text-[11px] text-muted-foreground">
              {pack.reels} reels · {pack.posts} carruseles · {pack.stories} días de
              historias
            </p>

            <h3 className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Primer mes — costos
            </h3>
            <table className="mt-1 w-full text-xs">
              <tbody>
                {items1.map(([label, v]) => (
                  <tr key={label} className="border-b border-border/40 last:border-0">
                    <td className="py-0.5 pr-2">{label}</td>
                    <td className="py-0.5 text-right tabular-nums">{ars(v)}</td>
                  </tr>
                ))}
                <tr className="font-semibold">
                  <td className="pt-1">Total costos</td>
                  <td className="pt-1 text-right tabular-nums">{ars(total1)}</td>
                </tr>
                <tr className={pack.precio - total1 < 0 ? "text-red-600" : "text-emerald-600"}>
                  <td>Bruto mes 1 (sin puesta en marcha)</td>
                  <td className="text-right font-bold tabular-nums">
                    {ars(pack.precio - total1)}
                  </td>
                </tr>
              </tbody>
            </table>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Si el lead lo trajo alguien de la agencia, sumar {ars(cdvLead)} (
              {pctTxt(r.comision_lead_propio ?? 0)}). La puesta en marcha (
              {ars(r.puesta_en_marcha ?? 0)}) mejora el bruto del mes 1.
            </p>

            <h3 className="mt-3 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Del 2° mes en adelante
            </h3>
            <table className="mt-1 w-full text-xs">
              <tbody>
                <tr>
                  <td className="py-0.5 pr-2">Total costos</td>
                  <td className="py-0.5 text-right tabular-nums">{ars(total2)}</td>
                </tr>
                <tr className="font-semibold text-emerald-600">
                  <td>Bruto mensual</td>
                  <td className="text-right tabular-nums">{ars(pack.precio - total2)}</td>
                </tr>
                <tr className="text-muted-foreground">
                  <td>Margen</td>
                  <td className="text-right tabular-nums">
                    {((1 - total2 / pack.precio) * 100).toFixed(1)}%
                  </td>
                </tr>
              </tbody>
            </table>
            <details className="mt-1">
              <summary className="cursor-pointer text-[10px] text-muted-foreground">
                Ver detalle del 2° mes
              </summary>
              <table className="mt-1 w-full text-xs">
                <tbody>
                  {items2.map(([label, v]) => (
                    <tr key={label} className="border-b border-border/40 last:border-0">
                      <td className="py-0.5 pr-2">{label}</td>
                      <td className="py-0.5 text-right tabular-nums">{ars(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Cuentas con precio personalizado (Boxescar, Azotea, Dr Dionisi,
        Botineta): sin comisión de Leo y con acuerdos propios — ver Panorama.
        Este modelo espeja el Excel FNA (hoja C.Operativos).
      </p>
    </div>
  );
}
