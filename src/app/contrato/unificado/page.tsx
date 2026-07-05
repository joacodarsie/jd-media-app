import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { mergeSettings } from "@/lib/coordinacion";
import { fetchClauseOverrides } from "@/lib/contract-clauses-server";
import type { ClientService } from "@/lib/types";
import {
  ContractDocument,
  type ContractMarca,
  type ContractModel,
} from "@/components/contract-document";

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
  contrato_descuento_monto: number | null;
  contrato_descuento_meses: number | null;
  contrato_observaciones: string | null;
}

/**
 * Carta acuerdo UNIFICADA: una sola carta para varias marcas/cuentas del mismo
 * titular. Se llega con ?ids=id1,id2[,id3]. Los datos del titular y las
 * condiciones (nº, fecha, plazo, día de cobro) salen de la primera cuenta;
 * cada marca aporta sus servicios y su descuento.
 */
export default async function CartaUnificadaPage({
  searchParams,
}: {
  searchParams: { ids?: string };
}) {
  await requireUser();

  const ids = (searchParams.ids ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length < 2) notFound();

  const supabase = createClient();
  const admin = createAdmin();

  const [{ data: clientsRaw }, { data: servicesRaw }, { data: settingsRow }] =
    await Promise.all([
      supabase
        .from("clients")
        .select(
          "id, nombre, contacto_nombre, contacto_dni_cuit, contacto_domicilio, contacto_email, contrato_numero, contrato_fecha_inicio, contrato_plazo_meses, contrato_dia_cobro, contrato_moneda, contrato_descuento_pct, contrato_descuento_monto, contrato_descuento_meses, contrato_observaciones"
        )
        .in("id", ids),
      supabase
        .from("client_services")
        .select("*")
        .in("cliente_id", ids)
        .eq("activo", true)
        .order("tipo"),
      admin.from("agency_settings").select("packs, rates").eq("id", 1).maybeSingle(),
    ]);

  const clients = (clientsRaw ?? []) as ClientFull[];
  if (clients.length < 2) notFound();

  // Respetar el orden en que vinieron los ids (la cuenta desde la que se generó
  // queda primera y define las condiciones comunes).
  const byId = new Map(clients.map((c) => [c.id, c]));
  const ordered = ids.map((id) => byId.get(id)).filter(Boolean) as ClientFull[];
  const primary = ordered[0];
  const moneda = primary.contrato_moneda ?? "ARS";

  const servicesByClient = new Map<string, ClientService[]>();
  for (const s of (servicesRaw ?? []) as ClientService[]) {
    const cid = (s as { cliente_id: string }).cliente_id;
    if (!servicesByClient.has(cid)) servicesByClient.set(cid, []);
    servicesByClient.get(cid)!.push(s);
  }

  const marcas: ContractMarca[] = ordered.map((c) => ({
    nombre: c.nombre,
    services: servicesByClient.get(c.id) ?? [],
    moneda: c.contrato_moneda ?? moneda,
    descuento: {
      pct: Number(c.contrato_descuento_pct) || 0,
      monto: Number(c.contrato_descuento_monto) || 0,
      meses: Number(c.contrato_descuento_meses) || 0,
    },
  }));

  const model: ContractModel = {
    numero: primary.contrato_numero,
    fechaInicio: primary.contrato_fecha_inicio,
    plazoMeses: primary.contrato_plazo_meses ?? 3,
    diaCobro: primary.contrato_dia_cobro ?? 1,
    moneda,
    observaciones: primary.contrato_observaciones,
    puestaEnMarcha: mergeSettings(settingsRow).rates.puesta_en_marcha ?? 0,
    titular: {
      nombre: primary.contacto_nombre ?? primary.nombre,
      dni_cuit: primary.contacto_dni_cuit,
      domicilio: primary.contacto_domicilio,
      email: primary.contacto_email,
    },
    marcas,
    backHref: `/clientes/${primary.id}/onboarding`,
    clauseOverrides: await fetchClauseOverrides(admin),
  };

  return <ContractDocument model={model} />;
}
