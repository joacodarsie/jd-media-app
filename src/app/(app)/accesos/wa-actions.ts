"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Guarda/actualiza el secret que usará Botly para leer la cola. */
export async function setWaSecret(secret: string) {
  await requireRole(["admin"]);
  if (!secret || secret.length < 16) {
    return { error: "El secret debe tener al menos 16 caracteres." };
  }
  const sb = createClient();
  const { error } = await sb
    .from("app_secrets")
    .upsert({ clave: "wa_queue_secret", valor: secret, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };
  revalidatePath("/accesos");
  return { ok: true };
}

/** Genera un secret nuevo aleatorio. */
export async function regenerateWaSecret() {
  await requireRole(["admin"]);
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  const secret = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const sb = createClient();
  const { error } = await sb
    .from("app_secrets")
    .upsert({ clave: "wa_queue_secret", valor: secret, updated_at: new Date().toISOString() });
  if (error) return { error: error.message };
  revalidatePath("/accesos");
  return { ok: true, secret };
}

/** Re-encolar pendientes que hayan quedado en "fallido" muchas veces. */
export async function reenqueueFailed() {
  await requireRole(["admin"]);
  const sb = createClient();
  const { error } = await sb
    .from("notification_queue")
    .update({ status: "pendiente", error_msg: null })
    .eq("status", "fallido");
  if (error) return { error: error.message };
  revalidatePath("/accesos");
  return { ok: true };
}
