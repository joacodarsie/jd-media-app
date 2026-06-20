import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import {
  mergeSettings,
  productionBase,
  mbCost,
  type RatePack,
  type AgencySettings,
} from "@/lib/coordinacion";
import { CoordinacionPanel, type PanoramaRow } from "@/components/coordinacion-panel";

export const dynamic = "force-dynamic";

export default async function CoordinacionPage() {
  await requireRole(["admin"]);
  const admin = createAdmin();

  const [{ data: settingsRow }, { data: clients }, { data: services }] =
    await Promise.all([
      admin.from("agency_settings").select("packs, rates").eq("id", 1).maybeSingle(),
      admin
        .from("clients")
        .select("id, nombre, estado, es_interno")
        .eq("estado", "activo")
        .eq("es_interno", false),
      admin
        .from("client_services")
        .select("cliente_id, tipo, pack, monto_mensual, facturacion, pack_detalle, activo, costo_override")
        .eq("activo", true),
    ]);

  const settings: AgencySettings = mergeSettings(settingsRow);
  const packQty = new Map(settings.packs.map((p) => [p.id, p]));

  // Panorama real: por cada cliente activo (no interno), ingreso mensual
  // recurrente (suma de servicios mensuales) y costo de producción de su
  // gestión de redes según el modelo de tarifas.
  const svcByClient = new Map<string, typeof services>();
  for (const s of services ?? []) {
    if (!svcByClient.has(s.cliente_id)) svcByClient.set(s.cliente_id, []);
    svcByClient.get(s.cliente_id)!.push(s);
  }

  const panorama: PanoramaRow[] = [];
  for (const c of clients ?? []) {
    const svcs = svcByClient.get(c.id) ?? [];
    if (svcs.length === 0) continue;
    const ingreso = svcs
      .filter((s) => s.facturacion !== "unico")
      .reduce((acc, s) => acc + (Number(s.monto_mensual) || 0), 0);

    const gestion = svcs.find((s) => s.tipo === "gestion_redes");
    // Cuentas sin gestión mensual (ej. branding único) no entran en el panorama
    // de ingresos recurrentes.
    if (!gestion && ingreso === 0) continue;
    // La gestión de campañas (media buyer) va incluida en gestión de redes:
    // cuesta en toda cuenta que tenga ese servicio.
    const conPauta = !!gestion;
    let costo = 0;
    let packLabel = "—";
    if (gestion) {
      const pack = (gestion.pack ?? "Personalizado") as RatePack;
      packLabel = pack;
      if (gestion.costo_override != null) {
        // Acuerdo particular (ej. Luz): costo de equipo fijo. La pauta, si la
        // hay, se suma aparte.
        costo = Number(gestion.costo_override) + (conPauta ? mbCost(pack, settings.rates) : 0);
      } else {
        const std = packQty.get(pack as never);
        const pd = (gestion.pack_detalle ?? {}) as Record<string, number>;
        const posts = std ? std.posts : Number(pd.posts ?? 0);
        const reels = std ? std.reels : Number(pd.reels ?? 0);
        costo =
          productionBase(pack, posts, reels, settings.rates) +
          (conPauta ? mbCost(pack, settings.rates) : 0);
      }
    }
    panorama.push({
      id: c.id,
      nombre: c.nombre,
      pack: packLabel,
      ingreso,
      costo,
      margen: ingreso - costo,
    });
  }
  panorama.sort((a, b) => b.margen - a.margen);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Coordinación</h1>
        <p className="text-muted-foreground">
          El centro de control de la agencia: economía de cada pack, simulador de
          escenarios y panorama real con todos los servicios activos. Solo vos
          podés verlo y modificarlo.
        </p>
      </div>
      <CoordinacionPanel initial={settings} panorama={panorama} />
    </div>
  );
}
