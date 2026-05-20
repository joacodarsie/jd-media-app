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

export interface PersonalInput {
  fecha_ingreso: string | null;
  telefono: string | null;
  dni_cuit: string | null;
  cbu: string | null;
  alias_cbu: string | null;
  titular_cuenta: string | null;
  notas_personales: string | null;
}

/** Solo admin o el propio user pueden actualizar. */
export async function updatePersonalInfo(targetUserId: string, input: PersonalInput) {
  const { supabase, userId } = await ctx();

  // Verificar permisos: admin o el propio user
  const { data: me } = await supabase
    .from("users")
    .select("rol")
    .eq("id", userId)
    .single();
  const isAdmin = me?.rol === "admin";
  const isSelf = userId === targetUserId;
  if (!isAdmin && !isSelf) {
    return { error: "Sin permiso" };
  }

  const payload = {
    fecha_ingreso: input.fecha_ingreso || null,
    telefono: input.telefono?.trim() || null,
    dni_cuit: input.dni_cuit?.trim() || null,
    cbu: input.cbu?.trim() || null,
    alias_cbu: input.alias_cbu?.trim() || null,
    titular_cuenta: input.titular_cuenta?.trim() || null,
    notas_personales: input.notas_personales?.trim() || null,
  };
  const { error } = await supabase.from("users").update(payload).eq("id", targetUserId);
  if (error) return { error: error.message };
  revalidatePath(`/equipo/persona/${targetUserId}`);
  revalidatePath("/mi-perfil");
  return { ok: true };
}
