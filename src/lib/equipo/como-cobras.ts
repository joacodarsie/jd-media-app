/**
 * «Cómo y cuándo cobrás» en Mi perfil (21/10/2026). Sale de las MISMAS tarifas
 * con las que se calcula la nómina (`agency_settings.rates`), así que nunca
 * queda viejo: si el dueño cambia una tarifa, cambia acá. Los acuerdos cargados
 * en Contratos son borradores de junio y no sirven de fuente.
 */
import type { AgencyRates } from "@/lib/coordinacion";

export interface PersonaCobro {
  rol: string;
  rol_secundario?: string | null;
  area?: string | null;
  area_secundaria?: string | null;
  comercial_sin_fijo?: boolean | null;
}

const $ = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;
const pct = (x: number) => `${Math.round(x * 1000) / 10}%`;

/** Las líneas de cómo se calcula lo que cobra esta persona. */
export function comoCobras(p: PersonaCobro, r: AgencyRates): string[] {
  const roles = new Set([p.rol, p.rol_secundario].filter(Boolean) as string[]);
  const areas = new Set([p.area, p.area_secundaria].filter(Boolean) as string[]);
  const out: string[] = [];
  const packs = (t: Record<string, number> | undefined) =>
    t ? `Presencia ${$(t.Presencia ?? 0)} · Crecimiento ${$(t.Crecimiento ?? 0)} · Escala ${$(t.Escala ?? 0)}` : "";

  if (roles.has("community_manager") || areas.has("Community Manager")) {
    out.push(`Por cada cuenta que llevás como community manager, por mes según su pack: ${packs(r.cm)}.`);
  }
  if (areas.has("Paid Media") || areas.has("Coordinación de Paid Media")) {
    out.push(`Por cada cuenta con pauta que llevás, por mes según su pack: ${packs(r.media_buyer)}.`);
  }
  if (roles.has("diseno") || areas.has("Diseño")) {
    out.push(
      `Por pieza publicada: ${$(r.diseno_pieza ?? 0)} cada posteo o carrusel y ${$(r.portada_reel ?? 0)} cada portada de reel.` +
        (r.manual_marca ? ` Cada kit o manual de marca de una cuenta nueva: ${$(r.manual_marca)}.` : "")
    );
  }
  if (roles.has("audiovisual") || areas.has("Edición Audiovisual")) {
    out.push(`Por reel o video publicado: ${$(r.edicion_reel ?? 0)}.`);
  }
  if (roles.has("comercial") || areas.has("Comercial")) {
    if (!p.comercial_sin_fijo && (r.comercial_fijo ?? 0) > 0) {
      out.push(`Fijo mensual por sostener la prospección: ${$(r.comercial_fijo ?? 0)}.`);
    }
    out.push(
      `Por cada cuenta que cerrás: ${pct(r.comision_cierre ?? 0)} del abono del primer mes, y desde el segundo mes ${pct(
        r.comision_cartera ?? 0
      )} del abono todos los meses mientras siga. Si la cerraron entre dos, cada uno cobra la mitad.`
    );
    if ((r.comision_servicio_extra ?? 0) > 0) {
      out.push(`Por cada servicio extra que le vendés a un cliente activo: ${pct(r.comision_servicio_extra ?? 0)} de una sola vez.`);
    }
  }
  if (areas.has("Coordinación")) {
    out.push(`${pct(r.comision_coordinacion ?? 0)} del abono de gestión de redes de cada cuenta que coordinás, todos los meses.`);
  }
  if (areas.has("Coordinación de Diseño")) {
    out.push(`${pct(r.comision_direccion_creativa ?? 0)} del abono de gestión de redes de cada cuenta que dirigís, todos los meses.`);
  }
  if (areas.has("Coordinación General") && (r.comision_coord_general ?? 0) > 0) {
    out.push(`${pct(r.comision_coord_general ?? 0)} de lo que facturan los clientes, todos los meses.`);
  }
  if (roles.has("web") || roles.has("botly") || areas.has("Desarrollo Web") || areas.has("Botly")) {
    out.push("Por proyecto: 70% para quien lo hace y 30% para la agencia.");
  }
  return out;
}

/** El próximo día de cobro (el 7) y qué mes se paga ese día. */
export function proximoCobro(hoy: string): { fecha: string; periodo: string } {
  const y = +hoy.slice(0, 4);
  const m = +hoy.slice(5, 7);
  const d = +hoy.slice(8, 10);
  // Antes del 7 se paga el mes anterior; desde el 7, el mes en curso se paga el 7 del que viene.
  const [py, pm] = d < 7 ? [y, m] : m === 12 ? [y + 1, 1] : [y, m + 1];
  const [ty, tm] = pm === 1 ? [py - 1, 12] : [py, pm - 1];
  return { fecha: `${py}-${String(pm).padStart(2, "0")}-07`, periodo: `${ty}-${String(tm).padStart(2, "0")}` };
}
