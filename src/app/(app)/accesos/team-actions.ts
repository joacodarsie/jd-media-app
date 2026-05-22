"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";

function invalidate() {
  revalidatePath("/accesos");
  revalidatePath("/equipo/personas");
}

/** Cambia el email de un usuario (en auth + en la tabla users). */
export async function updateUserEmail(userId: string, newEmail: string) {
  await requireRole(["admin"]);
  const email = newEmail.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "Email inválido." };
  }
  const admin = createAdmin();
  const { error: aErr } = await admin.auth.admin.updateUserById(userId, {
    email,
    email_confirm: true,
  });
  if (aErr) return { error: aErr.message };
  // Reflejar en tabla users
  const sb = createClient();
  const { error: uErr } = await sb.from("users").update({ email }).eq("id", userId);
  if (uErr) return { error: uErr.message };
  invalidate();
  return { ok: true };
}

/** Setea (resetea) la contraseña de un usuario directamente. */
export async function setUserPassword(userId: string, newPassword: string) {
  await requireRole(["admin"]);
  if (!newPassword || newPassword.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }
  const admin = createAdmin();
  const { error } = await admin.auth.admin.updateUserById(userId, {
    password: newPassword,
  });
  if (error) return { error: error.message };
  invalidate();
  return { ok: true };
}

/** Manda al usuario un mail de "olvidé mi contraseña". */
export async function sendPasswordReset(userId: string) {
  await requireRole(["admin"]);
  const admin = createAdmin();
  // Necesitamos el email
  const sb = createClient();
  const { data: u } = await sb.from("users").select("email").eq("id", userId).maybeSingle();
  if (!u?.email) return { error: "Usuario sin email cargado." };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const { error } = await admin.auth.resetPasswordForEmail(u.email, {
    redirectTo: `${siteUrl}/auth/callback?next=/auth/reset-password`,
  });
  if (error) return { error: error.message };
  return { ok: true };
}

/** Activa o desactiva un usuario en la app (no borra en auth). */
export async function toggleUserActive(userId: string, activo: boolean) {
  await requireRole(["admin"]);
  const sb = createClient();
  const { error } = await sb.from("users").update({ activo }).eq("id", userId);
  if (error) return { error: error.message };
  invalidate();
  return { ok: true };
}

/** Crea un usuario nuevo (auth + perfil). */
export async function inviteNewUser(input: {
  nombre: string;
  email: string;
  rol: string;
  area: string;
  password: string;
}) {
  await requireRole(["admin"]);
  const email = input.email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return { error: "Email inválido." };
  }
  if (!input.password || input.password.length < 8) {
    return { error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (!input.nombre.trim()) {
    return { error: "Falta el nombre." };
  }
  const admin = createAdmin();
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { nombre: input.nombre },
  });
  if (cErr || !created.user) return { error: cErr?.message ?? "No se pudo crear" };

  const sb = createClient();
  const { error: uErr } = await sb.from("users").insert({
    id: created.user.id,
    nombre: input.nombre.trim(),
    email,
    rol: input.rol,
    area: input.area,
    activo: true,
  });
  if (uErr) {
    // rollback en auth si falla la fila de profile
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: uErr.message };
  }
  invalidate();
  return { ok: true, id: created.user.id };
}
