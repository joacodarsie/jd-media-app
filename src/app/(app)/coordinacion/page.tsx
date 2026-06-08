import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import {
  mergeSettings,
  productionCost,
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
        .select("cliente_id, tipo, pack, monto_mensual, facturacion, pack_detalle, activo")
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
    let costo = 0;
    let packLabel = "—";
    if (gestion) {
      const pack = (gestion.pack ?? "Personalizado") as RatePack;
      packLabel = pack;
      let posts = 0;
      let reels = 0;
      const std = packQty.get(pack as never);
      if (std) {
        posts = std.posts;
        reels = std.reels;
      } else {
        const pd = (gestion.pack_detalle ?? {}) as Record<string, number>;
        posts = Number(pd.posts ?? 0);
        reels = Number(pd.reels ?? 0);
      }
      costo = productionCost(pack, posts, reels, settings.rates);
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
