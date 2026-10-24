/**
 * Qué funciona en una cuenta, contra Instagram (24/10/2026). Trae sus últimas
 * 100 publicaciones públicas (business discovery desde la cuenta de JD Media)
 * y las analiza con `queFunciona`. Se guarda un día en caché: no cambia de una
 * hora a otra y cada consulta gasta cupo de la API de Meta.
 */
import { unstable_cache } from "next/cache";
import { createAdmin } from "@/lib/supabase/admin";
import { usuarioDe } from "@/lib/diagnostico/puntaje";
import { cuentaConHistorial } from "@/lib/diagnostico/instagram-publico";
import { hoyYmd } from "@/lib/dates";
import { queFunciona, type QueFunciona } from "./que-funciona";

export type ResultadoQueFunciona = { ok: true; datos: QueFunciona; usuario: string } | { ok: false; motivo: string };

async function calcular(clienteId: string): Promise<ResultadoQueFunciona> {
  const admin = createAdmin();
  const [{ data: c }, { data: base }] = await Promise.all([
    admin.from("clients").select("instagram_url").eq("id", clienteId).maybeSingle(),
    admin.from("clients").select("ig_user_id").not("ig_user_id", "is", null).ilike("nombre", "jd media").limit(1).maybeSingle(),
  ]);
  const usuario = (c as { instagram_url: string | null } | null)?.instagram_url ? usuarioDe((c as { instagram_url: string }).instagram_url) : null;
  if (!usuario) return { ok: false, motivo: "La cuenta no tiene cargado su Instagram en la ficha." };
  const desde = (base as { ig_user_id: string } | null)?.ig_user_id;
  if (!desde) return { ok: false, motivo: "Falta conectar el Instagram de JD Media." };
  try {
    const cuenta = await cuentaConHistorial(desde, usuario, { paginasMax: 2 });
    return { ok: true, usuario, datos: queFunciona(cuenta.historial, hoyYmd()) };
  } catch {
    return { ok: false, motivo: `No pudimos leer @${usuario}: tiene que ser una cuenta de empresa o creador, y pública.` };
  }
}

export function cargarQueFunciona(clienteId: string): Promise<ResultadoQueFunciona> {
  return unstable_cache(() => calcular(clienteId), ["que-funciona-v1", clienteId], { revalidate: 86_400 })();
}
