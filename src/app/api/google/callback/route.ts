import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { exchangeCodeForTokens, fetchGoogleEmail } from "@/lib/google-calendar";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const stateRaw = searchParams.get("state");
  const error = searchParams.get("error");

  const redirectBack = (msg: string) =>
    NextResponse.redirect(new URL(`/mi-perfil?calendar=${encodeURIComponent(msg)}`, req.url));

  if (error) return redirectBack(`error:${error}`);
  if (!code || !stateRaw) return redirectBack("error:missing_code");

  let state: { u: string; v: "private" | "shared"; l: string };
  try {
    state = JSON.parse(Buffer.from(stateRaw, "base64url").toString());
  } catch {
    return redirectBack("error:bad_state");
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || user.id !== state.u) return redirectBack("error:auth");

  try {
    const tokens = await exchangeCodeForTokens(code);
    const googleEmail = await fetchGoogleEmail(tokens.access_token);
    const expiry = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

    const admin = createAdmin();
    const { error: upErr } = await admin
      .from("google_calendar_connections")
      .upsert(
        {
          owner_user_id: user.id,
          label: state.l,
          visibility: state.v,
          google_email: googleEmail,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expiry: expiry,
          scope: tokens.scope,
        },
        { onConflict: "owner_user_id,google_email" }
      );
    if (upErr) throw upErr;

    return redirectBack(`ok:${googleEmail}`);
  } catch (e) {
    console.error("Google callback error:", e);
    return redirectBack("error:exchange");
  }
}
