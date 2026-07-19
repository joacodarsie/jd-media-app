import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAuthUrl } from "@/lib/google-calendar";
import { DRIVE_SCOPE } from "@/lib/google-drive";

export async function GET(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login", req.url));

  const { searchParams } = new URL(req.url);
  const label = (searchParams.get("label") ?? "").slice(0, 60).trim() || "Mi Calendar";
  const visibilityRaw = searchParams.get("visibility") ?? "private";
  const visibility = visibilityRaw === "shared" ? "shared" : "private";
  // ?drive=1 pide además el scope de Drive (drive.file) para crear las
  // carpetas de clientes desde el onboarding.
  const wantsDrive = searchParams.get("drive") === "1";
  // Adónde volver después del consent (solo paths internos).
  const returnToRaw = searchParams.get("returnTo") ?? "";
  const returnTo =
    returnToRaw.startsWith("/") && !returnToRaw.startsWith("//") ? returnToRaw : null;

  // state = userId|visibility|label|returnTo en base64 url-safe.
  const state = Buffer.from(
    JSON.stringify({ u: user.id, v: visibility, l: label, ...(returnTo ? { r: returnTo } : {}) })
  ).toString("base64url");

  return NextResponse.redirect(buildAuthUrl(state, undefined, wantsDrive ? [DRIVE_SCOPE] : []));
}
