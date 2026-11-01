import { createHash, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";

/**
 * El token de la planilla del dueño. No está en Vercel: se compara su sha256
 * con el de `claves_api` (0227). Devuelve null si la clave no está cargada.
 */
export async function planillaAutorizada(req: NextRequest): Promise<boolean | null> {
  const token = req.headers.get("x-planilla-token") ?? req.nextUrl.searchParams.get("token") ?? "";
  if (!token) return false;
  const { data, error } = await createAdmin()
    .from("claves_api")
    .select("sha256")
    .eq("nombre", "planilla_finanzas")
    .maybeSingle();
  if (error || !data) return null;
  const esperado = Buffer.from(String((data as { sha256: string }).sha256), "hex");
  const recibido = createHash("sha256").update(token).digest();
  return esperado.length === recibido.length && timingSafeEqual(esperado, recibido);
}
