import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { listEventsForUser } from "@/lib/google-calendar";

export async function GET(req: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const defaultEnd = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const timeMin = searchParams.get("from") ?? now.toISOString();
  const timeMax = searchParams.get("to") ?? defaultEnd.toISOString();

  try {
    const events = await listEventsForUser(user.id, timeMin, timeMax);
    return NextResponse.json({ events });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
