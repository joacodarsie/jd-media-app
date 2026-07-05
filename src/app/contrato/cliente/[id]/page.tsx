import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { mergeSettings } from "@/lib/coordinacion";
import { fetchClauseOverrides } from "@/lib/contract-clauses-server";
import type { ClientService } from "@/lib/types";
import { ContractDocument, type ContractModel } from "@/components/contract-document";

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

export default async function CartaAcuerdoPage({
  params,
}: {
  params: { id: string };
}) {
  await requireUser();
  const supabase = createClient();
  const admin = createAdmin();

  const [{ data: client }, { data: services }, { data: settingsRow }] =
    await Promise.all([
      supabase
        .from("clients")
        .select(
          "id, nombre, contacto_nombre, contacto_dni_cuit, contacto_domicilio, contacto_email, contrato_numero, contrato_fecha_inicio, contrato_plazo_meses, contrato_dia_cobro, contrato_moneda, contrato_descuento_pct, contrato_descuento_monto, contrato_descuento_meses, contrato_observaciones"
        )
        .eq("id", params.id)
        .maybeSingle(),
      supabase
        .from("client_services")
        .select("*")
        .eq("cliente_id", params.id)
        .eq("activo", true)
        .order("tipo"),
      admin.from("agency_settings").select("packs, rates").eq("id", 1).maybeSingle(),
    ]);

  if (!client) notFound();
  const c = client as ClientFull;
  const svc = (services ?? []) as ClientService[];
  const moneda = c.contrato_moneda ?? "ARS";

  const model: ContractModel = {
    numero: c.contrato_numero,
    fechaInicio: c.contrato_fecha_inicio,
    plazoMeses: c.contrato_plazo_meses ?? 3,
    diaCobro: c.contrato_dia_cobro ?? 1,
    moneda,
    observaciones: c.contrato_observaciones,
    puestaEnMarcha: mergeSettings(settingsRow).rates.puesta_en_marcha ?? 0,
    titular: {
      nombre: c.contacto_nombre ?? c.nombre,
      dni_cuit: c.contacto_dni_cuit,
      domicilio: c.contacto_domicilio,
      email: c.contacto_email,
    },
    marcas: [
      {
        nombre: c.nombre,
        services: svc,
        moneda,
        descuento: {
          pct: Number(c.contrato_descuento_pct) || 0,
          monto: Number(c.contrato_descuento_monto) || 0,
          meses: Number(c.contrato_descuento_meses) || 0,
        },
      },
    ],
    backHref: `/clientes/${c.id}/onboarding`,
    clauseOverrides: await fetchClauseOverrides(admin),
  };

  return <ContractDocument model={model} />;
}
