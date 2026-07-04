"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";

interface ContractData {
  contacto_nombre: string | null;
  contacto_dni_cuit: string | null;
  contacto_domicilio: string | null;
  contrato_numero: string | null;
  contrato_fecha_inicio: string | null;
  contrato_plazo_meses: number | null;
  contrato_dia_cobro: number | null;
  contrato_moneda: string;
  contrato_descuento_pct: number | null;
  contrato_descuento_monto: number | null;
  contrato_descuento_meses: number | null;
  contrato_observaciones: string | null;
}

export async function saveContractData(clientId: string, data: ContractData) {
  await requireUser();
  const admin = createAdmin();
  const { error } = await admin
    .from("clients")
    .update({
      contacto_nombre: data.contacto_nombre,
      contacto_dni_cuit: data.contacto_dni_cuit,
      contacto_domicilio: data.contacto_domicilio,
      contrato_numero: data.contrato_numero,
      contrato_fecha_inicio: data.contrato_fecha_inicio,
      contrato_plazo_meses: data.contrato_plazo_meses,
      contrato_dia_cobro: data.contrato_dia_cobro,
      contrato_moneda: data.contrato_moneda,
      contrato_descuento_pct: data.contrato_descuento_pct,
      contrato_descuento_monto: data.contrato_descuento_monto,
      contrato_descuento_meses: data.contrato_descuento_meses,
      contrato_observaciones: data.contrato_observaciones,
    })
    .eq("id", clientId);
  if (error) return { error: error.message };
  revalidatePath(`/clientes/${clientId}/onboarding`);
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath(`/contrato/cliente/${clientId}`);
  return { ok: true };
}
