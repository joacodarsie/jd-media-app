"use server";

import { requireUser } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";

/** Los clientes activos, para elegir quién recomendó en «¿De dónde vino?». */
export async function clientesQueRecomiendan(): Promise<string[]> {
  await requireUser();
  const { data } = await createAdmin()
    .from("clients")
    .select("nombre")
    .eq("estado", "activo")
    .eq("es_interno", false)
    .order("nombre");
  return ((data ?? []) as { nombre: string }[]).map((c) => c.nombre);
}
