/**
 * Google Calendar OAuth + Events helpers.
 * Usado solo desde server-side (API routes). Tokens nunca se exponen al client.
 */
import { createAdmin } from "./supabase/admin";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const CALENDAR_API = "https://www.googleapis.com/calendar/v3";

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export interface GoogleCalendarConnection {
  id: string;
  owner_user_id: string;
  label: string;
  visibility: "private" | "shared";
  google_email: string;
  access_token: string;
  refresh_token: string;
  token_expiry: string;
  scope: string;
}

export interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  isAllDay: boolean;
  hangoutLink?: string;
  htmlLink?: string;
  location?: string;
  organizer?: { email?: string; displayName?: string; self?: boolean };
  attendees?: { email: string; displayName?: string; responseStatus?: string }[];
  status?: string; // "confirmed" | "tentative" | "cancelled"
  source_id: string;
  source_label: string;
  source_email: string;
  source_visibility: "private" | "shared";
}

function env(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Falta env var ${name}`);
  return v;
}

export function buildAuthUrl(state: string, redirectUri?: string) {
  const params = new URLSearchParams({
    client_id: env("GOOGLE_CLIENT_ID"),
    redirect_uri: redirectUri ?? env("GOOGLE_REDIRECT_URI"),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, redirectUri?: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      redirect_uri: redirectUri ?? env("GOOGLE_REDIRECT_URI"),
      grant_type: "authorization_code",
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Google token exchange falló: ${res.status} ${txt}`);
  }
  return (await res.json()) as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    scope: string;
    token_type: string;
  };
}

export async function fetchGoogleEmail(accessToken: string): Promise<string> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error("No se pudo obtener email de Google");
  const json = (await res.json()) as { email: string };
  return json.email;
}

async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: env("GOOGLE_CLIENT_ID"),
      client_secret: env("GOOGLE_CLIENT_SECRET"),
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Refresh token falló: ${res.status} ${txt}`);
  }
  return (await res.json()) as {
    access_token: string;
    expires_in: number;
    scope: string;
  };
}

/** Devuelve un access_token vigente, refrescando si está cerca de expirar. */
async function getValidAccessToken(conn: GoogleCalendarConnection): Promise<string> {
  const expiry = new Date(conn.token_expiry).getTime();
  const now = Date.now();
  if (expiry - now > 60_000) return conn.access_token;

  const refreshed = await refreshAccessToken(conn.refresh_token);
  const newExpiry = new Date(now + refreshed.expires_in * 1000).toISOString();
  const admin = createAdmin();
  await admin
    .from("google_calendar_connections")
    .update({
      access_token: refreshed.access_token,
      token_expiry: newExpiry,
    })
    .eq("id", conn.id);
  return refreshed.access_token;
}

export async function listConnectionsForUser(userId: string): Promise<GoogleCalendarConnection[]> {
  const admin = createAdmin();
  const { data, error } = await admin
    .from("google_calendar_connections")
    .select("*")
    .or(`owner_user_id.eq.${userId},visibility.eq.shared`)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as GoogleCalendarConnection[];
}

export async function listEvents(
  conn: GoogleCalendarConnection,
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  const token = await getValidAccessToken(conn);
  const url = new URL(`${CALENDAR_API}/calendars/primary/events`);
  url.searchParams.set("timeMin", timeMin);
  url.searchParams.set("timeMax", timeMax);
  url.searchParams.set("singleEvents", "true");
  url.searchParams.set("orderBy", "startTime");
  url.searchParams.set("maxResults", "50");
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`listEvents falló (${conn.google_email}): ${res.status} ${txt}`);
  }
  const json = (await res.json()) as {
    items?: Array<{
      id: string;
      summary?: string;
      description?: string;
      start?: { dateTime?: string; date?: string };
      end?: { dateTime?: string; date?: string };
      hangoutLink?: string;
      htmlLink?: string;
      location?: string;
      status?: string;
      organizer?: { email?: string; displayName?: string; self?: boolean };
      attendees?: { email: string; displayName?: string; responseStatus?: string }[];
    }>;
  };
  return (json.items ?? [])
    .filter((e) => e.start?.dateTime || e.start?.date)
    .map((e) => ({
      id: e.id,
      summary: e.summary ?? "(Sin título)",
      description: e.description,
      start: e.start!.dateTime ?? e.start!.date!,
      end: e.end?.dateTime ?? e.end?.date ?? e.start!.dateTime ?? e.start!.date!,
      isAllDay: !e.start!.dateTime,
      hangoutLink: e.hangoutLink,
      htmlLink: e.htmlLink,
      location: e.location,
      status: e.status,
      organizer: e.organizer,
      attendees: e.attendees,
      source_id: conn.id,
      source_label: conn.label,
      source_email: conn.google_email,
      source_visibility: conn.visibility,
    }));
}

export async function listEventsForUser(
  userId: string,
  timeMin: string,
  timeMax: string
): Promise<CalendarEvent[]> {
  const conns = await listConnectionsForUser(userId);
  const all = await Promise.all(
    conns.map((c) =>
      listEvents(c, timeMin, timeMax).catch((err) => {
        console.error(`Calendar ${c.google_email}:`, err);
        return [] as CalendarEvent[];
      })
    )
  );
  return all.flat().sort((a, b) => a.start.localeCompare(b.start));
}
