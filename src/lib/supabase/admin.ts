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
    // Next parchea el fetch global y cachea los GET. Con el service role eso es
    // siempre un bug: se leen datos viejos sin que nadie se entere. Pasó con el
    // abono de Magic, que se corrigió en la base y el informe siguió sirviendo
    // el valor anterior.
    global: {
      fetch: (input: RequestInfo | URL, init?: RequestInit) =>
        fetch(input, { ...init, cache: "no-store" }),
    },
  });
}
