"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";

type ActionResult<T = unknown> = { ok: true; data?: T } | { ok: false; error: string };

function genToken(): string {
  // 32 chars hex = 128 bits de entropía. Suficiente.
  return randomBytes(16).toString("hex");
}

/**
 * Genera un token nuevo para el portal del cliente.
 * Si ya hay uno activo, lo revoca antes (un solo activo a la vez).
 */
export async function generateClientPortalToken(
  clienteId: string
): Promise<ActionResult<{ token: string }>> {
  const user = await requireUser();
  const admin = createAdmin();

  // Revocar tokens activos previos
  await admin
    .from("client_portal_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("cliente_id", clienteId)
    .is("revoked_at", null);

  const token = genToken();
  const { error } = await admin.from("client_portal_tokens").insert({
    cliente_id: clienteId,
    token,
    created_by: user.id,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath(`/clientes/${clienteId}`);
  return { ok: true, data: { token } };
}

/**
 * Revoca el token activo del cliente. El link deja de funcionar.
 */
export async function revokeClientPortalToken(
  clienteId: string
): Promise<ActionResult> {
  await requireUser();
  const admin = createAdmin();

  const { error } = await admin
    .from("client_portal_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("cliente_id", clienteId)
    .is("revoked_at", null);

  if (error) return { ok: false, error: error.message };
  revalidatePath(`/clientes/${clienteId}`);
  return { ok: true };
}
