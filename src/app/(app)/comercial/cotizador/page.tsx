import { redirect } from "next/navigation";
import { requireUser, userHas } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { mergeSettings, type AgencySettings, type PackName } from "@/lib/coordinacion";
import { costoDeItems, precioSinPerdidaPrimerMes } from "@/lib/finanzas/cotizador";
import {
  DESCUENTO_SIN_PAUTA,
  IDS_PACKS,
  type MinimosPorPack,
  type PackComercial,
  type ServicioComercial,
} from "@/lib/comercial/cotizador-comercial";
import { CotizadorComercial } from "@/components/cotizador-comercial";

export const dynamic = "force-dynamic";

const COMERCIAL_ROLES = ["admin", "coordinador", "comercial", "prospecting"];

/**
 * Cotizador del área comercial.
 *
 * Versión simple del de Coordinación, para los que salen a vender. No muestra
 * cuánto se le paga al equipo ni el margen: muestra el precio de lista, el
 * descuento, el total y la comisión. El único dato que sale del costo es el
 * TOPE de descuento, y se calcula acá en el servidor: al navegador no viajan
 * las tarifas del equipo, solo el número final de cada pack.
 */
export default async function CotizadorComercialPage() {
  const me = await requireUser();
  const rolOk =
    COMERCIAL_ROLES.includes(me.rol) ||
    (!!me.rol_secundario && COMERCIAL_ROLES.includes(me.rol_secundario));
  if (!rolOk && !userHas(me, "comercial")) redirect("/dashboard");

  const { data: raw } = await createAdmin()
    .from("agency_settings")
    .select("packs, rates, precios_referencia")
    .eq("id", 1)
    .maybeSingle();
  const settings = mergeSettings(raw as Partial<AgencySettings> | null);
  const rates = settings.rates;

  const stories: Record<string, number> = {};
  for (const r of settings.preciosReferencia) {
    const m = r.nota?.match(/(\d+)\s*días de historias/);
    if (m) stories[r.id] = Number(m[1]);
  }

  const packs: PackComercial[] = settings.packs.map((p) => ({
    id: p.id,
    precio: p.precio,
    reels: p.reels,
    posts: p.posts,
    stories:
      (p as { stories?: number }).stories ?? stories[`redes_${p.id.toLowerCase()}`] ?? 0,
  }));

  // El mínimo de la gestión de cada pack, con y sin pauta: el precio con el
  // que el primer mes da cero, comisión del que cierra incluida.
  const minimos: MinimosPorPack = {};
  for (const p of settings.packs) {
    const base = {
      reels: p.reels,
      piezas: p.posts,
      portadas: p.portadas,
      cm: p.id as PackName,
      manualMarca: true,
      otros: 0,
    };
    const conPauta = precioSinPerdidaPrimerMes(costoDeItems({ ...base, mediaBuyer: p.id }, rates), rates);
    const sinPauta = precioSinPerdidaPrimerMes(costoDeItems({ ...base, mediaBuyer: null }, rates), rates);
    minimos[p.id] = {
      conPauta: conPauta ?? p.precio,
      sinPauta: sinPauta ?? p.precio - DESCUENTO_SIN_PAUTA,
    };
  }

  const servicios: ServicioComercial[] = settings.preciosReferencia
    .filter((r) => !IDS_PACKS.includes(r.id))
    .map((r) => ({ id: r.id, nombre: r.nombre, precio: r.precio, nota: r.nota }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Cotizador</h1>
        <p className="max-w-2xl text-muted-foreground">
          Armá la propuesta y mirá cuánto paga el cliente y cuánto cobrás vos. El descuento tiene
          un tope: por debajo, la cuenta pierde plata el primer mes.
        </p>
      </div>
      <CotizadorComercial
        packs={packs}
        servicios={servicios}
        minimos={minimos}
        pctCierre={rates.comision_cierre ?? 0}
        pctCartera={rates.comision_cartera ?? 0}
      />
    </div>
  );
}
