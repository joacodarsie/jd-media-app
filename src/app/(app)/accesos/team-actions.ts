"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { FEATURES, type Feature } from "@/lib/permissions";
import { defaultPermisosForRoles } from "@/lib/role-defaults";
import type { UserRole } from "@/lib/types";
import { invalidateUsersCache } from "@/lib/cache";

function invalidate() {
  revalidatePath("/accesos");
  revalidatePath("/equipo/personas");
  invalidateUsersCache();
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
  // Guardar tambien en plaintext para que el admin pueda recuperarla despues.
  // Si la columna no existe (migration 0050 no aplicada), ignoramos silencio.
  const sb = createClient();
  await sb
    .from("users")
    .update({ password_visible: newPassword })
    .eq("id", userId)
    .then(
      () => undefined,
      () => undefined
    );
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

/** Actualiza los permisos granulares de un usuario. */
export async function updateUserPermissions(
  userId: string,
  permisos: Partial<Record<Feature, boolean>>
) {
  await requireRole(["admin"]);
  // Filtrar a features válidas
  const sanitized: Record<string, boolean> = {};
  for (const f of FEATURES) {
    if (permisos[f] === true) sanitized[f] = true;
    // si es false o undefined, lo omitimos (default = no tiene)
  }
  const sb = createClient();
  const { error } = await sb
    .from("users")
    .update({ permisos: sanitized })
    .eq("id", userId);
  if (error) return { error: error.message };
  invalidate();
  return { ok: true };
}

/**
 * Cambia el rol/área (primario y secundario) de un usuario ya creado. Suma los
 * permisos por defecto de los roles a los que ya tiene (ADITIVO: nunca le saca
 * accesos otorgados a mano). Para cuando alguien pasa a cumplir 2 funciones.
 */
export async function updateUserRoles(
  userId: string,
  input: {
    rol: string;
    area: string;
    rolSecundario?: string | null;
    areaSecundaria?: string | null;
  }
) {
  await requireRole(["admin"]);
  if (!input.rol || !input.area) return { error: "Falta el rol o el área." };
  const rolSecundario =
    input.rolSecundario && input.rolSecundario !== input.rol ? input.rolSecundario : null;
  const areaSecundaria =
    input.areaSecundaria && input.areaSecundaria !== input.area ? input.areaSecundaria : null;

  const sb = createClient();
  // Traer permisos actuales para sumarle (no pisar) los defaults de los roles.
  const { data: cur } = await sb
    .from("users")
    .select("permisos")
    .eq("id", userId)
    .maybeSingle();
  const permisos: Record<string, boolean> = {
    ...(((cur as { permisos?: Record<string, boolean> } | null)?.permisos) ?? {}),
    ...defaultPermisosForRoles([input.rol as UserRole, rolSecundario as UserRole | null]),
  };

  const { error } = await sb
    .from("users")
    .update({
      rol: input.rol,
      area: input.area,
      rol_secundario: rolSecundario,
      area_secundaria: areaSecundaria,
      permisos,
    })
    .eq("id", userId);
  if (error) return { error: error.message };
  invalidate();
  return { ok: true as const };
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
  rolSecundario?: string | null;
  areaSecundaria?: string | null;
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
  // El secundario no puede repetir el primario (sería redundante).
  const rolSecundario =
    input.rolSecundario && input.rolSecundario !== input.rol ? input.rolSecundario : null;
  const areaSecundaria =
    input.areaSecundaria && input.areaSecundaria !== input.area
      ? input.areaSecundaria
      : null;
  const admin = createAdmin();
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email,
    password: input.password,
    email_confirm: true,
    user_metadata: { nombre: input.nombre },
  });
  if (cErr || !created.user) return { error: cErr?.message ?? "No se pudo crear" };

  const sb = createClient();
  // Auto-asignar features default segun rol (admin siempre tiene todas via codigo).
  // Si tiene rol secundario, suma también los defaults de ese rol.
  const permisos = defaultPermisosForRoles([
    input.rol as UserRole,
    rolSecundario as UserRole | null,
  ]);
  // OJO: el trigger `handle_new_user` ya crea la fila en public.users al crear el
  // auth user (con rol 'creativa' por defecto). Por eso usamos UPSERT: pisamos esa
  // fila con el rol/area/permisos reales en vez de un INSERT que chocaría con
  // users_pkey. Guardamos la pass en plaintext para que el admin la pueda ver;
  // si la columna password_visible no existe (migration 0050), reintentamos sin
  // ese campo asi no se rompe el alta.
  let uErr;
  {
    const row = {
      id: created.user.id,
      nombre: input.nombre.trim(),
      email,
      rol: input.rol,
      area: input.area,
      rol_secundario: rolSecundario,
      area_secundaria: areaSecundaria,
      activo: true,
      permisos,
    };
    const res = await sb
      .from("users")
      .upsert({ ...row, password_visible: input.password }, { onConflict: "id" });
    uErr = res.error;
    if (uErr && /password_visible/i.test(uErr.message)) {
      // Reintentar sin password_visible
      const res2 = await sb.from("users").upsert(row, { onConflict: "id" });
      uErr = res2.error;
    }
  }
  if (uErr) {
    // rollback en auth si falla la fila de profile
    await admin.auth.admin.deleteUser(created.user.id);
    return { error: uErr.message };
  }
  invalidate();
  return { ok: true, id: created.user.id };
}
