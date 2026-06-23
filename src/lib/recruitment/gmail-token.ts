/**
 * Devuelve un access token de Gmail válido desde la casilla conectada de la
 * agencia (id=1), refrescándolo si está por vencer. Compartido por las rutas de
 * importación de CVs.
 */
import type { createAdmin } from "@/lib/supabase/admin";
import { refreshGmailToken } from "@/lib/gmail";

export async function getValidGmailToken(
  admin: ReturnType<typeof createAdmin>
): Promise<string | null> {
  const { data } = await admin
    .from("gmail_account")
    .select("access_token, refresh_token, token_expires_at")
    .eq("id", 1)
    .maybeSingle();
  if (!data) return null;
  const row = data as {
    access_token: string;
    refresh_token: string;
    token_expires_at: string | null;
  };
  const exp = row.token_expires_at ? new Date(row.token_expires_at).getTime() : 0;
  if (exp > Date.now() + 60_000) return row.access_token;
  const t = await refreshGmailToken(row.refresh_token);
  await admin
    .from("gmail_account")
    .update({
      access_token: t.access_token,
      token_expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
    })
    .eq("id", 1);
  return t.access_token;
}
