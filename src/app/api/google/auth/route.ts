import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { buildAuthUrl } from "@/lib/google-calendar";

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

  // state = userId|visibility|label en base64 url-safe.
  const state = Buffer.from(JSON.stringify({ u: user.id, v: visibility, l: label }))
    .toString("base64url");

  return NextResponse.redirect(buildAuthUrl(state));
}
