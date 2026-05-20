import { redirect } from "next/navigation";
import { createClient } from "./supabase/server";
import type { AppUser } from "./types";

/** Devuelve el perfil del usuario logueado o redirige a /login. */
export async function requireUser(): Promise<AppUser> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/login");
  return profile as AppUser;
}

export function isStaff(rol: string) {
  return rol === "admin" || rol === "coordinador";
}

/** Redirige al dashboard si el rol no está permitido. */
export async function requireRole(roles: string[]): Promise<AppUser> {
  const user = await requireUser();
  if (!roles.includes(user.rol)) redirect("/dashboard");
  return user;
}
