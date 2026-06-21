import { NextResponse } from "next/server";
import { createAdmin } from "@/lib/supabase/admin";
import {
  tiktokConfigured,
  verifyState,
  exchangeCode,
  getUserInfo,
} from "@/lib/tiktok";

/**
 * Callback de OAuth de TikTok. Lo abre el navegador del CLIENTE (que autorizó su
 * cuenta), por eso es público: NO depende de la sesión de la app. La seguridad
 * está en el `state` firmado (HMAC con el client_secret), que ata el code a un
 * cliente concreto y vence a los 30 minutos.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state");
  const error = searchParams.get("error");

  // Página simple de resultado (el cliente no está logueado en la app).
  const done = (ok: boolean, msg: string) =>
    new NextResponse(
      `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
       <div style="font-family:system-ui;max-width:420px;margin:80px auto;text-align:center;padding:0 20px">
         <div style="font-size:40px">${ok ? "✅" : "⚠️"}</div>
         <h2 style="margin:12px 0 4px">${ok ? "TikTok conectado" : "No se pudo conectar"}</h2>
         <p style="color:#666">${msg}</p>
         <p style="color:#999;font-size:13px;margin-top:24px">Ya podés cerrar esta ventana.</p>
       </div>`,
      { status: ok ? 200 : 400, headers: { "content-type": "text/html; charset=utf-8" } }
    );

  if (!tiktokConfigured()) return done(false, "La integración de TikTok no está configurada.");
  if (error) return done(false, `TikTok devolvió un error: ${error}`);
  if (!code || !stateRaw) return done(false, "Faltan datos en la respuesta de TikTok.");

  const st = verifyState(stateRaw);
  if (!st) return done(false, "El link expiró o no es válido. Pedí uno nuevo a la agencia.");

  try {
    const tokens = await exchangeCode(code);
    const info = await getUserInfo(tokens.access_token);

    const admin = createAdmin();
    const now = Date.now();
    const { error: upErr } = await admin.from("client_tiktok_accounts").upsert(
      {
        cliente_id: st.clienteId,
        open_id: tokens.open_id || info.open_id,
        username: info.username,
        display_name: info.display_name,
        avatar_url: info.avatar_url,
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
        token_expires_at: new Date(now + tokens.expires_in * 1000).toISOString(),
        refresh_expires_at: new Date(now + tokens.refresh_expires_in * 1000).toISOString(),
        scope: tokens.scope,
        connected_at: new Date().toISOString(),
      },
      { onConflict: "cliente_id" }
    );
    if (upErr) throw upErr;

    return done(true, `Quedó vinculada la cuenta ${info.username ? "@" + info.username : ""}.`);
  } catch (e) {
    console.error("TikTok callback error:", e);
    return done(false, "Hubo un problema al guardar la conexión. Probá de nuevo.");
  }
}
