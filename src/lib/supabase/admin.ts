/**
 * Cliente Supabase con SERVICE ROLE — usar SOLO en server actions de admin.
 * Requiere env var SUPABASE_SERVICE_ROLE_KEY.
 *
 * Nunca exponer este client al browser ni en client components.
 */
import { createClient as createAdminClient } from "@supabase/supabase-js";

export function createAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) throw new Error("Falta NEXT_PUBLIC_SUPABASE_URL");
  if (!key) {
    throw new Error(
      "Falta SUPABASE_SERVICE_ROLE_KEY en el server. Agregala en Vercel → Settings → Environment Variables."
    );
  }
  return createAdminClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
