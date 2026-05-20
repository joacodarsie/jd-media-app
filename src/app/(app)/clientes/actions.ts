"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function ctx() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  return { supabase, userId: user.id };
}

export interface ClientInput {
  nombre: string;
  rubro: string | null;
  pack: string;
  estado: string;
  creativa_asignada_id: string | null;
  fecha_inicio: string | null;
  monto_mensual: number | null;
  calendario_url: string | null;
  drive_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
  web_url: string | null;
  datos_facturacion: string | null;
  notion_url: string | null;
  contacto_nombre: string | null;
  contacto_email: string | null;
  contacto_telefono: string | null;
  notas: string | null;
}

function clean(input: ClientInput) {
  return {
    nombre: input.nombre.trim(),
    rubro: input.rubro?.trim() || null,
    pack: input.pack,
    estado: input.estado,
    creativa_asignada_id: input.creativa_asignada_id || null,
    fecha_inicio: input.fecha_inicio || null,
    monto_mensual:
      input.monto_mensual === null || Number.isNaN(input.monto_mensual)
        ? null
        : input.monto_mensual,
    calendario_url: input.calendario_url?.trim() || null,
    drive_url: input.drive_url?.trim() || null,
    instagram_url: input.instagram_url?.trim() || null,
    facebook_url: input.facebook_url?.trim() || null,
    web_url: input.web_url?.trim() || null,
    datos_facturacion: input.datos_facturacion?.trim() || null,
    notion_url: input.notion_url?.trim() || null,
    contacto_nombre: input.contacto_nombre?.trim() || null,
    contacto_email: input.contacto_email?.trim() || null,
    contacto_telefono: input.contacto_telefono?.trim() || null,
    notas: input.notas?.trim() || null,
  };
}

export async function createClientRow(input: ClientInput) {
  const { supabase } = await ctx();
  const { data, error } = await supabase
    .from("clients")
    .insert(clean(input))
    .select("id")
    .single();
  if (error) return { error: error.message };
  revalidatePath("/clientes");
  return { ok: true, id: data.id };
}

export async function updateClientRow(id: string, input: ClientInput) {
  const { supabase } = await ctx();
  const { error } = await supabase.from("clients").update(clean(input)).eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/clientes");
  revalidatePath(`/clientes/${id}`);
  return { ok: true };
}

export async function deleteClientRow(id: string) {
  const { supabase } = await ctx();
  const { error } = await supabase.from("clients").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/clientes");
  return { ok: true };
}
